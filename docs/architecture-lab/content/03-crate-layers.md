# Crate layers & turn flow

## Layered crates

### Surface
| Crate | Role |
|-------|------|
| `xai-grok-pager-bin` | Composition root binary |
| `xai-grok-pager` | TUI app: scrollback, prompt, dispatch |
| `xai-grok-pager-render` | Themes, syntax, markdown paint |
| `xai-grok-pager-minimal` | Alternate render mode |
| `xai-ratatui-inline` | Inline viewport + scrollback |
| `xai-ratatui-textarea` | Prompt editing |
| `xai-grok-voice` | Optional voice |

### Runtime
| Crate | Role |
|-------|------|
| `xai-grok-shell` | Session loop, leader, headless, ACP glue |
| `xai-chat-state` | Conversation actor, compaction |
| `xai-prompt-queue` | Turn queue / interjection |
| `xai-grok-agent` | Prompts, plugin load, agent defs |
| `xai-grok-sampler` | Model streaming I/O |
| `xai-grok-subagent-resolution` | explore / plan / custom children |
| `xai-acp-lib` | ACP protocol helpers |

### Tools + host
| Crate | Role |
|-------|------|
| `xai-grok-tools` | Shell, edit, search, web, … |
| `xai-grok-workspace` | FS, VCS, exec, checkpoints, worktrees |
| `xai-grok-sandbox` | OS isolation |
| `xai-codebase-graph` | Tree-sitter index / navigation |
| `xai-hunk-tracker` | Edit tracking |
| `xai-fast-worktree` | Fast worktree pool |

### Platform
| Crate | Role |
|-------|------|
| `xai-grok-config` / `-types` | Config load/merge |
| `xai-grok-auth` | Login / tokens |
| `xai-grok-models` | Model catalog |
| `xai-grok-memory` | Cross-session memory |
| `xai-grok-mcp` | MCP client runtime |
| `xai-grok-hooks` | Hook runner |
| `xai-grok-plugin-marketplace` | Install / marketplace |
| `xai-grok-telemetry` | Tracing / metrics |
| `xai-crash-handler` | Crash dump + terminal restore |
| `xai-grok-update` | Self-update |

## One agent turn

```
User prompt (TUI / -p / ACP)
        │
        ▼
 SessionStart / UserPromptSubmit hooks
        │
        ▼
 System context: AGENTS.md + skills + memory + config
        │
        ▼
 Sampler ──► model stream (thoughts + text + tool_calls)
        │
        ▼
 For each tool_call:
   PreToolUse hook (may DENY)
   → tools + workspace (+ sandbox)
   → PostToolUse / Failure hooks
        │
        ▼
 Optional spawn_subagent (isolated child)
        │
        ▼
 Scrollback / ACP notifications / Stop hooks
```

## Build tips

```bash
cargo check -p xai-grok-pager-bin   # prefer per-crate
cargo run -p xai-grok-pager-bin
# full workspace is slow — avoid by default
```

Root `Cargo.toml` is **generated** — edit per-crate manifests.
