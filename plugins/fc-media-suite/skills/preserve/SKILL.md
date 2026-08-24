---
name: preserve
description: >
  Etcher-style device backup / gated flash for GrokBotBaby (iPhone 7 Plus
  linux-test) and Brick (daily iPhone 14 / Continuity, preserve only). Triggers: /preserve,
  fcs preserve, etcher backup, idevicebackup2, Manifest.db, linux-gate,
  FC-Preserve, Brick iPhone, GrokBotBaby, Personal Hotspot USB-NCM.
---

# /preserve · fc-preserve-etcher-v1

Universal (any terminal · any AI): **`fcs preserve`**. Do not reimplement
libimobiledevice / adb backup in chat. Do not start Elffin, embed WebKit, or
add a second GPU host.

```bash
fcs preserve                 # TTY → 3-step etcher; non-TTY → all GrokBotBaby
fcs preserve etcher
fcs preserve probe
fcs preserve all GrokBotBaby
fcs preserve backup Brick    # NEVER flash
fcs preserve linux GrokBotBaby
```

## Steps (Etcher-shaped, honest)

1. **SELECT DEVICE** — live USB (iOS `idevice_id` / Android `adb`). Aliases:
   **GrokBotBaby** (old iPhone 7 Plus `iPhone9,4` D111AP iOS 15.1 UDID
   `4ea7e05b3045f0e9036275125a85225dd6dd9bb9` serial `FCDTR1N8HFY7` —
   linux-test, preserve then gated flash). **Brick** (daily iPhone 14 class /
   Continuity Camera — preserve only, never flash). Do not assign the 7 Plus
   UDID to Brick.
2. **SELECT TARGET** — default **`/Volumes/MacBookPro - Data/FC-Preserve`**.
   Never `~/Documents` (Internal ~33 GiB is too tight). `FC_PRESERVE_VAULT` overrides.
3. **BACKUP** = backup → extract → catalog → SHA-256 chain → `linux-gate.json`.
   **FLASH** is refused unless `gate.ready` is true. Brick never passes the flash gate.

## Production pitfalls (Mini)

- USB node present + usbmux 0 + `en9` `169.254` → Personal Hotspot / USB-NCM
  stole the cable. Tell the user to turn off Hotspot and unplug/replug.
  Do **not** say “no phone / brew install libimobiledevice”.
- `idevicebackup2` `mobilebackup2 -4` / exit 255 on a hub → resume the **same**
  stamp; skip files already received.
- Parallel AFC DCIM pull is allowed so 34k photos can land. iCloud Optimize
  Storage originals that are not on device stay off the dump — say so.
- A 388 MB stub with `backup_ok: false` is never success. Required domains
  (Manifest.db, photos, messages, contacts) must exist or the run fails.

## Env

| Var | Role |
|-----|------|
| `FC_PRESERVE_VAULT` | vault override (not Documents) |
| `FC_PRESERVE_BACKUP_PASSWORD` | encrypted iOS backup; unset = unencrypted |
| `FC_PRESERVE_DEVICE` | non-TTY default device (GrokBotBaby) |
| `FCS_AGENT=1` | force non-interactive |

Progress is line-based (`percent + MB/s + last file`). `tail -F` the run log.

Docs: `plugins/fc-media-suite/preserve/README.md` · `commands/preserve.md`
