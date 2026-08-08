---
description: fornevercollective media suite status · install · doctor · update
argument-hint: "[install|doctor|update|credits]"
---

# /media — fc-media-suite

Versioned fornevercollective media wall (`/watch` `/cam` `/clock` `/map`).
**Universal:** same surfaces via `fcs` in any terminal / any AI.

## $ARGUMENTS

| Arg | Action |
|-----|--------|
| (empty) | Print version, feature ids, launch hints |
| `install` | Universal `fcs` + plugin install |
| `doctor` | Binary stamps + tools + multi-AI |
| `update` | Plugin + git pull + rebuild |
| `credits` | Show CREDITS.md |

## Commands to run (agent)

```bash
PLUGIN="${GROK_PLUGIN_ROOT:-$HOME/Projects/grok-build/plugins/fc-media-suite}"
case "${ARGUMENTS:-}" in
  install) bash "$PLUGIN/scripts/fcs" install all; bash "$PLUGIN/scripts/install.sh" ;;
  doctor)  fcs doctor 2>/dev/null || bash "$PLUGIN/scripts/fcs" doctor ;;
  update)  bash "$PLUGIN/scripts/update.sh" ;;
  credits) cat "$PLUGIN/CREDITS.md" ;;
  *)
    echo "fc-media-suite v$(cat "$PLUGIN/VERSION" 2>/dev/null)"
    echo "universal: fcs watch|cam|clock|map  (any terminal · any AI)"
    echo "repo: https://github.com/fornevercollective/grok-build"
    fcs doctor 2>/dev/null || bash "$PLUGIN/scripts/doctor.sh" || true
    ;;
esac
```

Repo: https://github.com/fornevercollective/grok-build  
Credits: fornevercollective · base harness xAI
