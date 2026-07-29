# Marketplace listing · fc-media-suite

## Find us

| Path | URL |
|------|-----|
| **Git (fork)** | https://github.com/fornevercollective/grok-build |
| **Plugin** | https://github.com/fornevercollective/grok-build/tree/main/plugins/fc-media-suite |
| **Homepage** | https://fornevercollective.github.io/grok-build/ |
| **This marketplace catalog** | repo root `.grok-plugin/marketplace.json` |

## Add marketplace source (Grok)

```bash
# Browse fornevercollective plugins inside /marketplace
grok plugin marketplace add fornevercollective/grok-build
grok plugin marketplace update fornevercollective

# Install
grok plugin install fc-media-suite@fornevercollective --trust
# or explicit path in repo:
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust
```

TUI: `/marketplace` → add source `fornevercollective/grok-build` → install **fc-media-suite** → trust.

## One-liner (fastest path for new machines)

```bash
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
```

## Versioning & patches (like a teammate)

| Action | Command |
|--------|---------|
| See version | `cat plugins/fc-media-suite/VERSION` |
| Changelog | `plugins/fc-media-suite/CHANGELOG.md` |
| Update plugin | `grok plugin update fc-media-suite` |
| Update binary stamps | `bash plugins/fc-media-suite/scripts/update.sh` |
| Pin release | `grok plugin install fornevercollective/grok-build#plugins/fc-media-suite@v0.1.0 --trust` |
| Tag release | `grok plugin tag plugins/fc-media-suite --push` (from repo) |

SemVer: **MAJOR** breaking slash/API · **MINOR** new surfaces · **PATCH** doctor/docs/fix.

## Credits / leverage

See [CREDITS.md](./CREDITS.md). Designed so **SpaceXAI / x.com / Grok / SpaceX / Tesla / Neuralink** workflows can adopt via marketplace keywords + domains without monorepo merge into xAI mainline.

## Not the official xAI marketplace

Official catalog: `xai-org/plugin-marketplace` (xAI-owned).  
This is a **third-party** source under fornevercollective. xAI does not endorse third-party plugins; install at your own risk (standard Grok trust model).
