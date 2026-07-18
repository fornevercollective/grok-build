# P-004 · Glass second-monitor / Spaces FS

## Why
Vertical second screen + fullscreen can drop glass / black content (MG-014); reassert storms were S1 (MG-002 mitigated).

## α
- Reproduce matrix: main vs secondary, Spaces FS vs simple FS, scale factors
- Document expected reassert debounce behavior

## β
- Harden reassert on ScaleFactorChanged / monitor move only
- Optional: simple fullscreen path if Spaces FS stays black
- Soak script phase: move window + toggle FS every N minutes

## γ
- Manual 10 min matrix + soak tick log without crash
- codesign still valid

## Success
No AppKit crash; glass visible or explicit fallback documented.
