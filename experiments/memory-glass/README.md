# Memory Glass · Native browser shell

**Rust-first · tao + wry → WKWebView · not Chrome · not Electron**

Droplet-glass concept browser for the SpaceX cool-test surface: transparent shell, flat page (no distance skew/tilt), three tabs on boot, depth HUD optional.

| Piece | Stack |
|-------|--------|
| Window | **tao** 0.31 |
| Web | **wry** 0.48 → macOS **WKWebView** (`transparent`) |
| Icon | Rust-oxide shield + cyan glass portal (Dock + window) |
| Bundle | `build-mac-app.sh` → `Memory Glass.app` |

## Icon

Rust-leaning superhero mark:

- Iron-oxide / rust metal rim + rivets  
- Glass droplet shield  
- Cyan energy portal (Memory Glass aperture)  
- Blueprint grid underlay  

Assets:

- `icons/app-icon-1024.png` — master  
- `icons/AppIcon.icns` — macOS Dock  
- `icons/AppIcon.iconset/` — source sizes  
- `assets/icon_128.rgba` — embedded window icon (128×128 RGBA)

## Build & run

```bash
cd experiments/memory-glass   # or this folder
cargo build --release
./target/release/memory-glass "https://www.spacex.com/"
# or
./launch.sh
```

### macOS app (Dock icon)

```bash
./build-mac-app.sh
open "Memory Glass.app"
```

| Shortcut | Action |
|----------|--------|
| ⌘T | New tab |
| ⌘N | New window |
| ⌘W | Close tab / window |
| ⌘L | Focus search |
| Corner `::` | Drag · double-click dim |
| `.....` | Search peek |

Default tabs: **spacex · starship · launches**.

## Grok-build placement

Lives under:

```text
experiments/memory-glass/
```

Standalone Cargo workspace (`[workspace]` in this folder) — not a monorepo member (same pattern as `docs/architecture-lab/native`).

Conceptual surface (DOM Memory Glass) remains:

```text
docs/architecture-lab/assets/memory-glass.{js,css}
docs/architecture-lab/content/32-memory-glass-browser.md
```

## License

Apache-2.0 (aligned with grok-build).
