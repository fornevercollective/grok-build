# Changelog · fc-media-suite

All notable releases of the **installable plugin pack** + coordinated fork binary stamps.

Format: Keep a Changelog · versioning: SemVer (`MAJOR.MINOR.PATCH`).

## [0.1.0] — 2026-07-29

### Added

- Marketplace plugin `fc-media-suite` with skills + slash command docs for:
  - `/watch` · `/gmux` · `/tv` · `/live` (`fc-live-demux-v1`)
  - `/cam` PiP + OS pop-out (`cam-popout`)
  - `/timesync` · `/clock` · `/zulu` (`fc-timesync-v1`)
  - `/map` · `/maptrace` (`fc-maptrace-v1`)
- Half-block TTY video path (`fc-halfblock-tty-video`) documented for `/gboom` + watch.
- One-liner install + doctor + update scripts.
- Credits, version file, fornevercollective marketplace catalog.
- Discovery keywords for SpaceXAI / x.com / SpaceX / Tesla / Neuralink / Grok.

### Binary coordination

Requires fornevercollective `xai-grok-pager` (or `grok`) with feature strings:

`fc-live-demux-v1` · `fc-timesync-v1` · `fc-maptrace-v1` · `fc-halfblock`

Doctor: `plugins/fc-media-suite/scripts/doctor.sh`
