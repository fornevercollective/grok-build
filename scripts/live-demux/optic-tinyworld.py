#!/usr/bin/env python3
"""Live clip-on glass → planet/rabbit/cymatics/orb + liquid-glass GPU workspace.

Layout:
  ┌──────────────────────────────┬─────────────────────────┐
  │  live GPU preview            │  HOT PIPE · chat        │
  │  planet|rabbit|glass|cymatic │  mode · LUT · rotate    │
  │  orb / bubble / crystal      │  prompt ↔ terminal      │
  └──────────────────────────────┴─────────────────────────┘

Hot pipe (bidirectional chat with agent terminal):
  ~/.panda/vision/cast/optic-pipe.jsonl   # out: notes, chat, snaps
  ~/.panda/vision/cast/optic-prompt.txt   # in: hot-reload system prompt
  ~/.panda/vision/cast/optic-chat-in.txt  # in: agent → UI replies (append lines)
  ~/.panda/vision/cast/optic-notes.md     # notes log

Usage:
  python3 scripts/live-demux/optic-tinyworld.py both
  python3 scripts/live-demux/optic-tinyworld.py glass
  python3 scripts/live-demux/optic-tinyworld.py cymatic
  python3 scripts/live-demux/optic-tinyworld.py orb

Keys: Esc/q quit · 1–8 modes · s snapshot · h flip h · r rotate 90°
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
PIPE_DIR = Path(os.environ.get("LIVE_DEMUX_OPTIC_PIPE_DIR", HOME / ".panda/vision/cast"))
PIPE_JSONL = Path(os.environ.get("LIVE_DEMUX_OPTIC_PIPE", PIPE_DIR / "optic-pipe.jsonl"))
PROMPT_FILE = Path(os.environ.get("LIVE_DEMUX_OPTIC_PROMPT", PIPE_DIR / "optic-prompt.txt"))
CHAT_IN = Path(os.environ.get("LIVE_DEMUX_OPTIC_CHAT_IN", PIPE_DIR / "optic-chat-in.txt"))
NOTES_FILE = Path(os.environ.get("LIVE_DEMUX_OPTIC_NOTES", PIPE_DIR / "optic-notes.md"))
SNAP_DIR = Path(os.environ.get("LIVE_DEMUX_OPTIC_SNAP", HOME / ".panda/vision"))

# ─── LUT presets (RGB gain / gamma / sat / lift) ────────────────────────────
LUT_PRESETS = {
    "neutral": {"gain": (1.0, 1.0, 1.0), "gamma": 1.0, "sat": 1.0, "lift": 0.0},
    "glass-cyan": {"gain": (0.92, 1.08, 1.18), "gamma": 0.95, "sat": 1.25, "lift": 0.02},
    "warm-amber": {"gain": (1.18, 1.05, 0.88), "gamma": 1.02, "sat": 1.15, "lift": 0.01},
    "cool-moon": {"gain": (0.88, 0.98, 1.22), "gamma": 0.92, "sat": 1.1, "lift": 0.03},
    "neon-acid": {"gain": (1.15, 1.25, 0.95), "gamma": 0.88, "sat": 1.55, "lift": 0.0},
    "mono-ink": {"gain": (1.0, 1.0, 1.0), "gamma": 1.1, "sat": 0.05, "lift": 0.0},
    "film-rose": {"gain": (1.12, 0.96, 1.05), "gamma": 1.05, "sat": 0.9, "lift": 0.02},
    "deep-void": {"gain": (0.85, 0.9, 1.15), "gamma": 1.2, "sat": 1.35, "lift": -0.02},
    "cymatic-blue": {"gain": (0.75, 0.95, 1.35), "gamma": 0.9, "sat": 1.4, "lift": 0.04},
    "starfield": {"gain": (0.95, 0.98, 1.2), "gamma": 0.85, "sat": 0.7, "lift": 0.0},
}
LUT_NAMES = list(LUT_PRESETS.keys())
# User stack: mono-ink · starfield · film-rose · deep-void
LUT_MIX_DEFAULT = {
    "mono-ink": 0.28,
    "starfield": 0.28,
    "film-rose": 0.22,
    "deep-void": 0.22,
}


def blend_luts(weights: dict) -> dict:
    """Weighted mix of LUT presets → single gain/gamma/sat/lift."""
    g = [0.0, 0.0, 0.0]
    gamma = sat = lift = 0.0
    wsum = 0.0
    for name, w in weights.items():
        if w <= 0 or name not in LUT_PRESETS:
            continue
        p = LUT_PRESETS[name]
        wsum += w
        for i in range(3):
            g[i] += p["gain"][i] * w
        gamma += p["gamma"] * w
        sat += p["sat"] * w
        lift += p["lift"] * w
    if wsum < 1e-6:
        return dict(LUT_PRESETS["neutral"])
    return {
        "gain": (g[0] / wsum, g[1] / wsum, g[2] / wsum),
        "gamma": gamma / wsum,
        "sat": sat / wsum,
        "lift": lift / wsum,
    }

MODE_LIST = [
    "planet",
    "rabbit",
    "both",
    "glass",
    "cymatic",
    "orb",
    "bubble",
    "crystal",
    "wave",
    "star",
]
MODE_IDS = {
    "planet": 0.0,
    "rabbit": 1.0,
    "glass": 2.0,
    "circle": 2.0,
    "both": 3.0,
    "cymatic": 4.0,
    "orb": 5.0,
    "bubble": 6.0,
    "crystal": 7.0,
    "wave": 8.0,
    "star": 9.0,
}


def ensure_pipes():
    PIPE_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_DIR.mkdir(parents=True, exist_ok=True)
    if not PROMPT_FILE.exists():
        PROMPT_FILE.write_text(
            "# optic system prompt — shared with agent terminal\n"
            "clip-on glass · tiny world · liquid glass · cymatics\n",
            encoding="utf-8",
        )
    if not NOTES_FILE.exists():
        NOTES_FILE.write_text("# optic notes\n\n", encoding="utf-8")
    if not CHAT_IN.exists():
        CHAT_IN.write_text("", encoding="utf-8")


def pipe_emit(kind: str, **fields):
    ensure_pipes()
    rec = {
        "t": time.time(),
        "iso": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "kind": kind,
        **fields,
    }
    line = json.dumps(rec, ensure_ascii=False)
    try:
        with PIPE_JSONL.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        print(f"[optic-pipe] write fail: {e}", file=sys.stderr, flush=True)

    # Terminal chat channel — human-readable for the agent session
    if kind in ("chat", "note", "user", "ask"):
        text = fields.get("text") or fields.get("message") or ""
        print(f"\n┌─ optic chat · you ─────────────────────────────", flush=True)
        print(f"│ {text}", flush=True)
        print(f"│ mode={fields.get('mode','?')} lut={fields.get('lut','?')}", flush=True)
        print(f"└─ reply → {CHAT_IN}  (or note in session)", flush=True)
    elif kind == "boot":
        print(f"[optic] boot mode={fields.get('mode')} pipe={PIPE_JSONL}", flush=True)
    elif kind == "mode":
        print(f"[optic] mode → {fields.get('mode')}", flush=True)
    elif kind == "snapshot":
        print(f"[optic] snap → {fields.get('path')}", flush=True)
    return rec


def pipe_tail(n: int = 14) -> list:
    if not PIPE_JSONL.exists():
        return []
    try:
        lines = PIPE_JSONL.read_text(encoding="utf-8").splitlines()
        out = []
        for line in lines[-n:]:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except Exception:
                out.append({"kind": "raw", "text": line[:120]})
        return out
    except Exception:
        return []


def read_prompt_file() -> str:
    try:
        if PROMPT_FILE.exists():
            return PROMPT_FILE.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""


def read_chat_in_lines(last_n: int = 20) -> list:
    """Agent → UI replies (one message per non-empty line)."""
    try:
        if not CHAT_IN.exists():
            return []
        lines = [ln.strip() for ln in CHAT_IN.read_text(encoding="utf-8").splitlines()]
        return [ln for ln in lines if ln and not ln.startswith("#")][-last_n:]
    except Exception:
        return []


# ─── CPU helpers ────────────────────────────────────────────────────────────

def glass_fill(bgr, size: int, zoom: float, rot_deg: float = 0.0, hflip: bool = True):
    import cv2
    import numpy as np

    if hflip:
        bgr = cv2.flip(bgr, 1)
    if abs(rot_deg) > 0.5:
        h, w = bgr.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), rot_deg, 1.0)
        bgr = cv2.warpAffine(bgr, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    h, w = bgr.shape[:2]
    side = min(h, w)
    y0 = (h - side) // 2
    x0 = (w - side) // 2
    sq = bgr[y0 : y0 + side, x0 : x0 + side]
    # higher zoom crop fraction = wider FOV / more space (user wants >0.92)
    zoom = float(np.clip(zoom, 0.40, 1.0))
    ch = max(8, int(side * zoom))
    y1 = (side - ch) // 2
    crop = sq[y1 : y1 + ch, y1 : y1 + ch]
    return cv2.resize(crop, (size, size), interpolation=cv2.INTER_LANCZOS4)


def open_capture(device: int, width: int, height: int, fps: int):
    import cv2

    cap = cv2.VideoCapture(device, cv2.CAP_AVFOUNDATION)
    if not cap.isOpened():
        cap = cv2.VideoCapture(device)
    if not cap.isOpened():
        return None
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    cap.set(cv2.CAP_PROP_FPS, fps)
    return cap


# ─── GLSL ───────────────────────────────────────────────────────────────────

VERT = """
#version 330
in vec2 in_vert;
in vec2 in_uv;
out vec2 v_uv;
void main() {
    v_uv = in_uv;
    gl_Position = vec4(in_vert, 0.0, 1.0);
}
"""

FRAG = """
#version 330
// Apple liquid-glass morphism + believable soap bubbles (WebGPU glass spirit)
// ref: real-time liquid glass (shaders.com / npm_i_shaders WebGPU demos)
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_zoom;
uniform float u_mode;     // 0 planet 1 rabbit 2 glass 3 both 4 cymatic 5 orb 6 bubble 7 crystal 8 wave 9 star
uniform float u_glass;
uniform float u_chroma;
uniform vec3 u_lut_gain;
uniform float u_lut_gamma;
uniform float u_lut_sat;
uniform float u_lut_lift;
uniform float u_cym_freq;
uniform float u_cym_amp;
uniform float u_bright;   // brightness add -0.5..0.5
uniform float u_contrast; // contrast scale around mid 0.5..2.0
uniform float u_mix_crystal; // 0..1 facet mix into glass modes
uniform float u_mix_rabbit;  // 0..1 inverted-polar ghost in star/glass
uniform float u_voice;       // 0..1 voice/talk pulse (x.ai bubble energy)
uniform float u_anim;        // 0..1 satellite bubbles + ring animation
uniform float u_overlay;     // 0..1 imagine/video overlay blend
uniform sampler2D u_overlay_tex;
uniform float u_has_overlay; // 1 if overlay texture valid
in vec2 v_uv;
out vec4 f_color;

const float PI = 3.14159265359;
const float ETA = 1.0 / 1.33; // air→soap/water-ish

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash(i), b = hash(i + vec2(1.,0.));
    float c = hash(i + vec2(0.,1.)), d = hash(i + vec2(1.,1.));
    vec2 u = f*f*(3.-2.*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p = p * 2.03 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

vec2 clampUv(vec2 suv) { return clamp(suv, 0.002, 0.998); }

// Chromatic sample (liquid glass dispersion)
vec3 sampleChroma(vec2 suv, vec2 disp) {
    suv = clampUv(suv);
    float g = u_glass * 0.018 * u_chroma;
    float r = texture(u_tex, clampUv(suv + disp * g * 1.6)).r;
    float gr = texture(u_tex, suv).g;
    float b = texture(u_tex, clampUv(suv - disp * g * 1.6)).b;
    return vec3(r, gr, b);
}

// Soft multi-tap blur — frosted / Apple glass morphism backdrop
vec3 sampleBlur(vec2 suv, float radius) {
    suv = clampUv(suv);
    vec3 acc = texture(u_tex, suv).rgb;
    float wsum = 1.0;
    // 8-tap ring + 4 mid (cheap gaussian-ish)
    for (int i = 0; i < 8; i++) {
        float a = float(i) * (PI * 0.25) + u_time * 0.05;
        vec2 o = vec2(cos(a), sin(a)) * radius;
        acc += texture(u_tex, clampUv(suv + o)).rgb;
        wsum += 1.0;
    }
    for (int j = 0; j < 4; j++) {
        float a = float(j) * (PI * 0.5) + 0.4;
        vec2 o = vec2(cos(a), sin(a)) * radius * 0.45;
        acc += texture(u_tex, clampUv(suv + o)).rgb * 0.7;
        wsum += 0.7;
    }
    return acc / wsum;
}

vec3 sampleFill(vec2 suv) {
    vec2 dir = suv - 0.5;
    return sampleChroma(suv, dir);
}

vec3 samplePano(float lon, float lat) {
    float lon3 = lon * 3.0;
    float cell = floor(lon3);
    float f = fract(lon3);
    if (mod(cell, 2.0) > 0.5) f = 1.0 - f;
    vec2 suv = vec2(f, clamp(lat, 0.0, 1.0));
    suv = (suv - 0.5) / max(u_zoom, 0.45) + 0.5;
    return sampleFill(suv);
}

vec3 applyLut(vec3 col) {
    col = pow(max(col, 0.0), vec3(u_lut_gamma));
    col = col * u_lut_gain + u_lut_lift;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, u_lut_sat);
    // brightness / contrast (midpoint 0.5)
    col = (col - 0.5) * max(u_contrast, 0.05) + 0.5 + u_bright;
    return clamp(col, 0.0, 1.0);
}

// Crystal facet warp of UV (for mix into glass/star)
vec2 crystalWarp(vec2 p, float t) {
    float ang = atan(p.y, p.x);
    float facets = 8.0;
    float fa = floor((ang + PI) / (2.0 * PI) * facets) / facets * 2.0 * PI - PI;
    float r = length(p);
    vec2 fp = vec2(cos(fa), sin(fa)) * r;
    fp += 0.05 * sin(r * 12.0 + t) * vec2(cos(fa), sin(fa));
    return fp;
}

// Rabbit-style inverted polar sample of cam (ghost layer)
vec3 rabbitGhost(vec2 p) {
    float rr = length(p);
    float theta = atan(p.y, p.x);
    float lon = (theta + PI) / (2.0 * PI);
    float lat = pow(clamp(1.0 - rr, 0.0, 1.0), 0.85);
    return samplePano(lon, lat);
}

// Schlick fresnel
float fresnelSchlick(float cosTheta, float F0) {
    return F0 + (1.0 - F0) * pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
}

// Thin-film soap iridescence (approximate spectral)
vec3 thinFilm(float thickness, float cosN) {
    // optical path ~ thickness * cos
    float phase = thickness * cosN * 12.0 + u_time * 0.8;
    // shifted RGB interference fringes
    return 0.5 + 0.5 * vec3(
        sin(phase),
        sin(phase + 2.094),
        sin(phase + 4.189)
    );
}

// Sphere normal from circle UV (p in -1..1 disk)
vec3 sphereNormal(vec2 p) {
    float z = sqrt(max(0.0, 1.0 - dot(p, p)));
    return normalize(vec3(p, z));
}

float cymatic(vec2 p, float t) {
    float f = u_cym_freq;
    float a = u_cym_amp;
    float v = 0.0;
    v += sin((p.x * f + t * 1.3) * PI) * sin((p.y * f * 0.9 - t * 0.8) * PI);
    v += 0.6 * sin((p.x * f * 1.7 - p.y * f * 1.1 + t) * PI);
    v += 0.4 * cos(length(p) * f * 2.2 - t * 2.0);
    v += 0.25 * sin(atan(p.y, p.x) * 6.0 + t * 1.5);
    return v * a;
}

// ── Apple liquid-glass morphism (single dome) ──────────────────────────────
vec3 liquidGlass(vec2 p, float t) {
    float r = length(p);
    vec3 n = sphereNormal(p);
    vec3 V = vec3(0.0, 0.0, 1.0);
    float NdotV = max(dot(n, V), 0.0);
    float F = fresnelSchlick(NdotV, 0.06 + 0.04 * u_glass);

    // refraction: bend view through sphere (IOR)
    vec3 R = refract(-V, n, mix(0.92, 0.72, clamp(u_glass * 0.5, 0.0, 1.0)));
    vec2 suv = 0.5 + R.xy * 0.48 * u_zoom;
    // liquid wobble on surface
    float wob = fbm(p * 3.0 + t * 0.35) - 0.5;
    suv += n.xy * wob * 0.04 * u_glass;

    // frosted backdrop (morphism blur) + sharp refract mix
    float blurR = 0.012 + 0.028 * u_glass * (1.0 - NdotV);
    vec3 frosted = sampleBlur(suv, blurR);
    vec3 sharp = sampleChroma(suv, n.xy);
    vec3 trans = mix(sharp, frosted, 0.45 + 0.25 * u_glass);

    // subtle desat / lift like Apple UI glass
    float lum = dot(trans, vec3(0.299, 0.587, 0.114));
    trans = mix(vec3(lum), trans, 0.88);
    trans = mix(trans, trans + vec3(0.04, 0.06, 0.08), 0.2);

    // environment specular (window light)
    vec3 L1 = normalize(vec3(-0.35, 0.55, 0.75));
    vec3 L2 = normalize(vec3(0.6, 0.2, 0.55));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(n, H1), 0.0), 64.0);
    float spec2 = pow(max(dot(n, L2), 0.0), 12.0) * 0.25;
    // anisotropic-ish rim highlight
    float rimH = pow(1.0 - NdotV, 3.0);

    vec3 col = trans * (0.55 + 0.35 * NdotV);
    col += vec3(1.0) * spec1 * 0.85 * u_glass;
    col += vec3(0.7, 0.85, 1.0) * spec2 * u_glass;
    col += vec3(0.55, 0.8, 1.0) * rimH * F * 0.7 * u_glass;
    // chromatic edge sparkle
    col.r += rimH * 0.06 * u_chroma;
    col.b += rimH * 0.1 * u_chroma;
    // soft contact shadow at edge
    col *= 1.0 - smoothstep(0.92, 1.0, r) * 0.85;
    return col;
}

// ── Believable soap bubble (single sphere) ─────────────────────────────────
// returns rgb + alpha coverage for compositing
vec4 soapBubble(vec2 p, vec2 center, float rad, float seed, float t) {
    vec2 lp = (p - center) / max(rad, 1e-4);
    float lr = length(lp);
    if (lr > 1.05) return vec4(0.0);

    // soft sphere
    float z = sqrt(max(0.0, 1.0 - min(lr * lr, 1.0)));
    vec3 n = normalize(vec3(lp, z));
    vec3 V = vec3(0.0, 0.0, 1.0);
    float NdotV = max(dot(n, V), 0.0);
    float F = fresnelSchlick(NdotV, 0.04);

    // thickness varies with noise + gravity (thinner at top)
    float thick = 0.35 + 0.45 * fbm(lp * 2.5 + seed + t * 0.1);
    thick *= 0.7 + 0.5 * (0.5 + 0.5 * lp.y); // drainage
    vec3 film = thinFilm(thick, NdotV + 0.15);

    // transmit background with bulge refraction
    vec3 R = refract(-V, n, ETA);
    vec2 suv = 0.5 + (center + R.xy * rad * 1.1) * 0.5 * u_zoom;
    // magnify center slightly (lens)
    suv = mix(suv, 0.5 + center * 0.5 * u_zoom, 0.15);
    vec3 bg = sampleBlur(suv, 0.006 + 0.01 * (1.0 - NdotV));
    bg = sampleChroma(suv, n.xy * 0.5) * 0.55 + bg * 0.45;

    // mostly transparent; film + fresnel carry the look
    vec3 col = mix(bg, film, 0.22 + 0.35 * (1.0 - NdotV));
    col = mix(col, film, F * 0.55);

    // specular glint
    vec3 L = normalize(vec3(-0.3 + 0.1 * sin(seed), 0.55, 0.75));
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(n, H), 0.0), 80.0);
    col += vec3(1.0) * spec * 1.1;

    // bright ring (meniscus / edge)
    float edge = smoothstep(0.78, 0.95, lr) * (1.0 - smoothstep(0.98, 1.02, lr));
    col += film * edge * 0.65;
    col += vec3(0.8, 0.95, 1.0) * edge * F * 0.4;

    // secondary internal caustic
    float cau = pow(max(n.z, 0.0), 3.0) * noise(lp * 6.0 + t * 0.2 + seed);
    col += film * cau * 0.2;

    // coverage: soft disk
    float alpha = smoothstep(1.02, 0.88, lr);
    alpha *= 0.35 + 0.55 * F + 0.25 * edge; // more opaque on rim
    alpha = clamp(alpha * (0.75 + 0.35 * u_glass), 0.0, 1.0);
    return vec4(col, alpha);
}

void main() {
    vec2 uv = v_uv;
    float invert = 0.0;
    int mode = int(u_mode + 0.1);

    if (mode == 3) {
        if (uv.x < 0.5) { uv.x *= 2.0; mode = 0; }
        else { uv.x = (uv.x - 0.5) * 2.0; mode = 1; invert = 1.0; }
    }

    vec2 p = uv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) {
        f_color = vec4(0.015, 0.015, 0.02, 1.0);
        return;
    }

    float t = u_time;
    vec3 col = vec3(0.0);
    float fres = pow(r, 2.8);
    float rim = smoothstep(0.88, 1.0, r);

    if (mode == 0 || mode == 1) {
        if (mode == 1) invert = 1.0;
        float theta = atan(p.y, p.x);
        float lon = (theta + PI) / (2.0 * PI);
        float lat = invert > 0.5 ? (1.0 - r) : r;
        lat = pow(clamp(lat, 0.0, 1.0), invert > 0.5 ? 0.85 : 1.15);
        col = samplePano(lon, lat);
        // light glass rim on polar modes
        col = mix(col, liquidGlass(p, t), 0.12 * u_glass);
        col += vec3(0.4, 0.7, 1.0) * fres * 0.12 * u_glass;
        col *= 1.0 - rim * 0.9;
    }
    else if (mode == 2) {
        // APPLE LIQUID GLASS + crystal/rabbit mix
        col = liquidGlass(p, t);
        if (u_mix_crystal > 0.01) {
            vec2 pw = crystalWarp(p, t);
            vec2 suv = 0.5 + pw * 0.48 * u_zoom;
            vec3 fac = sampleFill(suv);
            float ang = atan(p.y, p.x);
            float fe = abs(fract((ang + PI) / (2.0 * PI) * 8.0) - 0.5);
            fac += vec3(0.6, 0.85, 1.0) * smoothstep(0.08, 0.0, fe) * 0.4;
            col = mix(col, fac, clamp(u_mix_crystal, 0.0, 1.0) * 0.45);
        }
        if (u_mix_rabbit > 0.01) {
            col = mix(col, rabbitGhost(p), clamp(u_mix_rabbit, 0.0, 1.0) * 0.3);
        }
        // extra edge chroma on glass
        float edge = pow(r, 2.5);
        col.r += edge * 0.08 * u_chroma;
        col.b += edge * 0.12 * u_chroma;
    }
    else if (mode == 4) {
        float cy = cymatic(p, t);
        float band = smoothstep(0.05, 0.15, abs(cy));
        vec2 suv = 0.5 + p * 0.45 * u_zoom;
        suv += 0.04 * cy * normalize(p + 1e-4);
        col = mix(sampleFill(suv), sampleBlur(suv, 0.01), 0.35);
        float ridges = smoothstep(0.02, 0.0, abs(cy)) * 0.85;
        col = mix(col, vec3(0.05, 0.12, 0.28), ridges);
        col = mix(col, col * vec3(0.7, 0.95, 1.4), band * 0.5);
        col = mix(col, liquidGlass(p, t), 0.2 * u_glass);
        col *= 1.0 - rim * 0.95;
    }
    else if (mode == 5 || mode == 9) {
        // ORB / STAR — user-visible glass sphere + crystal + rabbit mix
        // mode 5 orb: balanced shell · mode 9 star: more edge stars/chroma but KEEP subject
        vec3 n = sphereNormal(p);
        vec3 V = vec3(0.0, 0.0, 1.0);
        float NdotV = max(dot(n, V), 0.0);
        float F = fresnelSchlick(NdotV, 0.05);
        float edge = pow(1.0 - NdotV, 2.2); // rim weight

        // crystal-warped refraction so facets read on the shell
        vec2 pref = mix(p, crystalWarp(p, t), clamp(u_mix_crystal, 0.0, 1.0));
        float plen = length(pref);
        if (plen > 1e-4) pref *= min(length(p), 0.999) / plen;

        vec3 Rd = refract(-V, sphereNormal(pref), 0.82);
        // stronger center zoom so face stays readable
        float centerPull = (mode == 9) ? 0.55 : 0.42;
        vec2 suv = 0.5 + mix(Rd.xy, p, centerPull) * 0.48 * u_zoom;
        // subject layer — bright, mostly sharp
        vec3 subject = sampleChroma(suv, n.xy * (0.3 + 0.7 * edge));
        subject = mix(subject, sampleBlur(suv, 0.006), 0.15);
        // lift shadows so user is visible under stars
        subject = subject * 1.15 + 0.06;

        // rabbit inverted-polar ghost (depth / tunnel)
        vec3 rab = rabbitGhost(p);
        subject = mix(subject, rab, clamp(u_mix_rabbit, 0.0, 1.0) * (0.25 + 0.35 * edge));

        // liquid-glass shell contribution
        vec3 lg = liquidGlass(p, t);

        // stars — concentrated on EDGE so they don't wipe the face
        float stars = 0.0;
        for (int i = 0; i < 4; i++) {
            float sc = 11.0 + float(i) * 9.0;
            vec2 sp = p * sc + float(i) * 19.0 + t * 0.02;
            float h = hash(floor(sp));
            float d = length(fract(sp) - 0.5);
            float tw = 0.5 + 0.5 * sin(t * 2.5 + h * 30.0);
            stars += smoothstep(0.065, 0.0, d) * step(0.93, h) * tw;
        }
        // edge mask: stars mostly outside ~0.45 radius
        float starMask = smoothstep(0.35, 0.85, r) * (0.55 + 0.45 * edge);
        if (mode == 9) starMask = smoothstep(0.28, 0.75, r);
        vec3 space = vec3(0.02, 0.03, 0.07)
                   + stars * vec3(0.95, 0.97, 1.0) * starMask
                   + vec3(0.12, 0.04, 0.22) * fbm(p * 2.0 + t * 0.05) * 0.25 * starMask;

        // CORE: subject dominates center; EDGE: glass + stars + chroma
        float core = smoothstep(0.85, 0.25, r); // 1 at center
        col = mix(lg * 0.55 + space, subject, 0.62 + 0.28 * core);
        if (mode == 9) {
            // star mode: still keep user — don't invert to space-only
            col = mix(subject * 1.05, mix(subject, lg, 0.35) + space * 0.85, 0.45 * starMask + 0.15);
            col = mix(col, subject, 0.4 * core); // re-assert face in center
        } else {
            col = mix(col, subject, 0.35 * core);
            col += space * 0.55;
        }

        // crystal edge glints
        float ang = atan(p.y, p.x);
        float facetEdge = abs(fract((ang + PI) / (2.0 * PI) * 8.0) - 0.5);
        float fGlint = smoothstep(0.07, 0.0, facetEdge) * edge * u_mix_crystal;
        col += vec3(0.65, 0.85, 1.0) * fGlint * 0.55;

        // glass fresnel + specular
        col += vec3(0.55, 0.8, 1.0) * F * 0.55 * u_glass;
        vec3 L = normalize(vec3(-0.4, 0.55, 0.75));
        float spec = pow(max(dot(n, normalize(L + V)), 0.0), 56.0);
        col += vec3(1.0) * spec * 0.75;

        // EDGE CHROMA — stronger for star
        float ch = u_chroma * (mode == 9 ? 1.65 : 1.1);
        col.r += edge * 0.14 * ch;
        col.g += edge * 0.04 * ch;
        col.b += edge * 0.22 * ch;
        // RGB split along rim
        vec2 eDir = normalize(p + 1e-5) * edge * 0.02 * ch;
        col.r = mix(col.r, sampleFill(suv + eDir).r, edge * 0.45);
        col.b = mix(col.b, sampleFill(suv - eDir).b, edge * 0.5);

        col *= 1.0 - smoothstep(0.95, 1.0, r);
    }
    else if (mode == 6) {
        // BELIEVABLE soap bubble cluster (depth-ish front to back)
        // backdrop: soft glass morphism of scene
        vec3 back = sampleBlur(0.5 + p * 0.38 * u_zoom, 0.02);
        back = mix(back, liquidGlass(p, t), 0.25);
        col = back * 0.55;

        // larger bubbles first (behind), smaller on top — fixed order by seed
        for (int i = 0; i < 14; i++) {
            float fi = float(i);
            float h1 = hash(vec2(fi, 1.7));
            float h2 = hash(vec2(fi, 4.3));
            float h3 = hash(vec2(fi, 9.1));
            // slow drift + slight jostle
            vec2 c = vec2(
                sin(fi * 2.3 + t * (0.08 + 0.04 * h1)) * (0.25 + 0.45 * h2),
                cos(fi * 1.7 - t * (0.07 + 0.03 * h2)) * (0.25 + 0.4 * h3)
            );
            // pack toward center a bit
            c *= 0.92;
            float rad = 0.10 + 0.14 * h1 + 0.04 * sin(t * 0.5 + fi);
            // front bubbles slightly larger motion
            vec4 b = soapBubble(p, c, rad, h1 * 10.0 + fi, t);
            col = mix(col, b.rgb, b.a);
        }
        // one hero bubble near center (more readable)
        vec4 hero = soapBubble(p, vec2(0.05 * sin(t * 0.3), -0.02), 0.28 + 0.02 * sin(t * 0.7), 0.5, t);
        col = mix(col, hero.rgb, hero.a * 0.95);

        // outer vessel rim (holding glass)
        col = mix(col, liquidGlass(p, t), fres * 0.15 * u_glass);
        col *= 1.0 - smoothstep(0.94, 1.0, r) * 0.9;
    }
    else if (mode == 7) {
        float ang = atan(p.y, p.x);
        float facets = 8.0;
        float fa = floor((ang + PI) / (2.0 * PI) * facets) / facets * 2.0 * PI - PI;
        vec2 fp = vec2(cos(fa), sin(fa)) * r;
        vec2 suv = 0.5 + fp * 0.48 * u_zoom;
        suv += 0.06 * sin(r * 12.0 + t) * vec2(cos(fa), sin(fa));
        col = mix(sampleFill(suv), sampleBlur(suv, 0.008), 0.3);
        float edge = abs(fract((ang + PI) / (2.0 * PI) * facets) - 0.5);
        col += vec3(0.6, 0.85, 1.0) * smoothstep(0.08, 0.0, edge) * 0.45;
        col = mix(col, liquidGlass(p, t), 0.2);
        col *= 1.0 - rim * 0.9;
    }
    else if (mode == 8) {
        float wave = sin(p.x * 14.0 + t * 2.5) * cos(p.y * 11.0 - t * 1.8);
        wave += 0.5 * sin(length(p) * 20.0 - t * 3.0);
        wave += 0.25 * fbm(p * 4.0 + t * 0.5);
        vec2 suv = 0.5 + p * 0.45 * u_zoom + 0.035 * wave * vec2(1.0, 0.7);
        col = mix(sampleFill(suv), sampleBlur(suv, 0.01), 0.4);
        col = mix(col, col * vec3(0.8, 1.05, 1.2), 0.4);
        float spec = pow(max(0.0, 1.0 - abs(wave * 0.3 + r)), 14.0);
        col += vec3(1.0) * spec * 0.4 * u_glass;
        col = mix(col, liquidGlass(p, t), 0.18);
        col *= 1.0 - rim;
    }
    else {
        col = liquidGlass(p, t);
    }

    // ═══ polished voice energy (NO competing soap beads) ═══
    // Same sphere filter language as the hero orb — soft rim pulse only.
    // Floating soapBubble satellites looked cheap next to the main sphere.
    if (u_anim > 0.01 && r <= 1.0) {
        float pulse = 0.5 + 0.5 * sin(t * (2.4 + u_voice * 3.2));
        // single listening ring — matches liquid-glass rim, not a second material
        float ringR = 0.91 + 0.025 * pulse * (0.35 + u_voice);
        float ring = smoothstep(0.022, 0.0, abs(r - ringR)) * smoothstep(0.55, 0.88, r);
        col += vec3(0.55, 0.78, 1.0) * ring * 0.28 * u_anim * (0.4 + 0.6 * u_voice);
        // subtle specular breathe on shell (same glass, not new blobs)
        float breathe = 0.5 + 0.5 * sin(t * 1.6);
        col += vec3(1.0) * pow(max(1.0 - r, 0.0), 10.0) * 0.12 * u_anim * breathe * u_voice;
    }

    // Imagine / loop video overlay (additive glass film)
    if (u_has_overlay > 0.5 && u_overlay > 0.01) {
        vec2 ou = 0.5 + p * 0.5;
        vec3 ov = texture(u_overlay_tex, clampUv(ou)).rgb;
        // screen-ish blend through glass
        col = mix(col, 1.0 - (1.0 - col) * (1.0 - ov), u_overlay * 0.55);
        col = mix(col, col + ov * 0.35, u_overlay * 0.4);
    }

    col = applyLut(col);
    f_color = vec4(clamp(col, 0.0, 1.0), 1.0);
}
"""


# ─── /cam device registry ───────────────────────────────────────────────────

CAM_DEVICE_JSON = PIPE_DIR / "cam-device.json"

# Winning Continuity / built-in map (matches AVFoundation list on this Mac)
DEFAULT_CAM_DEVICES = [
    (0, "FaceTime HD Camera (Built-in)"),
    (1, "Brick Camera"),  # Continuity / phone — preferred /cam phone
    (2, "Brick Desk View Camera"),
]


def list_cam_devices() -> list:
    """Return [(index, label)] for /cam-compatible sources.

    Do not probe indices by open() — AVFoundation exclusive lock + false fails.
    Known map matches Continuity (Brick) + FaceTime used by /cam phone.
    """
    return list(DEFAULT_CAM_DEVICES)


def write_cam_device(idx: int, name: str):
    ensure_pipes()
    rec = {
        "schema": "fc-cam-device-v1",
        "device": idx,
        "name": name,
        "t": time.time(),
        "iso": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "for": ["/cam", "/lens", "optic-tinyworld"],
    }
    try:
        CAM_DEVICE_JSON.write_text(json.dumps(rec, indent=2), encoding="utf-8")
        # env-friendly one-liner for shells
        (PIPE_DIR / "cam-device.env").write_text(
            f"export LIVE_DEMUX_CAM_DEVICE={idx}\n"
            f"export LIVE_DEMUX_CAM_PHONE_DEVICE={idx if 'Brick' in name or 'iPhone' in name else 1}\n",
            encoding="utf-8",
        )
    except Exception as e:
        print(f"[optic] cam-device write fail: {e}", flush=True)
    pipe_emit("cam_device", device=idx, name=name)
    return rec



def run_gpu(mode, device, cw, ch, size, zoom, fps, mirror, glass, chroma) -> int:
    import cv2
    import numpy as np
    import moderngl
    import glfw
    import imgui
    from imgui.integrations.glfw import GlfwRenderer

    ensure_pipes()
    pipe_emit("boot", mode=mode, device=device, size=size, backend="moderngl+imgui+cymatic")

    if not glfw.init():
        print("error: glfw init failed", file=sys.stderr)
        return 1

    panel_w = int(os.environ.get("LIVE_DEMUX_OPTIC_PANEL_W", "420"))
    preview_w = size * 2 if mode == "both" else size
    win_w = preview_w + panel_w
    win_h = max(size, 680)

    title = f"optic · {mode} · gpu · pipe · [{device}]"
    glfw.window_hint(glfw.CONTEXT_VERSION_MAJOR, 3)
    glfw.window_hint(glfw.CONTEXT_VERSION_MINOR, 3)
    glfw.window_hint(glfw.OPENGL_PROFILE, glfw.OPENGL_CORE_PROFILE)
    glfw.window_hint(glfw.OPENGL_FORWARD_COMPAT, True)
    window = glfw.create_window(win_w, win_h, title, None, None)
    if not window:
        glfw.terminate()
        return 1
    glfw.make_context_current(window)
    glfw.swap_interval(1)

    imgui.create_context()
    impl = GlfwRenderer(window)

    ctx = moderngl.create_context()
    prog = ctx.program(vertex_shader=VERT, fragment_shader=FRAG)
    vertices = np.array(
        [-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1],
        dtype="f4",
    )
    vbo = ctx.buffer(vertices.tobytes())
    vao = ctx.simple_vertex_array(prog, vbo, "in_vert", "in_uv")

    # Defaults tuned from live session look
    st = {
        "mode": mode if mode in MODE_LIST else "star",
        "zoom": float(zoom),
        "glass": float(glass),
        "chroma": float(chroma),
        "mirror": bool(mirror),
        "rot": float(os.environ.get("LIVE_DEMUX_LENS_ROT", "-175.83")),
        "lut": "mix",
        "lut_mix": dict(LUT_MIX_DEFAULT),  # mono-ink · starfield · film-rose · deep-void
        "cym_freq": 6.0,
        "cym_amp": 0.85,
        "bright": float(os.environ.get("LIVE_DEMUX_LENS_BRIGHT", "-0.032")),
        "contrast": float(os.environ.get("LIVE_DEMUX_LENS_CONTRAST", "1.461")),
        "mix_crystal": 0.45,
        "mix_rabbit": 0.35,
        "voice": 0.45,  # soft voice energy on glass rim
        "anim": 0.55,  # polished pulse only (no floating soap beads)
        "overlay_amt": 0.25,
        "cam_devices": list_cam_devices(),
        "cam_idx": int(device),
        "cam_label": "",
        "note": "",
        "prompt": read_prompt_file(),
        "prompt_mtime": PROMPT_FILE.stat().st_mtime if PROMPT_FILE.exists() else 0.0,
        "chat_in_mtime": CHAT_IN.stat().st_mtime if CHAT_IN.exists() else 0.0,
        "chat_log": [],
        "status": "voice bubbles · /cam device picker · overlay ready",
        "frames": 0,
        "fps_ema": 0.0,
        "snap_path": "",
    }
    for idx, lab in st["cam_devices"]:
        if idx == st["cam_idx"]:
            st["cam_label"] = lab
            break
    if not st["cam_label"] and st["cam_devices"]:
        st["cam_label"] = st["cam_devices"][0][1]
    write_cam_device(st["cam_idx"], st["cam_label"] or f"Camera {st['cam_idx']}")
    # seed chat
    st["chat_log"].append({"role": "sys", "text": f"optic workspace · pipe {PIPE_JSONL.name}"})

    tex = ctx.texture((size, size), 3)
    tex.filter = (moderngl.LINEAR, moderngl.LINEAR)
    tex.repeat_x = False
    tex.repeat_y = False

    # Imagine / loop video overlay layer (optional)
    overlay_tex = ctx.texture((size, size), 3)
    overlay_tex.filter = (moderngl.LINEAR, moderngl.LINEAR)
    overlay_path = Path(
        os.environ.get(
            "LIVE_DEMUX_OPTIC_OVERLAY",
            str(SNAP_DIR / "optic-overlay.mp4"),
        )
    )
    # also try common still/gif frames
    overlay_candidates = [
        overlay_path,
        SNAP_DIR / "optic-overlay.mov",
        SNAP_DIR / "optic-overlay.webm",
        PIPE_DIR / "optic-overlay.mp4",
        SNAP_DIR / "imagine-bubble.mp4",
    ]
    overlay_cap = None
    has_overlay = 0.0
    for op in overlay_candidates:
        if op.is_file():
            overlay_cap = cv2.VideoCapture(str(op))
            if overlay_cap is not None and overlay_cap.isOpened():
                has_overlay = 1.0
                print(f"    overlay video: {op}", flush=True)
                break
            overlay_cap = None
    if has_overlay < 0.5:
        # procedural placeholder — solid dark so shader u_has_overlay can stay 0
        print("    overlay: none (drop mp4 at ~/.panda/vision/optic-overlay.mp4)", flush=True)

    cap = open_capture(st["cam_idx"], cw, ch, fps)
    if cap is None:
        print(f"error: cannot open camera {st['cam_idx']}", file=sys.stderr)
        # try FaceTime fallback
        cap = open_capture(0, cw, ch, fps)
        if cap is None:
            impl.shutdown()
            glfw.terminate()
            return 1
        st["cam_idx"] = 0

    print(f"==> optic workspace · mode={st['mode']} cam={st['cam_idx']} ({st['cam_label']})", flush=True)
    print(f"    pipe out: {PIPE_JSONL}", flush=True)
    print(f"    chat in:  {CHAT_IN}  (agent replies, one line each)", flush=True)
    print(f"    prompt:   {PROMPT_FILE}", flush=True)
    print("    modes: planet rabbit both glass cymatic orb bubble crystal wave star", flush=True)
    print("    keys: 1–0 modes · [ ] rotate · h flip · s snap · Esc quit", flush=True)

    t0 = time.time()
    last = t0
    try:
        while not glfw.window_should_close(window):
            now = time.time()
            dt = max(1e-4, now - last)
            last = now

            # hot-reload prompt
            try:
                mt = PROMPT_FILE.stat().st_mtime
                if mt != st["prompt_mtime"]:
                    st["prompt"] = read_prompt_file()
                    st["prompt_mtime"] = mt
                    pipe_emit("prompt_reload", chars=len(st["prompt"]))
                    st["status"] = "prompt reloaded from file"
            except Exception:
                pass

            # agent chat-in replies
            try:
                mt = CHAT_IN.stat().st_mtime
                if mt != st["chat_in_mtime"]:
                    lines = read_chat_in_lines(30)
                    st["chat_in_mtime"] = mt
                    # take new lines vs existing
                    known = {c["text"] for c in st["chat_log"] if c["role"] == "agent"}
                    for ln in lines:
                        if ln not in known:
                            st["chat_log"].append({"role": "agent", "text": ln})
                            print(f"\n┌─ optic chat · agent ──────────────────────────", flush=True)
                            print(f"│ {ln}", flush=True)
                            print(f"└───────────────────────────────────────────────", flush=True)
                            st["status"] = "agent reply"
                    if len(st["chat_log"]) > 40:
                        st["chat_log"] = st["chat_log"][-40:]
            except Exception:
                pass

            ok, frame = cap.read()
            if ok and frame is not None:
                fill = glass_fill(frame, size, st["zoom"], rot_deg=st["rot"], hflip=st["mirror"])
                rgb = cv2.cvtColor(fill, cv2.COLOR_BGR2RGB)
                tex.write(rgb.tobytes())
                st["frames"] += 1
                st["fps_ema"] = st["fps_ema"] * 0.9 + (1.0 / dt) * 0.1
            # overlay video layer (loop)
            if overlay_cap is not None:
                ok_o, ofr = overlay_cap.read()
                if not ok_o or ofr is None:
                    overlay_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ok_o, ofr = overlay_cap.read()
                if ok_o and ofr is not None:
                    ofr = cv2.resize(ofr, (size, size))
                    overlay_tex.write(cv2.cvtColor(ofr, cv2.COLOR_BGR2RGB).tobytes())
                    has_overlay = 1.0
            # auto voice pulse (imagine breathing) + optional env
            env_voice = os.environ.get("LIVE_DEMUX_OPTIC_VOICE")
            if env_voice is not None:
                try:
                    st["voice"] = float(env_voice)
                except ValueError:
                    pass
            else:
                # gentle LFO when not driven externally
                st["voice"] = 0.35 + 0.35 * (0.5 + 0.5 * math.sin(now * 2.4))

            fb_w, fb_h = glfw.get_framebuffer_size(window)
            win_w2, win_h2 = glfw.get_window_size(window)
            scale_x = fb_w / max(win_w2, 1)
            scale_y = fb_h / max(win_h2, 1)

            pw = panel_w
            prev_w = max(1, win_w2 - pw)
            prev_h = win_h2
            if st["mode"] == "both":
                cell = min(prev_w // 2, prev_h)
                draw_w, draw_h = cell * 2, cell
            else:
                cell = min(prev_w, prev_h)
                draw_w, draw_h = cell, cell
            ox = (prev_w - draw_w) // 2
            oy = (prev_h - draw_h) // 2

            ctx.screen.use()
            ctx.viewport = (0, 0, fb_w, fb_h)
            ctx.clear(0.035, 0.035, 0.05, 1.0)

            vx = int(ox * scale_x)
            vy = int((win_h2 - oy - draw_h) * scale_y)
            vw = max(1, int(draw_w * scale_x))
            vh = max(1, int(draw_h * scale_y))
            ctx.viewport = (vx, vy, vw, vh)
            tex.use(0)
            if st["lut"] == "mix":
                lut = blend_luts(st["lut_mix"])
            else:
                lut = LUT_PRESETS.get(st["lut"], LUT_PRESETS["neutral"])
            prog["u_tex"].value = 0
            prog["u_time"].value = now - t0
            prog["u_zoom"].value = float(st["zoom"])
            prog["u_glass"].value = float(st["glass"])
            prog["u_chroma"].value = float(st["chroma"])
            prog["u_mode"].value = MODE_IDS.get(st["mode"], 3.0)
            prog["u_lut_gain"].value = tuple(lut["gain"])
            prog["u_lut_gamma"].value = float(lut["gamma"])
            prog["u_lut_sat"].value = float(lut["sat"])
            prog["u_lut_lift"].value = float(lut["lift"])
            prog["u_cym_freq"].value = float(st["cym_freq"])
            prog["u_cym_amp"].value = float(st["cym_amp"])
            prog["u_bright"].value = float(st["bright"])
            prog["u_contrast"].value = float(st["contrast"])
            prog["u_mix_crystal"].value = float(st["mix_crystal"])
            prog["u_mix_rabbit"].value = float(st["mix_rabbit"])
            prog["u_voice"].value = float(st["voice"])
            prog["u_anim"].value = float(st["anim"])
            prog["u_overlay"].value = float(st["overlay_amt"])
            prog["u_has_overlay"].value = float(has_overlay)
            tex.use(0)
            prog["u_tex"].value = 0
            overlay_tex.use(1)
            prog["u_overlay_tex"].value = 1
            vao.render(moderngl.TRIANGLES)

            # ── ImGui panel ──
            impl.process_inputs()
            imgui.new_frame()

            imgui.set_next_window_position(prev_w, 0)
            imgui.set_next_window_size(pw, win_h2)
            flags = (
                imgui.WINDOW_NO_RESIZE
                | imgui.WINDOW_NO_MOVE
                | imgui.WINDOW_NO_COLLAPSE
                | imgui.WINDOW_NO_TITLE_BAR
            )
            imgui.begin("optic_pipe_panel", flags=flags)

            imgui.text("OPTIC · HOT PIPE · CHAT")
            imgui.separator()
            imgui.text(f"{st['fps_ema']:.0f}fps  n={st['frames']}")
            imgui.text_wrapped(str(PIPE_JSONL))

            # /cam device picker (FaceTime · Brick Continuity · Desk)
            imgui.spacing()
            imgui.text("/cam DEVICE")
            cam_labels = [f"[{i}] {n}" for i, n in st["cam_devices"]]
            cur = 0
            for i, (idx, _) in enumerate(st["cam_devices"]):
                if idx == st["cam_idx"]:
                    cur = i
                    break
            chg, cur = imgui.combo("##camdev", cur, cam_labels if cam_labels else ["[0] default"])
            if chg and st["cam_devices"]:
                new_idx, new_lab = st["cam_devices"][cur]
                if new_idx != st["cam_idx"]:
                    # exclusive reopen
                    try:
                        cap.release()
                    except Exception:
                        pass
                    ncap = open_capture(new_idx, cw, ch, fps)
                    if ncap is not None:
                        cap = ncap
                        st["cam_idx"] = new_idx
                        st["cam_label"] = new_lab
                        write_cam_device(new_idx, new_lab)
                        st["status"] = f"/cam → [{new_idx}] {new_lab}"
                        glfw.set_window_title(
                            window, f"optic · {st['mode']} · gpu · pipe · [{new_idx}]"
                        )
                    else:
                        st["status"] = f"cam [{new_idx}] busy — keep prior"
                        # reopen old
                        cap = open_capture(st["cam_idx"], cw, ch, fps)
            imgui.text_wrapped(st.get("cam_label") or "")
            if imgui.button("refresh devices"):
                st["cam_devices"] = list_cam_devices()
            imgui.same_line()
            if imgui.button("use Brick"):
                for idx, lab in st["cam_devices"]:
                    if "Brick" in lab and "Desk" not in lab:
                        try:
                            cap.release()
                        except Exception:
                            pass
                        ncap = open_capture(idx, cw, ch, fps)
                        if ncap:
                            cap = ncap
                            st["cam_idx"] = idx
                            st["cam_label"] = lab
                            write_cam_device(idx, lab)
                            st["status"] = f"/cam phone Continuity → {lab}"
                        break

            # modes
            imgui.spacing()
            modes_row = [
                ("planet", "planet"),
                ("rabbit", "rabbit"),
                ("both", "both"),
                ("glass", "glass"),
            ]
            for i, (lab, mid) in enumerate(modes_row):
                if i:
                    imgui.same_line()
                if imgui.button(f"{lab}##m", 72, 22):
                    st["mode"] = mid
                    pipe_emit("mode", mode=mid)
            modes_row2 = [
                ("cymatic", "cymatic"),
                ("orb", "orb"),
                ("bubble", "bubble"),
                ("crystal", "crystal"),
            ]
            for i, (lab, mid) in enumerate(modes_row2):
                if i:
                    imgui.same_line()
                if imgui.button(f"{lab}##m2", 72, 22):
                    st["mode"] = mid
                    pipe_emit("mode", mode=mid)
            if imgui.button("wave##m3", 72, 22):
                st["mode"] = "wave"
                pipe_emit("mode", mode="wave")
            imgui.same_line()
            if imgui.button("star##m3", 72, 22):
                st["mode"] = "star"
                pipe_emit("mode", mode="star")
            imgui.same_line()
            imgui.text(f"→ {st['mode']}")

            # sliders
            # zoom: higher = more FOV / space (was capped 0.92)
            chg, st["zoom"] = imgui.slider_float("zoom (space)", st["zoom"], 0.45, 1.0)
            chg, st["glass"] = imgui.slider_float("glass", st["glass"], 0.0, 2.5)
            chg, st["chroma"] = imgui.slider_float("chroma", st["chroma"], 0.0, 2.5)
            chg, st["bright"] = imgui.slider_float("brightness", st["bright"], -0.35, 0.45)
            chg, st["contrast"] = imgui.slider_float("contrast", st["contrast"], 0.5, 2.2)
            chg, st["mix_crystal"] = imgui.slider_float("mix crystal", st["mix_crystal"], 0.0, 1.0)
            chg, st["mix_rabbit"] = imgui.slider_float("mix rabbit", st["mix_rabbit"], 0.0, 1.0)
            chg, st["voice"] = imgui.slider_float("voice pulse", st["voice"], 0.0, 1.0)
            chg, st["anim"] = imgui.slider_float("rim anim", st["anim"], 0.0, 1.0)
            chg, st["overlay_amt"] = imgui.slider_float("video overlay", st["overlay_amt"], 0.0, 1.0)
            imgui.text_disabled("rim anim = glass pulse only (no floating beads)")

            # mirror + horizontal rotate side by side
            chg, st["mirror"] = imgui.checkbox("mirror", st["mirror"])
            imgui.same_line()
            chg, st["rot"] = imgui.slider_float("h-rot°", st["rot"], -180.0, 180.0)
            if imgui.button("-90##r", 40, 20):
                st["rot"] = (st["rot"] - 90.0) % 360.0
                if st["rot"] > 180:
                    st["rot"] -= 360
            imgui.same_line()
            if imgui.button("+90##r", 40, 20):
                st["rot"] = (st["rot"] + 90.0) % 360.0
                if st["rot"] > 180:
                    st["rot"] -= 360
            imgui.same_line()
            if imgui.button("0##r", 28, 20):
                st["rot"] = 0.0

            # LUT presets + multi mix
            imgui.separator()
            imgui.text("LUT  (mix = mono-ink·starfield·film-rose·deep-void)")
            lut_choices = ["mix"] + LUT_NAMES
            lut_idx = lut_choices.index(st["lut"]) if st["lut"] in lut_choices else 0
            chg, lut_idx = imgui.combo("##lut", lut_idx, lut_choices)
            if chg:
                st["lut"] = lut_choices[lut_idx]
                pipe_emit("lut", lut=st["lut"])
            if st["lut"] == "mix":
                for name in ("mono-ink", "starfield", "film-rose", "deep-void"):
                    w = float(st["lut_mix"].get(name, 0.0))
                    chg, w = imgui.slider_float(f"{name}##mw", w, 0.0, 1.0)
                    if chg:
                        st["lut_mix"][name] = w
                if imgui.button("reset mix stack"):
                    st["lut_mix"] = dict(LUT_MIX_DEFAULT)
                    pipe_emit("lut", lut="mix", weights=st["lut_mix"])
            else:
                for i, name in enumerate(LUT_NAMES[:5]):
                    if i:
                        imgui.same_line()
                    if imgui.small_button(f"{name[:8]}##l{i}"):
                        st["lut"] = name
                        pipe_emit("lut", lut=name)
            if imgui.button("apply session look"):
                st["zoom"] = 0.92
                st["glass"] = 1.665
                st["chroma"] = 1.766
                st["bright"] = -0.032
                st["contrast"] = 1.461
                st["mirror"] = True
                st["rot"] = -175.83
                st["lut"] = "mix"
                st["lut_mix"] = dict(LUT_MIX_DEFAULT)
                pipe_emit("session_look", **{k: st[k] for k in ("zoom", "glass", "chroma", "bright", "contrast", "rot", "lut")})
                st["status"] = "session look applied"

            # cymatic params when relevant
            if st["mode"] in ("cymatic", "wave"):
                chg, st["cym_freq"] = imgui.slider_float("cym freq", st["cym_freq"], 2.0, 16.0)
                chg, st["cym_amp"] = imgui.slider_float("cym amp", st["cym_amp"], 0.2, 1.5)

            # HOT PROMPT
            imgui.separator()
            imgui.text("HOT PROMPT (file)")
            chg, new_p = imgui.input_text_multiline("##prompt", st["prompt"], 8192, height=70)
            if chg:
                st["prompt"] = new_p
            if imgui.button("save prompt"):
                PROMPT_FILE.write_text(st["prompt"], encoding="utf-8")
                st["prompt_mtime"] = PROMPT_FILE.stat().st_mtime
                pipe_emit("prompt_save", chars=len(st["prompt"]))
                st["status"] = "prompt saved"
            imgui.same_line()
            if imgui.button("reload##p"):
                st["prompt"] = read_prompt_file()
                st["status"] = "prompt reloaded"

            # CHAT with terminal
            imgui.separator()
            imgui.text("CHAT → TERMINAL / AGENT")
            imgui.text_wrapped(f"out: {PIPE_JSONL.name}  in: {CHAT_IN.name}")
            chg, st["note"] = imgui.input_text_multiline("##chat", st["note"], 4096, height=90)
            if imgui.button("send chat → terminal"):
                note = (st["note"] or "").strip()
                if note:
                    pipe_emit(
                        "chat",
                        text=note,
                        mode=st["mode"],
                        lut=st["lut"],
                        zoom=st["zoom"],
                        glass=st["glass"],
                        chroma=st["chroma"],
                        rot=st["rot"],
                        prompt_head=(st["prompt"] or "")[:240],
                    )
                    st["chat_log"].append({"role": "you", "text": note})
                    try:
                        with NOTES_FILE.open("a", encoding="utf-8") as nf:
                            nf.write(
                                f"\n## {datetime.now().strftime('%H:%M:%S')} · {st['mode']} · {st['lut']}\n{note}\n"
                            )
                    except Exception:
                        pass
                    st["status"] = "chat sent to terminal"
                    st["note"] = ""
            imgui.same_line()
            if imgui.button("snapshot"):
                try:
                    ok2, fr = cap.read()
                    if ok2 and fr is not None:
                        fill2 = glass_fill(fr, size, st["zoom"], st["rot"], st["mirror"])
                        path = SNAP_DIR / "lens.jpg"
                        cv2.imwrite(str(path), fill2)
                        stamp = SNAP_DIR / f"optic-{st['mode']}-{int(time.time())}.jpg"
                        cv2.imwrite(str(stamp), fill2)
                        st["snap_path"] = str(stamp)
                        pipe_emit("snapshot", path=str(stamp), mode=st["mode"], lut=st["lut"])
                        st["status"] = f"snap {stamp.name}"
                except Exception as e:
                    st["status"] = f"snap fail: {e}"

            imgui.text(f"status: {st['status']}")

            # chat log
            imgui.separator()
            imgui.text("CHAT LOG")
            imgui.begin_child("chatlog", 0, 120, border=True)
            for msg in st["chat_log"][-12:]:
                role = msg.get("role", "?")
                prefix = {"you": "you", "agent": "agent", "sys": "sys"}.get(role, role)
                imgui.text_wrapped(f"[{prefix}] {msg.get('text','')[:200]}")
            imgui.end_child()

            imgui.separator()
            imgui.text("PIPE TAIL")
            imgui.begin_child("pipetail", 0, 80, border=True)
            for rec in reversed(pipe_tail(8)):
                k = rec.get("kind", "?")
                if k in ("chat", "note"):
                    imgui.text_wrapped(f"· {k}: {str(rec.get('text',''))[:70]}")
                elif k == "mode":
                    imgui.text(f"· mode→{rec.get('mode')}")
                elif k == "lut":
                    imgui.text(f"· lut→{rec.get('lut')}")
                else:
                    imgui.text(f"· {k}")
            imgui.end_child()

            imgui.text_disabled("1–0 modes · [ ] rot · h mirror · s snap")
            imgui.end()

            # overlay labels
            imgui.set_next_window_position(ox + 8, oy + 8)
            imgui.set_next_window_bg_alpha(0.0)
            imgui.begin(
                "labels",
                flags=imgui.WINDOW_NO_TITLE_BAR
                | imgui.WINDOW_NO_RESIZE
                | imgui.WINDOW_NO_MOVE
                | imgui.WINDOW_NO_SCROLLBAR
                | imgui.WINDOW_ALWAYS_AUTO_RESIZE
                | imgui.WINDOW_NO_BACKGROUND
                | imgui.WINDOW_NO_INPUTS,
            )
            if st["mode"] == "both":
                imgui.text("PLANET")
                imgui.same_line(spacing=max(40, cell - 50))
                imgui.text("RABBIT")
            else:
                imgui.text(st["mode"].upper())
            imgui.end()

            imgui.render()
            ctx.viewport = (0, 0, fb_w, fb_h)
            impl.render(imgui.get_draw_data())
            glfw.swap_buffers(window)
            glfw.poll_events()

            # keys
            if glfw.get_key(window, glfw.KEY_ESCAPE) == glfw.PRESS or glfw.get_key(
                window, glfw.KEY_Q
            ) == glfw.PRESS:
                break
            key_modes = {
                glfw.KEY_1: "planet",
                glfw.KEY_2: "rabbit",
                glfw.KEY_3: "both",
                glfw.KEY_4: "glass",
                glfw.KEY_5: "cymatic",
                glfw.KEY_6: "orb",
                glfw.KEY_7: "bubble",
                glfw.KEY_8: "crystal",
                glfw.KEY_9: "wave",
                glfw.KEY_0: "star",
            }
            for k, m in key_modes.items():
                if glfw.get_key(window, k) == glfw.PRESS:
                    if st["mode"] != m:
                        st["mode"] = m
                        pipe_emit("mode", mode=m)
            if glfw.get_key(window, glfw.KEY_LEFT_BRACKET) == glfw.PRESS:
                st["rot"] = max(-180.0, st["rot"] - 2.0)
            if glfw.get_key(window, glfw.KEY_RIGHT_BRACKET) == glfw.PRESS:
                st["rot"] = min(180.0, st["rot"] + 2.0)
            if glfw.get_key(window, glfw.KEY_H) == glfw.PRESS:
                # edge-trigger would be better; simple toggle debounce via frames
                if st["frames"] % 15 == 0:
                    st["mirror"] = not st["mirror"]

            if fps > 0:
                target = 1.0 / fps
                elapsed = time.time() - now
                if elapsed < target:
                    time.sleep(target - elapsed)

    finally:
        pipe_emit(
            "shutdown",
            frames=st["frames"],
            mode=st["mode"],
            cam=st.get("cam_idx"),
            cam_name=st.get("cam_label"),
        )
        try:
            cap.release()
        except Exception:
            pass
        try:
            if overlay_cap is not None:
                overlay_cap.release()
        except Exception:
            pass
        impl.shutdown()
        glfw.terminate()
    print(f"[optic] exit frames={st['frames']} pipe={PIPE_JSONL}", flush=True)
    return 0


def run_cpu(mode, device, cw, ch, size, zoom, fps, mirror, glass, chroma) -> int:
    """Minimal CPU path — no panel."""
    import cv2

    ensure_pipes()
    pipe_emit("boot", mode=mode, backend="cpu")
    print("[optic] CPU mode — use GPU for full panel/chat", flush=True)
    cap = open_capture(device, cw, ch, fps)
    if not cap:
        return 1
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        fill = glass_fill(frame, size, zoom, 0.0, mirror)
        cv2.imshow(f"optic-cpu-{mode}", fill)
        if cv2.waitKey(1) & 0xFF in (27, ord("q")):
            break
    cap.release()
    cv2.destroyAllWindows()
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", nargs="?", default="both")
    ap.add_argument("--cpu", action="store_true")
    ap.add_argument("--gpu", action="store_true")
    args = ap.parse_args()

    mode = args.mode.lower().strip()
    aliases = {
        "tinyplanet": "planet",
        "globe": "planet",
        "rabbithole": "rabbit",
        "invert": "rabbit",
        "ways": "both",
        "sbs": "both",
        "optic": "glass",
        "circle": "glass",
        "cymatics": "cymatic",
        "chladni": "cymatic",
        "sphere": "orb",
        "starfield": "star",
        "soap": "bubble",
        "facet": "crystal",
        "ripple": "wave",
    }
    mode = aliases.get(mode, mode)
    if mode not in MODE_LIST:
        mode = "both"

    device = int(os.environ.get("LIVE_DEMUX_CAM_DEVICE", "0"))
    capture = os.environ.get("LIVE_DEMUX_CAM_CAPTURE", "640x480")
    try:
        cw, ch = map(int, capture.lower().split("x"))
    except Exception:
        cw, ch = 640, 480
    size = max(360, min(int(os.environ.get("LIVE_DEMUX_LENS_PLANET_SIZE", "640")), 1400))
    zoom = float(os.environ.get("LIVE_DEMUX_LENS_OPTIC_ZOOM", "0.92"))
    fps = int(os.environ.get("LIVE_DEMUX_LENS_FPS", "24"))
    mirror = os.environ.get("LIVE_DEMUX_LENS_MIRROR", "1") not in ("0", "false", "no")
    glass = float(os.environ.get("LIVE_DEMUX_LENS_GLASS", "1.665"))
    chroma = float(os.environ.get("LIVE_DEMUX_LENS_CHROMA", "1.766"))
    env_shader = os.environ.get("LIVE_DEMUX_LENS_SHADER", "1") not in ("0", "false", "no")

    use_gpu = env_shader and not args.cpu
    if args.gpu:
        use_gpu = True
    if use_gpu:
        try:
            import moderngl  # noqa: F401
            import glfw  # noqa: F401
            import imgui  # noqa: F401
            from imgui.integrations.glfw import GlfwRenderer  # noqa: F401
        except ImportError as e:
            print(f"note: GPU deps missing ({e}) → CPU", flush=True)
            use_gpu = False

    try:
        import cv2  # noqa: F401
    except ImportError:
        print("error: need opencv", file=sys.stderr)
        return 1

    if use_gpu:
        return run_gpu(mode, device, cw, ch, size, zoom, fps, mirror, glass, chroma)
    return run_cpu(mode, device, cw, ch, size, zoom, fps, mirror, glass, chroma)


if __name__ == "__main__":
    raise SystemExit(main())
