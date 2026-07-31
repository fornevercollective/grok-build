#!/usr/bin/env bash
# Fast fornevercollective bring-up on Mac Mini (or any Mac pull target).
#
#   bash scripts/dev-mac-mini.sh              # git pull + debug deploy
#   bash scripts/dev-mac-mini.sh --optical    # + decimen deps + mix-pipe doctor
#   bash scripts/dev-mac-mini.sh --skip-build # install last binary only
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OPTICAL=0
SKIP_BUILD=0
for a in "$@"; do
  case "$a" in
    --optical) OPTICAL=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

echo "==> dev-mac-mini · $ROOT"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "    branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
  git status -sb | head -20
fi

export CARGO_TERM_COLOR=always
if [[ "$SKIP_BUILD" -eq 1 ]]; then
  bash scripts/deploy-fc-grok.sh --debug --skip-build
else
  # debug is much faster for mini iteration
  bash scripts/deploy-fc-grok.sh --debug
fi

if [[ "$OPTICAL" -eq 1 ]]; then
  OT="$ROOT/scripts/live-demux/optical-transfer"
  echo "==> optical-transfer bring-up"
  if [[ -d "$OT/vendor/decimen-optical-transfer" ]]; then
    (
      cd "$OT/vendor/decimen-optical-transfer"
      if [[ ! -d node_modules ]]; then
        npm ci --omit=dev 2>/dev/null || npm install
      fi
      if [[ ! -f dist/send/index.html ]]; then
        npm run build
      fi
      echo "    decimen: ok · bash $OT/decimen.sh dev"
    )
  fi
  command -v yt-dlp >/dev/null && command -v ffmpeg >/dev/null && \
    echo "    mix-pipe: yt-dlp+ffmpeg ok · bash $OT/mix-pipe.sh bloomberg" || \
    echo "    mix-pipe: install yt-dlp + ffmpeg for /watch bloomberg pipe"
fi

echo "==> done · grok $(~/.grok/bin/grok --version 2>/dev/null | head -1 || echo '?')"
echo "    smoke: grok   then  /optical · /watch optical · /map"
