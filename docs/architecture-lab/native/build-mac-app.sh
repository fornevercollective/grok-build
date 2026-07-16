#!/usr/bin/env bash
# Bundle Architecture Lab.app that runs the Rust native binary (not Electron).
set -euo pipefail

NATIVE="$(cd "$(dirname "$0")" && pwd)"
LAB="$(cd "$NATIVE/.." && pwd)"
APP_NAME="Architecture Lab"
APP_DIR="$NATIVE/${APP_NAME}.app"
MACOS="$APP_DIR/Contents/MacOS"
RES="$APP_DIR/Contents/Resources"

echo "Building native binary…"
(cd "$NATIVE" && cargo build --release)

BIN_SRC="$NATIVE/target/release/architecture-lab"
[[ -x "$BIN_SRC" ]] || { echo "missing $BIN_SRC" >&2; exit 1; }

echo "Assembling ${APP_DIR}…"
rm -rf "$APP_DIR"
mkdir -p "$MACOS" "$RES"

# Embed a lab snapshot pointer + launcher that finds repo or uses env
cp "$BIN_SRC" "$MACOS/architecture-lab"
chmod +x "$MACOS/architecture-lab"

# Wrapper sets ARCH_LAB_ROOT to the real lab next to the .app when in-repo,
# or to a sibling ArchitectureLabResources if shipped that way.
cat > "$MACOS/Architecture Lab" << 'WRAP'
#!/usr/bin/env bash
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
# Prefer bundled static snapshot (relocatable)
if [[ -f "$HERE/../Resources/lab/index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$HERE/../Resources/lab" && pwd)"
# In-repo: …/architecture-lab/native/Architecture Lab.app → lab is ../..
elif [[ -f "$APP/../index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$APP/.." && pwd)"
elif [[ -f "$APP/../../index.html" ]]; then
  export ARCH_LAB_ROOT="$(cd "$APP/../.." && pwd)"
fi
MODE="${LAB_WINDOW_MODE:-float}"
exec "$HERE/architecture-lab" --mode "$MODE" --root "${ARCH_LAB_ROOT:-.}"
WRAP
chmod +x "$MACOS/Architecture Lab"

# Optional: ship a copy of static lab into Resources for relocatable app
# (keeps working if moved without the monorepo)
rsync -a --delete \
  --exclude 'native' \
  --exclude 'desktop/node_modules' \
  --exclude 'desktop/dist' \
  --exclude '.git' \
  "$LAB/" "$RES/lab/" 2>/dev/null || {
  mkdir -p "$RES/lab"
  cp -R "$LAB/index.html" "$LAB/assets" "$LAB/content" "$LAB/nav.json" \
    "$LAB/manifest.webmanifest" "$LAB/sw.js" "$LAB/version.json" \
    "$RES/lab/" 2>/dev/null || true
}

cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Architecture Lab</string>
  <key>CFBundleIdentifier</key>
  <string>ai.x.architecture-lab.native</string>
  <key>CFBundleName</key>
  <string>Architecture Lab</string>
  <key>CFBundleDisplayName</key>
  <string>Architecture Lab</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.2.0</string>
  <key>CFBundleVersion</key>
  <string>2</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSCameraUsageDescription</key>
  <string>Walkie burst camera for the glyph orb.</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Listen mode for voice intents.</string>
</dict>
</plist>
PLIST
echo -n "APPL????" > "$APP_DIR/Contents/PkgInfo"

echo ""
echo "  Built: $APP_DIR"
echo "  Engine: Rust + WKWebView (tao/wry) — not Electron"
echo "  Run:    open \"$APP_DIR\""
echo "  CLI:    $BIN_SRC --mode float|lab|tui"
echo ""
command -v open >/dev/null && open "$(dirname "$APP_DIR")"
