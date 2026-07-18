#!/usr/bin/env python3
"""Memory Glass · offline Ollama helper (no cloud).

Env:
  MG_LOCAL_LLM=1          enable (callers check this)
  MG_OLLAMA_HOST          default http://127.0.0.1:11434
  MG_OLLAMA_MODEL         default qwen3:8b (brief / reason)
  MG_OLLAMA_REASON_MODEL  default deepseek-r1:7b (postmortem)
  MG_OLLAMA_PACE_MODEL    default llama3.2:1b (live pacing)
  MG_OLLAMA_EMBED_MODEL   default nomic-embed-text
  MG_OLLAMA_TIMEOUT       seconds, default 120
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

HOST = os.environ.get("MG_OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
# First load of 5–8B models on Mac can exceed 2 min
TIMEOUT = float(os.environ.get("MG_OLLAMA_TIMEOUT", "300"))


def enabled() -> bool:
    v = os.environ.get("MG_LOCAL_LLM", "").strip().lower()
    return v in ("1", "true", "yes", "on")


def model(kind: str = "brief") -> str:
    if kind == "reason":
        return os.environ.get("MG_OLLAMA_REASON_MODEL", "deepseek-r1:7b")
    if kind == "pace":
        return os.environ.get("MG_OLLAMA_PACE_MODEL", "llama3.2:1b")
    if kind == "code":
        return os.environ.get("MG_OLLAMA_CODE_MODEL", "codestral:latest")
    if kind == "embed":
        return os.environ.get("MG_OLLAMA_EMBED_MODEL", "nomic-embed-text")
    return os.environ.get("MG_OLLAMA_MODEL", "qwen3:8b")


def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{HOST}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read().decode("utf-8", "replace")
    return json.loads(raw) if raw else {}


def alive() -> bool:
    try:
        req = urllib.request.Request(f"{HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def list_models() -> list[str]:
    try:
        req = urllib.request.Request(f"{HOST}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            d = json.loads(resp.read().decode())
        return [m.get("name", "") for m in d.get("models", []) if m.get("name")]
    except Exception:
        return []


def chat(
    prompt: str,
    *,
    system: str | None = None,
    model_name: str | None = None,
    temperature: float = 0.2,
    kind: str = "brief",
) -> str:
    """Non-streaming chat. Returns assistant text or raises."""
    m = model_name or model(kind)
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    try:
        out = _post(
            "/api/chat",
            {
                "model": m,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature},
            },
        )
        msg = out.get("message") or {}
        text = (msg.get("content") or "").strip()
        if text:
            return text
    except urllib.error.HTTPError:
        pass
    # fallback generate API
    full = (system + "\n\n" if system else "") + prompt
    out = _post(
        "/api/generate",
        {
            "model": m,
            "prompt": full,
            "stream": False,
            "options": {"temperature": temperature},
        },
    )
    return (out.get("response") or "").strip()


def embed(text: str, *, model_name: str | None = None) -> list[float]:
    m = model_name or model("embed")
    out = _post("/api/embeddings", {"model": m, "prompt": text})
    return list(out.get("embedding") or [])


if __name__ == "__main__":
    import sys

    print("host", HOST)
    print("alive", alive())
    print("models", list_models()[:12])
    print("enabled", enabled())
    if len(sys.argv) > 1 and sys.argv[1] == "ping":
        if not alive():
            sys.exit(2)
        try:
            print(chat("Reply with exactly: pong", model_name=model("pace"), kind="pace"))
        except Exception as e:
            print("chat_err", e)
            sys.exit(3)
