#!/usr/bin/env bash
# Bundle "Memory Glass.app" — Rust + WKWebView (not Electron / not Chrome).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Memory Glass"
APP_DIR="$ROOT/${APP_NAME}.app"
MACOS="$APP_DIR/Contents/MacOS"
RES="$APP_DIR/Contents/Resources"

echo "Building memory-glass (release)…"
# Force rebuild stamp every bundle so BUILD_EPOCH always advances
(cd "$ROOT" && touch build.rs && cargo build --release)

BIN_SRC="$ROOT/target/release/memory-glass"
[[ -x "$BIN_SRC" ]] || { echo "missing $BIN_SRC" >&2; exit 1; }

BUILD_EPOCH="$(date +%s)"
BUILD_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if [[ -f "$ROOT/BUILD_STAMP" ]]; then
  echo "  BUILD_STAMP:"
  sed 's/^/    /' "$ROOT/BUILD_STAMP" || true
fi
echo "  bundle wall clock: epoch=${BUILD_EPOCH} iso=${BUILD_ISO}"
echo "  binary mtime: $(stat -f '%Sm' -t '%Y-%m-%dT%H:%M:%S%z' "$BIN_SRC" 2>/dev/null || stat -c '%y' "$BIN_SRC" 2>/dev/null || echo '?')"

echo "Assembling ${APP_DIR}…"
rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RES"

cp "$BIN_SRC" "$MACOS/memory-glass"
chmod +x "$MACOS/memory-glass"
# Prove which binary is inside the bundle
{
  echo "exe_epoch=${BUILD_EPOCH}"
  echo "exe_iso=${BUILD_ISO}"
  echo "exe_path=Contents/MacOS/memory-glass"
  if [[ -f "$ROOT/BUILD_STAMP" ]]; then cat "$ROOT/BUILD_STAMP"; fi
} > "$RES/BUILD_STAMP"
# Do NOT put BUILD_STAMP in MacOS/ — taskgated treats extra files there as
# unsigned code objects → SIGKILL (Code Signature Invalid) on launch.

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

# Bundle hot-pipe (live.js · agent · mitigations) for in-app soft reload
if [[ -d "$ROOT/hotpipe" ]]; then
  rm -rf "$RES/hotpipe"
  cp -R "$ROOT/hotpipe" "$RES/hotpipe"
  echo "  Hotpipe: Resources/hotpipe (live inject · agent · Grok packs)"
fi

# Bundle voice + vision snapshots + MANIFEST (update package)
PACK="$ROOT/Resources-pack"
if [[ -d "$PACK/voice" ]]; then
  rm -rf "$RES/voice"
  cp -R "$PACK/voice" "$RES/voice"
  chmod +x "$RES/voice"/*.sh 2>/dev/null || true
  echo "  Voice:   Resources/voice (speak · bridge · mute · STS · clone)"
fi
if [[ -d "$PACK/vision" ]]; then
  rm -rf "$RES/vision"
  cp -R "$PACK/vision" "$RES/vision"
  chmod +x "$RES/vision"/*.sh 2>/dev/null || true
  echo "  Vision:  Resources/vision (still-server · capture)"
fi
if [[ -f "$PACK/MANIFEST.md" ]]; then
  cp -f "$PACK/MANIFEST.md" "$RES/MANIFEST.md"
  echo "  Manifest: Resources/MANIFEST.md"
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
  <string>Memory Glass uses the camera for head tracking, face mesh, hand expansion HUD, and live PIP. Enable Camera for Memory Glass in System Settings › Privacy &amp; Security › Camera.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Microphone is not required. This key is present so media prompts remain clear if WebKit requests capture together.</string>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

xattr -cr "$APP_DIR" 2>/dev/null || true
touch "$APP_DIR" "$APP_DIR/Contents/Info.plist" "$RES/AppIcon.icns" 2>/dev/null || true
# Force LaunchServices + Dock to notice a new icon/version
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f -R -trusted "$APP_DIR" 2>/dev/null || \
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "$APP_DIR" 2>/dev/null || true

# Ad-hoc codesign so TCC Camera permission sticks across launches
# (unsigned rebuilds look like a new app → "would like to access the camera" every time)
if command -v codesign >/dev/null 2>&1; then
  xattr -cr "$APP_DIR" 2>/dev/null || true
  if codesign --force --deep -s - \
    --identifier "dev.fornevercollective.memory-glass" \
    --entitlements /dev/null \
    "$APP_DIR" 2>/dev/null \
    || codesign --force --deep -s - --identifier "dev.fornevercollective.memory-glass" "$APP_DIR" 2>/dev/null; then
    echo "  Codesign: ad-hoc (stable id · TCC camera can persist)"
  else
    echo "  Codesign: skipped/fail (camera TCC may re-prompt each rebuild)" >&2
  fi
fi

# Mirror to ~/Applications so "open -a Memory Glass" / Dock hits the same build
if [[ -d "$HOME/Applications" ]]; then
  rm -rf "$HOME/Applications/Memory Glass.app"
  cp -R "$APP_DIR" "$HOME/Applications/Memory Glass.app"
  xattr -cr "$HOME/Applications/Memory Glass.app" 2>/dev/null || true
  # Re-sign AFTER copy — cp can invalidate sealed hashes / leave binary linker-only signed
  if command -v codesign >/dev/null 2>&1; then
    codesign --force --deep -s - \
      --identifier "dev.fornevercollective.memory-glass" \
      "$HOME/Applications/Memory Glass.app" 2>/dev/null \
      || echo "  WARN: post-install codesign failed" >&2
  fi
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -f "$HOME/Applications/Memory Glass.app" 2>/dev/null || true
  echo "  Installed: $HOME/Applications/Memory Glass.app"
fi

echo ""
echo "  Built: $APP_DIR"
echo "  Engine: Rust + WKWebView · icon: graphite shield / white singularity"
echo "  Stamp:  pkg=${MARKETING_VER} bundle=${BUNDLE_VER} epoch=${BUILD_EPOCH}"
echo "  Logs:   ~/Library/Logs/MemoryGlass/launch.log"
echo "  Run:    open \"$APP_DIR\""
echo "          open \"$HOME/Applications/Memory Glass.app\""
echo "  Tip:    if Dock icon is stale: killall Dock"
echo ""
# Kill any old process so relaunch cannot leave a stale binary running
pkill -x memory-glass 2>/dev/null || true
