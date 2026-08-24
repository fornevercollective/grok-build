# /preserve — Etcher-style device backup / gated flash

`fc-preserve-etcher-v1`. Universal via **`fcs preserve`**. Not a fork of Etcher,
Phosphor, OpenExtract, or IntuneBrew.

```text
/preserve                 TTY: 1) device  2) vault  3) backup/flash
/preserve etcher          same 3-step (TTY only; no curses)
/preserve probe           live USB · hotspot/NCM diagnosis
/preserve all GrokBotBaby backup → extract → catalog → sha256 → linux-gate
/preserve backup Brick    daily iPhone — preserve only, NEVER flash
/preserve linux GrokBotBaby   flash notes iff gate.ready
```

Shell (any terminal / any AI):

```bash
fcs preserve
fcs preserve probe
fcs preserve all GrokBotBaby
fcs preserve backup Brick
fcs preserve linux GrokBotBaby
```

Non-TTY / agent shells skip the interactive steps and run `all GrokBotBaby`.

**Default vault:** `/Volumes/MacBookPro - Data/FC-Preserve`  
Do not use `~/Documents` (Internal is too tight). Override: `FC_PRESERVE_VAULT`.

**Aliases:** GrokBotBaby (linux-test, postmarketos) · Brick (iPhone 7 Plus
`iPhone9,4` / iOS 15.1 — preserve only).

Encrypted iOS backup: `FC_PRESERVE_BACKUP_PASSWORD` (unset = unencrypted).
