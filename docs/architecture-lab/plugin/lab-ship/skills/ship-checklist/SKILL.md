---
name: ship-checklist
description: >
  Pre-push / pre-deploy go/no-go for Grok Build Lab and fork work.
  Triggers: /ship-check, ship checklist, status.x.ai, Pages deploy, pre-push.
---

# Ship checklist

## Go / no-go

```bash
npm run status --prefix docs/architecture-lab
# or
bash docs/architecture-lab/scripts/status-xai-check.sh --strict
```

Live board: https://status.x.ai — block on incidents; treat CF UNKNOWN as manual confirm.

## Lab ship steps

1. Status board green (or explicit override `STATUS_XAI_SKIP=1` emergency only).
2. `cd docs/architecture-lab && ./serve.sh` — load Docs, **Ship**, Chat.
3. `grok plugin validate` on `docs/architecture-lab/plugin/lab-ship` if plugin changed.
4. Bump `package.json` / `version.json` lab_semver when releasing lab UX.
5. Confirm Pages workflow path `docs/architecture-lab/**` will deploy.
6. After deploy: open https://fornevercollective.github.io/grok-build/ — clients auto-reload on SHA change.

## Upstream constraint

Do **not** open PRs to `xai-org/grok-build`. Ship on `fornevercollective/grok-build` (or your fork). Prefer plugins over forking the pager.
