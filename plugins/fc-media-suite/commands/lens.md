# /lens — tiny bug world · HDRI anamorphic · 360

Live pop-out OS window (ffplay), not TTY half-block.  
Uses **webcams / Continuity Camera only** (laptop + phone as camera).

```text
/lens                 bug world (follows /cam dual/phone/you)
/lens planet          tiny planet stereographic HDRI
/lens rabbit          rabbit hole (inverted planet)
/lens planet dual     laptop + phone as tiny planets
/lens bug dual        laptop + phone insect vision
/lens 360             compound dual-fisheye
/lens anamorphic · tiny · hdri
```

In `/watch` or desk: **L** = lens ffplay only · **Y** = clean dual cam.  
Desk TUI is separate: `/cam phone` or `/lens planet dual desk`.

```bash
bash scripts/live-demux/lens-popout.sh planet dual
python3 scripts/live-demux/tiny-planet.py pano.jpg -o out.jpg   # still only
```
