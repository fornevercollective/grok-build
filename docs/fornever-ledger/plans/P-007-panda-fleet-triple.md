# P-007 · Panda fleet triple-pane ship

## Why
panda-shell roadmap: wire lab Spawn triple → three panda panes with α/β/γ profiles.

## α
- Confirm `panda new` splits API
- Map profiles to panes
- Lab API `/api/panda/open` if present

## β
- `panda-loop.sh init` + `panda new fleet --splits 3` docs
- Auto-source profile per pane if supported; else pane scripts
- Ensure `~/.panda` never clobbers `~/.grok`

## γ
- Three panes show α/β/γ banners from profiles
- handoff status updates lab-handoff.json

## Success
Operator can run plan→build→verify without manual env guesswork.
