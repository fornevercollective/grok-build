# Grok Build Lab conventions

This directory is the **Grok Build Lab** companion (docs + Ship deck + chat + native shell).  
Historical folder name: `architecture-lab`. Product name: **Grok Build Lab**.

## Prefer extension surfaces

- Package workflows as **plugins / skills / hooks / MCP / agents** — not pager forks.
- Official TUI source: repo `crates/codegen/*`. Upstream `xai-org/grok-build` does **not** accept external PRs; ship on the fork.
- Installable pack for this lab: `plugin/lab-ship/`.

## When editing the lab UI

1. Keep `docs/architecture-lab/` path stable (CI/Pages).
2. Register new markdown pages in `nav.json`.
3. Bump cache-bust query strings on changed JS/CSS in `index.html` / `chat.html`.
4. Bump `package.json` + `version.json` `lab_semver` on user-visible releases.
5. Use unaltered official brand marks under `assets/brand/` and `docs/SpaceXAI_Grok_Assets/`.

## Speed & robustness

- Lazy-load heavy tool tabs (e.g. git history only when History selected).
- Ops APIs may be missing on static Pages — degrade gracefully.
- Chat: support **text + voice**; never hard-require mic.
- Short timeouts on `/api/*`; surface errors without freezing UI.

## Ship checklist

```bash
npm run status --prefix docs/architecture-lab
./serve.sh   # from docs/architecture-lab
grok plugin validate docs/architecture-lab/plugin/lab-ship
```

## Related

- Matrix: `content/17-ship-everything.md`
- Official user guide: `crates/codegen/xai-grok-pager/docs/user-guide/`
- CLI product: https://x.ai/cli
