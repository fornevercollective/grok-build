# Riffing on these docs

This lab is **yours to mutate**. Markdown in `content/` is the source of truth.

## Add a page

1. Create `content/12-my-topic.md`  
2. Add an entry in `nav.json` under the right section  
3. Refresh the browser (no build step)

## Naming

| Pattern | Use |
|---------|-----|
| `00–09` | Core map |
| `10–89` | Companions, recipes, experiments |
| `90–99` | Meta |

## Style

- Prefer tables and short code fences  
- ASCII diagrams OK (render well offline)  
- Link with hash routes: `[label](#/05-plugin-catalog)`  
- Leave **checklists** for living backlogs  

## Optional enhancements (later)

- [ ] Mermaid diagrams via CDN  
- [ ] Search box over `content/*.md`  
- [ ] Export to PDF / single HTML  
- [ ] Wire `lab` into `gy pins` / grok skill  
- [ ] Dark/light toggle persistence  

## Serve

```bash
./serve.sh          # python3 http.server :8765
./serve.sh 9000     # custom port
```

No npm required. Edit → save → hard-refresh.
