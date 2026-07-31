#!/usr/bin/env python3
"""fc-optical-transfer-v1 — Decimen-compatible frame protocol + LT fountain.

Magic 0xD1 0x0C (same layout as bashalarmistalt/decimen-optical-transfer).
Every frame is self-describing: no handshake; new sessionId resets RX.

Layout (little-endian), 20 bytes + blockLen payload:
  0  u8   magic 0xD1
  1  u8   magic 0x0C
  2  u16  sessionId
  4  u32  seq
  8  u16  k
  10 u16  blockLen
  12 u32  totalLen
  16 u32  payloadFnv  (FNV-1a of whole file)
"""
from __future__ import annotations

import math
import struct
from typing import Iterable, List, Optional, Set

HEADER_LEN = 20
MAGIC0 = 0xD1
MAGIC1 = 0x0C
SOLITON_C = 0.1
SOLITON_DELTA = 0.5
LN2 = 0.6931471805599453


def dlog(x: float) -> float:
    """Deterministic ln via range reduction + atanh series (bit-stable)."""
    e = 0
    m = float(x)
    while m >= 1.5:
        m /= 2.0
        e += 1
    while m < 0.75:
        m *= 2.0
        e -= 1
    z = (m - 1.0) / (m + 1.0)
    z2 = z * z
    term = z
    s = 0.0
    for n in range(1, 22, 2):
        s += term / n
        term *= z2
    return e * LN2 + 2.0 * s


def fnv1a(data: bytes) -> int:
    h = 0x811C9DC5
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def splitmix32(seed: int):
    s = seed & 0xFFFFFFFF

    def rnd() -> int:
        nonlocal s
        s = (s + 0x9E3779B9) & 0xFFFFFFFF
        t = s ^ (s >> 16)
        t = (t * 0x21F0AAAD) & 0xFFFFFFFF
        t ^= t >> 15
        t = (t * 0x735A2D97) & 0xFFFFFFFF
        t ^= t >> 15
        return t & 0xFFFFFFFF

    return rnd


def soliton_cdf(k: int) -> List[float]:
    if k <= 1:
        return [1.0]
    R = max(1.0, SOLITON_C * dlog(k / SOLITON_DELTA) * math.sqrt(k))
    spike = min(k, int(math.ceil(k / R)))
    total = 0.0
    cdf: List[float] = []
    for d in range(1, k + 1):
        rho = 1.0 / k if d == 1 else 1.0 / (d * (d - 1))
        if d < spike:
            tau = R / (d * k)
        elif d == spike:
            tau = (R * max(0.0, dlog(R / SOLITON_DELTA))) / k
        else:
            tau = 0.0
        total += rho + tau
        cdf.append(total)
    cdf = [c / total for c in cdf]
    cdf[-1] = 1.0
    return cdf


def frame_seed(session_id: int, seq: int) -> int:
    h = (((session_id + 1) * 0x9E3779B1) ^ (seq + 0x85EBCA6B)) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 0xC2B2AE35) & 0xFFFFFFFF
    return (h ^ (h >> 16)) & 0xFFFFFFFF


def frame_indices(k: int, cdf: List[float], session_id: int, seq: int) -> List[int]:
    rnd = splitmix32(frame_seed(session_id, seq))
    u = rnd() / (2**32)
    lo, hi = 0, k - 1
    while lo < hi:
        mid = (lo + hi) >> 1
        if cdf[mid] >= u:
            hi = mid
        else:
            lo = mid + 1
    d = min(k, lo + 1)
    if d > (k >> 3):
        scratch = list(range(k))
        out: List[int] = []
        for i in range(d):
            j = i + (rnd() % (k - i))
            scratch[i], scratch[j] = scratch[j], scratch[i]
            out.append(scratch[i])
        return out
    s: Set[int] = set()
    while len(s) < d:
        s.add(rnd() % k)
    return list(s)


def pack_frame(
    session_id: int,
    seq: int,
    k: int,
    block_len: int,
    total_len: int,
    payload_fnv: int,
    block: bytes,
) -> bytes:
    hdr = struct.pack(
        "<BBHIHHII",
        MAGIC0,
        MAGIC1,
        session_id & 0xFFFF,
        seq & 0xFFFFFFFF,
        k & 0xFFFF,
        block_len & 0xFFFF,
        total_len & 0xFFFFFFFF,
        payload_fnv & 0xFFFFFFFF,
    )
    if len(block) < block_len:
        block = block + bytes(block_len - len(block))
    return hdr + block[:block_len]


def parse_frame(data: bytes) -> Optional[tuple[dict, bytes]]:
    if len(data) <= HEADER_LEN:
        return None
    if data[0] != MAGIC0 or data[1] != MAGIC1:
        return None
    magic0, magic1, session_id, seq, k, block_len, total_len, payload_fnv = struct.unpack(
        "<BBHIHHII", data[:HEADER_LEN]
    )
    del magic0, magic1
    if k == 0 or block_len == 0 or total_len == 0:
        return None
    if len(data) != HEADER_LEN + block_len:
        return None
    header = {
        "sessionId": session_id,
        "seq": seq,
        "k": k,
        "blockLen": block_len,
        "totalLen": total_len,
        "payloadFnv": payload_fnv,
    }
    return header, data[HEADER_LEN:]


class LTEncoder:
    def __init__(self, payload: bytes, block_len: int, session_id: int):
        self.payload = payload
        self.block_len = max(1, block_len)
        self.session_id = session_id & 0xFFFF
        self.k = max(1, (len(payload) + self.block_len - 1) // self.block_len)
        self.cdf = soliton_cdf(self.k)
        self.payload_fnv = fnv1a(payload)
        self.total_len = len(payload)
        # pad blocks
        self.blocks: List[bytes] = []
        for i in range(self.k):
            chunk = payload[i * self.block_len : (i + 1) * self.block_len]
            if len(chunk) < self.block_len:
                chunk = chunk + bytes(self.block_len - len(chunk))
            self.blocks.append(chunk)

    def encode(self, seq: int) -> bytes:
        idx = frame_indices(self.k, self.cdf, self.session_id, seq)
        out = bytearray(self.block_len)
        for b in idx:
            src = self.blocks[b]
            for i in range(self.block_len):
                out[i] ^= src[i]
        return bytes(out)

    def pack(self, seq: int) -> bytes:
        return pack_frame(
            self.session_id,
            seq,
            self.k,
            self.block_len,
            self.total_len,
            self.payload_fnv,
            self.encode(seq),
        )


class LTDecoder:
    def __init__(self, k: int, block_len: int, session_id: int, total_len: int):
        self.k = k
        self.block_len = block_len
        self.session_id = session_id
        self.total_len = total_len
        self.cdf = soliton_cdf(k)
        self.solved: List[Optional[bytearray]] = [None] * k
        self.solved_count = 0
        self.seen: Set[int] = set()
        self.frames_new = 0
        self.frames_dup = 0
        # pending: list of (set of block indices, words)
        self.pending: List[tuple[Set[int], bytearray]] = []

    @property
    def is_complete(self) -> bool:
        return self.solved_count >= self.k

    def add_frame(self, seq: int, block: bytes) -> None:
        if seq in self.seen:
            self.frames_dup += 1
            return
        self.seen.add(seq)
        self.frames_new += 1
        if self.is_complete:
            return
        idx = set(frame_indices(self.k, self.cdf, self.session_id, seq))
        words = bytearray(block[: self.block_len])
        if len(words) < self.block_len:
            words.extend(bytes(self.block_len - len(words)))
        # reduce by already-solved
        for b in list(idx):
            s = self.solved[b]
            if s is not None:
                for i in range(self.block_len):
                    words[i] ^= s[i]
                idx.discard(b)
        if not idx:
            return
        if len(idx) == 1:
            self._resolve(next(iter(idx)), words)
            return
        self.pending.append((idx, words))
        # Opportunistic: if peel stalled, try GF(2) residual solve (small k).
        if self.solved_count < self.k and len(self.pending) >= (self.k - self.solved_count):
            self._gaussian_finish()

    def _resolve(self, b0: int, w0: bytearray) -> None:
        queue: List[tuple[int, bytearray]] = [(b0, w0)]
        while queue:
            b, w = queue.pop()
            if self.solved[b] is not None:
                continue
            self.solved[b] = w
            self.solved_count += 1
            still: List[tuple[Set[int], bytearray]] = []
            for idx, words in self.pending:
                if b not in idx:
                    still.append((idx, words))
                    continue
                for i in range(self.block_len):
                    words[i] ^= w[i]
                idx.discard(b)
                if len(idx) == 1:
                    r = next(iter(idx))
                    if self.solved[r] is None:
                        queue.append((r, words))
                elif len(idx) > 1:
                    still.append((idx, words))
            self.pending = still

    def _gaussian_finish(self) -> None:
        """Finish residual system over GF(2) for unsolved blocks (byte-wise).

        Pure LT peel needs degree-1 seeds; optical channels often need a residual
        solve when the first dozens of frames are all degree ≥ 2.
        """
        unsolved = [i for i in range(self.k) if self.solved[i] is None]
        if not unsolved or not self.pending:
            return
        u_index = {b: j for j, b in enumerate(unsolved)}
        m = len(unsolved)
        # Build bit equations per byte position independently is expensive;
        # instead treat each byte lane with same support matrix, solve supports
        # that form a full-rank system using first m independent rows.
        rows: List[tuple[List[int], bytearray]] = []
        for idx, words in self.pending:
            if not idx.issubset(set(unsolved)):
                continue
            mask = [0] * m
            for b in idx:
                mask[u_index[b]] = 1
            rows.append((mask, bytearray(words)))
        if len(rows) < m:
            return
        # Gaussian elimination on m columns (bit presence), XOR payloads together.
        A = [mask[:] + list(words) for mask, words in rows[: m * 3]]
        n_cols = m
        row = 0
        pivots = [-1] * m
        for col in range(n_cols):
            piv = None
            for r in range(row, len(A)):
                if A[r][col]:
                    piv = r
                    break
            if piv is None:
                continue
            A[row], A[piv] = A[piv], A[row]
            pivots[col] = row
            for r in range(len(A)):
                if r != row and A[r][col]:
                    for c in range(n_cols):
                        A[r][c] ^= A[row][c]
                    # payload part
                    for c in range(n_cols, n_cols + self.block_len):
                        A[r][c] ^= A[row][c]
            row += 1
            if row >= len(A):
                break
        # Extract unit rows
        for col, piv in enumerate(pivots):
            if piv is None or piv < 0:
                continue
            # ensure singleton support
            if sum(A[piv][c] for c in range(n_cols)) != 1 or not A[piv][col]:
                continue
            b = unsolved[col]
            if self.solved[b] is not None:
                continue
            w = bytearray(A[piv][n_cols : n_cols + self.block_len])
            self._resolve(b, w)
            if self.is_complete:
                return

    def assemble(self) -> Optional[bytes]:
        if not self.is_complete:
            return None
        out = bytearray()
        for b in range(self.k):
            out.extend(self.solved[b] or bytes(self.block_len))
        return bytes(out[: self.total_len])


# ── Jawta light / optical OOK (morse + binary) ──────────────────────────

MORSE_TABLE = {
    "a": ".-",
    "b": "-...",
    "c": "-.-.",
    "d": "-..",
    "e": ".",
    "f": "..-.",
    "g": "--.",
    "h": "....",
    "i": "..",
    "j": ".---",
    "k": "-.-",
    "l": ".-..",
    "m": "--",
    "n": "-.",
    "o": "---",
    "p": ".--.",
    "q": "--.-",
    "r": ".-.",
    "s": "...",
    "t": "-",
    "u": "..-",
    "v": "...-",
    "w": ".--",
    "x": "-..-",
    "y": "-.--",
    "z": "--..",
    "0": "-----",
    "1": ".----",
    "2": "..---",
    "3": "...--",
    "4": "....-",
    "5": ".....",
    "6": "-....",
    "7": "--...",
    "8": "---..",
    "9": "----.",
    " ": " ",
    "?": "..--..",
    "/": "-..-.",
    ".": ".-.-.-",
    ",": "--..--",
    "=": "-...-",
    "+": ".-.-.",
    "-": "-....-",
    "@": ".--.-.",
}

REVERSE_MORSE = {v: k for k, v in MORSE_TABLE.items() if v != " "}

PULSE_LIBRARY = {
    "sos": "SOS",
    "cq": "CQ CQ CQ DE FC K",
    "qth": "QTH",
    "qsl": "QSL",
    "73": "73",
    "88": "88",
    "qrz": "QRZ?",
    "rst": "RST 599",
    "beacon": "VVV DE FC",
    "sync": "SYNC",
    "ack": "R",
    "nack": "QRT",
    "ping": "V",
    "heartbeat": "H",
}


def text_to_morse(text: str) -> str:
    return " ".join(MORSE_TABLE.get(c, "") for c in text.lower() if c in MORSE_TABLE).strip()


def morse_to_text(morse: str) -> str:
    words = morse.strip().split("   ")
    out = []
    for w in words:
        out.append("".join(REVERSE_MORSE.get(c, "") for c in w.split()))
    return " ".join(out)


def dit_ms(wpm: float = 15.0) -> float:
    return 1200.0 / max(1.0, wpm)


def morse_timeline(morse: str, wpm: float = 15.0) -> List[tuple[float, float, int]]:
    """Return list of (start_ms, duration_ms, on) events for jawta light TX."""
    dit = dit_ms(wpm)
    t = 0.0
    events: List[tuple[float, float, int]] = []
    for el in morse:
        if el == ".":
            events.append((t, dit, 1))
            t += dit + dit
        elif el == "-":
            events.append((t, dit * 3, 1))
            t += dit * 3 + dit
        elif el == " ":
            t += dit * 3
    return events


def bytes_to_ook_bits(data: bytes) -> List[int]:
    """MSB-first bit stream for binary optical OOK (preamble + payload)."""
    bits = [1, 0, 1, 0, 1, 1, 0, 0]  # preamble 0xAC
    for b in data:
        for i in range(7, -1, -1):
            bits.append((b >> i) & 1)
    return bits
