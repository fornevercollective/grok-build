---
description: fornevercollective media suite status · install · doctor · update
argument-hint: "[install|doctor|update|credits]"
---

# /media — fc-media-suite

Versioned fornevercollective media wall (`/watch` `/cam` `/clock` `/map`).

## $ARGUMENTS

| Arg | Action |
|-----|--------|
| (empty) | Print version, feature ids, launch hints |
| `install` | Run install one-liner path |
| `doctor` | Binary feature stamps + tools |
| `update` | Plugin + git pull + rebuild |
| `credits` | Show CREDITS.md |

## Commands to run (agent)

```bash
PLUGIN="${GROK_PLUGIN_ROOT:-$HOME/Projects/grok-build/plugins/fc-media-suite}"
case "${ARGUMENTS:-}" in
  install) bash "$PLUGIN/scripts/install.sh" ;;
  doctor)  bash "$PLUGIN/scripts/doctor.sh" ;;
  update)  bash "$PLUGIN/scripts/update.sh" ;;
  credits) cat "$PLUGIN/CREDITS.md" ;;
  *)
    echo "fc-media-suite v$(cat "$PLUGIN/VERSION" 2>/dev/null)"
    echo "repo: https://github.com/fornevercollective/grok-build"
    echo "launch: bash scripts/launch-watch.sh | launch-timesync.sh | launch-map.sh"
    bash "$PLUGIN/scripts/doctor.sh" || true
    ;;
esac
```

Repo: https://github.com/fornevercollective/grok-build  
Credits: fornevercollective · base harness xAI
