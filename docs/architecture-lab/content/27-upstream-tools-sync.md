# Upstream monorepo tools sync · Lab 1–4+

**Policy:** path-checkout from `xai-org/grok-build` · **keep** `docs/architecture-lab` + `experiments/` · never force-merge · never refork-wipe Lab.

## What we pulled (xai-org tip `8adf901`)

```bash
./scripts/sync-upstream-path-checkout.sh    # or pass a SHA
# checks out: crates/ Cargo.* SOURCE_REV README bin/ third_party/ prod/ …
```

`SOURCE_REV` records monorepo commit: see repo root file.

### Tool packs now in tree (`crates/codegen/xai-grok-tools`)

| Namespace | Tools (high level) |
|-----------|-------------------|
| **grok_build** | read_file · search_replace · list_dir · grep · bash · web_search · web_fetch · image_gen · image_edit · video_gen · monitor · task · task_output · kill_task · scheduler_* · enter/exit_plan_mode · ask_user_question · update_goal · todo · lsp · search_tool · use_tool · deploy_app |
| **grok_build_concise** | slim bash/read/edit |
| **grok_build_hashline** | hashline edit/grep/read |
| **codex** | apply_patch · grep_files · list_dir · read_file |
| **opencode** | bash · edit · glob · grep · read · skill · write · todowrite |
| **memory** | memory search/get |
| **skills / MCP** | discovery · use_tool bridge |

Also synced: hooks SSRF fix, headless drain, pager/shell/workspace/auth, voice config, DotSlash/README notes.

### Lab surfaces for tools

| API / UI | Role |
|----------|------|
| `GET /api/tools/catalog` | Presentation catalog |
| Workbench **Tools** button | Paint tool cards from catalog |
| Iterate text → tool cards | `LabToolsCatalog.extractFromText` |
| Real tool execution | Still via **`grok`** (TUI / `-p` / Multi PTY) — Lab does not reimplement harness |

---

## Lab push 1–4+ (this wave)

| # | Item | Shipped |
|---|------|---------|
| **1** | Center agent tool stream | Iterate + tool cards + catalog extract from reply |
| **2** | TerminalPane chrome αβγ | Workbench panes: dots, chrome bar, prompt glyphs |
| **3** | Session interchange | `lab.session.v1` · `LabSession` · **Session** export · `~/.panda/lab-session.json` |
| **4** | Option C host pipe | `scripts/panda-host-lab.sh` |
| **+** | Repeatable sync | `scripts/sync-upstream-path-checkout.sh` |

---

## Do not refork

Reforking loses Lab (native, workbench, LTS, A/B/C docs). Prefer:

```bash
git fetch upstream
./scripts/sync-upstream-path-checkout.sh
git status   # docs/architecture-lab should be clean
# build monorepo tools when needed:
# cargo build -p xai-grok-pager-bin   # requires DotSlash for protoc
```

---

## Related

- [Dev-off · grok-cli · overview](#/26-dev-off-grok-cli-overview)
- [A · B · C path](#/24-abc-path)
- [Colossus/Dojo LTS](#/25-colossus-dojo-lts)
