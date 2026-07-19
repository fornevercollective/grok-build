#!/usr/bin/env python3
"""Re-extract high-value Downloads Figma Make projects into hotpipe/data/.

Usage:
  python3 scripts/mg-harvest-downloads.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOT = ROOT / "hotpipe" / "data"
DL = Path.home() / "Downloads"
NOW = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def letters_to_rows(letters: list[str]) -> list[list[str]]:
    return [letters[0:10], letters[10:20], letters[20:]]


def extract_global_matrix() -> dict:
    gl_path = DL / "3D Global Keyboard Layout Matrix/src/app/data/globalLayouts.ts"
    text = gl_path.read_text(encoding="utf-8")
    layout_pat = re.compile(
        r"(\w+):\s*\{\s*"
        r"name:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"description:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"region:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"efficiency:\s*'((?:\\'|[^'])*)'\s*,\s*"
        r"letters:\s*\[([^\]]+)\]",
        re.S,
    )

    def extract_families(src: str) -> dict:
        start = src.find("export const globalLayouts")
        start = src.find("{", start)
        i = start + 1
        depth = 1
        fams: dict = {}
        n = len(src)
        while i < n and depth:
            if depth == 1:
                m = re.match(r"\s*//[^\n]*\n", src[i:])
                if m:
                    i += m.end()
                    continue
                m = re.match(r"\s*(\w+)\s*:\s*\{", src[i:])
                if m:
                    key = m.group(1)
                    i += m.end()
                    depth = 2
                    body_start = i
                    while i < n and depth > 1:
                        c = src[i]
                        if c == "{":
                            depth += 1
                        elif c == "}":
                            depth -= 1
                        elif c in "'\"":
                            q = c
                            i += 1
                            while i < n and src[i] != q:
                                if src[i] == "\\":
                                    i += 1
                                i += 1
                        i += 1
                    body = src[body_start : i - 1]
                    nm = re.search(r"name:\s*'((?:\\'|[^'])*)'", body)
                    fams[key] = {
                        "id": key,
                        "name": nm.group(1) if nm else key,
                        "layouts": {},
                        "_body": body,
                    }
                    continue
            i += 1
        for fam in fams.values():
            body = fam.pop("_body")
            for m in layout_pat.finditer(body):
                lid, name, desc, region, eff, letters_raw = m.groups()
                letters = re.findall(r"'((?:\\'|[^'])*)'", letters_raw)
                fam["layouts"][lid] = {
                    "id": lid,
                    "label": name,
                    "description": desc,
                    "region": region,
                    "efficiency": eff,
                    "letters": letters,
                    "rows": letters_to_rows(letters),
                }
        return fams

    families = extract_families(text)
    layouts_flat = {}
    for fam in families.values():
        for lid, L in fam["layouts"].items():
            entry = dict(L)
            entry["family"] = fam["id"]
            entry["familyName"] = fam["name"]
            entry["source"] = "3D Global Keyboard Layout Matrix"
            layouts_flat[lid] = entry

    return {
        "schema": "mg.global-keyboard-matrix/v1",
        "ver": "harvest-v1",
        "generated": NOW,
        "source": {
            "path": str(gl_path),
            "project": "3D Global Keyboard Layout Matrix",
            "landing": "Keys + atlas seed",
        },
        "familyCount": len(families),
        "layoutCount": len(layouts_flat),
        "families": {
            k: {
                "id": v["id"],
                "name": v["name"],
                "layoutIds": list(v["layouts"].keys()),
            }
            for k, v in families.items()
        },
        "layouts": layouts_flat,
        "mg": {
            "mergeInto": "keyboard-language-atlas.json · float-keyboard LAYOUTS",
            "apiHint": "window.__mgKeyboardAtlas",
        },
    }


def extract_popout() -> dict:
    base = DL / "Desktop Keyboard App with Pop-out Menus/src/components"
    text = ""
    for name in ("KeyboardSections.tsx", "Keyboard.tsx"):
        p = base / name
        if p.exists():
            text += p.read_text(encoding="utf-8")
    items = re.findall(
        r'className="p-2 hover:bg-gray-100 rounded cursor-pointer">([^<]+)</div>',
        text,
    )
    return {
        "schema": "mg.key-popout-menus/v1",
        "ver": "harvest-v1",
        "generated": NOW,
        "source": {
            "project": "Desktop Keyboard App with Pop-out Menus",
            "landing": "Dual drawers / peeks · Keys long-press menus",
        },
        "pattern": {
            "kind": "popover-on-key",
            "trigger": "click/long-press",
            "menuItemsSeen": sorted(set(items)),
            "sections": ["function-keys", "numpad", "main"],
        },
        "mg": {
            "apply": "float-keyboard key chrome secondary menu",
            "doNot": "do not port React Popover stack wholesale",
        },
        "seedMenus": {
            "home": ["Navigation Options", "Page Controls", "Jump stack"],
            "end": ["Navigation Options", "Page Controls"],
            "page_up": ["Page Controls", "Scroll host"],
            "page_down": ["Page Controls", "Scroll host"],
            "clear": ["Calculator Mode", "Number Lock"],
            "fn": ["Function layer", "Media keys"],
        },
    }


def extract_lark() -> dict:
    md = (DL / " lark tree/src/app/lib/mockData.ts").read_text(encoding="utf-8")
    nodes = []
    for m in re.finditer(
        r'id:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*description:\s*"([^"]*)"(?:\s*,\s*type:\s*"([^"]*)")?',
        md,
    ):
        nodes.append(
            {
                "id": m.group(1),
                "name": m.group(2),
                "description": m.group(3),
                "type": m.group(4) or "",
            }
        )
    return {
        "schema": "mg.lark-tree-extract/v1",
        "ver": "harvest-v1",
        "generated": NOW,
        "source": {"project": "lark tree", "landing": "GT / governance"},
        "nodeCount": len(nodes),
        "nodes": nodes,
        "mg": {"mergeInto": "lark-governance-tree.json", "api": "window.__mgLark"},
    }


def extract_audio() -> dict:
    audio_root = DL / "audio - Neural/src/app"
    comps = sorted(
        p.stem
        for p in audio_root.glob("components/*.tsx")
        if p.parent.name == "components"
    )
    services = (
        sorted(p.stem for p in (audio_root / "services").glob("*.ts"))
        if (audio_root / "services").exists()
        else []
    )
    return {
        "schema": "mg.audio-neural-manifest/v1",
        "ver": "harvest-v1",
        "generated": NOW,
        "source": {"project": "audio - Neural", "landing": "Staff + beats"},
        "components": comps,
        "services": services,
        "mg": {
            "priority": [
                "PopupPiano",
                "PianoPanel",
                "SequencerPanel",
                "BeatMappingPanel",
                "ScorePanel",
                "TidalEngine",
            ],
            "mapTo": "staff-lab-plane · keyboard-beats · music-packs",
        },
    }


def merge_atlas(matrix: dict) -> None:
    atlas_path = HOT / "keyboard-language-atlas.json"
    atlas = json.loads(atlas_path.read_text(encoding="utf-8"))
    atlas["matrixHarvest"] = {
        "ver": "harvest-v1",
        "generated": NOW,
        "layoutIds": list(matrix["layouts"].keys()),
        "file": "global-keyboard-matrix.json",
    }
    atlas.setdefault("layouts", {})
    added = 0
    for lid, L in matrix["layouts"].items():
        key = f"mx_{lid}"
        if key in atlas["layouts"]:
            atlas["layouts"][key]["rows"] = L.get("rows")
            continue
        atlas["layouts"][key] = {
            "lang": lid,
            "label": L.get("label") or lid.upper()[:4],
            "rows": L.get("rows"),
            "family": L.get("family"),
            "region": L.get("region"),
            "source": "global-keyboard-matrix",
        }
        added += 1
    atlas["ver"] = "mg-keyboard-atlas-v2-matrix-harvest"
    atlas["note"] = (
        f"kbatch + matrix harvest {NOW} · layouts={len(atlas['layouts'])} · +{added} new"
    )
    atlas_path.write_text(
        json.dumps(atlas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    # seed inject
    seed = (
        "/* keyboard-atlas-seed · auto from data/keyboard-language-atlas.json */\n"
        "(function () {\n"
        "  if (window.__mgKeyboardAtlas) return;\n"
        "  window.__mgKeyboardAtlas = "
        + json.dumps(atlas, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        "  try {\n"
        "    if (window.__mgDevLog) window.__mgDevLog('ok', 'keyboard-atlas ' + "
        "(window.__mgKeyboardAtlas.ver||'') + ' layouts=' + "
        "Object.keys(window.__mgKeyboardAtlas.layouts||{}).length, 'kb-atlas');\n"
        "  } catch (e) {}\n"
        "})();\n"
    )
    (ROOT / "hotpipe" / "keyboard-atlas-seed.js").write_text(seed, encoding="utf-8")
    print(f"atlas layouts={len(atlas['layouts'])} +{added}")


def write_popout_seed(pop: dict) -> None:
    seed = (
        "/* key-popout-menus-seed · harvest */\n"
        "(function () {\n"
        "  if (window.__mgKeyPopoutMenus) return;\n"
        "  window.__mgKeyPopoutMenus = "
        + json.dumps(pop, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        "})();\n"
    )
    (ROOT / "hotpipe" / "key-popout-menus-seed.js").write_text(seed, encoding="utf-8")


def enrich_lark_gov(extract: dict) -> None:
    gov_path = HOT / "lark-governance-tree.json"
    gov = json.loads(gov_path.read_text(encoding="utf-8"))
    gov["harvest"] = {
        "ver": "harvest-v1",
        "generated": NOW,
        "from": "Downloads/lark tree mockData",
        "nodeCount": extract["nodeCount"],
        "file": "lark-tree-extract.json",
    }
    gov["schema"] = "mg-lark-governance-tree-v2-harvest"
    cdn_names = [
        n
        for n in extract["nodes"]
        if n.get("type") == "cdn"
        or n["name"]
        in (
            "Cloudflare",
            "Akamai",
            "Fastly",
            "AWS CloudFront",
            "Google Cloud CDN",
            "Microsoft Azure CDN",
        )
    ]

    def walk(nodes, fn):
        for n in nodes or []:
            fn(n)
            walk(n.get("children"), fn)

    found = []

    def find_edge(n):
        if n.get("id") == "edge_cdn" or str(n.get("name") or "").startswith("Edge"):
            found.append(n)

    walk(gov.get("roots"), find_edge)
    if found and cdn_names:
        edge = found[0]
        existing = {c.get("name") for c in edge.get("children") or []}
        edge.setdefault("children", [])
        for c in cdn_names:
            if c["name"] not in existing:
                slug = re.sub(r"[^a-z0-9]+", "-", c["name"].lower()).strip("-")
                edge["children"].append(
                    {
                        "id": "cdn-" + slug,
                        "name": c["name"],
                        "description": c.get("description") or "",
                        "type": "cdn",
                    }
                )
    gov_path.write_text(json.dumps(gov, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    HOT.mkdir(parents=True, exist_ok=True)
    matrix = extract_global_matrix()
    (HOT / "global-keyboard-matrix.json").write_text(
        json.dumps(matrix, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"matrix layouts={matrix['layoutCount']}")

    pop = extract_popout()
    (HOT / "key-popout-menus.json").write_text(
        json.dumps(pop, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_popout_seed(pop)
    print(f"popout items={pop['pattern']['menuItemsSeen']}")

    lark = extract_lark()
    (HOT / "lark-tree-extract.json").write_text(
        json.dumps(lark, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    enrich_lark_gov(lark)
    print(f"lark nodes={lark['nodeCount']}")

    audio = extract_audio()
    (HOT / "audio-neural-manifest.json").write_text(
        json.dumps(audio, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"audio comps={len(audio['components'])}")

    merge_atlas(matrix)
    print("harvest OK", NOW)


if __name__ == "__main__":
    main()
