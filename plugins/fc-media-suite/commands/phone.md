# /phone — tether phone PWA into Grok

Memory Glass **inspect** grammar: phone is the cam body, Grok is the desk.

```text
/phone              start still-pipe hub + open /cam on live.jpg
/phone hub          ensure hub only
/phone urls         print HTTPS phone PWA + inspect links
/phone inspect      open live.jpg in browser
/phone stop         stop hub
/cam phone          same still-pipe source without /phone helper
```

Shell (outside Grok):

```bash
bash scripts/live-demux/phone-tether.sh start
bash scripts/live-demux/phone-tether.sh cam
```

Keys in `/watch`: **h** phone↔local · **a** mic · **t** talk · **c** cam.
