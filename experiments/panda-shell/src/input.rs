//! Keyboard routing: prefix mode (Ctrl-a) vs passthrough to focused PTY.

use crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

/// High-level UI actions produced by the prefix chord language.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    /// Detach client; session keeps running in the daemon.
    Detach,
    /// Kill session and quit.
    Quit,
    SplitHorizontal,
    SplitVertical,
    ClosePane,
    FocusNext,
    FocusPrev,
    FocusLeft,
    FocusRight,
    FocusUp,
    FocusDown,
    ToggleHelp,
    ZoomToggle,
    NewTab,
    NextTab,
    PrevTab,
    NextModel,
    PrevModel,
    SelectModel(usize),
    /// Raw bytes for the focused PTY.
    PtyBytes(Vec<u8>),
}

/// Prefix chord state machine. Default prefix: Ctrl-a (screen/tmux muscle memory).
#[derive(Debug, Default)]
pub struct InputRouter {
    pub prefix_armed: bool,
    pub show_help: bool,
}

impl InputRouter {
    pub fn handle(&mut self, key: KeyEvent) -> Option<Action> {
        if !self.prefix_armed {
            if key.code == KeyCode::Char('a') && key.modifiers.contains(KeyModifiers::CONTROL) {
                self.prefix_armed = true;
                return None;
            }
            if key.modifiers.contains(KeyModifiers::ALT) {
                return match key.code {
                    KeyCode::Left => Some(Action::FocusLeft),
                    KeyCode::Right => Some(Action::FocusRight),
                    KeyCode::Up => Some(Action::FocusUp),
                    KeyCode::Down => Some(Action::FocusDown),
                    KeyCode::Char('h') => Some(Action::ToggleHelp),
                    KeyCode::Char('%') => Some(Action::SplitHorizontal),
                    KeyCode::Char('"') => Some(Action::SplitVertical),
                    KeyCode::Char('x') => Some(Action::ClosePane),
                    KeyCode::Char('d') => Some(Action::Detach),
                    KeyCode::Char('q') => Some(Action::Quit),
                    KeyCode::Char('m') => Some(Action::NextModel),
                    _ => key_to_bytes(key).map(Action::PtyBytes),
                };
            }
            return key_to_bytes(key).map(Action::PtyBytes);
        }

        self.prefix_armed = false;
        match key.code {
            KeyCode::Char('a') if key.modifiers.contains(KeyModifiers::CONTROL) => {
                Some(Action::PtyBytes(vec![0x01]))
            }
            KeyCode::Char('%') | KeyCode::Char('|') => Some(Action::SplitHorizontal),
            KeyCode::Char('"') | KeyCode::Char('-') => Some(Action::SplitVertical),
            KeyCode::Char('x') => Some(Action::ClosePane),
            KeyCode::Char('n') | KeyCode::Tab => Some(Action::FocusNext),
            KeyCode::Char('p') | KeyCode::BackTab => Some(Action::FocusPrev),
            KeyCode::Left | KeyCode::Char('h') => Some(Action::FocusLeft),
            KeyCode::Right | KeyCode::Char('l') => Some(Action::FocusRight),
            KeyCode::Up | KeyCode::Char('k') => Some(Action::FocusUp),
            KeyCode::Down | KeyCode::Char('j') => Some(Action::FocusDown),
            KeyCode::Char('z') => Some(Action::ZoomToggle),
            KeyCode::Char('c') => Some(Action::NewTab),
            KeyCode::Char(']') => Some(Action::NextTab),
            KeyCode::Char('[') => Some(Action::PrevTab),
            KeyCode::Char('m') => Some(Action::NextModel),
            KeyCode::Char('M') => Some(Action::PrevModel),
            KeyCode::Char(d @ '1'..='9') => {
                Some(Action::SelectModel((d as u8 - b'1') as usize))
            }
            KeyCode::Char('?') => {
                self.show_help = !self.show_help;
                Some(Action::ToggleHelp)
            }
            KeyCode::Char('d') => Some(Action::Detach),
            KeyCode::Char('q') => Some(Action::Quit),
            KeyCode::Esc => None,
            _ => None,
        }
    }
}

/// Encode a crossterm key event as xterm-ish bytes for the PTY.
pub fn key_to_bytes(key: KeyEvent) -> Option<Vec<u8>> {
    let mods = key.modifiers;
    let ctrl = mods.contains(KeyModifiers::CONTROL);
    let alt = mods.contains(KeyModifiers::ALT);

    match key.code {
        KeyCode::Char(c) => {
            if ctrl {
                let b = match c.to_ascii_lowercase() {
                    'a'..='z' => (c.to_ascii_lowercase() as u8) - b'a' + 1,
                    '@' | ' ' => 0x00,
                    '[' => 0x1b,
                    '\\' => 0x1c,
                    ']' => 0x1d,
                    '^' => 0x1e,
                    '_' => 0x1f,
                    '?' => 0x7f,
                    _ => return Some(c.to_string().into_bytes()),
                };
                return Some(vec![b]);
            }
            let mut out = Vec::new();
            if alt {
                out.push(0x1b);
            }
            let mut buf = [0u8; 4];
            let s = c.encode_utf8(&mut buf);
            out.extend_from_slice(s.as_bytes());
            Some(out)
        }
        KeyCode::Enter => Some(vec![b'\r']),
        KeyCode::Tab => Some(vec![b'\t']),
        KeyCode::Backspace => Some(vec![0x7f]),
        KeyCode::Esc => Some(vec![0x1b]),
        KeyCode::Delete => Some(b"\x1b[3~".to_vec()),
        KeyCode::Home => Some(b"\x1b[H".to_vec()),
        KeyCode::End => Some(b"\x1b[F".to_vec()),
        KeyCode::PageUp => Some(b"\x1b[5~".to_vec()),
        KeyCode::PageDown => Some(b"\x1b[6~".to_vec()),
        KeyCode::Insert => Some(b"\x1b[2~".to_vec()),
        KeyCode::Up => Some(if ctrl {
            b"\x1b[1;5A".to_vec()
        } else {
            b"\x1b[A".to_vec()
        }),
        KeyCode::Down => Some(if ctrl {
            b"\x1b[1;5B".to_vec()
        } else {
            b"\x1b[B".to_vec()
        }),
        KeyCode::Right => Some(if ctrl {
            b"\x1b[1;5C".to_vec()
        } else {
            b"\x1b[C".to_vec()
        }),
        KeyCode::Left => Some(if ctrl {
            b"\x1b[1;5D".to_vec()
        } else {
            b"\x1b[D".to_vec()
        }),
        KeyCode::F(n) => {
            let seq = match n {
                1 => "\x1bOP",
                2 => "\x1bOQ",
                3 => "\x1bOR",
                4 => "\x1bOS",
                5 => "\x1b[15~",
                6 => "\x1b[17~",
                7 => "\x1b[18~",
                8 => "\x1b[19~",
                9 => "\x1b[20~",
                10 => "\x1b[21~",
                11 => "\x1b[23~",
                12 => "\x1b[24~",
                _ => return None,
            };
            Some(seq.as_bytes().to_vec())
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefix_detach() {
        let mut r = InputRouter::default();
        let arm = KeyEvent::new(KeyCode::Char('a'), KeyModifiers::CONTROL);
        assert!(r.handle(arm).is_none());
        let act = r.handle(KeyEvent::new(KeyCode::Char('d'), KeyModifiers::NONE));
        assert_eq!(act, Some(Action::Detach));
    }

    #[test]
    fn model_select() {
        let mut r = InputRouter::default();
        r.prefix_armed = true;
        assert_eq!(
            r.handle(KeyEvent::new(KeyCode::Char('2'), KeyModifiers::NONE)),
            Some(Action::SelectModel(1))
        );
    }

    #[test]
    fn ctrl_c_bytes() {
        let k = KeyEvent::new(KeyCode::Char('c'), KeyModifiers::CONTROL);
        assert_eq!(key_to_bytes(k), Some(vec![0x03]));
    }
}
