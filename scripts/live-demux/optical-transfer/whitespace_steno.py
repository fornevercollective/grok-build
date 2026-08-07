#!/usr/bin/env python3
"""Whitespace / glyph stego capacity for prompts & documents.

fc-whitespace-steno-v1 — estimate + encode/decode demos.

  python3 whitespace_steno.py budget
  python3 whitespace_steno.py encode --text 'hello' --carrier 'Write a short poem about space.'
  python3 whitespace_steno.py decode --file ./out.txt
  python3 whitespace_steno.py matrix   # printable comparison table

Channels (increasing stealth / fragility):
  trailing_space  — EOL double-space bit (markdown often keeps)
  nbsp            — U+00A0 vs regular space
  zw              — U+200B/U+200C/U+200D/U+2060 (2 bits each insert)
  soft_hyphen     — U+00AD between letters
  homoglyph       — Latin/Cyrillic lookalikes (visible if inspected)
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ZW = ["\u200b", "\u200c", "\u200d", "\u2060"]  # 2 bits / insert
NBSP = "\u00a0"
SOFT = "\u00ad"

# Common Latin → Cyrillic homoglyphs (subset)
HOMO = {
    "a": "а",
    "c": "с",
    "e": "е",
    "o": "о",
    "p": "р",
    "x": "х",
    "y": "у",
    "A": "А",
    "B": "В",
    "C": "С",
    "E": "Е",
    "H": "Н",
    "K": "К",
    "M": "М",
    "O": "О",
    "P": "Р",
    "T": "Т",
    "X": "Х",
}


def budget_row(
    name: str,
    bits_per_unit: float,
    units: int,
    survives_llm: str,
    notes: str,
) -> dict:
    bits = bits_per_unit * units
    return {
        "channel": name,
        "units": units,
        "bits": round(bits, 1),
        "bytes": round(bits / 8, 2),
        "survives_llm": survives_llm,
        "notes": notes,
    }


def prompt_budget(visible_chars: int = 1200, lines: int = 24) -> dict:
    """Typical chat prompt / short system doc."""
    spaces = max(1, visible_chars // 5)  # ~word separators
    letters = max(1, int(visible_chars * 0.65))
    return {
        "schema": "fc-whitespace-steno-budget-v1",
        "scenario": "standard_prompt",
        "visible_chars": visible_chars,
        "lines": lines,
        "channels": [
            budget_row(
                "trailing_space_eol",
                1,
                lines,
                "partial",
                "1 bit/line via end double-space; markdown may keep",
            ),
            budget_row(
                "nbsp_vs_space",
                1,
                spaces,
                "partial",
                "swap space→NBSP; some UIs normalize",
            ),
            budget_row(
                "zero_width_insert",
                2,
                min(spaces, visible_chars // 4),
                "rarely",
                "2 bits/ZW insert; tokenizers often drop ZW*",
            ),
            budget_row(
                "soft_hyphen",
                1,
                letters // 4,
                "rarely",
                "U+00AD between letters; fragile export",
            ),
            budget_row(
                "homoglyph_swap",
                1,
                sum(1 for c in "aeopcx" * (letters // 30)),
                "yes_if_passthrough",
                "Cyrillic lookalikes; human-auditable",
            ),
            budget_row(
                "markdown_html_comment",
                8,
                256,
                "no_in_chat",
                "raw file only; unlimited block in .md source",
            ),
        ],
    }


def document_budget(pages: int = 10, chars_per_page: int = 3000) -> dict:
    chars = pages * chars_per_page
    spaces = chars // 5
    lines = pages * 40
    return {
        "schema": "fc-whitespace-steno-budget-v1",
        "scenario": "standard_document",
        "pages": pages,
        "visible_chars": chars,
        "channels": [
            budget_row("trailing_space_eol", 1, lines, "partial", "bits scale with lines"),
            budget_row("nbsp_vs_space", 1, spaces, "partial", "~1 bit per word gap"),
            budget_row(
                "zero_width_dense",
                2,
                spaces,
                "rarely",
                f"up to ~{spaces * 2 / 8:.0f} B if preserved",
            ),
            budget_row(
                "mixed_whitespace_pack",
                1.5,
                spaces,
                "partial",
                "NBSP+thin space+ZW mix average ~1.5 bit/gap",
            ),
            budget_row(
                "homoglyph_full_pass",
                0.8,
                int(chars * 0.4),
                "yes_if_passthrough",
                "rewrite eligible letters; visible under font audit",
            ),
        ],
    }


def encode_zw(payload: bytes, carrier: str) -> str:
    """Embed payload as 2-bit ZW symbols after each word boundary when possible."""
    bits = []
    for b in payload:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    # pad to pairs
    if len(bits) % 2:
        bits.append(0)
    out = []
    bi = 0
    i = 0
    while i < len(carrier):
        out.append(carrier[i])
        if carrier[i].isspace() and bi + 1 < len(bits):
            pair = (bits[bi] << 1) | bits[bi + 1]
            out.append(ZW[pair])
            bi += 2
        i += 1
    # overflow append at end
    while bi + 1 < len(bits):
        pair = (bits[bi] << 1) | bits[bi + 1]
        out.append(ZW[pair])
        bi += 2
    return "".join(out)


def decode_zw(text: str) -> bytes:
    bits = []
    for ch in text:
        if ch in ZW:
            v = ZW.index(ch)
            bits.append((v >> 1) & 1)
            bits.append(v & 1)
    # pack
    out = bytearray()
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for j in range(8):
            b = (b << 1) | bits[i + j]
        out.append(b)
    return bytes(out)


def encode_nbsp(payload: bytes, carrier: str) -> str:
    bits = []
    for b in payload:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    out = []
    bi = 0
    for ch in carrier:
        if ch == " " and bi < len(bits):
            out.append(NBSP if bits[bi] else " ")
            bi += 1
        else:
            out.append(ch)
    return "".join(out)


def decode_nbsp(text: str) -> bytes:
    bits = []
    for ch in text:
        if ch == " ":
            bits.append(0)
        elif ch == NBSP:
            bits.append(1)
    out = bytearray()
    for i in range(0, len(bits) - 7, 8):
        b = 0
        for j in range(8):
            b = (b << 1) | bits[i + j]
        out.append(b)
    return bytes(out)


def matrix() -> str:
    p = prompt_budget()
    d = document_budget()
    lines = [
        "# Whitespace / glyph capacity matrix",
        "",
        "## Standard prompt (~1200 visible chars)",
        "",
        "| Channel | Bytes (est.) | Survives LLM? | Notes |",
        "|---------|--------------|---------------|-------|",
    ]
    for c in p["channels"]:
        lines.append(
            f"| {c['channel']} | {c['bytes']} | {c['survives_llm']} | {c['notes']} |"
        )
    lines += [
        "",
        "## ~10-page document (~30k chars)",
        "",
        "| Channel | Bytes (est.) | Survives LLM? | Notes |",
        "|---------|--------------|---------------|-------|",
    ]
    for c in d["channels"]:
        lines.append(
            f"| {c['channel']} | {c['bytes']} | {c['survives_llm']} | {c['notes']} |"
        )
    lines += [
        "",
        "## Takeaways",
        "",
        "- Chat prompts: treat stego as **metadata (tens–hundreds of bits)**, not media.",
        "- Zero-width is high capacity on paper, **near-zero after LLM tokenization**.",
        "- Documents: NBSP/mixed whitespace can hide **1–15 KB** before export sanitizers.",
        "- For real media payloads, use **optical layers** (Decimen QR / mix-pipe), not prompt stego.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description="fc-whitespace-steno-v1")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("budget", help="JSON capacity for prompt + document")
    sub.add_parser("matrix", help="Markdown capacity table")
    p_enc = sub.add_parser("encode")
    p_enc.add_argument("--text", required=True, help="payload string")
    p_enc.add_argument("--carrier", required=True, help="visible carrier text")
    p_enc.add_argument("--mode", choices=["zw", "nbsp"], default="zw")
    p_enc.add_argument("-o", "--out", type=Path, default=None)
    p_dec = sub.add_parser("decode")
    p_dec.add_argument("--file", type=Path, required=True)
    p_dec.add_argument("--mode", choices=["zw", "nbsp"], default="zw")

    args = ap.parse_args()
    if args.cmd == "budget":
        body = {
            "prompt": prompt_budget(),
            "document": document_budget(),
            "recommendation": {
                "prompt_practical_bytes": "4–64 (control flags)",
                "document_practical_bytes": "256–8192 (pre-sanitizer)",
                "media_use_optical": True,
            },
        }
        print(json.dumps(body, indent=2))
        return 0
    if args.cmd == "matrix":
        print(matrix())
        return 0
    if args.cmd == "encode":
        raw = args.text.encode("utf-8")
        out = encode_zw(raw, args.carrier) if args.mode == "zw" else encode_nbsp(raw, args.carrier)
        if args.out:
            args.out.write_text(out, encoding="utf-8")
            print(f"wrote {args.out} ({len(out)} chars, payload {len(raw)} B)")
        else:
            sys.stdout.write(out)
        return 0
    if args.cmd == "decode":
        text = args.file.read_text(encoding="utf-8")
        raw = decode_zw(text) if args.mode == "zw" else decode_nbsp(text)
        try:
            print(raw.decode("utf-8"))
        except UnicodeDecodeError:
            print(raw.hex())
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
