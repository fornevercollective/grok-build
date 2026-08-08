/**
 * Memory Glass hotpipe · drone HUD bridge
 * Inject / postMessage into webgrid-drone-hud.html
 *
 * Pack: ~/.panda/packs/drone-hotpipe.jsonl  (append JSON lines)
 * Types:
 *   {type:'drone.track', unit:'U01', boxes:[{id,x,y,w,h,label,score}]}
 *   {type:'drone.slam', points:[{lat,lon}]}
 *   {type:'drone.gsplat', calib:{residual,gaussians,pipeHz,gsCalib}}
 *   {type:'drone.cmd', cmd:'rth'|'hold'|'land'|'arm'|'disarm'|'track', args:{}}
 *   {type:'drone.telem', unit:'U01', alt,spd,hdg,batt,rssi}
 */
(function () {
  "use strict";
  var VER = "drone-hotpipe-v1";
  var PACK = "/drone-hotpipe.jsonl";
  var lastSize = 0;

  function deliver(msg) {
    try {
      if (window.WebgridDroneHud && WebgridDroneHud.hotpipe) {
        WebgridDroneHud.hotpipe.ingest(msg);
      }
    } catch (e) {}
    try {
      window.postMessage({ source: "mg-drone-hotpipe", payload: msg }, "*");
    } catch (e2) {}
  }

  function pollPack() {
    // Best-effort local pack (companion may expose it)
    fetch(PACK + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (txt) {
        if (!txt || txt.length <= lastSize) return;
        var chunk = txt.slice(lastSize);
        lastSize = txt.length;
        chunk.split("\n").forEach(function (line) {
          line = line.trim();
          if (!line) return;
          try { deliver(JSON.parse(line)); } catch (e) {}
        });
      })
      .catch(function () {});
  }

  window.addEventListener("message", function (ev) {
    var d = ev.data;
    if (!d) return;
    if (d.source === "mg-drone-hotpipe" && d.payload) return; // echo
    if (d.type && String(d.type).indexOf("drone.") === 0) deliver(d);
    if (d.payload && d.payload.type && String(d.payload.type).indexOf("drone.") === 0) {
      deliver(d.payload);
    }
  });

  setInterval(pollPack, 800);
  console.info("[drone-hotpipe]", VER, "listening");
  window.__droneHotpipe = { version: VER, deliver: deliver, poll: pollPack };
})();
