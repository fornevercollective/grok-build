# Experiments (fornevercollective)

**Not** part of `xai-org/grok-build`. These packages live outside the upstream crate graph so path-checkout of `upstream/main` into `crates/` does not delete them.

| Path | Product direction |
|------|-------------------|
| [`panda-shell/`](panda-shell/) | **Panda** — multi-terminal / glass Rust shell (Mu-class). Uses monorepo `ptyctl` only as a library. |
| [`memory-glass/`](memory-glass/) | **Memory Glass** — native droplet browser shell (**tao + wry → WKWebView**). Transparent shell, flat page, three tabs, rust-shield Dock icon. Not Chrome / not Electron. |

---

## Panda shell

After a full `Cargo.toml` overwrite from upstream, re-add workspace members:

```toml
"experiments/panda-shell",
```

Build:

```bash
cargo build -p panda-shell --release
./target/release/panda info
```

Lab map: [Panda shell experiment](../docs/architecture-lab/content/22-panda-shell.md) (`#/22-panda-shell`).

---

## Memory Glass

Standalone Cargo workspace under [`memory-glass/`](memory-glass/) (not a monorepo workspace member — same isolation idea as `docs/architecture-lab/native`).

```bash
cd experiments/memory-glass
cargo build --release
./target/release/memory-glass "https://www.spacex.com/"
# macOS Dock icon (rust shield + cyan portal):
./build-mac-app.sh && open "Memory Glass.app"
```

| Piece | Notes |
|-------|--------|
| README | [`memory-glass/README.md`](memory-glass/README.md) |
| Engine | Rust · **tao** + **wry** → system **WKWebView** (`transparent`) |
| Icon | `memory-glass/icons/AppIcon.icns` · embedded `assets/icon_128.rgba` |
| Lab concept (DOM) | [`docs/architecture-lab`](../docs/architecture-lab/) — `assets/memory-glass.{js,css}`, `#/32-memory-glass-browser`, `browser.html` |

Lab map: [Memory Glass browser](../docs/architecture-lab/content/32-memory-glass-browser.md) (`#/32-memory-glass-browser`).
