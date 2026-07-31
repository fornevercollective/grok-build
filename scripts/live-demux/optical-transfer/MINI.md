# Mac Mini · optical + media suite (fast path)

## One-shot after `git pull`

```bash
cd ~/Projects/grok-build   # or your clone path
bash scripts/dev-mac-mini.sh --optical
```

Debug build is intentional (faster than release for daily test).

## Optical stack (browser + bloomberg mix)

```bash
# Terminal A — Decimen HTTPS (phone RX needs https)
bash scripts/live-demux/optical-transfer/decimen.sh dev

# Terminal B — same stream as /watch bloomberg + ffplay
bash scripts/live-demux/optical-transfer/mix-pipe.sh bloomberg

# Browser
open 'https://127.0.0.1:5173/send/?mix=watch'
# composite: broadcast · QR region color: inverse|match
```

Stop mix: `bash scripts/live-demux/optical-transfer/mix-pipe.sh stop`

## Grok slash (after deploy)

```text
/optical
/optical bloomberg
/optical qr
/watch optical
/map
```

## Deps on Mini

- rustc/cargo (same as laptop)
- yt-dlp, ffmpeg, ffplay (mix-pipe)
- node + npm (Decimen `npm install` once under vendor/decimen-optical-transfer)

## Notes

- `node_modules/` is gitignored — Mini runs `npm install` once.
- `dist/` can be rebuilt with `bash …/decimen.sh build`.
- Prefer debug deploy for iteration; release only before demos.
