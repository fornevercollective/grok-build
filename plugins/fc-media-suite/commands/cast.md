# /cast · TCL Google TV / Chromecast

```text
/cast list
/cast profile
/cast doctor
/cast desk
/cast mosaic
/cast align
/cast align-ui
/cast https://…
/cast stop
```

Aliases: `/share` · `/mirror` (cast only — not OS Screen Sharing).

**Default device:** `Smart TV` (TCL @ LAN). Sibling: `GoogleTV3065` (Hisense).

```bash
pipx install catt
export LIVE_DEMUX_CAST_DEVICE='Smart TV'
bash scripts/live-demux/cast-tv.sh doctor
bash scripts/live-demux/cast-tv.sh align
bash scripts/live-demux/cast-tv.sh align-ui
# select: LIVE_DEMUX_CAST_ALIGN_SELECT='1,2,5-8,A3'
```

Align chart: `scripts/live-demux/cast-align/README.md`  
Docs: `docs/fornever-ledger/CAST-TV-WALL-PLAN.md`
