# Install · fornevercollective media suite

**Fast path for anyone (including SpaceXAI / Grok ops) who should not need the whole monorepo story.**

## 30-second install

```bash
curl -fsSL https://raw.githubusercontent.com/fornevercollective/grok-build/main/plugins/fc-media-suite/scripts/install.sh | bash
```

## Marketplace

```bash
grok plugin marketplace add fornevercollective/grok-build
grok plugin install fornevercollective/grok-build#plugins/fc-media-suite --trust
grok plugin enable fc-media-suite
```

## Run

```bash
cd ~/Projects/grok-build   # created by install.sh
bash scripts/launch-watch.sh
# /watch · /cam · /clock · /map starbase
```

## Update patches

```bash
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/update.sh
# or: grok plugin update fc-media-suite
```

## Links

- Repo: https://github.com/fornevercollective/grok-build  
- Plugin: https://github.com/fornevercollective/grok-build/tree/main/plugins/fc-media-suite  
- Credits: `plugins/fc-media-suite/CREDITS.md`  
- Version: `plugins/fc-media-suite/VERSION` (currently **0.1.0**)

## Doctor

```bash
bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/doctor.sh
```

Must report OK for: `fc-live-demux-v1` · `fc-timesync-v1` · `fc-maptrace-v1` · `fc-halfblock`.
