#!/usr/bin/env bash
# R1 · append / rotate ~/.panda/research/queue.jsonl for unattended Mini
# launchd: StartInterval 300 → this script
set -euo pipefail
QDIR="${HOME}/.panda/research"
QFILE="${QDIR}/queue.jsonl"
mkdir -p "$QDIR"
# ensure seed file exists
SEED_REPO="$(cd "$(dirname "$0")/.." && pwd)/hotpipe/research-packs/cv-2026-seed.json"
if [[ -f "$SEED_REPO" && ! -f "${QDIR}/cv-2026-seed.json" ]]; then
  cp "$SEED_REPO" "${QDIR}/cv-2026-seed.json"
fi
# health stamp
echo "{\"t\":$(date +%s000),\"event\":\"tick\",\"host\":\"$(hostname)\",\"q_bytes\":$(wc -c <"$QFILE" 2>/dev/null || echo 0)}" >> "${QDIR}/ticks.jsonl"
# keep ticks small
if [[ -f "${QDIR}/ticks.jsonl" ]] && [[ $(wc -l <"${QDIR}/ticks.jsonl") -gt 500 ]]; then
  tail -n 200 "${QDIR}/ticks.jsonl" > "${QDIR}/ticks.jsonl.tmp"
  mv "${QDIR}/ticks.jsonl.tmp" "${QDIR}/ticks.jsonl"
fi
exit 0
