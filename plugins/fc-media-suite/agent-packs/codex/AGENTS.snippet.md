# Codex · fc-media-suite

If the user asks for `/watch`, live TV, half-block video, `/cam`, `/clock`, `/map`, cast, or lens:

1. Run the universal CLI (not Grok-only slash):
   ```bash
   fcs watch popout <channel-or-url>
   fcs cam
   fcs clock --once
   fcs map popout <host>
   fcs doctor
   ```
2. If `fcs` is missing:
   ```bash
   bash ~/Projects/grok-build/plugins/fc-media-suite/scripts/fcs install
   ```
3. Prefer pop-out / `--once` in non-interactive agent shells.
4. Full skill: `~/.codex/skills/fc-media-suite/SKILL.md` or plugin `agent-packs/generic/SKILL.md`.
