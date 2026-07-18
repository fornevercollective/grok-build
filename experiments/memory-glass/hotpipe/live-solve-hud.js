/* Memory Glass · always-on solve metrics (Bloch + playthrough + beats)
 * Compact glass strip — continuous learning readout, not a full site.
 * VER: live-solve-hud-v1
 */
(function () {
  "use strict";
  var VER = "live-solve-hud-v2-playperf";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._liveSolveHudVer === VER) return;
  HP._liveSolveHudVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var el = null;

  function ensure() {
    if (el) return;
    if (!document.getElementById("mg-solve-hud-css")) {
      var st = document.createElement("style");
      st.id = "mg-solve-hud-css";
      st.textContent = [
        "#mg-solve-hud{position:fixed;top:10px;left:50%;transform:translateX(-50%);",
        "  z-index:2147482990;max-width:min(720px,92vw);",
        "  padding:5px 12px;border-radius:999px;",
        "  background:rgba(10,12,16,0.42);backdrop-filter:blur(18px) saturate(1.3);",
        "  -webkit-backdrop-filter:blur(18px) saturate(1.3);",
        "  border:1px solid rgba(255,255,255,0.14);",
        "  box-shadow:0 4px 16px rgba(0,0,0,0.12);",
        "  font:600 9px/1.2 ui-monospace,Menlo,monospace;color:rgba(230,240,250,0.92);",
        "  letter-spacing:0.03em;pointer-events:none;white-space:nowrap;overflow:hidden;",
        "  text-overflow:ellipsis}",
        "#mg-solve-hud b{color:rgba(160,220,255,0.95);font-weight:700}",
        "#mg-solve-hud .sep{opacity:0.35;margin:0 6px}",
      ].join("");
      (document.head || document.documentElement).appendChild(st);
    }
    el = document.createElement("div");
    el.id = "mg-solve-hud";
    el.textContent = "SOLVE · warming…";
    (document.body || document.documentElement).appendChild(el);
  }

  function tick() {
    /* Stay live during play — just run slightly less often when busy */
    ensure();
    var parts = ["SOLVE"];
    try {
      if (window.__mgBlochSolve) {
        parts.push("<b>BLOCH</b> " + (window.__mgBlochSolve.report() || "").replace(/^[^ ]+ /, ""));
      } else if (window.__mgQuantum && window.__mgQuantum.report) {
        parts.push("<b>Q</b> " + window.__mgQuantum.report());
      }
    } catch (e) {}
    try {
      if (window.__mgContrail && window.__mgContrail.report) {
        var cr = window.__mgContrail.report();
        parts.push("<b>PATH</b> " + cr.replace(/^[^ ]+ /, "").slice(0, 48));
      }
    } catch (e2) {}
    try {
      if (window.__mgKeyboardBeats) {
        parts.push(
          "<b>BEAT</b> " +
            window.__mgKeyboardBeats.bpm() +
            " · " +
            window.__mgKeyboardBeats.hits() +
            "/" +
            window.__mgKeyboardBeats.attempts()
        );
      }
    } catch (e3) {}
    try {
      if (window.__mgMemoryMaze) {
        parts.push("<b>MAZE</b> " + (window.__mgMemoryMaze.points().length || 0));
      }
    } catch (e4) {}
    try {
      if (window.__mgRubikLang) {
        parts.push("<b>RUBIK</b> " + (window.__mgRubikLang.face() || "—"));
      }
    } catch (e4b) {}
    try {
      if (window.__mgActivityBoard) {
        var br = window.__mgActivityBoard.report() || "";
        var top = /top=([^\s]+)/.exec(br);
        parts.push("<b>BOARD</b> " + (top ? top[1] : "—"));
      }
    } catch (e4c) {}
    try {
      if (window.__mgCollabDay && window.__mgCollabDay.day && window.__mgCollabDay.day()) {
        parts.push("<b>DAY</b> on");
      } else if (window.__mgMesh) {
        parts.push("<b>MESH</b> " + (window.__mgMesh.peerCount ? window.__mgMesh.peerCount() : 0));
      }
    } catch (e4d) {}
    try {
      var dj = window.__mgContrail && window.__mgContrail.lastDojo && window.__mgContrail.lastDojo();
      if (dj && dj.strain != null) parts.push("<b>S</b> " + Math.round(dj.strain));
    } catch (e5) {}
    el.innerHTML = parts.join('<span class="sep">·</span>');
  }

  setInterval(tick, 500);
  setTimeout(tick, 200);
  window.__mgLiveSolveHud = { ver: VER, tick: tick };
})();
