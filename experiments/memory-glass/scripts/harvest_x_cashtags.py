#!/usr/bin/env python3
"""Harvest $TICKER cashtags from text / seed files for flip-board universe merge.

Does not call X API directly (use agent X search or paste). Safe filters:
  - 1–5 letter US-style tickers (and dotted like BRK.B)
  - drop common non-tickers (USD, IPO, CEO, ATH, …)

Usage:
  python3 harvest_x_cashtags.py --seed seeds/x-cashtags-seed.txt -o /tmp/x-cashtags.json
  python3 harvest_x_cashtags.py --text-file posts.txt -o /tmp/x-cashtags.json
"""
from __future__ import annotations

import argparse
import json
import re
import time
from collections import Counter
from pathlib import Path

CASHTAG = re.compile(r"(?<![A-Za-z0-9_])\$([A-Z]{1,5}(?:\.[A-Z])?)\b")

STOP = {
    "USD", "USDT", "EUR", "GBP", "IPO", "CEO", "CFO", "ATH", "ATL", "ETF", "ETFS",
    "AI", "API", "GDP", "CPI", "FOMC", "SEC", "FDA", "EPS", "PE", "PEG", "ROI",
    "IMO", "TBH", "FYI", "LOL", "OMG", "NFT", "NFTS", "CEO", "YOLO", "FOMO",
    "DD", "TA", "FA", "OTM", "ITM", "ATM", "IV", "HV", "VWAP", "RSI", "MACD",
    "BB", "EMA", "SMA", "OHLC", "AM", "PM", "EST", "PST", "UTC", "PDF", "USA",
    "UK", "EU", "SPX", "NDX", "DXY", "VIX",  # keep VIX/^ later if needed as index
}


def extract(text: str) -> Counter:
    c: Counter = Counter()
    for m in CASHTAG.finditer(text.upper()):
        t = m.group(1)
        if t in STOP:
            continue
        if t.isdigit():
            continue
        c[t] += 1
    return c


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=Path, action="append", default=[])
    ap.add_argument("--text-file", type=Path, action="append", default=[])
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()
    counts: Counter = Counter()
    for p in args.seed + args.text_file:
        if p.exists():
            counts.update(extract(p.read_text(encoding="utf-8", errors="replace")))
    # always include hard seed of liquid names from live X harvest sessions
    hard = """
    $TSLA $NVDA $AAPL $MSFT $META $GOOGL $AMZN $AMD $ORCL $NFLX $UBER $PDD $APP
    $MU $QQQ $SPY $SPX $IWM $BABA $SOFI $PLTR $UNH $HIMS $ASTS $OSCR $SE
    $JOBY $QCOM $GM $ARTY $COIN $HOOD $RIVN $LCID $NIO $XPEV $ARM $AVGO $TSM
    $SMCI $DELL $INTC $CRM $SNOW $NET $DDOG $PANW $CRWD $SHOP $SQ $PYPL $JPM
    $BAC $GS $XOM $CVX $COP $OXY $CAT $BA $GE $DIS $NKE $WMT $COST $TGT
    """
    counts.update(extract(hard))
    tickers = sorted(counts.keys(), key=lambda t: (-counts[t], t))
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "x_cashtag_harvest",
        "n": len(tickers),
        "counts": dict(counts.most_common()),
        "tickers": tickers,
        "symbolToLists": {t: ["X Cashtag"] for t in tickers},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2))
    print(f"wrote {len(tickers)} cashtags → {args.output}")
    print("top:", counts.most_common(20))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
