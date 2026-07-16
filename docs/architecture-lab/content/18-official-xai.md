# Official xAI · iterate the four

Living map of **public** xAI surfaces we track while building Grok Build Lab and the fork.  
**Not legal advice.** Always re-check the live pages — pricing and subprocessors change.

| # | Surface | URL | Lab use |
|---|---------|-----|---------|
| 1 | **Subprocessors** | [x.ai/legal/subprocessor-list](https://x.ai/legal/subprocessor-list) | Data-path awareness · trust board |
| 2 | **Brand guidelines** | [x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines) | Marks · attribution · no endorsement |
| 3 | **Models** | [docs.x.ai/developers/models](https://docs.x.ai/developers/models) | Which model for code / chat / media |
| 4 | **Use cases** | [x.ai/grok/use-cases](https://x.ai/grok/use-cases) | Product intent · Ship deck mapping |

Related: [Brand page](#/12-brand) · [Ship everything](#/17-ship-everything) · [x.ai/cli](https://x.ai/cli)

---

## 1 · Subprocessor list

Source: [Subprocessor List](https://x.ai/legal/subprocessor-list) (xAI DPA context).

| Subprocessor | Purpose (as listed) | Location |
|--------------|---------------------|----------|
| AWS | Cloud infrastructure, services, and support | US |
| Axiom | Services and support | US |
| Chronosphere | Services and support | US |
| ClickHouse | Services and support | US |
| Cloudflare | Content delivery | US |
| Elasticsearch | Services and support | US |
| Google Cloud | Cloud infrastructure, services, and support | US |
| GrowthBook | Services and support | US |
| Hive | Content delivery | US |
| Hubspot | Services and support | US |
| LiveKit | Real-time media | US |
| MongoDB, Inc | Cloud database service | US |
| Okta | Services and support | US |
| Oracle | Cloud infrastructure, services, and support | US |
| Paypal (Braintree) | Payment processing | US |
| Sentry | Error monitoring | US |
| Stripe | Payment processing | US |
| Twilio | Services and support | US |
| Vercel | Web hosting and deployment | US |
| Wiz | Services and support | US |
| WorkOS | Services and support | US |
| xAI Affiliates | Cloud infrastructure, services, and support | US |
| xAI Subsidiary | Services and support | **UK** |
| Zendesk | Services and support | US |

### Lab implications

| Topic | Stance |
|-------|--------|
| **Lab itself** | Local docs + native shell + Pages static site. Does **not** become an xAI subprocessor. |
| **When you call Grok API / TUI cloud** | Your traffic may touch providers on this list under xAI’s DPA — follow your org’s vendor review. |
| **MCP / plugins** | Third-party MCP (Linear, Sentry, …) are **your** subprocessors when you enable them — not automatically xAI’s. |
| **Fork Pages** | Hosted on **GitHub Pages** (fork choice) — separate from xAI’s Vercel/Cloudflare stack. |
| **Trust board** | Before big pushes still check [status.x.ai](https://status.x.ai) (`npm run status`). |

---

## 2 · Brand guidelines

Source: [xAI Brand Guidelines](https://x.ai/legal/brand-guidelines) · **February 14, 2025**.

### About

- xAI develops Grok; owns trademarks / branding in **“xAI”**, **“Grok”**, combinations, and logos.  
- **xAI is a separate company from X** (formerly Twitter).  
- Full lab policy: [SpaceXAI / Grok brand](#/12-brand).

### Content attribution (required when publishing Grok-generated material)

- **Written with Grok**  
- **Created with Grok**  

Display legibly wherever the material is published or distributed.

### Press

Contact **legal@x.ai** before press materials. Describe xAI as working to accelerate human scientific discovery / advance understanding of the universe (per guidelines).

### Usage terms (summary)

| Do | Don’t |
|----|--------|
| Accurately refer to xAI / Grok services | Imply endorsement, approval, or sponsorship |
| Follow guidelines + updates | Put marks in app titles / domains / product names **not** made by xAI |
| Change use if xAI requires after review | Alter logos or invent a combined mark |
| Use logos **exactly** as provided | Use marks as part of **your** marks |

Logo pack: [SpaceXAI_Grok_Assets.zip](https://data.x.ai/logos/SpaceXAI_Grok_Assets.zip)

### Lab compliance snapshot

| Item | Status |
|------|--------|
| Unaltered official assets under `docs/SpaceXAI_Grok_Assets/` + `assets/brand/` | Required |
| App name **Grok Build Lab** (engineering map, not official product) | Stated on overview |
| Bundle id `dev.fornevercollective.*` (technical only) | Not `ai.x.*` |
| Rainbow aura / float chrome | Local chrome, **not** part of the official mark |
| Press / marketing claims of endorsement | **Forbidden** without xAI |

---

## 3 · Models (developer docs)

Source: [docs.x.ai/developers/models](https://docs.x.ai/developers/models).  
Prices = **per million tokens** unless noted. Long-context rows bill **all** tokens at the higher rate once the prompt crosses the threshold.

### Which model?

| Use | Recommendation (docs) |
|-----|------------------------|
| Code | **Grok 4.5** |
| Chat | **Grok 4.5** |
| Images | Grok Imagine API |
| Videos | Grok Imagine API |
| Voice | Grok Voice API |

> Knowledge cut-off for Grok 4.5: **February 1, 2026** (per docs note).

### Text API pricing (snapshot)

| Model | Context | Input / 1M (&lt; thr) | Cached in | Output / 1M (&lt; thr) | Long-prompt thr |
|-------|---------|----------------------|-----------|------------------------|-----------------|
| **grok-4.5** | 500k | $2.00 | $0.50 | $6.00 | ≥200k → 2× |
| grok-4.3 | 1M | $1.25 | $0.20 | $2.50 | ≥200k → 2× |
| grok-4.20-*-reasoning / non-reasoning / multi-agent-0309 | 1M | $1.25 | $0.20 | $2.50 | ≥200k → 2× |
| **grok-build-0.1** | 256k | $1.00 | $0.20 | $2.00 | ≥200k → 2× |

Long-context rate (example **grok-4.5** ≥200k): input $4.00 · cached $1.00 · output $12.00.

### Imagine · Voice (snapshot)

| Capability | Cost |
|------------|------|
| grok-imagine-image-quality | $0.05 / image |
| grok-imagine-image | $0.02 / image |
| grok-imagine-video | $0.050 / sec |
| grok-imagine-video-1.5 | $0.080 / sec |
| Voice realtime | $0.05 / min ($3.00 / hr) |
| Realtime text input | $0.004 / message |
| TTS | $15.00 / 1M chars |
| STT | $0.10 / hr REST · $0.20 / hr streaming |

### Additional model notes (docs)

- **No realtime knowledge** without search tools (Web Search / X Search).  
- Chat: roles may be mixed in any order (`system` / `user` / `assistant`).  
- `logprobs` / `top_logprobs` **not** supported on `grok-4.20` and newer (silently ignored).  
- Image input: max **20 MiB**, `jpg/jpeg` or `png`, any image/text order.

### Aliases

| Form | Meaning |
|------|---------|
| `<modelname>` | Latest **stable** |
| `<modelname>-latest` | Latest (features) |
| `<modelname>-<date>` | Pinned release (consistency) |

### Lab / Grok Build mapping

| Surface | Prefer |
|---------|--------|
| Grok Build TUI / agent coding | **grok-4.5** (or account default) · coding-oriented **grok-build-0.1** when offered |
| Lab chat voice path | Voice API pricing above · local Listen is intent routing only |
| Headless CI | Pin `-<date>` alias if reproducibility matters |
| Cost control | Prefer cached input · keep context under long-prompt threshold when possible |

Official CLI: [x.ai/cli](https://x.ai/cli) · Build overview: [docs.x.ai/build](https://docs.x.ai/build/overview)

---

## 4 · Use cases

Source: [What will you build with Grok?](https://x.ai/grok/use-cases)

### Catalog → Lab / TUI

| Category | Use case | Official path | Lab / Build hook |
|----------|----------|---------------|------------------|
| **Research** | Synthesize research | [research-synthesis](https://x.ai/grok/use-cases/research-synthesis) | explore subagent · web/X search |
| **Research** | News & market signals | [market-monitoring](https://x.ai/grok/use-cases/market-monitoring) | X desk · web search |
| **Research** | Financial data & filings | [financial-analysis](https://x.ai/grok/use-cases/financial-analysis) | MCP + search tools |
| **Engineering** | Plan & implement code | [code-planning](https://x.ai/grok/use-cases/code-planning) | **Plan mode** · Ship tab · `/plan-loop` |
| **Engineering** | Debug production | [debugging](https://x.ai/grok/use-cases/debugging) | terminal · multi-term · Sentry MCP |
| **Engineering** | Technical docs | [technical-docs](https://x.ai/grok/use-cases/technical-docs) | this lab · `content/*` |
| **Content** | Long-form writing | [long-form-writing](https://x.ai/grok/use-cases/long-form-writing) | Notes tab · attribution |
| **Content** | Marketing copy | [marketing-copy](https://x.ai/grok/use-cases/marketing-copy) | brand guidelines first |
| **Content** | Translate / localize | [translation](https://x.ai/grok/use-cases/translation) | skills pack |
| **Operations** | Voice agents | [voice-agents](https://x.ai/grok/use-cases/voice-agents) | Lab chat voice · LiveKit on subprocessor list |
| **Operations** | Document extraction | [document-processing](https://x.ai/grok/use-cases/document-processing) | API + tools |
| **Operations** | Internal tools via API | [internal-tools](https://x.ai/grok/use-cases/internal-tools) | MCP · headless · plugins |
| **Creative** | Image generation | [image-generation](https://x.ai/grok/use-cases/image-generation) | Imagine API · **Created with Grok** |
| **Creative** | Image edit / restyle | [image-editing](https://x.ai/grok/use-cases/image-editing) | Imagine API |
| **Creative** | Short video | [video-generation](https://x.ai/grok/use-cases/video-generation) | Imagine video pricing |
| **Office** | Excel / Word / PowerPoint | [Excel](https://x.ai/grok/excel) · [Word](https://x.ai/grok/word) · [PowerPoint](https://x.ai/grok/powerpoint) | Outside lab; same brand rules |

### Priority for this fork

1. **Code planning** — plan mode + lab-ship `plan-loop` + Ship Q&A  
2. **Technical docs** — architecture-lab markdown SPA  
3. **Debug / ops** — terminal footer · mitigate · status.x.ai  
4. **Voice** — chat float (local intent + optional Voice API)  
5. **Internal tools** — plugins · MCP · headless CI  

---

## Iterate checklist (re-run when shipping)

- [ ] Re-open all four URLs; diff subprocessors and pricing  
- [ ] Confirm brand zip + unaltered marks still match guidelines date  
- [ ] Default coding model still **Grok 4.5** (or newer doc recommendation)  
- [ ] Use-case table still matches [x.ai/grok/use-cases](https://x.ai/grok/use-cases)  
- [ ] Lab overview still states **not** an official product / no endorsement  
- [ ] Published Grok-generated assets carry **Written with Grok** / **Created with Grok**  

```bash
# optional local open
open https://x.ai/legal/subprocessor-list
open https://x.ai/legal/brand-guidelines
open https://docs.x.ai/developers/models
open https://x.ai/grok/use-cases
```

---

## Sources (canonical)

1. https://x.ai/legal/subprocessor-list  
2. https://x.ai/legal/brand-guidelines  
3. https://docs.x.ai/developers/models  
4. https://x.ai/grok/use-cases  
