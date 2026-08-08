/* fc-timesync stamp for /drone payloads · tools.ugrad.ai/clock compatible */
(function (global) {
  "use strict";
  var VER = "drone-clock-v1";
  var last = null;
  var listeners = [];

  function zulu(d) {
    d = d || new Date();
    return d.toISOString().replace(/\.\d{3}Z$/, "Z");
  }
  function missionStrip(d) {
    d = d || new Date();
    var mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
    var day = String(d.getUTCDate()).padStart(2, "0");
    var hhmm = String(d.getUTCHours()).padStart(2, "0") + String(d.getUTCMinutes()).padStart(2, "0");
    return "MISSION · " + mon + " " + day + " · " + hhmm;
  }
  function snapshot(extra) {
    var d = new Date();
    var s = {
      t_zulu: zulu(d),
      t_unix: Math.floor(d.getTime() / 1000),
      ntp_class: last && last.ntp_class ? last.ntp_class : "https-date",
      markets: last && last.markets ? last.markets : "—",
      source: last && last.source ? last.source : "fc-timesync-v1",
      mission: missionStrip(d),
      clock_ver: VER
    };
    if (extra) for (var k in extra) s[k] = extra[k];
    return s;
  }
  function emit() {
    var s = snapshot();
    listeners.forEach(function (fn) { try { fn(s); } catch (e) {} });
    return s;
  }
  function onTick(fn) { listeners.push(fn); return function () {
    listeners = listeners.filter(function (x) { return x !== fn; });
  }; }

  /** Prefer ~/.panda pack via relative fetch when served locally; else tools.ugrad.ai */
  function refresh() {
    var tries = [
      "http://127.0.0.1:8790/../packs/timesync-last.json",
      "https://tools.ugrad.ai/tools/clock"
    ];
    // Local Date is always available; try network stamp class
    last = {
      ntp_class: "https-date",
      source: "fc-timesync-v1 · browser Date",
      markets: "RTH approx"
    };
    // Head request style clock from tools page is HTML — mark honesty
    try {
      fetch("https://tools.ugrad.ai/tools/clock", { mode: "no-cors", cache: "no-store" })
        .then(function () {
          last.ntp_class = "https-date · tools.ugrad.ai reachable";
          last.source = "fc-timesync-v1 · tools.ugrad.ai/clock";
          emit();
        })
        .catch(function () { emit(); });
    } catch (e) { emit(); }
    // Optional local jsonl last line via companion path
    try {
      fetch("/timesync-last.json", { cache: "no-store" }).then(function (r) {
        if (!r.ok) return;
        return r.json();
      }).then(function (j) {
        if (!j) return;
        last = Object.assign({}, last, j, { source: j.source || "timesync.jsonl" });
        emit();
      }).catch(function () {});
    } catch (e2) {}
    return emit();
  }

  setInterval(emit, 1000);
  global.DroneClock = {
    version: VER,
    zulu: zulu,
    missionStrip: missionStrip,
    snapshot: snapshot,
    onTick: onTick,
    refresh: refresh,
    get last() { return last; }
  };
})(typeof window !== "undefined" ? window : globalThis);
