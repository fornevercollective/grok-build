#!/usr/bin/env bash
# Bundle "Memory Glass.app" — Rust + WKWebView (not Electron / not Chrome).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Memory Glass"
APP_DIR="$ROOT/${APP_NAME}.app"
MACOS="$APP_DIR/Contents/MacOS"
RES="$APP_DIR/Contents/Resources"

echo "Building memory-glass (release)…"
(cd "$ROOT" && cargo build --release)

BIN_SRC="$ROOT/target/release/memory-glass"
[[ -x "$BIN_SRC" ]] || { echo "missing $BIN_SRC" >&2; exit 1; }

echo "Assembling ${APP_DIR}…"
rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RES"

cp "$BIN_SRC" "$MACOS/memory-glass"
chmod +x "$MACOS/memory-glass"

# CFBundleExecutable wrapper — passes URL args through
cat > "$MACOS/Memory Glass" << 'WRAP'
#!/bin/bash
HERE="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${HOME}/Library/Logs/MemoryGlass"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/launch.log"
exec > >(tee -a "$LOG") 2>&1
echo "---- $(date -u +%Y-%m-%dT%H:%M:%SZ) ----"
BIN="$HERE/memory-glass"
if [[ ! -x "$BIN" ]]; then
  osascript -e 'display dialog "Memory Glass binary missing. Re-run build-mac-app.sh" with title "Memory Glass" buttons {"OK"} default button "OK" with icon stop' 2>/dev/null || true
  exit 1
fi
# Default cool-test URL if none provided
if [[ $# -eq 0 ]]; then
  set -- "https://www.spacex.com/"
fi
exec "$BIN" "$@"
WRAP
chmod +x "$MACOS/Memory Glass"

ICON_SRC="$ROOT/icons/AppIcon.icns"
ICON_PNG="$ROOT/icons/app-icon-1024.png"
if [[ -f "$ICON_SRC" ]]; then
  cp -f "$ICON_SRC" "$RES/AppIcon.icns"
  echo "  Icon: AppIcon.icns ($(wc -c < "$RES/AppIcon.icns" | tr -d ' ') bytes)"
else
  echo "WARN: missing $ICON_SRC — Dock icon may be generic" >&2
fi
if [[ -f "$ICON_PNG" ]]; then
  cp -f "$ICON_PNG" "$RES/icon.png"
fi

BUNDLE_VER="${MG_BUNDLE_VERSION:-$(date +%Y%m%d%H%M)}"
MARKETING_VER="$(grep -E '^version' "$ROOT/Cargo.toml" | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
MARKETING_VER="${MARKETING_VER:-0.2.0}"

cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Memory Glass</string>
  <key>CFBundleIdentifier</key>
  <string>dev.fornevercollective.memory-glass</string>
  <key>CFBundleName</key>
  <string>Memory Glass</string>
  <key>CFBundleDisplayName</key>
  <string>Memory Glass</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${MARKETING_VER}</string>
  <key>CFBundleVersion</key>
  <string>${BUNDLE_VER}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>CFBundleIconName</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSCameraUsageDescription</key>
  <string>Optional camera viewRay for depth focus tracking.</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

xattr -cr "$APP_DIR" 2>/dev/null || true
touch "$APP_DIR" "$APP_DIR/Contents/Info.plist" 2>/dev/null || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP_DIR" 2>/dev/null || true

echo ""
echo "  Built: $APP_DIR"
echo "  Engine: Rust + WKWebView · icon: rust shield / cyan portal"
echo "  Logs:   ~/Library/Logs/MemoryGlass/launch.log"
echo "  Run:    open \"$APP_DIR\""
echo "          open \"$APP_DIR\" --args 'https://www.spacex.com/vehicles/starship/'"
echo ""
