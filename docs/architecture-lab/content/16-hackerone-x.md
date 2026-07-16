# X / xAI · HackerOne bounty

Living map of the public **X / xAI** bug bounty program, plus an honest scorecard of **our** bugs and research avenues vs prize eligibility.

> **Source of truth:** [hackerone.com/x](https://hackerone.com/x?type=team) · monorepo `SECURITY.md` → same program.  
> **Do not** open public GitHub issues for security reports.  
> Snapshot date: **2026-07-15** (re-check the live page before submitting).

---

<details class="doc-collapse" open>
<summary>Program snapshot · rewards · SLAs</summary>

| Field | Value |
|-------|--------|
| Program | **X / xAI** · handle `x` · [hackerone.com/x](https://hackerone.com/x) |
| Status | **Open** · offers bounties · offers thanks · offers swag |
| Launched | May 2014 (public) |
| Base bounty | **$100** USD |
| Response efficiency | ~**70%** (program indicator can lag) |
| Researchers thanked | **~1,330** |
| Reports resolved | **~1,678** |
| Assets in scope (listed) | **~20** live (plus archived historical rows) |

### Severity → payout bands

*Last updated on program page: May 15, 2025. Severity uses an internal **5×5** Impact × Likelihood matrix. Payouts are panel-discretionary.*

| Severity | Listed range | ~90-day avg bounty | ~Share of resolved |
|----------|--------------|--------------------|--------------------|
| **Low** | $100 – $500 | **$180** | ~20% |
| **Medium** | $500 – $2,000 | **$800** | ~40% |
| **High** | $2,500 – $7,000 | **$4,833** | ~30% |
| **Critical** | $7,500 – $20,000 | **$16,667** | ~10% |

### Program-wide stats (public)

| Metric | Value |
|--------|--------|
| Total bounties paid | **~$1.88M** |
| Average bounty | **~$560** |
| Top bounty range | **~$2,940 – $20,160** |
| Bounties paid (90 days) | **~$102,950** |
| Reports received (90 days) | **~1,266** |

### SLA (best effort)

| Milestone | Target |
|-----------|--------|
| First response | 2 business days |
| Time to triage | 10 business days |
| Time to bounty | 14 business days |
| Resolution | depends on severity / complexity |

**Observed averages (program highlights):** first response ~4.5 days · triage ~5 days · bounty ~9 days · submission→bounty ~2 weeks · resolution ~3.5 weeks.

</details>

---

<details class="doc-collapse">
<summary>Eligibility · rules of engagement · AI carve-outs</summary>

### General eligibility (must all hold)

1. You are the **first reporter**  
2. Vulnerability shows **security impact** on an **in-scope** asset  
3. You did **not** violate user privacy or [X Rules](https://help.twitter.com/en/rules-and-policies/X-rules)  
4. **No public disclosure** before the report is closed (HackerOne disclosure guidelines)  
5. X is not legally barred from rewarding you  

### Rules of engagement

- Use **test accounts** when research could touch others’ privacy  
- **No** spam, DoS, or actions that harm real users  
- **No** automated-tool dumps without manual verification  
- Violations can disqualify the report and trigger further action  

### AI / model issues

| Topic | Where it goes |
|-------|----------------|
| **Model** issues (safety, jailbreaks, harmful generation as *model* behavior) | **Out of H1 bounty** → [safety@x.ai](mailto:safety@x.ai) |
| Infra / product security on Grok · xAI · X surfaces | HackerOne **if** asset is in scope + real security impact |

### Explicitly **ineligible** (selected)

High-signal exclusions from the live policy (not exhaustive — read the full page):

| Class | Notes |
|-------|--------|
| Physical / social engineering | Device access, data centers, phishing staff |
| Weak “best practice” without impact | Missing CSRF token alone, missing headers, clickjacking on static pages, descriptive errors |
| CSRF logout / password policy nits | Need real CSRF impact for forms |
| SPF / content spoof / spam / malware URL bypass | Out |
| DoS (network or app layer) · cache poisoning that hurts availability | Out |
| Outdated browsers only | Out |
| Open redirect **unless** higher risk than phishing | Out |
| Homoglyph phishing **unless** AuthN/AuthZ (or similar) | Out |
| **Grok / xAI API rate-limit bypass alone** | Out |
| **Client-side-only issues on `grok-build-cli`** | Out |
| Software / protocols **not under X control** | Out |
| Core HackerOne “ineligible findings” list | Out |

### Open-source recommendation algorithm

Extra bar: **working PoC** (or enough docs for X engineers to recreate) is usually required; quality is at program discretion.

</details>

---

<details class="doc-collapse">
<summary>Structured scope · bounty-eligible assets</summary>

Pulled from the public HackerOne GraphQL team scope for handle `x` (active rows only).  
**Always re-verify** on [hackerone.com/x](https://hackerone.com/x) before testing or filing.

### Bounty-eligible (max severity typically **critical**)

| Asset | Type |
|-------|------|
| `*.x.com` · `x.com` | Wildcard / URL |
| `*.twitter.com` · `*.twimg.com` · `*.twitter.biz` | Wildcard |
| `*.x.ai` | Wildcard |
| `*.grok.com` · `grok.com` | Wildcard / URL |
| `chat.x.com` · `money.x.com` · `grokipedia.com` | URL |
| `gnip.com` · `*.vine.co` | URL / Wildcard |
| `com.twitter.android` · `com.atebits.Tweetie2` | Mobile (Android / iOS) |
| `ai.x.grok` · `ai.x.GrokApp` | Grok mobile apps |
| **`grok-build-cli`** | Downloadable executable (**in scope**, but **client-side-only** reports are **ineligible**) |

### Submission OK · **not** bounty (or limited)

| Asset | Max | Notes |
|-------|-----|--------|
| `t.co` | medium | Team notes ongoing work; not accepting many reports |
| `xadsacademy.com` | medium | No bounty flag |

### Out of submission

| Asset | Notes |
|-------|--------|
| `status.twitter.com` | Third-party (status.io) |

### Archived (historical — do **not** treat as active targets)

`api.x.ai`, `grok.x.ai`, `ide.x.ai`, `accounts.x.ai`, `console.x.ai` appear as **archived** scope rows (2024-10). Prefer live wildcards like **`*.x.ai`** when relevant, and confirm current eligibility on the program page.

</details>

---

<details class="doc-collapse" open>
<summary>Our work · prize eligibility scorecard</summary>

Honest read of **lab / fork / companion** work against the program — **not** legal advice; triage is discretionary.

| Avenue / bug (thus far) | In structured scope? | Security impact on X/xAI users? | Prize-likely? | Why |
|-------------------------|----------------------|----------------------------------|---------------|-----|
| **Grok Build Lab** docs SPA / Pages | No | No | **No** | Local engineering docs; not an X asset |
| **Grok Build Lab.app** native float (tao/wry, fornever bundle id) | No | Local host only | **No** | Fork companion shell; software not under X product control |
| Lab **Refresh All** CFString / `evaluate_script` crash | No | Reliability, not confidentiality/integrity of X | **No** | Fixed via `load_url`; not a bounty-class vuln |
| Local **`POST /api/control`** + **`eval`** on `127.0.0.1` | No | Own machine; intentional automation surface | **No** as H1 prize | Binds localhost by default; not production X. Harden for *users* of the lab, not for bounty |
| Lab CORS / static ops APIs / summon hooks | No | Local ops tooling | **No** | Same class |
| **Electron** desktop fallback | No | Local | **No** | Deprecated lab path |
| **GrokYtalkY** / `gy` mesh / pins plugin | No (unless it breaks an in-scope X asset) | Separate product | **No** by default | Companion repo; report only if a chain hits `*.x.com` / Grok apps / etc. with impact |
| **security-fence** plugin idea | N/A | Defense feature | **No** | Product hardening, not a vulnerability report |
| **Model** jailbreak / safety content | Model channel | Safety, not classic vuln | **Not H1 bounty** | Policy → **safety@x.ai** |
| **Rate-limit** probes on Grok / xAI APIs | In-scope hosts ≠ eligible class | Often nuisance | **No** | Explicitly ineligible |
| **Client-side only** UI/TUI polish on **official** `grok-build-cli` | Asset yes | Usually none | **No** | Explicitly ineligible |
| **Official `grok-build-cli`** with **server/auth/sandbox/secret** impact | **Yes** (`grok-build-cli`) | **If proven** | **Maybe** | Need: first reporter · clear impact · solid PoC · **not** client-side-only |
| **Official** Grok / X / xAI web · mobile · API under live scope | **Yes** | **If proven** | **Maybe → high** | AuthZ/IDOR, account takeover, RCE, cross-user data, etc. |

### Bottom line for *this* tree

| Question | Answer |
|----------|--------|
| Do our **lab shell** bugs meet prize standards today? | **No** — out of scope / no X security impact |
| Does **building** the lab improve bounty odds? | Indirectly only (maps surfaces); it is **not** a submission artifact |
| Closest **in-program** surface we already touch as engineers | Official **`grok-build-cli`** / monorepo — but only **security-impact** findings; monorepo points reporters to H1 |
| What would make a **prize-shaped** report from our stack? | A **reproducible** issue on a **listed asset** with **impact** (e.g. cross-user data, auth bypass, sandbox escape in shipped Grok CLI, not local float chrome) |

### If you *do* have a candidate

1. Confirm asset is **bounty-eligible** and not excluded (esp. CLI client-side, rate limits, models).  
2. Write **impact-first** report + minimal **PoC** on **test** accounts.  
3. File via [HackerOne](https://hackerone.com/x) — not public issues / not this lab page.  
4. Keep **private** until closed; do not paste PoCs into Grok Build Lab content.  

Monorepo pointer: `SECURITY.md` → `https://hackerone.com/x`.

</details>

---

<details class="doc-collapse">
<summary>What *would* score (direction only · no exploit recipes)</summary>

High-signal classes that historically fit **web / app / CLI** bounty programs (still must hit **this** program’s scope + impact bar):

| Class | Examples of impact (not a how-to) |
|-------|-----------------------------------|
| AuthN / AuthZ | Access another user’s data or actions without authorization |
| IDOR / broken object refs | Cross-account read/write on Grok / X / xAI products |
| Injection → real impact | XSS/SQLi/SSRF/command injection with demonstrated effect on in-scope assets |
| Mobile / app | Token theft, insecure storage of session secrets with exploitability |
| CLI (non client-side-only) | Sandbox escape, secret exfil via tool pipeline, privilege issues in **shipped** grok-build-cli with security impact |
| Supply / OAuth | Consent bypass, token mishandling on X/xAI OAuth surfaces |

**Do not pursue:** DoS, spam, social engineering, pure model jailbreaks for H1 cash, rate-limit games, pure UI nits on the CLI, lab-local crashes.

</details>

---

<details class="doc-collapse">
<summary>Links · process</summary>

| Resource | URL |
|----------|-----|
| Program home | [hackerone.com/x](https://hackerone.com/x) |
| Policy / team view | [hackerone.com/x?type=team](https://hackerone.com/x?type=team) |
| Disclosure guidelines | [hackerone.com/disclosure-guidelines](https://www.hackerone.com/disclosure-guidelines) |
| Model safety (out of H1 bounty) | [safety@x.ai](mailto:safety@x.ai) |
| Brand (unrelated to bounty) | [x.ai/legal/brand-guidelines](https://x.ai/legal/brand-guidelines) |
| This monorepo process | `SECURITY.md` |

Related lab pages: [Dev build · forks · compliance](#/14-dev-build-and-forks) · [Lab shells](#/15-lab-shells) · [Contributing docs](#/99-contributing-docs).

</details>
