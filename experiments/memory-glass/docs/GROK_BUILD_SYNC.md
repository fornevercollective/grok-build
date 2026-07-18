# Memory Glass ↔ Grok Build sync

**Trust `SOURCE_REV` + path-checkout**, not GitHub “N commits behind.”

| Pin | Value |
|-----|--------|
| Monorepo `SOURCE_REV` | see repo root `SOURCE_REV` (path-checked from `xai-org/grok-build`) |
| Policy | [`docs/FORK_SYNC.md`](../../docs/FORK_SYNC.md) |
| Sync | `./scripts/sync-upstream-path-checkout.sh upstream/main` |
| Verify | `./scripts/verify-upstream-sync.sh` |

## What landed in the 2026-07-16…07-18 product tree (shell 0.2.102–0.2.105)

Highlights from `xai-grok-shell` changelog (synced monorepo):

| Ver | Highlights |
|-----|------------|
| **0.2.105** | Grok **4.5** default · `/summarize` · `/btw` in `--minimal` · snap-prompt setting · **login-env bash** · smoother scroll · MCP OAuth issuer fix · compaction tool_choice fix |
| **0.2.104** | Background work counts on status line · auth recovery · rate-limit detail |
| **0.2.103** | Plugin `require_sha` · full **rc env / cwd inheritance** · `grok wrap ssh` tip · voice per-model keys |
| **0.2.102** | `/jump` · `/timeline` · tab completion in `!bash` · fleet permission mode · plugin install qualifier |

### Agent tools (foundation MG can surface)

From `crates/codegen/xai-grok-tools` (grok_build implementations):

- **Shell / tasks:** `bash` (run_terminal_command), `task` / `task_output` / `kill_task`, `monitor`, `scheduler_*`
- **Files:** `read_file`, `search_replace`, `grep`, `list_dir`
- **Web:** `web_search`, `web_fetch` (SSRF hardened)
- **Agent UX:** `todo`, `update_goal`, `ask_user_question`, `enter/exit_plan_mode`
- **Media:** `image_gen`, `image_edit`, video gen stubs
- **MCP:** `search_tool` / `use_tool` via MCP crate
- **Editor infra:** PTY (`ptyctl`), sandbox, workspace, voice, update (`xai-grok-update`)

## Memory Glass bridges

| Surface | Path | Role |
|---------|------|------|
| **TOOLS drawer** | `hotpipe/mg-tools-drawer.js` | Left chrome — open modules on demand |
| **Grok terminal float** | `hotpipe/mg-grok-terminal.js` | Glass term · `/status` `/tools` `/version` `/open` · tool roster |
| **IPC** | `op: "grok_term"` in `src/main.rs` | Host probes + open external `grok` TUI |
| **Rubik language** | `hotpipe/rubik-language-float.js` | Face→lettering dual-space glass cube |

Adoption path: host deeper PTY sessions via monorepo `ptyctl` + `xai-grok-shell` while MG keeps glass chrome and dual-space lab tools.

## Do not

- Merge `upstream/main` into fork `main` (unrelated histories).
- Path-checkout `experiments/` or `docs/architecture-lab` from upstream.
