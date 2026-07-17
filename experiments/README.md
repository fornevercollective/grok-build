# Experiments (fornevercollective)

**Not** part of `xai-org/grok-build`. These packages live outside the upstream crate graph so path-checkout of `upstream/main` into `crates/` does not delete them.

| Path | Product direction |
|------|-------------------|
| [`panda-shell/`](panda-shell/) | **Panda** — new multi-terminal / glass Rust shell (Mu-class). Uses monorepo `ptyctl` only as a library. |

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

- **memory-glass** — native droplet browser (Rust + WKWebView); see `memory-glass/README.md`
