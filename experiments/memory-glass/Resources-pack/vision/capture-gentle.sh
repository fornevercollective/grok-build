#!/bin/bash
VISION="$HOME/.panda/vision"
while true; do
  MAIN=$(swift -e 'import Cocoa
let opts = CGWindowListOption(arrayLiteral: .optionOnScreenOnly, .excludeDesktopElements)
var best=0; var bestA=0.0
if let info = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] {
  for w in info {
    guard let owner = w[kCGWindowOwnerName as String] as? String, owner == "Memory Glass" else { continue }
    let id = w[kCGWindowNumber as String] as? Int ?? 0
    let b = w[kCGWindowBounds as String] as? [String: Any]
    let a = ((b?["Width"] as? NSNumber)?.doubleValue ?? 0) * ((b?["Height"] as? NSNumber)?.doubleValue ?? 0)
    if a > bestA { bestA=a; best=id }
  }
}
print(best)' 2>/dev/null)
  if [ -n "$MAIN" ] && [ "$MAIN" != "0" ]; then
    /usr/sbin/screencapture -x -t jpg -l "$MAIN" "$VISION/mg-main.jpg" 2>/dev/null
    [ -f "$VISION/mg-main.jpg" ] && cp -f "$VISION/mg-main.jpg" "$VISION/glass.jpg"
  fi
  sleep 1.8
done
