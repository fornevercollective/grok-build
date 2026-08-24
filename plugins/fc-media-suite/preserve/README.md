# fcs preserve · Etcher-style backup / gated flash

**Feature id:** `fc-preserve-etcher-v1`  
**Command:** `fcs preserve`  
**Default vault:** `/Volumes/MacBookPro - Data/FC-Preserve`

Inspired by Etcher UX (select → target → flash/verify), Phosphor (`Manifest.db`),
OpenExtract (domain export), and IntuneBrew (per-app JSON catalog).
**Not a fork of any of them.**

This tool does **not** start Elffin, embed WebKit, or add a second GPU host.

## Three honest steps

1. **SELECT DEVICE** — live USB probe (iOS via libimobiledevice, Android via adb).
2. **SELECT TARGET** — vault root. Default is the Data volume above. Do **not**
   use `~/Documents` (Internal is ~33 GiB and too tight).
3. **BACKUP** (or **FLASH**). Backup = backup → extract → catalog → SHA-256
   chain of custody → `linux-gate.json`. Flash is refused unless `gate.ready`
   is true.

```bash
fcs preserve                 # TTY → 3-step; non-TTY → all GrokBotBaby
fcs preserve etcher          # interactive 3-step (TTY only; no curses)
fcs preserve probe           # live USB + Personal Hotspot / USB-NCM diagnosis
fcs preserve all GrokBotBaby
fcs preserve backup Brick    # daily iPhone — preserve only, NEVER flash
fcs preserve linux GrokBotBaby   # flash notes only when linux-gate ready
```

Non-TTY / `FCS_AGENT=1` never opens a hung TUI. It runs `all GrokBotBaby`.

## Known aliases

| Alias | What | Flash |
|-------|------|-------|
| **Brick** | daily iPhone 7 Plus (`iPhone9,4`, iOS 15.1, UDID `4ea7e05b3045f0e9036275125a85225dd6dd9bb9`) | **never** — preserve only |
| **GrokBotBaby** | linux-test, flavor `postmarketos` | only when `linux-gate.json` `ready: true` |

## Vault

Configured in `default.json` as:

```text
/Volumes/MacBookPro - Data/FC-Preserve
```

Override with `--vault` or `FC_PRESERVE_VAULT`. Documents paths are refused.

Each run is a stamp under `runs/<UTC>-<alias>-<udid8>/`. If `idevicebackup2`
dies mid-stream (`mobilebackup2 -4` / exit 255 on a USB hub), the next attempt
**resumes the same stamp** and skips files already received. A new empty vault
is not created on each drop.

## Honesty rules

- Live line-based progress (`percent + MB/s + last file/domain`) is flushed to
  `preserve.log` so `tail -F` is watchable. `idevicebackup2` `\r` status is
  rewritten as newlines.
- After backup, **VERIFY**: Manifest.db, photos, messages, contacts (iOS) or
  os-release + photos (linux) must actually exist. Missing domains fail the
  run and `gate.ready` stays false.
- A 388 MB stub with `backup_ok: false` is **never** success. Size is not a
  success signal.
- Parallel AFC DCIM pull (`get -rf`) is allowed next to backup2 so 34k photos
  / 600+ videos can land. iCloud Optimize Storage originals that are not on
  the device stay off the dump and are marked honest in the summary.
- Encrypted iOS backup: set `FC_PRESERVE_BACKUP_PASSWORD`. Unset = unencrypted
  (the Mini production runs).

## Personal Hotspot / USB-NCM (Mini production)

iPhone 7 Plus often enumerates on USB while `idevice_id -l` is empty because
Personal Hotspot / USB-NCM stole the cable (`en9` `169.254.*`).

Detect: USB node present + mux empty + USB ethernet up.

Print: turn off Personal Hotspot, unplug/replug — **not**
“no phone / brew install libimobiledevice”.

## linux-gate.json

`ready: true` only when all of these are true:

- `backup_ok`
- `Manifest.db` present (or linux `os-release` stand-in)
- required domains extracted
- SHA-256 hashes written

`fcs preserve linux GrokBotBaby` prints flash notes only then.
Brick can never pass the flash gate (`flash_allowed` is always false).

## Layout of a stamp

```text
<vault>/runs/<stamp>/
  preserve.log
  backup/           # idevicebackup2 or linux tree
  extract/          # domain export
  catalog/          # per-app JSON + _index.json
  dcim/             # optional AFC pull
  hashes.sha256
  custody.json
  linux-gate.json
  summary.json
```

## Tests

```bash
python3 plugins/fc-media-suite/preserve/tests/test_preserve.py
```
