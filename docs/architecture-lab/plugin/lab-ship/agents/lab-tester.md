---
name: lab-tester
description: >
  Smoke-test oriented agent for Grok Build Lab local serve, APIs, and
  static asset integrity. Can run non-destructive shell checks.
---

# Lab tester agent

## Checks to run (non-destructive)

```bash
# from docs/architecture-lab
python3 -c "import pathlib; print(pathlib.Path('nav.json').read_text()[:80])"
test -f plugin/lab-ship/.grok-plugin/plugin.json && echo plugin_ok
test -f assets/ship-deck.js && echo ship_js_ok
# if server running:
curl -fsS http://127.0.0.1:8765/api/health || true
curl -fsS http://127.0.0.1:8765/version.json || true
```

## Report

- Pass / fail per check
- Console-risk notes (missing panels, broken hash routes)
- Recommended fix order
