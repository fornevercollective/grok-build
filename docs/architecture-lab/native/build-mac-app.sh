#!/usr/bin/env bash
# Bundle "Grok Build Lab.app" — Rust + WKWebView (not Electron).
set -euo pipefail

NATIVE="$(cd "$(dirname "$0")" && pwd)"
LAB="$(cd "$NATIVE/.." && pwd)"
APP_NAME="Grok Build Lab"
APP_DIR="$NATIVE/${APP_NAME}.app"
MACOS="$APP_DIR/Contents/MacOS"
RES="$APP_DIR/Contents/Resources"

echo "Building native binary…"
(cd "$NATIVE" && cargo build --release)

BIN_SRC=""
for cand in "$NATIVE/target/release/grok-build-lab" "$NATIVE/target/release/architecture-lab"; do
  if [[ -x "$cand" ]]; then BIN_SRC="$cand"; break; fi
done
[[ -n "$BIN_SRC" && -x "$BIN_SRC" ]] || { echo "missing release binary (cargo build --release)" >&2; exit 1; }

echo "Assembling ${APP_DIR}…"
# Remove legacy bundle names if present
rm -rf "$APP_DIR" "$NATIVE/Architecture Lab.app"
mkdir -p "$MACOS" "$RES"

# Ship as grok-build-lab (keep architecture-lab alias for old wrappers)
cp "$BIN_SRC" "$MACOS/grok-build-lab"
cp "$BIN_SRC" "$MACOS/architecture-lab"
chmod +x "$MACOS/grok-build-lab" "$MACOS/architecture-lab"

# Robust launcher: always prefer bundled Resources/lab, log failures, show dialog
# CFBundleExecutable must match this filename.
cat > "$MACOS/Grok Build Lab" << 'WRAP'
#!/bin/bash
# Do not use set -e before we can show a dialog
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${HOME}/Library/Logs/GrokBuildLab"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/launch.log"
exec > >(tee -a "$LOG") 2>&1
echo "---- $(date -u +%Y-%m-%dT%H:%M:%SZ) ----"
echo "HERE=$HERE"

# 1) Bundled snapshot (preferred for double-click .app)
if [[ -f "$HERE/../Resources/lab/index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$HERE/../Resources/lab" && pwd)"
# 2) In-repo layout: …/architecture-lab/native/Grok Build Lab.app
elif [[ -f "$HERE/../../../index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$HERE/../../.." && pwd)"
elif [[ -f "$HERE/../../../../index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$HERE/../../../.." && pwd)"
fi

echo "ARCH_LAB_ROOT=${ARCH_LAB_ROOT:-unset}"
MODE="${LAB_WINDOW_MODE:-float}"
if [[ -x "$HERE/grok-build-lab" ]]; then
  BIN="$HERE/grok-build-lab"
else
  BIN="$HERE/architecture-lab"
fi

if [[ ! -x "$BIN" ]]; then
  osascript -e 'display dialog "Grok Build Lab binary missing inside the app bundle. Re-run native/build-mac-app.sh" with title "Grok Build Lab" buttons {"OK"} default button "OK" with icon stop' 2>/dev/null || true
  exit 1
fi

if [[ -z "${ARCH_LAB_ROOT:-}" || ! -f "${ARCH_LAB_ROOT}/index.html" ]]; then
  osascript -e 'display dialog "Could not find lab index.html. Re-run: docs/architecture-lab/native/build-mac-app.sh" with title "Grok Build Lab" buttons {"OK"} default button "OK" with icon stop' 2>/dev/null || true
  exit 1
fi

# port 0 = free port (avoids crash when ./serve.sh already holds :8765)
export RUST_LOG="${RUST_LOG:-grok_build_lab=info,architecture_lab=info}"
export RUST_BACKTRACE="${RUST_BACKTRACE:-1}"
exec "$BIN" --mode "$MODE" --root "$ARCH_LAB_ROOT" --port 0
WRAP
chmod +x "$MACOS/Grok Build Lab"

# Ship static lab for relocatable double-click
echo "Copying lab assets into Resources/lab…"
rm -rf "$RES/lab"
mkdir -p "$RES/lab"
rsync -a \
  --exclude 'native' \
  --exclude 'desktop/node_modules' \
  --exclude 'desktop/dist' \
  --exclude 'desktop/*.app' \
  --exclude '**/*.app' \
  --exclude '.git' \
  --exclude 'scripts' \
  "$LAB/" "$RES/lab/"

# App icon: rainbow chat aura + official Grok mark (composed, mark unaltered)
ICON_SRC="$NATIVE/icons/AppIcon.icns"
ICON_PNG="$NATIVE/icons/app-icon-1024.png"
if [[ -f "$ICON_SRC" ]]; then
  cp "$ICON_SRC" "$RES/AppIcon.icns"
fi
if [[ -f "$ICON_PNG" ]]; then
  cp "$ICON_PNG" "$RES/icon.png"
elif [[ -f "$LAB/assets/brand/grok-logomark-dark.png" ]]; then
  cp "$LAB/assets/brand/grok-logomark-dark.png" "$RES/icon.png"
fi

cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Grok Build Lab</string>
  <key>CFBundleIdentifier</key>
  <string>dev.fornevercollective.grok-build-lab</string>
  <key>CFBundleName</key>
  <string>Grok Build Lab</string>
  <key>CFBundleDisplayName</key>
  <string>Grok Build Lab</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.3.2</string>
  <key>CFBundleVersion</key>
  <string>6</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSCameraUsageDescription</key>
  <string>Walkie burst camera for the glyph orb.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Listen mode for voice intents.</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

# Clear quarantine so double-click works without Gatekeeper bounce-kill
xattr -cr "$APP_DIR" 2>/dev/null || true

echo ""
echo "  Built: $APP_DIR"
echo "  Engine: Rust + WKWebView — free port (won't die if :8765 busy)"
echo "  Logs:   ~/Library/Logs/GrokBuildLab/launch.log"
echo "  Run:    open \"$APP_DIR\""
echo ""
