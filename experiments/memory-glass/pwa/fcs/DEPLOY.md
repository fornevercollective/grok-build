# fcs.ugrad.ai · deploy

Hub for **fornevercollective suite** skills + **Memory Glass** download surface.
Bridges **lang.ugrad.ai** sitemap + offline models (canonical there).

## Local paper (:8790)

```bash
bash scripts/fcs-site-deploy.sh
open http://127.0.0.1:8790/fcs/
```

## Cloudflare Pages (recommended)

1. Project name e.g. `fcs-ugrad`
2. Deploy folder `experiments/memory-glass/pwa/fcs-dist` after deploy script:

```bash
bash scripts/fcs-site-deploy.sh
npx wrangler pages deploy experiments/memory-glass/pwa/fcs-dist \
  --project-name=fcs-ugrad
```

3. Custom domain: **fcs.ugrad.ai** → this project (CNAME in dist).

## What ships

| Path | Role |
|------|------|
| `/` | Suite hub · skills grid · lang probe |
| `/download` | Memory Glass download (future DMG + lab install now) |
| `/skills.json` | Machine skill catalog |
| `/sitemap.json` · `/sitemap.html` | AI + human map |
| `/models` | Bridge → lang offline models |
| `/llms.txt` | Agent contract |

## Related

- https://lang.ugrad.ai/sitemap.html  
- https://lang.ugrad.ai/data/language/models-offline.html  
- `plugins/fc-media-suite` · `fcs` CLI  
