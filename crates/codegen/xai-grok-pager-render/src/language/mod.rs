//! `/language` — simultaneous multi-language keyboard translation streams.
//!
//! Feature id: **fc-language-stream-v1** (fornevercollective)
//!
//! One live keyboard buffer fans out to many streams at once (layout remap,
//! script forms, offline word map, optional `trans` CLI). Same craft as the
//! Memory Glass keyboard/language plane (`KEYBOARD-PLANE.md`) but in-TTY.

use crate::render::safe_buf::SafeBuf;
use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Span;
use ratatui::widgets::{Block, BorderType, Borders, Clear, Widget};
use std::process::Command;
use std::time::{Duration, Instant};

/// Binary stamp / feature id.
pub const FEATURE_ID: &str = "fc-language-stream-v1";
pub const TOAST_OPEN: &str =
    "LANGUAGE · multi-stream keyboard · type · Tab cycle · m mode · o MG plane · Esc";

/// How each column is produced.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StreamKind {
    /// Same physical keys remapped to another layout (qwerty→ru/he/ar…).
    Layout,
    /// Best-effort offline phrase map + optional `trans` CLI.
    Translate,
    /// Codec form (hex / steno / reverse / braille).
    Codec,
}

#[derive(Clone, Debug)]
pub struct LangStream {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: StreamKind,
    pub text: String,
    pub note: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LanguageMode {
    /// All stream kinds visible.
    All,
    /// Layout remaps only.
    Layout,
    /// Translation columns only.
    Translate,
    /// Codec columns only.
    Codec,
}

impl LanguageMode {
    pub fn id(self) -> &'static str {
        match self {
            LanguageMode::All => "all",
            LanguageMode::Layout => "layout",
            LanguageMode::Translate => "translate",
            LanguageMode::Codec => "codec",
        }
    }

    pub fn cycle(self) -> Self {
        match self {
            LanguageMode::All => LanguageMode::Layout,
            LanguageMode::Layout => LanguageMode::Translate,
            LanguageMode::Translate => LanguageMode::Codec,
            LanguageMode::Codec => LanguageMode::All,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LanguageKeyOutcome {
    Close,
    Changed,
}

/// Live multi-stream language keyboard state.
pub struct LanguageState {
    /// Source buffer (what the human types).
    pub source: String,
    pub mode: LanguageMode,
    pub streams: Vec<LangStream>,
    /// Focused stream index (Tab).
    pub focus: usize,
    pub cursor_blink: Instant,
    pub status: String,
    /// When we last attempted `trans` (rate limit).
    last_trans: Instant,
    trans_pending: bool,
}

// ── QWERTY → layout tables (physical key positions) ─────────────────────

const QWERTY: &str = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM";
const RU: &str = "йцукенгшщзфывапролдячсмитьЙЦУКЕНГШЩЗФЫВАПРОЛДЯЧСМИТЬ";
const HE: &str = "ץקראטוןםפשדגכעיחלךזסבהנמצץקראטוןםפשדגכעיחלךזסבהנמצ";
// Simplified Arabic finger-map (demo; not full Arabic keyboard)
const AR: &str = "ضصثقفغعهخحشسيبلاتنمكطئءؤرلاىةوزظضصثقفغعهخحشسيبلاتنمكطئءؤرلاىةوزظ";
const DVORAK: &str = "pyfgcrlAOEUIDHTNSqjkxbmwvzPYFGCRLAOEUIDHTNSQJKXBMWVZ";
const AZERTY: &str = "azertyuiopqsdfghjklmwxcvbnAZERTYUIOPQSDFGHJKLMWXCVBN";

fn map_layout(src: &str, table: &str) -> String {
    let mut out = String::with_capacity(src.len());
    for ch in src.chars() {
        if let Some(i) = QWERTY.find(ch) {
            if let Some(mc) = table.chars().nth(i) {
                out.push(mc);
                continue;
            }
        }
        out.push(ch);
    }
    out
}

/// Tiny offline phrase dictionary (en → target). Not production MT.
fn offline_phrase(en: &str, lang: &str) -> Option<&'static str> {
    let k = en.trim().to_ascii_lowercase();
    let pairs: &[(&str, &str, &str)] = &[
        ("hello", "es", "hola"),
        ("hello", "fr", "bonjour"),
        ("hello", "de", "hallo"),
        ("hello", "pt", "olá"),
        ("hello", "it", "ciao"),
        ("hello", "ja", "こんにちは"),
        ("hello", "zh", "你好"),
        ("hello", "ko", "안녕하세요"),
        ("hello", "ru", "привет"),
        ("hello", "ar", "مرحبا"),
        ("hello", "hi", "नमस्ते"),
        ("thank you", "es", "gracias"),
        ("thank you", "fr", "merci"),
        ("thank you", "de", "danke"),
        ("thank you", "ja", "ありがとう"),
        ("thank you", "zh", "谢谢"),
        ("yes", "es", "sí"),
        ("yes", "fr", "oui"),
        ("yes", "de", "ja"),
        ("no", "es", "no"),
        ("no", "fr", "non"),
        ("no", "de", "nein"),
        ("help", "es", "ayuda"),
        ("help", "fr", "aide"),
        ("help", "de", "hilfe"),
        ("good morning", "es", "buenos días"),
        ("good morning", "fr", "bonjour"),
        ("good morning", "ja", "おはようございます"),
        ("i love you", "es", "te quiero"),
        ("i love you", "fr", "je t'aime"),
        ("i love you", "de", "ich liebe dich"),
        ("i love you", "ja", "愛してる"),
        ("open", "es", "abrir"),
        ("close", "es", "cerrar"),
        ("start", "es", "empezar"),
        ("stop", "es", "parar"),
    ];
    pairs
        .iter()
        .find(|(e, l, _)| *e == k && *l == lang)
        .map(|(_, _, t)| *t)
}

fn word_translate(src: &str, lang: &str) -> String {
    if src.is_empty() {
        return String::new();
    }
    // Whole phrase first
    if let Some(p) = offline_phrase(src, lang) {
        return p.to_string();
    }
    // Word-by-word
    let mut parts = Vec::new();
    for w in src.split_whitespace() {
        let clean = w
            .trim_matches(|c: char| !c.is_alphanumeric() && c != '\'')
            .to_string();
        if let Some(t) = offline_phrase(&clean, lang) {
            // preserve trailing punct
            let punct: String = w.chars().filter(|c| !c.is_alphanumeric() && *c != '\'').collect();
            parts.push(format!("{t}{punct}"));
        } else {
            parts.push(w.to_string());
        }
    }
    parts.join(" ")
}

fn try_trans_cli(src: &str, lang: &str) -> Option<String> {
    if src.trim().is_empty() {
        return None;
    }
    // translate-shell: `trans -b :es "hello"`
    let out = Command::new("trans")
        .args(["-b", &format!(":{lang}"), src])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(s)
    }
}

fn to_hex_utf8(s: &str) -> String {
    s.as_bytes()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn to_steno_spaces(s: &str) -> String {
    // Whitespace steno channel spirit (demo): map a–z to unicode spaces family
    // Use a readable proxy: · for letters, ␣ for space
    let mut out = String::new();
    for ch in s.chars() {
        if ch.is_ascii_alphabetic() {
            let n = (ch.to_ascii_lowercase() as u8 - b'a') as usize;
            let marks = ['·', '⋅', '∙', '•', '‧', '∘', '○', '◌', '◍', '◎', '◉', '⦿', '∗'];
            out.push(marks[n % marks.len()]);
        } else if ch == ' ' {
            out.push('␣');
        } else {
            out.push(ch);
        }
    }
    out
}

fn to_braille_demo(s: &str) -> String {
    // Map a–z into Braille Patterns block (U+2800+) for training geometry
    s.chars()
        .map(|ch| {
            if ch.is_ascii_alphabetic() {
                let n = (ch.to_ascii_lowercase() as u8 - b'a') as u32;
                char::from_u32(0x2801 + n).unwrap_or(ch)
            } else if ch == ' ' {
                '\u{2800}'
            } else {
                ch
            }
        })
        .collect()
}

fn default_streams() -> Vec<LangStream> {
    let mut v = vec![
        LangStream {
            id: "en",
            label: "EN source",
            kind: StreamKind::Translate,
            text: String::new(),
            note: "source".into(),
        },
    ];
    // Translate targets (hotpipe + offline)
    for (id, label) in [
        ("es", "ES"),
        ("fr", "FR"),
        ("de", "DE"),
        ("ja", "JA"),
        ("zh", "ZH"),
        ("ko", "KO"),
        ("pt", "PT"),
        ("it", "IT"),
        ("ru", "RU"),
        ("ar", "AR"),
        ("hi", "HI"),
    ] {
        v.push(LangStream {
            id,
            label,
            kind: StreamKind::Translate,
            text: String::new(),
            note: "offline+trans+hotpipe".into(),
        });
    }
    // Layout remaps
    for (id, label, note) in [
        ("ru-layout", "RU layout", "qwerty→йцукен"),
        ("he-layout", "HE layout", "qwerty→hebrew"),
        ("ar-layout", "AR layout", "qwerty→arabic"),
        ("dvorak", "Dvorak", "layout"),
        ("azerty", "AZERTY", "layout"),
    ] {
        v.push(LangStream {
            id,
            label,
            kind: StreamKind::Layout,
            text: String::new(),
            note: note.into(),
        });
    }
    // Full lang-codec-plane FORMATS (hotpipe allViews)
    for (id, label, note) in [
        ("ascii", "ASCII", "lang-codec"),
        ("hex", "HEX", "lang-codec"),
        ("binary", "BIN", "lang-codec"),
        ("pcap", "PCAP", "lang-codec lite"),
        ("gutter", "QGUT", "quantum gutter"),
        ("steno", "STENO", "whitespace channel"),
        ("glyph", "GLYPH", "gyg1 grid"),
        ("qbit", "QBIT", "qbit-codec"),
        ("rev", "REV", "reverse"),
        ("braille", "BR8", "braille patterns"),
    ] {
        v.push(LangStream {
            id,
            label,
            kind: StreamKind::Codec,
            text: String::new(),
            note: note.into(),
        });
    }
    v
}

impl LanguageState {
    pub fn open() -> Self {
        let mut s = Self {
            source: String::new(),
            mode: LanguageMode::All,
            streams: default_streams(),
            focus: 0,
            cursor_blink: Instant::now(),
            status: "type · multi-stream live · m mode · Tab focus · o MG keyboard · Esc".into(),
            last_trans: Instant::now() - Duration::from_secs(10),
            trans_pending: false,
        };
        s.recompute(true);
        s
    }

    pub fn open_with_mode(mode: LanguageMode) -> Self {
        let mut s = Self::open();
        s.mode = mode;
        s.recompute(true);
        s
    }

    fn visible_streams(&self) -> Vec<usize> {
        self.streams
            .iter()
            .enumerate()
            .filter(|(_, st)| match self.mode {
                LanguageMode::All => true,
                LanguageMode::Layout => st.kind == StreamKind::Layout,
                LanguageMode::Translate => st.kind == StreamKind::Translate,
                LanguageMode::Codec => st.kind == StreamKind::Codec,
            })
            .map(|(i, _)| i)
            .collect()
    }

    fn recompute(&mut self, force_trans: bool) {
        let src = self.source.clone();
        let try_cli = force_trans
            || self.last_trans.elapsed() > Duration::from_millis(400);

        for st in &mut self.streams {
            match st.kind {
                StreamKind::Translate => {
                    if st.id == "en" {
                        st.text = src.clone();
                        st.note = "source".into();
                    } else {
                        let lang = st.id;
                        let offline = word_translate(&src, lang);
                        if try_cli {
                            if let Some(t) = try_trans_cli(&src, lang) {
                                st.text = t;
                                st.note = "trans CLI".into();
                            } else {
                                st.text = offline;
                                st.note = "offline+hotpipe".into();
                            }
                        } else {
                            st.text = offline;
                            st.note = "offline+hotpipe".into();
                        }
                    }
                }
                StreamKind::Layout => {
                    st.text = match st.id {
                        "ru-layout" => map_layout(&src, RU),
                        "he-layout" => map_layout(&src, HE),
                        "ar-layout" => map_layout(&src, AR),
                        "dvorak" => map_layout(&src, DVORAK),
                        "azerty" => map_layout(&src, AZERTY),
                        _ => src.clone(),
                    };
                }
                StreamKind::Codec => {
                    st.text = codec_display(&src, st.id);
                    st.note = "lang-codec hotpipe".into();
                }
            }
        }
        if try_cli {
            self.last_trans = Instant::now();
        }
        let vis = self.visible_streams().len();
        self.status = format!(
            "mode={} · streams={vis} · {} chars · hotpipe · Tab · Ctrl+m · Ctrl+o MG · Esc",
            self.mode.id(),
            src.chars().count()
        );
        // Hotpipe pack — MG language-hotpipe.js polls this for all options fanout
        publish_hotpipe_pack(&self.source, self.mode, &self.streams);
    }

    pub fn handle_key(&mut self, key: &KeyEvent) -> LanguageKeyOutcome {
        match key.code {
            KeyCode::Esc => LanguageKeyOutcome::Close,
            KeyCode::Char('q') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                LanguageKeyOutcome::Close
            }
            KeyCode::Char('m') | KeyCode::Char('M')
                if key.modifiers.contains(KeyModifiers::CONTROL)
                    || key.modifiers.is_empty() && self.source.is_empty() =>
            {
                // bare m only cycles when empty so typing "m" works in buffer
                if key.modifiers.contains(KeyModifiers::CONTROL) || self.source.is_empty() {
                    self.mode = self.mode.cycle();
                    if self.focus >= self.visible_streams().len() {
                        self.focus = 0;
                    }
                    self.recompute(false);
                } else {
                    self.push_char('m');
                }
                LanguageKeyOutcome::Changed
            }
            KeyCode::Tab => {
                let vis = self.visible_streams();
                if !vis.is_empty() {
                    self.focus = (self.focus + 1) % vis.len();
                }
                LanguageKeyOutcome::Changed
            }
            KeyCode::BackTab => {
                let vis = self.visible_streams();
                if !vis.is_empty() {
                    self.focus = (self.focus + vis.len() - 1) % vis.len();
                }
                LanguageKeyOutcome::Changed
            }
            KeyCode::Char('r') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                self.source.clear();
                self.recompute(true);
                LanguageKeyOutcome::Changed
            }
            KeyCode::Char('o') | KeyCode::Char('O')
                if key.modifiers.contains(KeyModifiers::CONTROL) =>
            {
                // pop-out MG keyboard plane
                let _ = open_mg_keyboard_plane();
                self.status = "pop-out · MG keyboard plane (?mg_kb=1)".into();
                LanguageKeyOutcome::Changed
            }
            KeyCode::Backspace => {
                self.source.pop();
                self.recompute(false);
                LanguageKeyOutcome::Changed
            }
            KeyCode::Enter => {
                self.source.push('\n');
                self.recompute(true);
                LanguageKeyOutcome::Changed
            }
            KeyCode::Char(c) if !key.modifiers.contains(KeyModifiers::CONTROL) => {
                // mode cycle with Meta? skip — normal type
                if c == 'm' && key.modifiers.contains(KeyModifiers::ALT) {
                    self.mode = self.mode.cycle();
                    self.recompute(false);
                } else {
                    self.push_char(c);
                }
                LanguageKeyOutcome::Changed
            }
            _ => LanguageKeyOutcome::Changed,
        }
    }

    fn push_char(&mut self, c: char) {
        if self.source.len() < 2000 {
            self.source.push(c);
            self.recompute(false);
        }
    }

    pub fn paint(&mut self, buf: &mut Buffer, area: Rect, bg: Color, fg: Color, dim: Color) {
        if area.width < 24 || area.height < 8 {
            return;
        }
        crate::render::color::dim_area(buf, area, bg, 0.5);

        let popup_w = ((area.width as u32 * 96) / 100)
            .max(36)
            .min(area.width as u32) as u16;
        let popup_h = ((area.height as u32 * 94) / 100)
            .max(12)
            .min(area.height as u32) as u16;
        let px = area.x + (area.width.saturating_sub(popup_w)) / 2;
        let py = area.y + (area.height.saturating_sub(popup_h)) / 2;
        let popup = Rect::new(px, py, popup_w, popup_h);

        Clear.render(popup, buf);
        buf.set_style(popup, Style::default().fg(fg).bg(bg));
        Block::default()
            .borders(Borders::ALL)
            .border_type(BorderType::Rounded)
            .border_style(Style::default().fg(Color::Cyan).bg(bg))
            .style(Style::default().bg(bg))
            .render(popup, buf);

        let title = format!(" LANGUAGE · simultaneous streams · {FEATURE_ID} ");
        let tw = title.chars().count().min(popup.width as usize) as u16;
        let tx = popup.x + (popup.width.saturating_sub(tw)) / 2;
        buf.set_span_safe(
            tx,
            popup.y,
            &Span::styled(
                &title,
                Style::default()
                    .fg(Color::Black)
                    .bg(Color::Cyan)
                    .add_modifier(Modifier::BOLD),
            ),
            tw,
        );

        let inner = Rect::new(
            popup.x + 1,
            popup.y + 1,
            popup.width.saturating_sub(2),
            popup.height.saturating_sub(2),
        );
        if inner.width < 20 || inner.height < 5 {
            return;
        }

        let blink = (self.cursor_blink.elapsed().as_millis() / 500) % 2 == 0;
        let cursor = if blink { "▌" } else { " " };
        let src_line = format!("▶ {}{cursor}", self.source.replace('\n', "↵"));
        buf.set_string_safe(
            inner.x,
            inner.y,
            &src_line,
            Style::default().fg(fg).add_modifier(Modifier::BOLD),
        );
        buf.set_string_safe(
            inner.x,
            inner.y + 1,
            &format!("  {}", self.status),
            Style::default().fg(dim),
        );

        let vis = self.visible_streams();
        if vis.is_empty() {
            return;
        }
        let cols = inner.width.max(1) as usize;
        let n_cols = if cols >= 90 {
            3
        } else if cols >= 50 {
            2
        } else {
            1
        };
        let col_w = ((cols / n_cols) as u16).max(16);
        let start_row = inner.y + 3;
        let max_y = inner.y + inner.height.saturating_sub(2);

        for (vi, &si) in vis.iter().enumerate() {
            let st = &self.streams[si];
            let col = (vi % n_cols) as u16;
            let row = start_row + ((vi / n_cols) as u16) * 3;
            if row + 1 >= max_y {
                break;
            }
            let x0 = inner.x + col * col_w;
            let focused = vi == self.focus;
            let head = format!(
                "{} {} · {}",
                if focused { "●" } else { "○" },
                st.label,
                st.note
            );
            let style = if focused {
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD)
            } else {
                Style::default().fg(Color::Cyan)
            };
            let head_trim: String = head.chars().take(col_w.saturating_sub(1) as usize).collect();
            buf.set_string_safe(x0, row, &head_trim, style);
            let body = if st.text.chars().count() > col_w.saturating_sub(2) as usize {
                let t: String = st
                    .text
                    .chars()
                    .take(col_w.saturating_sub(3) as usize)
                    .collect();
                format!("{t}…")
            } else if st.text.is_empty() {
                "—".into()
            } else {
                st.text.clone()
            };
            buf.set_string_safe(x0, row + 1, &body, Style::default().fg(fg));
        }

        let foot = "Esc quit · type live · Ctrl+m mode · Tab focus · Ctrl+r clear · Ctrl+o MG kb";
        buf.set_string_safe(
            inner.x,
            inner.y + inner.height.saturating_sub(1),
            foot,
            Style::default().fg(dim),
        );
    }
}

fn open_mg_keyboard_plane() -> Result<(), String> {
    let url = std::env::var("LIVE_DEMUX_LANGUAGE_URL").unwrap_or_else(|_| {
        "http://127.0.0.1:8790/webgrid-ugrad.html?mg_kb=1&lang=all".into()
    });
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("open").arg(&url).spawn();
        if let Ok(home) = std::env::var("HOME") {
            let mg = std::path::PathBuf::from(home).join("Applications/Memory Glass.app");
            if mg.is_dir() {
                let _ = Command::new("open")
                    .args(["-a", "Memory Glass", &url])
                    .spawn();
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = Command::new("xdg-open").arg(&url).spawn();
    }
    Ok(())
}

/// Public pop-out for slash / fcs.
pub fn launch_language_popout() -> String {
    let _ = open_mg_keyboard_plane();
    format!("{TOAST_OPEN} · browser/MG keyboard plane")
}


fn codec_display(src: &str, id: &str) -> String {
    match id {
        "ascii" => src
            .chars()
            .map(|c| format!("{:03}", c as u32))
            .collect::<Vec<_>>()
            .join(" "),
        "hex" => to_hex_utf8(src),
        "binary" | "bin" => src
            .as_bytes()
            .iter()
            .map(|b| format!("{b:08b}"))
            .collect::<Vec<_>>()
            .join(" "),
        "pcap" => format!("PCAP-lite len={}B", src.len()),
        "gutter" | "qgut" => {
            // demo gutter prefixes cycling
            let gates = ["n:", "+1:", "-n:", "0:", "H:", "X:", "T:"];
            src.chars()
                .enumerate()
                .map(|(i, c)| format!("{}{}", gates[i % gates.len()], c))
                .collect::<Vec<_>>()
                .join(" ")
        }
        "steno" => to_steno_spaces(src),
        "glyph" => {
            // compact gyg1-ish hex glyph ticket
            format!("gyg1 {}", to_hex_utf8(src))
        }
        "qbit" => format!("qbit-lite:{}", to_hex_utf8(src).chars().take(48).collect::<String>()),
        "rev" => src.chars().rev().collect(),
        "braille" => to_braille_demo(src),
        _ => src.to_string(),
    }
}

fn publish_hotpipe_pack(source: &str, mode: LanguageMode, streams: &[LangStream]) {
    use std::io::Write;
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
    let dir = std::path::PathBuf::from(home).join(".panda/packs");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("language-hotpipe.jsonl");
    let mut codecs = serde_json::Map::new();
    let mut layouts = serde_json::Map::new();
    let mut translate = serde_json::Map::new();
    for st in streams {
        match st.kind {
            StreamKind::Codec => {
                codecs.insert(st.id.to_string(), serde_json::Value::String(st.text.clone()));
            }
            StreamKind::Layout => {
                layouts.insert(st.id.to_string(), serde_json::Value::String(st.text.clone()));
            }
            StreamKind::Translate => {
                translate.insert(st.id.to_string(), serde_json::Value::String(st.text.clone()));
            }
        }
    }
    let payload = serde_json::json!({
        "type": "language.fanout",
        "ver": "language-hotpipe-v1",
        "text": source,
        "mode": mode.id(),
        "codecs": codecs,
        "layouts": layouts,
        "translate": translate,
        "formats": ["ascii","hex","binary","pcap","gutter","steno","glyph","qbit"],
        "t": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
    });
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(f, "{payload}");
    }
    // also rewrite a "latest" single-line file for simple poll
    let latest = dir.join("language-hotpipe-latest.json");
    let _ = std::fs::write(latest, payload.to_string());
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layout_map_changes_letters() {
        let s = map_layout("hello", RU);
        assert_ne!(s, "hello");
        assert_eq!(s.chars().count(), 5);
    }

    #[test]
    fn offline_hello_es() {
        assert_eq!(word_translate("hello", "es"), "hola");
    }

    #[test]
    fn recompute_fills_streams() {
        let mut st = LanguageState::open();
        st.source = "hello".into();
        st.recompute(true);
        let es = st.streams.iter().find(|s| s.id == "es").unwrap();
        assert!(es.text.contains("hola") || !es.text.is_empty());
    }
}
