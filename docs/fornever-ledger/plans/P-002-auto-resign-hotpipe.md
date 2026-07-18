# P-002 · Auto re-sign on hotpipe deploy

## Why
Copying JS/binary into `Memory Glass.app` without codesign → taskgated **SIGKILL** (MG-001, MG-008).

## α
- Hook points: build-mac-app, manual cp, mg-pack-to-grok, agent deploy notes
- Always call `scripts/resign-app.sh`

## β
- Add `scripts/deploy-hotpipe.sh` that cp + resign + verify
- Document in memory-glass skill
- Optional: mtime watcher that resigns after hotpipe edit into Resources

## γ
- Intentionally cp webgrid-play.js → Resources; run deploy script; `codesign --verify --deep --strict` OK; app launches

## Success
No unsigned Resources edits in the recommended path.
