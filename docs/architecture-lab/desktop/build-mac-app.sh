#!/usr/bin/env bash
# Build a double-clickable Grok Build Lab.app for macOS (no code signing).
set -euo pipefail

DESKTOP="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DESKTOP/.." && pwd)"
APP_NAME="Grok Build Lab"
APP_DIR="$DESKTOP/${APP_NAME}.app"
MACOS="$APP_DIR/Contents/MacOS"
RES="$APP_DIR/Contents/Resources"

echo "Building ${APP_DIR}…"
rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RES"

# Bundle a copy of launch-mac.sh for relocatable .app
cp "$DESKTOP/launch-mac.sh" "$RES/launch-mac.sh"
chmod +x "$RES/launch-mac.sh"

# Launcher binary (shell)
cat > "$MACOS/Grok Build Lab" << 'LAUNCH'
#!/usr/bin/env bash
# Resolve: Contents/MacOS → Contents → Resources/launch-mac.sh
HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$(cd "$HERE/../Resources" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
# 1) Bundled script
if [[ -f "$RES/launch-mac.sh" ]]; then
  exec bash "$RES/launch-mac.sh"
fi
# 2) Sibling desktop folder (repo layout: desktop/Grok Build Lab.app)
DESKTOP="$(cd "$APP/.." && pwd)"
if [[ -f "$DESKTOP/launch-mac.sh" ]]; then
  exec bash "$DESKTOP/launch-mac.sh"
fi
osascript -e 'display alert "Grok Build Lab" message "launch-mac.sh not found. Re-run desktop/build-mac-app.sh from the repo."'
exit 1
LAUNCH
chmod +x "$MACOS/Grok Build Lab"

# Info.plist
cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>Grok Build Lab</string>
  <key>CFBundleIdentifier</key>
  <string>dev.fornevercollective.grok-build-lab</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Grok Build Lab</string>
  <key>CFBundleDisplayName</key>
  <string>Grok Build Lab</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSCameraUsageDescription</key>
  <string>Walkie burst camera uses your webcam for the glyph orb.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Listen mode and walkie use the microphone for voice.</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
</dict>
</plist>
PLIST

# Icon: convert PNG if sips available
PNG="$ROOT/assets/brand/grok-logomark-dark.png"
if [[ -f "$PNG" ]] && command -v sips >/dev/null 2>&1; then
  ICONSET="$RES/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for sz in 16 32 64 128 256 512; do
    sips -z $sz $sz "$PNG" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
    sips -z $((sz*2)) $((sz*2)) "$PNG" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
  done
  if command -v iconutil >/dev/null 2>&1; then
    iconutil -c icns "$ICONSET" -o "$RES/AppIcon.icns" 2>/dev/null || true
    rm -rf "$ICONSET"
  fi
  # electron-builder optional
  if [[ -f "$RES/AppIcon.icns" ]]; then
    cp "$RES/AppIcon.icns" "$DESKTOP/icon.icns" 2>/dev/null || true
  fi
fi

# PkgInfo
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

echo ""
echo "  Built: $APP_DIR"
echo "  Double-click to launch (starts lab server + app window)."
echo "  First Electron install:  cd desktop && npm install && npm start"
echo "  Or:                      ./launch-mac.sh"
echo ""

# Open Finder to the app
if command -v open >/dev/null 2>&1; then
  open "$DESKTOP"
fi
