//! Named channel aliases for `/watch` · `/gmux`.
//!
//! Type a short name instead of a full URL:
//!   `/watch bloomberg`  `/watch cnn`  `/watch vevo`
//!
//! Browse in-player: **g** / **Tab** opens the channel guide (A–Z, regions, news).
//!
//! Music-TV sources (VEVO Friday playlist) behave like a channel zapper:
//!   n / ] / ↑  next track · p / [ / ↓  previous · Space pause · auto-advance on EOF.
//! News live: n/p zaps the next/prev **station** (alphabetical within the active region).

/// Kind of watch source — drives playlist length and HUD wording.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ChannelKind {
    /// 24/7 news live stream (single item; scrub only, no track skip).
    LiveNews,
    /// Music playlist zapped like TV (next/prev track, auto-advance).
    MusicTv,
    /// Generic URL / search result.
    Generic,
}

/// Geographic / content grouping for the channel guide and region hop.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ChannelRegion {
    /// Music TV playlists (not news).
    Music,
    /// US / business news.
    Us,
    /// UK + continental Europe.
    Europe,
    /// Global / non-US-EU news desks.
    World,
    /// Tech / weather / specialty live.
    Specialty,
}

impl ChannelRegion {
    pub const ALL: &[ChannelRegion] = &[
        ChannelRegion::Music,
        ChannelRegion::Us,
        ChannelRegion::Europe,
        ChannelRegion::World,
        ChannelRegion::Specialty,
    ];

    pub fn id(self) -> &'static str {
        match self {
            ChannelRegion::Music => "music",
            ChannelRegion::Us => "us",
            ChannelRegion::Europe => "europe",
            ChannelRegion::World => "world",
            ChannelRegion::Specialty => "specialty",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            ChannelRegion::Music => "Music TV",
            ChannelRegion::Us => "US / business",
            ChannelRegion::Europe => "UK / Europe",
            ChannelRegion::World => "World",
            ChannelRegion::Specialty => "Specialty",
        }
    }

    /// Parse region tokens used by `/watch us` · guide filters · list.
    pub fn parse(token: &str) -> Option<ChannelRegion> {
        let t = normalize_token(token);
        match t.as_str() {
            "music" | "music-tv" | "musictv" | "tv-music" => Some(ChannelRegion::Music),
            "us" | "usa" | "america" | "u-s" | "business" | "markets" => {
                Some(ChannelRegion::Us)
            }
            "europe" | "eu" | "uk" | "britain" | "emea" => Some(ChannelRegion::Europe),
            "world" | "intl" | "international" | "global" => Some(ChannelRegion::World),
            "specialty" | "special" | "tech" | "science" | "space" => {
                Some(ChannelRegion::Specialty)
            }
            _ => None,
        }
    }
}

/// Guide list filter (All / News / Music / one region).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum GuideFilter {
    All,
    News,
    Music,
    Region(ChannelRegion),
}

impl GuideFilter {
    pub fn label(self) -> &'static str {
        match self {
            GuideFilter::All => "All",
            GuideFilter::News => "News",
            GuideFilter::Music => "Music",
            GuideFilter::Region(ChannelRegion::Us) => "US",
            GuideFilter::Region(ChannelRegion::Europe) => "Europe",
            GuideFilter::Region(ChannelRegion::World) => "World",
            GuideFilter::Region(ChannelRegion::Specialty) => "Specialty",
            GuideFilter::Region(ChannelRegion::Music) => "Music",
        }
    }

    pub fn cycle_next(self) -> Self {
        match self {
            GuideFilter::All => GuideFilter::News,
            GuideFilter::News => GuideFilter::Music,
            GuideFilter::Music => GuideFilter::Region(ChannelRegion::Us),
            GuideFilter::Region(ChannelRegion::Us) => GuideFilter::Region(ChannelRegion::Europe),
            GuideFilter::Region(ChannelRegion::Europe) => GuideFilter::Region(ChannelRegion::World),
            GuideFilter::Region(ChannelRegion::World) => {
                GuideFilter::Region(ChannelRegion::Specialty)
            }
            GuideFilter::Region(ChannelRegion::Specialty) | GuideFilter::Region(ChannelRegion::Music) => {
                GuideFilter::All
            }
        }
    }

    pub fn cycle_prev(self) -> Self {
        match self {
            GuideFilter::All => GuideFilter::Region(ChannelRegion::Specialty),
            GuideFilter::News => GuideFilter::All,
            GuideFilter::Music => GuideFilter::News,
            GuideFilter::Region(ChannelRegion::Us) => GuideFilter::Music,
            GuideFilter::Region(ChannelRegion::Europe) => GuideFilter::Region(ChannelRegion::Us),
            GuideFilter::Region(ChannelRegion::World) => GuideFilter::Region(ChannelRegion::Europe),
            GuideFilter::Region(ChannelRegion::Specialty) => GuideFilter::Region(ChannelRegion::World),
            GuideFilter::Region(ChannelRegion::Music) => GuideFilter::Music,
        }
    }

    /// Digit keys 0–6 jump straight to a filter.
    pub fn from_digit(d: char) -> Option<Self> {
        match d {
            '0' => Some(GuideFilter::All),
            '1' => Some(GuideFilter::News),
            '2' => Some(GuideFilter::Music),
            '3' => Some(GuideFilter::Region(ChannelRegion::Us)),
            '4' => Some(GuideFilter::Region(ChannelRegion::Europe)),
            '5' => Some(GuideFilter::Region(ChannelRegion::World)),
            '6' => Some(GuideFilter::Region(ChannelRegion::Specialty)),
            _ => None,
        }
    }
}

/// One built-in channel or playlist.
#[derive(Clone, Copy, Debug)]
pub struct ChannelDef {
    /// Canonical short id (what you type).
    pub id: &'static str,
    /// Extra aliases (case-insensitive).
    pub aliases: &'static [&'static str],
    /// Human label for HUD / `/watch list`.
    pub label: &'static str,
    /// yt-dlp URL (https, @handle/live, list=, or ytsearch1:…).
    pub url: &'static str,
    pub kind: ChannelKind,
    pub region: ChannelRegion,
}

/// VEVO Friday playlist — default music TV stream (skip tracks like a channel).
pub const VEVO_FRIDAY_URL: &str =
    "https://www.youtube.com/watch?v=jaCxgxTScjc&list=PLbAbqvKSxmj4";

/// Rotten Tomatoes Trailers channel uploads — multi-item movie trailer feed.
///
/// Resolved flat via yt-dlp (`@handle/videos`); shuffle with **`s`** / auto on EOF.
pub const MOVIE_TRAILERS_URL: &str =
    "https://www.youtube.com/@RottenTomatoesTrailers/videos";

/// Broader “what’s new” trailer search (fallback / second feed).
pub const MOVIE_TRAILERS_SEARCH_URL: &str = "ytsearch50:official movie trailer";

/// Default when `/watch` is bare → VEVO Friday music TV.
pub const DEFAULT_CHANNEL_ID: &str = "vevo";

/// Built-in channel ids that open with **shuffle mode on** (movie trailer feeds).
///
/// Accepts canonical ids **and** aliases (`movies`, `rt`, `cinema`, …) by
/// resolving through [`find_channel`] first.
pub fn is_trailer_feed_id(id: &str) -> bool {
    if let Some(ch) = find_channel(id) {
        return matches!(ch.id, "trailers" | "newtrailers");
    }
    matches!(
        normalize_token(id).as_str(),
        "trailers"
            | "movies"
            | "movie"
            | "trailer"
            | "cinema"
            | "xtrailers"
            | "x-trailers"
            | "movie-trailers"
            | "movietrailers"
            | "rt-trailers"
            | "rt"
            | "rottentomatoes"
            | "newtrailers"
            | "new-trailers"
    )
}

/// Built-in news live + music TV stations.
///
/// Live URLs use YouTube `@handle/live` when the channel keeps a persistent
/// stream. Some handles stay dark off-air — free-text `/watch <words>` falls
/// back to `ytsearch1:… live`.
pub const CHANNELS: &[ChannelDef] = &[
    // --- Music TV (zap with n/p · auto-skip dead tracks) ---
    ChannelDef {
        id: "vevo",
        aliases: &["vevotv", "vevo-tv", "vevo_tv", "friday", "music-tv", "musictv"],
        label: "VEVO Friday · music TV",
        url: VEVO_FRIDAY_URL,
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    // --- Movie trailers (shuffle feed · s = random · S = toggle shuffle) ---
    ChannelDef {
        id: "trailers",
        aliases: &[
            "movies",
            "movie",
            "trailer",
            "cinema",
            "xtrailers",
            "x-trailers",
            "movie-trailers",
            "movietrailers",
            "rt-trailers",
            "rottentomatoes",
            "rt",
        ],
        label: "Movie trailers · shuffle feed",
        // Full upload feed — n/p sequential, s shuffle, auto-random on EOF when shuffle on.
        url: MOVIE_TRAILERS_URL,
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    ChannelDef {
        id: "newtrailers",
        aliases: &["new-trailers", "fresh-trailers", "upcoming"],
        label: "New trailers search · shuffle",
        url: MOVIE_TRAILERS_SEARCH_URL,
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    ChannelDef {
        id: "lofi",
        aliases: &["lo-fi", "lofifi", "chill", "study", "beats"],
        label: "Lo-Fi beats · music TV",
        // Search resolves the current 24/7 lo-fi stream (IDs rotate).
        url: "ytsearch1:lofi hip hop radio beats to relax study to",
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    ChannelDef {
        id: "synthwave",
        aliases: &["synth", "retrowave", "outrun"],
        label: "Synthwave radio · music TV",
        url: "ytsearch1:synthwave radio live",
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    ChannelDef {
        id: "jazz",
        aliases: &["smooth-jazz", "smoothjazz"],
        label: "Jazz radio · music TV",
        url: "ytsearch1:smooth jazz radio live",
        kind: ChannelKind::MusicTv,
        region: ChannelRegion::Music,
    },
    // --- US / business news ---
    ChannelDef {
        id: "abc",
        aliases: &["abcnews", "abc-news"],
        label: "ABC News Live",
        url: "https://www.youtube.com/@ABCNews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "bloomberg",
        aliases: &["bbg", "bloom", "bloomberg-tv", "bloombergtv"],
        label: "Bloomberg Live",
        // Main Bloomberg Originals 24/7 stream (handle is @business, not @Bloomberg).
        url: "https://www.youtube.com/@business/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "cbs",
        aliases: &["cbsnews", "cbs-news"],
        label: "CBS News Live",
        url: "https://www.youtube.com/@CBSNews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "cnbc",
        aliases: &["cnbc-live"],
        label: "CNBC Live",
        url: "https://www.youtube.com/@CNBC/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "cnn",
        aliases: &["cnn-live"],
        label: "CNN Live",
        url: "https://www.youtube.com/@CNN/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "fox",
        aliases: &["foxnews", "fox-news", "fox_news"],
        label: "Fox News Live",
        // /live often dark; search finds the active stream when on-air.
        url: "ytsearch1:Fox News Live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "msnbc",
        aliases: &["msnbc-live"],
        label: "MSNBC Live",
        url: "ytsearch1:MSNBC Live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "nbc",
        aliases: &["nbcnews", "nbc-news"],
        label: "NBC News Live",
        url: "https://www.youtube.com/@NBCNews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "pbs",
        aliases: &["pbsnews", "newshour", "pbs-news"],
        label: "PBS NewsHour Live",
        url: "https://www.youtube.com/@PBSNewsHour/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    ChannelDef {
        id: "reuters",
        aliases: &["reuters-live"],
        label: "Reuters Live",
        url: "https://www.youtube.com/@Reuters/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Us,
    },
    // --- UK / Europe ---
    ChannelDef {
        id: "bbc",
        aliases: &["bbcnews", "bbc-news"],
        label: "BBC News Live",
        url: "https://www.youtube.com/@BBCNews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Europe,
    },
    ChannelDef {
        id: "dw",
        aliases: &["dwnews", "deutsche-welle", "deutschewelle"],
        label: "DW News Live",
        url: "https://www.youtube.com/@dwnews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Europe,
    },
    ChannelDef {
        id: "euronews",
        aliases: &["euro-news"],
        label: "Euronews Live",
        url: "https://www.youtube.com/@euronews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Europe,
    },
    ChannelDef {
        id: "france24",
        aliases: &["f24", "france-24"],
        label: "France 24 English Live",
        url: "ytsearch1:France 24 English Live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Europe,
    },
    ChannelDef {
        id: "sky",
        aliases: &["skynews", "sky-news"],
        label: "Sky News Live",
        url: "https://www.youtube.com/@SkyNews/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Europe,
    },
    // --- World ---
    ChannelDef {
        id: "aljazeera",
        aliases: &["aj", "aje", "al-jazeera", "jazeera"],
        label: "Al Jazeera English Live",
        url: "https://www.youtube.com/@aljazeeraenglish/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::World,
    },
    ChannelDef {
        id: "nhk",
        aliases: &["nhk-world", "nhkworld"],
        label: "NHK World Live",
        url: "https://www.youtube.com/@NHKWORLDJAPAN/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::World,
    },
    // --- Tech / specialty ---
    ChannelDef {
        id: "nasa",
        aliases: &["nasa-tv", "nasatv"],
        label: "NASA TV Live",
        url: "https://www.youtube.com/@NASA/live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Specialty,
    },
    ChannelDef {
        id: "weather",
        aliases: &["weather-channel", "twc"],
        label: "Weather Live",
        url: "ytsearch1:The Weather Channel Live",
        kind: ChannelKind::LiveNews,
        region: ChannelRegion::Specialty,
    },
    // --- X.com (Twitter) live hub ---
    // Bare `x` / `twitter` does not demux a homepage — open() focuses search
    // prefilled for broadcast/status paste (see x_live + LiveWatchState::open).
    ChannelDef {
        id: "x",
        aliases: &[
            "twitter",
            "xcom",
            "x-com",
            "x.com",
            "x-live",
            "xlive",
            "x_live",
            "spaces",
            "xspaces",
        ],
        label: "X live · paste broadcast/status URL",
        // Sentinel — never demuxed; open focuses in-modal search.
        url: "x://hub",
        kind: ChannelKind::Generic,
        region: ChannelRegion::Specialty,
    },
];

/// Resolved input ready for yt-dlp.
#[derive(Clone, Debug)]
pub struct ResolvedSource {
    pub url: String,
    pub label: String,
    pub kind: ChannelKind,
    /// Canonical channel id when matched, else None.
    pub channel_id: Option<String>,
    /// Open the in-player channel guide after start (region / news browse).
    pub open_guide: bool,
    /// Initial guide filter when `open_guide` is set.
    pub guide_filter: GuideFilter,
}

fn normalize_token(s: &str) -> String {
    s.trim()
        .to_ascii_lowercase()
        .chars()
        .map(|c| if c == ' ' || c == '_' { '-' } else { c })
        .collect()
}

/// Look up a built-in channel by id or alias (case-insensitive).
pub fn find_channel(token: &str) -> Option<&'static ChannelDef> {
    let key = normalize_token(token);
    if key.is_empty() {
        return None;
    }
    CHANNELS.iter().find(|c| {
        normalize_token(c.id) == key
            || c.aliases
                .iter()
                .any(|a| normalize_token(a) == key)
    })
}

/// True if the string looks like a URL / yt-dlp locator (not a channel name).
pub fn looks_like_locator(s: &str) -> bool {
    let t = s.trim();
    if t.is_empty() {
        return false;
    }
    let lower = t.to_ascii_lowercase();
    if lower == "x://hub" {
        // Internal sentinel for the X hub channel — not a real locator.
        return false;
    }
    lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("ytsearch")
        || lower.starts_with("ytdl")
        || lower.contains("youtube.com/")
        || lower.contains("youtu.be/")
        || lower.contains("x.com/")
        || lower.contains("twitter.com/")
        || lower.contains("pscp.tv")
        || lower.starts_with("x:")
        || lower.starts_with("twitter:")
        || lower.starts_with("xlive:")
        || lower.contains("://")
        || lower.starts_with("www.")
}

/// Channels matching a guide filter, sorted A–Z by id.
pub fn channels_for_filter(filter: GuideFilter) -> Vec<&'static ChannelDef> {
    let mut out: Vec<&'static ChannelDef> = CHANNELS
        .iter()
        .filter(|c| match filter {
            GuideFilter::All => true,
            GuideFilter::News => c.kind == ChannelKind::LiveNews,
            GuideFilter::Music => c.kind == ChannelKind::MusicTv,
            GuideFilter::Region(r) => c.region == r,
        })
        .collect();
    out.sort_by(|a, b| a.id.cmp(b.id));
    out
}

/// Alphabetical news stations only (for n/p station zap).
pub fn news_channels_alpha() -> Vec<&'static ChannelDef> {
    channels_for_filter(GuideFilter::News)
}

/// News stations in a region, A–Z by id.
pub fn news_channels_in_region(region: ChannelRegion) -> Vec<&'static ChannelDef> {
    channels_for_filter(GuideFilter::Region(region))
        .into_iter()
        .filter(|c| c.kind == ChannelKind::LiveNews)
        .collect()
}

/// Index of `id` in the A–Z list for `filter`, if present.
pub fn channel_index_in_filter(filter: GuideFilter, id: &str) -> Option<usize> {
    let key = normalize_token(id);
    channels_for_filter(filter)
        .iter()
        .position(|c| normalize_token(c.id) == key)
}

/// First channel whose id starts with `letter` (case-insensitive) in the filtered A–Z list.
pub fn hop_letter(filter: GuideFilter, letter: char) -> Option<&'static ChannelDef> {
    let ch = letter.to_ascii_lowercase();
    if !ch.is_ascii_alphabetic() {
        return None;
    }
    channels_for_filter(filter)
        .into_iter()
        .find(|c| c.id.chars().next().map(|x| x.to_ascii_lowercase()) == Some(ch))
}

/// Next station after `current_id` in the A–Z news list (wraps). Prefer same region when set.
pub fn next_news_channel(
    current_id: Option<&str>,
    prefer_region: Option<ChannelRegion>,
) -> Option<&'static ChannelDef> {
    let list = match prefer_region {
        Some(r) => {
            let regional = news_channels_in_region(r);
            if regional.len() > 1 {
                regional
            } else {
                news_channels_alpha()
            }
        }
        None => news_channels_alpha(),
    };
    if list.is_empty() {
        return None;
    }
    let Some(cur) = current_id else {
        return Some(list[0]);
    };
    let key = normalize_token(cur);
    let idx = list
        .iter()
        .position(|c| normalize_token(c.id) == key)
        .unwrap_or(0);
    Some(list[(idx + 1) % list.len()])
}

/// Previous station before `current_id` in the A–Z news list (wraps).
pub fn prev_news_channel(
    current_id: Option<&str>,
    prefer_region: Option<ChannelRegion>,
) -> Option<&'static ChannelDef> {
    let list = match prefer_region {
        Some(r) => {
            let regional = news_channels_in_region(r);
            if regional.len() > 1 {
                regional
            } else {
                news_channels_alpha()
            }
        }
        None => news_channels_alpha(),
    };
    if list.is_empty() {
        return None;
    }
    let Some(cur) = current_id else {
        return Some(list[0]);
    };
    let key = normalize_token(cur);
    let idx = list
        .iter()
        .position(|c| normalize_token(c.id) == key)
        .unwrap_or(0);
    let prev = if idx == 0 { list.len() - 1 } else { idx - 1 };
    Some(list[prev])
}

fn resolved_from_channel(ch: &ChannelDef, open_guide: bool, guide_filter: GuideFilter) -> ResolvedSource {
    ResolvedSource {
        url: ch.url.to_string(),
        label: ch.label.to_string(),
        kind: ch.kind,
        channel_id: Some(ch.id.to_string()),
        open_guide,
        guide_filter,
    }
}

/// Resolve bare `/watch`, channel names, regions, or raw URLs into a playable source.
///
/// | Input | Result |
/// |-------|--------|
/// | empty | VEVO Friday music TV |
/// | `bloomberg`, `cnn`, … | built-in live / playlist |
/// | `news` / `list` tokens | first news + open guide (handled by slash cmd for list) |
/// | `us` `europe` `world` … | first A–Z station in region + guide |
/// | `https://…` | pass-through |
/// | other word | `ytsearch1:{word} live` (news-biased search) |
pub fn resolve_watch_source(input: &str) -> ResolvedSource {
    let raw = input.trim();
    if raw.is_empty() {
        let ch = find_channel(DEFAULT_CHANNEL_ID).expect("vevo channel present");
        return resolved_from_channel(ch, false, GuideFilter::Music);
    }

    // Dual cam desk: laptop | phone only — no yt-dlp / VEVO stream.
    // Also treat bare phone/dual tokens as desk so stale slash paths cannot
    // fall into ytsearch1:phone live.
    let key0 = raw.split_whitespace().next().unwrap_or(raw).to_ascii_lowercase();
    if super::camera::is_desk_source(raw)
        || matches!(
            key0.as_str(),
            "phone" | "tether" | "dual" | "both" | "desk" | "camdesk" | "you+phone"
        )
    {
        return ResolvedSource {
            url: super::camera::DESK_URL.into(),
            label: "desk · you | phone".into(),
            kind: ChannelKind::Generic,
            channel_id: Some("desk".into()),
            open_guide: false,
            guide_filter: GuideFilter::All,
        };
    }

    // Optical blur / jawta light as the **main /watch surface** (not a side cam).
    if super::optical::is_optical_source(raw)
        || matches!(
            key0.as_str(),
            "optical" | "optic" | "jawta" | "optical-blur" | "fountain" | "decimen"
        )
    {
        let (mode, text) = super::optical::parse_optical_args(raw);
        let label = if text.is_empty() || text == "FC OPTICAL" {
            mode.label().to_string()
        } else {
            format!("{} · {}", mode.id(), text.chars().take(40).collect::<String>())
        };
        return ResolvedSource {
            url: super::optical::optical_url(mode),
            label,
            kind: ChannelKind::Generic,
            channel_id: Some("optical".into()),
            open_guide: false,
            guide_filter: GuideFilter::All,
        };
    }

    // X.com / Twitter / Periscope: normalize broadcast/status/pscp /media URLs.
    if let Some(xurl) = super::x_live::normalize_x_url(raw) {
        // Profile Media tabs are multi-item video feeds (zap like music TV).
        let is_feed = super::x_live::is_x_user_media_feed(&xurl);
        let handle = super::x_live::x_user_media_handle(&xurl);
        let label = if is_feed {
            match handle {
                Some(h) => format!("X · @{h} media"),
                None => format!("X · {}", xurl.chars().take(48).collect::<String>()),
            }
        } else {
            format!("X · {}", xurl.chars().take(48).collect::<String>())
        };
        return ResolvedSource {
            url: xurl,
            label,
            kind: if is_feed {
                ChannelKind::MusicTv
            } else {
                ChannelKind::Generic
            },
            channel_id: Some(if is_feed { "x-media".into() } else { "x".into() }),
            open_guide: false,
            guide_filter: GuideFilter::Region(ChannelRegion::Specialty),
        };
    }
    // "x <url-or-id>" / "twitter <paste>"
    let mut words = raw.split_whitespace();
    if let Some(first) = words.next() {
        if super::x_live::is_x_hub_token(first) {
            let rest = words.collect::<Vec<_>>().join(" ");
            if rest.is_empty() {
                // Bare hub — sentinel; LiveWatchState focuses search.
                if let Some(ch) = find_channel("x") {
                    return resolved_from_channel(ch, false, GuideFilter::Region(ChannelRegion::Specialty));
                }
            } else if let Some(xurl) = super::x_live::normalize_x_url(&rest) {
                return ResolvedSource {
                    url: xurl.clone(),
                    label: format!("X · {}", xurl.chars().take(48).collect::<String>()),
                    kind: ChannelKind::Generic,
                    channel_id: Some("x".into()),
                    open_guide: false,
                    guide_filter: GuideFilter::Region(ChannelRegion::Specialty),
                };
            } else if looks_like_locator(&rest) {
                return ResolvedSource {
                    url: rest.clone(),
                    label: format!("X · {}", rest.chars().take(48).collect::<String>()),
                    kind: ChannelKind::Generic,
                    channel_id: Some("x".into()),
                    open_guide: false,
                    guide_filter: GuideFilter::Region(ChannelRegion::Specialty),
                };
            }
        }
    }

    if looks_like_locator(raw) {
        let is_x = super::x_live::is_x_locator(raw);
        return ResolvedSource {
            url: raw.to_string(),
            label: if is_x {
                format!("X · {}", raw.chars().take(48).collect::<String>())
            } else {
                raw.chars().take(64).collect()
            },
            kind: ChannelKind::Generic,
            channel_id: if is_x { Some("x".into()) } else { None },
            open_guide: false,
            guide_filter: GuideFilter::All,
        };
    }

    // First token is the channel name / browse token; rest ignored.
    let token = raw.split_whitespace().next().unwrap_or(raw);
    let key = normalize_token(token);

    // Browse tokens: open guide filtered, start on first A–Z match.
    if matches!(
        key.as_str(),
        "news" | "stations" | "guide" | "browse" | "channels"
    ) {
        let list = channels_for_filter(GuideFilter::News);
        if let Some(ch) = list.first() {
            return resolved_from_channel(ch, true, GuideFilter::News);
        }
    }
    if key == "all" || key == "alpha" || key == "az" || key == "a-z" {
        let list = channels_for_filter(GuideFilter::All);
        if let Some(ch) = list.first() {
            return resolved_from_channel(ch, true, GuideFilter::All);
        }
    }
    if let Some(region) = ChannelRegion::parse(&key) {
        let filter = if region == ChannelRegion::Music {
            GuideFilter::Music
        } else {
            GuideFilter::Region(region)
        };
        let list = channels_for_filter(filter);
        if let Some(ch) = list.first() {
            return resolved_from_channel(ch, true, filter);
        }
    }

    if let Some(ch) = find_channel(token) {
        let filter = match ch.kind {
            ChannelKind::MusicTv => GuideFilter::Music,
            ChannelKind::LiveNews => GuideFilter::Region(ch.region),
            ChannelKind::Generic => GuideFilter::All,
        };
        return resolved_from_channel(ch, false, filter);
    }

    // Free-text: live-biased YouTube search so `/watch reuters markets` works.
    let q = raw.replace('"', "");
    ResolvedSource {
        url: format!("ytsearch1:{q} live"),
        label: format!("search · {q}"),
        kind: ChannelKind::Generic,
        channel_id: None,
        open_guide: false,
        guide_filter: GuideFilter::All,
    }
}

/// Multi-line listing for `/watch list` — regions, then A–Z within each.
pub fn format_channel_list() -> String {
    let mut lines = Vec::with_capacity(CHANNELS.len() + 24);
    lines.push("WATCH channels  (type /watch <name> · g/Tab in player = guide)".to_string());
    lines.push("".to_string());
    lines.push("Browse tokens (open A–Z guide):".to_string());
    lines.push("  news · all · us · europe · world · specialty · music".to_string());
    lines.push("".to_string());
    lines.push("In player: g/Tab guide · ↑↓ select · Enter tune · a–z hop · 0–6 filter · n/p station (news)".to_string());
    lines.push("Trailers: /watch trailers · s shuffle · S toggle shuffle mode · n/p next/prev".to_string());
    lines.push("".to_string());

    for region in ChannelRegion::ALL {
        let mut group: Vec<&'static ChannelDef> = CHANNELS
            .iter()
            .filter(|c| c.region == *region)
            .collect();
        group.sort_by(|a, b| a.id.cmp(b.id));
        if group.is_empty() {
            continue;
        }
        lines.push(format!("{}  (/{})", region.label(), region.id()));
        for c in group {
            let kind = match c.kind {
                ChannelKind::MusicTv => "music",
                ChannelKind::LiveNews => "live",
                ChannelKind::Generic => "?",
            };
            lines.push(format!("  {:12}  [{}] {}", c.id, kind, c.label));
        }
        lines.push("".to_string());
    }

    lines.push("X.com live (from):".to_string());
    lines.push("  /watch x                         # focus search for paste".to_string());
    lines.push("  /watch https://x.com/i/broadcasts/…".to_string());
    lines.push("  /watch https://x.com/user/status/…".to_string());
    lines.push("  /watch x:1ynJO…                  # bare broadcast id".to_string());
    lines.push("  In player: / then paste URL · Enter  ·  cookies: YTDLP_COOKIES_FROM_BROWSER".to_string());
    lines.push("X.com go-live (to):".to_string());
    lines.push("  /watch golive                    # start HLS pipeline (x-media-studio-hls)".to_string());
    lines.push("  In player: U (shift+u) uplink · studio.x.com/producer HLS source".to_string());
    lines.push("".to_string());
    lines.push("Also: /watch <youtube-url>  ·  /watch <search words>".to_string());
    lines.push("Bare /watch opens VEVO Friday music TV.".to_string());
    lines.join("\n")
}

/// Arg-completion items for the `/watch` slash dropdown.
pub fn channel_suggest_items() -> Vec<(&'static str, &'static str)> {
    let mut out: Vec<(&'static str, &'static str)> = Vec::with_capacity(CHANNELS.len() + 12);
    out.push(("list", "Show channels by region (A–Z)"));
    out.push(("news", "News guide · all live stations A–Z"));
    out.push(("all", "Full guide · every channel A–Z"));
    out.push(("us", "US / business news guide"));
    out.push(("europe", "UK / Europe news guide"));
    out.push(("world", "World news guide"));
    out.push(("specialty", "NASA · weather · specialty"));
    out.push(("music", "Music TV guide"));
    out.push(("trailers", "Movie trailers · shuffle feed (s random)"));
    out.push(("shuffle", "Open with shuffle mode (e.g. shuffle trailers)"));
    // A–Z channel ids
    let mut ids: Vec<&'static ChannelDef> = CHANNELS.iter().collect();
    ids.sort_by(|a, b| a.id.cmp(b.id));
    for c in ids {
        out.push((c.id, c.label));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bare_defaults_to_vevo() {
        let s = resolve_watch_source("");
        assert_eq!(s.channel_id.as_deref(), Some("vevo"));
        assert_eq!(s.kind, ChannelKind::MusicTv);
        assert!(s.url.contains("list=PLbAbqvKSxmj4"));
        assert!(!s.open_guide);
    }

    #[test]
    fn bloomberg_alias() {
        for a in ["bloomberg", "BBG", "Bloom", "bloomberg-tv"] {
            let s = resolve_watch_source(a);
            assert_eq!(s.channel_id.as_deref(), Some("bloomberg"), "alias {a}");
            assert_eq!(s.kind, ChannelKind::LiveNews);
            assert_eq!(s.guide_filter, GuideFilter::Region(ChannelRegion::Us));
        }
    }

    #[test]
    fn vevo_aliases() {
        for a in ["vevo", "friday", "vevo-tv", "VEVOTV"] {
            let s = resolve_watch_source(a);
            assert_eq!(s.channel_id.as_deref(), Some("vevo"), "alias {a}");
            assert_eq!(s.kind, ChannelKind::MusicTv);
        }
    }

    #[test]
    fn trailers_channel_resolves() {
        for a in ["trailers", "movies", "cinema", "xtrailers", "movie-trailers", "rt"] {
            let s = resolve_watch_source(a);
            assert_eq!(s.channel_id.as_deref(), Some("trailers"), "alias {a}");
            assert_eq!(s.kind, ChannelKind::MusicTv);
            assert!(s.url.contains("RottenTomatoesTrailers") || s.url.contains("trailer"));
            assert!(is_trailer_feed_id(a));
        }
        let n = resolve_watch_source("newtrailers");
        assert_eq!(n.channel_id.as_deref(), Some("newtrailers"));
        assert!(is_trailer_feed_id("newtrailers"));
    }

    #[test]
    fn lofi_and_nasa_aliases() {
        let lofi = resolve_watch_source("chill");
        assert_eq!(lofi.channel_id.as_deref(), Some("lofi"));
        assert_eq!(lofi.kind, ChannelKind::MusicTv);
        let nasa = resolve_watch_source("nasatv");
        assert_eq!(nasa.channel_id.as_deref(), Some("nasa"));
        assert_eq!(nasa.kind, ChannelKind::LiveNews);
    }

    #[test]
    fn url_passthrough() {
        let u = "https://www.youtube.com/watch?v=abc123";
        let s = resolve_watch_source(u);
        assert_eq!(s.url, u);
        assert!(s.channel_id.is_none());
    }

    #[test]
    fn free_text_becomes_live_search() {
        // Use a phrase that is not a built-in channel id/alias.
        let s = resolve_watch_source("kittens playing piano");
        assert!(s.url.starts_with("ytsearch1:"), "got {}", s.url);
        assert!(s.url.contains("kittens playing piano"));
        assert!(s.url.ends_with(" live"));
    }

    #[test]
    fn nasa_tv_words_hit_nasa_channel() {
        // First token "nasa" matches built-in before free-text search.
        let s = resolve_watch_source("nasa tv");
        assert_eq!(s.channel_id.as_deref(), Some("nasa"));
    }

    #[test]
    fn list_mentions_bloomberg_and_vevo() {
        let t = format_channel_list();
        assert!(t.contains("bloomberg"));
        assert!(t.contains("vevo"));
        assert!(t.contains("cnbc"));
        assert!(t.contains("US / business"));
        assert!(t.contains("UK / Europe"));
    }

    #[test]
    fn all_ids_unique() {
        let mut seen = std::collections::HashSet::new();
        for c in CHANNELS {
            assert!(seen.insert(c.id), "duplicate id {}", c.id);
        }
    }

    #[test]
    fn news_token_opens_guide_on_first_alpha() {
        let s = resolve_watch_source("news");
        assert!(s.open_guide);
        assert_eq!(s.guide_filter, GuideFilter::News);
        let first = channels_for_filter(GuideFilter::News)[0];
        assert_eq!(s.channel_id.as_deref(), Some(first.id));
    }

    #[test]
    fn us_region_opens_guide() {
        let s = resolve_watch_source("us");
        assert!(s.open_guide);
        assert_eq!(s.guide_filter, GuideFilter::Region(ChannelRegion::Us));
        // First US A–Z is abc
        assert_eq!(s.channel_id.as_deref(), Some("abc"));
    }

    #[test]
    fn hop_letter_b_is_bloomberg_in_us() {
        let ch = hop_letter(GuideFilter::Region(ChannelRegion::Us), 'b').unwrap();
        assert_eq!(ch.id, "bloomberg");
    }

    #[test]
    fn hop_letter_c_is_cbs_before_cnbc() {
        let ch = hop_letter(GuideFilter::News, 'c').unwrap();
        assert_eq!(ch.id, "cbs");
    }

    #[test]
    fn next_prev_news_wraps_alpha() {
        let list = news_channels_alpha();
        assert!(list.len() >= 3);
        let first = list[0].id;
        let second = list[1].id;
        let last = list[list.len() - 1].id;
        assert_eq!(
            next_news_channel(Some(first), None).map(|c| c.id),
            Some(second)
        );
        assert_eq!(
            next_news_channel(Some(last), None).map(|c| c.id),
            Some(first)
        );
        assert_eq!(
            prev_news_channel(Some(first), None).map(|c| c.id),
            Some(last)
        );
    }

    #[test]
    fn channels_for_filter_sorted() {
        let news = channels_for_filter(GuideFilter::News);
        let ids: Vec<_> = news.iter().map(|c| c.id).collect();
        let mut sorted = ids.clone();
        sorted.sort();
        assert_eq!(ids, sorted);
    }

    #[test]
    fn guide_filter_digits() {
        assert_eq!(GuideFilter::from_digit('1'), Some(GuideFilter::News));
        assert_eq!(
            GuideFilter::from_digit('3'),
            Some(GuideFilter::Region(ChannelRegion::Us))
        );
    }

    #[test]
    fn business_alias_is_us_region_not_bloomberg() {
        // "business" is a region token (US) so it opens the US guide, not Bloomberg.
        // Bloomberg keeps bbg/bloom aliases.
        let s = resolve_watch_source("business");
        assert!(s.open_guide);
        assert_eq!(s.guide_filter, GuideFilter::Region(ChannelRegion::Us));
    }

    #[test]
    fn space_alias_is_specialty_region() {
        // "space" maps to specialty region browse (nasa is still /watch nasa).
        let s = resolve_watch_source("space");
        assert!(s.open_guide);
        assert_eq!(
            s.guide_filter,
            GuideFilter::Region(ChannelRegion::Specialty)
        );
    }
}
