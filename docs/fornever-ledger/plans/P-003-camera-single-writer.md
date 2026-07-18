# P-003 · Camera single-writer guard

## Why
Multiple `capture-stream` / snap-loop → LED thrash, auth flaps, SPOOL_STALL (MG-004, PD-001).

## α
- Inventory all writers (still-server, capture-stream, capture-gentle, MG getUserMedia)
- Single continuous writer rule

## β
- `mg-stop-cams.sh` on MG webgrid launch path (document + optional auto)
- PID lock file `~/.panda/vision/capture.lock`
- Webgrid keeps camera defer

## γ
- Launch MG webgrid + still-pipe only; no second capture-stream
- Inspect meters show stable spool

## Success
One writer; lock held; ledger PD-001 mitigated.
