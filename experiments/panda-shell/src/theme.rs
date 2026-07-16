//! Obsidian glass-morphism palette — black-on-black with frost edges.

use ratatui::style::{Color, Modifier, Style};

/// Near-black void. Terminals with true transparency will show through.
pub const VOID: Color = Color::Rgb(6, 6, 10);
/// Frosted panel body — slightly lifted from void.
pub const GLASS: Color = Color::Rgb(12, 12, 18);
/// Secondary frost layer for headers/footers.
pub const FROST: Color = Color::Rgb(18, 18, 28);
/// Soft edge for unfocused panes.
pub const EDGE_DIM: Color = Color::Rgb(36, 36, 52);
/// Bright glass rim for focused pane.
pub const EDGE_FOCUS: Color = Color::Rgb(120, 140, 200);
/// Accent glow (soft indigo-cyan).
pub const ACCENT: Color = Color::Rgb(122, 162, 247);
/// Secondary accent (violet).
pub const ACCENT_2: Color = Color::Rgb(187, 154, 247);
/// Primary text on glass.
pub const TEXT: Color = Color::Rgb(196, 200, 220);
/// Muted labels.
pub const MUTED: Color = Color::Rgb(90, 96, 120);
/// Success / live indicator.
pub const LIVE: Color = Color::Rgb(158, 206, 106);
/// Warning.
pub const WARN: Color = Color::Rgb(224, 175, 104);

pub fn glass() -> Style {
    Style::default().bg(GLASS).fg(TEXT)
}

pub fn frost() -> Style {
    Style::default().bg(FROST).fg(MUTED)
}

pub fn title_active() -> Style {
    Style::default()
        .bg(FROST)
        .fg(ACCENT)
        .add_modifier(Modifier::BOLD)
}

pub fn title_inactive() -> Style {
    Style::default().bg(GLASS).fg(MUTED)
}

pub fn border_focus() -> Style {
    Style::default().fg(EDGE_FOCUS).bg(VOID)
}

pub fn border_dim() -> Style {
    Style::default().fg(EDGE_DIM).bg(VOID)
}

pub fn help_key() -> Style {
    Style::default()
        .bg(FROST)
        .fg(ACCENT_2)
        .add_modifier(Modifier::BOLD)
}

pub fn help_desc() -> Style {
    Style::default().bg(FROST).fg(MUTED)
}

/// Map CSS-ish color strings from ptyctl styled output into ratatui colors.
pub fn parse_css_color(s: &str) -> Option<Color> {
    let s = s.trim();
    if let Some(hex) = s.strip_prefix('#') {
        return parse_hex(hex);
    }
    if let Some(inner) = s
        .strip_prefix("rgb(")
        .and_then(|x| x.strip_suffix(')'))
        .or_else(|| s.strip_prefix("rgba(").and_then(|x| x.strip_suffix(')')))
    {
        let parts: Vec<_> = inner.split(',').map(str::trim).collect();
        if parts.len() >= 3 {
            let r = parts[0].parse().ok()?;
            let g = parts[1].parse().ok()?;
            let b = parts[2]
                .split_whitespace()
                .next()
                .and_then(|p| p.parse().ok())?;
            return Some(Color::Rgb(r, g, b));
        }
    }
    // Named ANSI-ish fallbacks from alacritty NamedColor CSS mapping.
    match s.to_ascii_lowercase().as_str() {
        "black" => Some(Color::Black),
        "red" => Some(Color::Red),
        "green" => Some(Color::Green),
        "yellow" => Some(Color::Yellow),
        "blue" => Some(Color::Blue),
        "magenta" => Some(Color::Magenta),
        "cyan" => Some(Color::Cyan),
        "white" => Some(Color::White),
        "gray" | "grey" => Some(Color::Gray),
        _ => None,
    }
}

fn parse_hex(hex: &str) -> Option<Color> {
    let hex = hex.trim();
    match hex.len() {
        3 => {
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some(Color::Rgb(r, g, b))
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(Color::Rgb(r, g, b))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hex() {
        assert_eq!(parse_css_color("#7aa2f7"), Some(Color::Rgb(122, 162, 247)));
        assert_eq!(parse_css_color("#fff"), Some(Color::Rgb(255, 255, 255)));
    }

    #[test]
    fn parses_rgb() {
        assert_eq!(
            parse_css_color("rgb(10, 20, 30)"),
            Some(Color::Rgb(10, 20, 30))
        );
    }
}
