# Riffing on these docs

This lab is **yours to mutate**. Markdown in `content/` is the source of truth.

Before you expand the lab, read the compliance + fork map:

→ **[Dev build · dependencies · versioning · forks](#/14-dev-build-and-forks)**

---

## Contributing boundaries (important)

| Surface | Accepts external PRs? | Where work lives |
|---------|----------------------|------------------|
| **SpaceXAI / `xai-org/grok-build`** | **No** — see root `CONTRIBUTING.md` | Upstream only |
| **This Architecture Lab** (`docs/architecture-lab/`) | Local / fork experiments OK | `fornevercollective/grok-build` or your fork |
| **gy-glyph-pins plugin** | Companion repo | `GrokYtalkY` → `~/.grok/plugins/` |
| **Grok Build core crates** | Prefer **plugins / MCP / skills**, not core forks | Extension surfaces |

Security issues: follow monorepo `SECURITY.md` — do not open public issues for vulns.

Licensing: monorepo is **Apache-2.0**. Lab native shell matches that license. Do not drop proprietary third-party marks into the tree.

---

## Plugin guidelines (when you ship a plugin)

Canonical anatomy: [Plugin anatomy](#/06-plugin-anatomy).

Minimum bar:

1. `.grok-plugin/plugin.json` — `name` matches folder, semver `version`  
2. Skill `description` includes **triggers**  
3. Hooks cheap on `SessionStart`; only block on `PreToolUse` when intentional  
4. Prefer MCP for SaaS; do not reimplement mesh inside Grok (keep in GY)  
5. Validate: `grok plugin validate ./my-plugin`  
6. Enable: TUI `Ctrl+L` or `[plugins].enabled`  

Architecture Lab is **not** a plugin. Do not package the whole SPA as a plugin unless you deliberately ship skills/commands that point *at* the lab.

---

## Brand guidelines (when you touch UI / icons)

- Official marks only from `assets/brand/` (or monorepo `docs/SpaceXAI_Grok_Assets/`)  
- **Do not** recolor, stretch, or merge Grok marks into a new logo  
- App icon: unaltered mark + separate chrome (e.g. rainbow aura) is OK; altered marks are not  
- Full detail: [SpaceXAI / Grok brand](#/12-brand) · [x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines)

---

## Add a page

1. Create `content/NN-my-topic.md`  
2. Add an entry in `nav.json` under the right section  
3. Refresh the browser / native app (no SPA build step)

## Naming

| Pattern | Use |
|---------|-----|
| `00–09` | Core map |
| `10–89` | Companions, recipes, experiments, **dev meta** |
| `90–99` | Process / riffing |

## Style

- Prefer tables and short code fences  
- ASCII diagrams OK (render well offline)  
- Link with hash routes: `[label](#/05-plugin-catalog)`  
- Leave **checklists** for living backlogs  
- Document **version bumps** and **forks** on [14-dev-build-and-forks](#/14-dev-build-and-forks)

## Versioning when you ship

| Change type | Bump |
|-------------|------|
| Content / CSS only | `package.json` + Pages SHA |
| Native shell | `native/Cargo.toml` + `Info.plist` + rebuild `.app` |
| Plugin | companion `plugin.json` only |

See the full matrix on the [dev build page](#/14-dev-build-and-forks).

## Optional enhancements (later)

- [ ] Mermaid diagrams via CDN  
- [ ] Search box over `content/*.md`  
- [ ] Export to PDF / single HTML  
- [ ] Wire `lab` into `gy pins` / grok skill  
- [ ] Dark/light toggle persistence  

## Serve

```bash
./serve.sh          # python3 + ops APIs :8765
./serve.sh 9000     # custom port

# product float shell
cd native && ./launch.sh float
```

No npm required for the web lab. Edit → save → hard-refresh (or **View → Refresh** in native).
