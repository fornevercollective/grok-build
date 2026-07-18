/* Memory Glass · geo pattern flow + data scavenger hunt
 * USGS earthquake paths as contrail/Pattern Flow style trails.
 * Portland Maps–style property/stats cards for scavenger data hunts.
 * Educational lab only — public data feeds; no scraping paywalls.
 * VER: geo-pattern-v2-offline
 */
(function () {
  "use strict";
  var VER = "geo-pattern-v2-offline";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._geoPatternVer === VER) return;
  HP._geoPatternVer = VER;
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "geo");
    } catch (e) {}
  }

  /* USGS free GeoJSON feeds */
  var FEEDS = {
    day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
    significant:
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
  };
  var MAP_USGS =
    "https://earthquake.usgs.gov/earthquakes/map/?extent=-8.4941,-140.36133&extent=67.23806,-49.57031";
  var PORTLAND_MAPS = "https://www.portlandmaps.com/";
  /* Public demo property (user screenshot lineage) */
  var PDX_SAMPLE =
    "https://www.portlandmaps.com/detail/property/7000-WI-NE-AIRPORT-WAY/R316936_did/";

  var panel = null;
  var open = false;
  var cv = null;
  var quakes = []; /* {lon,lat,mag,depth,t,place,id} */
  var mode = "pattern"; /* pattern | map | stats */
  var feedId = "day";
  var loading = false;
  var lastErr = "";
  var hunt = null; /* scavenger target */
  var stats = {
    n: 0,
    maxMag: 0,
    meanMag: 0,
    meanDepth: 0,
    spanHrs: 0,
  };

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      try {
        window.open(url, "_blank");
      } catch (e2) {}
    }
  }

  function ensureCss() {
    if (document.getElementById("mg-geo-css")) return;
    var st = document.createElement("style");
    st.id = "mg-geo-css";
    st.textContent = [
      "#mg-geo-float{position:fixed;left:50%;top:56px;transform:translateX(-50%);",
      "  z-index:2147482994;width:min(420px,92vw);border-radius:12px;overflow:hidden;",
      "  background:rgba(10,12,16,0.55);backdrop-filter:blur(22px) saturate(1.35);",
      "  -webkit-backdrop-filter:blur(22px) saturate(1.35);",
      "  border:1px solid rgba(255,255,255,0.16);",
      "  box-shadow:0 8px 28px rgba(0,0,0,0.22),inset 0 1px 0 rgba(255,255,255,0.1);",
      "  font:650 9px/1.25 system-ui;color:rgba(244,246,250,0.94);pointer-events:auto}",
      "#mg-geo-float.hidden{display:none}",
      "#mg-geo-float .hd{display:flex;justify-content:space-between;align-items:center;",
      "  padding:6px 10px;letter-spacing:0.1em;text-transform:uppercase;",
      "  border-bottom:1px solid rgba(255,255,255,0.1);color:rgba(160,210,255,0.95)}",
      "#mg-geo-float .hd button{appearance:none;background:0;border:0;color:inherit;cursor:pointer;",
      "  font:700 11px/1 system-ui;margin-left:4px}",
      "#mg-geo-float .tabs{display:flex;gap:4px;padding:6px 8px;flex-wrap:wrap;",
      "  border-bottom:1px solid rgba(255,255,255,0.08)}",
      "#mg-geo-float .tabs button{appearance:none;cursor:pointer;padding:4px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;color:rgba(230,240,250,0.9);",
      "  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12)}",
      "#mg-geo-float .tabs button.on{background:rgba(80,160,255,0.22);border-color:rgba(140,200,255,0.45);",
      "  color:rgba(180,220,255,0.98)}",
      "#mg-geo-float canvas{width:100%;height:140px;display:block;background:rgba(4,8,14,0.9)}",
      "#mg-geo-float .stats{display:grid;grid-template-columns:1fr 1fr;gap:0;",
      "  border-top:1px solid rgba(255,255,255,0.08);font:500 9px/1.3 ui-monospace,Menlo,monospace}",
      "#mg-geo-float .stats .row{display:contents}",
      "#mg-geo-float .stats .k{padding:5px 8px;color:rgba(160,190,210,0.8);",
      "  border-bottom:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.15)}",
      "#mg-geo-float .stats .v{padding:5px 8px;color:rgba(200,230,255,0.95);",
      "  border-bottom:1px solid rgba(255,255,255,0.05)}",
      "#mg-geo-float .hunt{padding:6px 8px;font:500 8px/1.35 system-ui;color:rgba(180,220,180,0.9);",
      "  border-top:1px solid rgba(255,255,255,0.08);background:rgba(20,40,20,0.25)}",
      "#mg-geo-float .ft{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px;",
      "  border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-geo-float .ft button{appearance:none;cursor:pointer;padding:5px 8px;border-radius:999px;",
      "  font:700 8px/1 system-ui;color:rgba(240,245,255,0.95);",
      "  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14)}",
      "#mg-geo-float .ft button.hot{background:rgba(255,140,60,0.22);border-color:rgba(255,180,100,0.45)}",
      "#mg-geo-float .ft button.ok{background:rgba(60,180,120,0.2);border-color:rgba(100,220,160,0.4)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function ensurePanel() {
    if (panel) return;
    ensureCss();
    panel = document.createElement("div");
    panel.id = "mg-geo-float";
    panel.className = open ? "" : "hidden";
    panel.innerHTML =
      '<div class="hd"><span>Geo · pattern flow · hunt</span>' +
      '<span><button type="button" id="mg-geo-ref" title="refresh">↻</button>' +
      '<button type="button" id="mg-geo-x">×</button></span></div>' +
      '<div class="tabs">' +
      '<button type="button" data-m="pattern" class="on">Pattern Flow</button>' +
      '<button type="button" data-m="map">Map trail</button>' +
      '<button type="button" data-m="stats">Data card</button>' +
      "</div>" +
      '<canvas id="mg-geo-cv"></canvas>' +
      '<div class="stats" id="mg-geo-stats"></div>' +
      '<div class="hunt" id="mg-geo-hunt">Scavenger: refresh or HUNT for a target clue.</div>' +
      '<div class="ft">' +
      '<button type="button" class="hot" id="mg-geo-hunt-btn">HUNT</button>' +
      '<button type="button" class="ok" id="mg-geo-claim-btn">CLAIM ✓</button>' +
      '<button type="button" id="mg-geo-usgs">USGS MAP</button>' +
      '<button type="button" id="mg-geo-pdx">PDX MAPS</button>' +
      '<button type="button" class="ok" id="mg-geo-pdx-sample">AIRPORT WAY</button>' +
      '<button type="button" id="mg-geo-feed-d">day</button>' +
      '<button type="button" id="mg-geo-feed-w">week</button>' +
      '<button type="button" id="mg-geo-maze">→ MAZE</button>' +
      "</div>";
    (document.body || document.documentElement).appendChild(panel);
    cv = panel.querySelector("#mg-geo-cv");
    panel.querySelector("#mg-geo-x").onclick = close;
    panel.querySelector("#mg-geo-ref").onclick = function () {
      loadQuakes(true);
    };
    panel.querySelectorAll(".tabs button").forEach(function (b) {
      b.onclick = function () {
        mode = b.getAttribute("data-m") || "pattern";
        panel.querySelectorAll(".tabs button").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
        draw();
      };
    });
    panel.querySelector("#mg-geo-hunt-btn").onclick = pickHunt;
    panel.querySelector("#mg-geo-claim-btn").onclick = function () {
      claimHunt();
    };
    panel.querySelector("#mg-geo-usgs").onclick = function () {
      nav(MAP_USGS);
    };
    panel.querySelector("#mg-geo-pdx").onclick = function () {
      nav(PORTLAND_MAPS);
    };
    panel.querySelector("#mg-geo-pdx-sample").onclick = function () {
      nav(PDX_SAMPLE);
      setHuntCard({
        kind: "property",
        title: "7000 WI/NE AIRPORT WAY",
        clue: "Portland · INDUSTRIAL · 1942 · Port of Portland · elev ~14 ft · IG2 zoning",
        url: PDX_SAMPLE,
      });
    };
    panel.querySelector("#mg-geo-feed-d").onclick = function () {
      feedId = "day";
      loadQuakes(true);
    };
    panel.querySelector("#mg-geo-feed-w").onclick = function () {
      feedId = "week";
      loadQuakes(true);
    };
    panel.querySelector("#mg-geo-maze").onclick = function () {
      pushToMaze();
      if (window.__mgMemoryMaze) window.__mgMemoryMaze.open();
    };
  }

  function magColor(mag, a) {
    a = a == null ? 0.85 : a;
    if (mag >= 6) return "rgba(248,81,73," + a + ")";
    if (mag >= 4.5) return "rgba(255,180,60," + a + ")";
    if (mag >= 3) return "rgba(160,200,255," + a + ")";
    return "rgba(100,220,160," + a + ")";
  }

  function projectLonLat(lon, lat, W, H, bounds) {
    var x = ((lon - bounds.minLon) / Math.max(1e-6, bounds.maxLon - bounds.minLon)) * (W - 16) + 8;
    var y =
      ((bounds.maxLat - lat) / Math.max(1e-6, bounds.maxLat - bounds.minLat)) * (H - 20) + 12;
    return { x: x, y: y };
  }

  function boundsOf(arr) {
    var minLon = 180,
      maxLon = -180,
      minLat = 90,
      maxLat = -90;
    arr.forEach(function (q) {
      if (q.lon < minLon) minLon = q.lon;
      if (q.lon > maxLon) maxLon = q.lon;
      if (q.lat < minLat) minLat = q.lat;
      if (q.lat > maxLat) maxLat = q.lat;
    });
    if (minLon === maxLon) {
      minLon -= 5;
      maxLon += 5;
    }
    if (minLat === maxLat) {
      minLat -= 5;
      maxLat += 5;
    }
    /* pad */
    var pl = (maxLon - minLon) * 0.08;
    var pt = (maxLat - minLat) * 0.08;
    return {
      minLon: minLon - pl,
      maxLon: maxLon + pl,
      minLat: minLat - pt,
      maxLat: maxLat + pt,
    };
  }

  function paintPattern(ctx, W, H) {
    /* KBatch Pattern Flow spirit: magnitude vs time, color by mag */
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("PATTERN FLOW · mag×t · USGS " + feedId, 6, 12);
    if (quakes.length < 2) {
      ctx.fillStyle = "rgba(180,200,210,0.7)";
      ctx.fillText(loading ? "loading…" : lastErr || "no quakes", 6, H / 2);
      return;
    }
    var sorted = quakes.slice().sort(function (a, b) {
      return a.t - b.t;
    });
    var t0 = sorted[0].t;
    var t1 = sorted[sorted.length - 1].t || t0 + 1;
    var maxM = 1;
    sorted.forEach(function (q) {
      if (q.mag > maxM) maxM = q.mag;
    });
    ctx.beginPath();
    sorted.forEach(function (q, i) {
      var x = 8 + ((q.t - t0) / Math.max(1, t1 - t0)) * (W - 16);
      var y = H - 12 - (q.mag / maxM) * (H - 28);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(140,180,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    sorted.forEach(function (q) {
      var x = 8 + ((q.t - t0) / Math.max(1, t1 - t0)) * (W - 16);
      var y = H - 12 - (q.mag / maxM) * (H - 28);
      ctx.fillStyle = magColor(q.mag, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 2 + Math.min(4, q.mag * 0.6), 0, Math.PI * 2);
      ctx.fill();
    });
    /* contrail-style phrase of dirs between successive epicenters */
    var dirs = [];
    for (var i = 1; i < Math.min(sorted.length, 40); i++) {
      var dlon = sorted[i].lon - sorted[i - 1].lon;
      var dlat = sorted[i].lat - sorted[i - 1].lat;
      var ang = (Math.atan2(dlat, dlon) * 180) / Math.PI;
      var lab = "E";
      if (ang > -22.5 && ang <= 22.5) lab = "E";
      else if (ang > 22.5 && ang <= 67.5) lab = "NE";
      else if (ang > 67.5 && ang <= 112.5) lab = "N";
      else if (ang > 112.5 && ang <= 157.5) lab = "NW";
      else if (ang > 157.5 || ang <= -157.5) lab = "W";
      else if (ang > -157.5 && ang <= -112.5) lab = "SW";
      else if (ang > -112.5 && ang <= -67.5) lab = "S";
      else lab = "SE";
      dirs.push(lab);
    }
    var phrase = dirs.slice(0, 24).join(" ");
    ctx.fillStyle = "rgba(180,210,230,0.75)";
    ctx.font = "500 8px ui-monospace,Menlo,monospace";
    ctx.fillText(phrase.slice(0, 52) || "—", 6, H - 4);
  }

  function paintMap(ctx, W, H) {
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("MAP TRAIL · epicenter path", 6, 12);
    if (!quakes.length) {
      ctx.fillText(loading ? "loading…" : "no data", 6, H / 2);
      return;
    }
    var b = boundsOf(quakes);
    /* faint grid */
    ctx.strokeStyle = "rgba(80,120,160,0.15)";
    ctx.lineWidth = 1;
    for (var g = 0; g < 5; g++) {
      var gx = 8 + (g / 4) * (W - 16);
      ctx.beginPath();
      ctx.moveTo(gx, 14);
      ctx.lineTo(gx, H - 6);
      ctx.stroke();
    }
    var sorted = quakes.slice().sort(function (a, b2) {
      return a.t - b2.t;
    });
    ctx.beginPath();
    sorted.forEach(function (q, i) {
      var p = projectLonLat(q.lon, q.lat, W, H, b);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "rgba(120,200,255,0.4)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    sorted.forEach(function (q) {
      var p = projectLonLat(q.lon, q.lat, W, H, b);
      ctx.fillStyle = magColor(q.mag, 0.9);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8 + Math.min(5, q.mag), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function paintStatsCanvas(ctx, W, H) {
    ctx.fillStyle = "rgba(150,170,190,0.55)";
    ctx.font = "600 8px ui-monospace,Menlo,monospace";
    ctx.fillText("DATA CARD · pattern statistics (Portland Maps spirit)", 6, 12);
    var lines = [
      "events " + stats.n + " · feed " + feedId,
      "max mag " + stats.maxMag.toFixed(1) + " · mean " + stats.meanMag.toFixed(2),
      "mean depth " + stats.meanDepth.toFixed(1) + " km",
      "span " + stats.spanHrs.toFixed(1) + " h",
      lastErr ? "err " + lastErr.slice(0, 40) : "source USGS GeoJSON public feed",
    ];
    ctx.fillStyle = "rgba(200,220,240,0.9)";
    ctx.font = "600 11px ui-monospace,Menlo,monospace";
    lines.forEach(function (ln, i) {
      ctx.fillText(ln, 10, 32 + i * 18);
    });
  }

  function draw() {
    if (!open || !cv) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = cv.clientWidth || 400;
    var H = 140;
    cv.width = Math.floor(W * dpr);
    cv.height = Math.floor(H * dpr);
    var ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "rgba(4,8,14,0.95)";
    ctx.fillRect(0, 0, W, H);
    if (mode === "map") paintMap(ctx, W, H);
    else if (mode === "stats") paintStatsCanvas(ctx, W, H);
    else paintPattern(ctx, W, H);
    paintStatsTable();
  }

  function paintStatsTable() {
    var el = document.getElementById("mg-geo-stats");
    if (!el) return;
    var rows = [
      ["Events", String(stats.n)],
      ["Max magnitude", stats.maxMag ? stats.maxMag.toFixed(1) : "—"],
      ["Mean magnitude", stats.meanMag ? stats.meanMag.toFixed(2) : "—"],
      ["Mean depth (km)", stats.meanDepth ? stats.meanDepth.toFixed(1) : "—"],
      ["Time span (h)", stats.spanHrs ? stats.spanHrs.toFixed(1) : "—"],
      ["Feed", feedId + (loading ? " …" : "")],
    ];
    el.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="row"><div class="k">' +
          r[0] +
          '</div><div class="v">' +
          r[1] +
          "</div></div>"
        );
      })
      .join("");
  }

  function recomputeStats() {
    stats.n = quakes.length;
    stats.maxMag = 0;
    var sumM = 0,
      sumD = 0,
      tMin = Infinity,
      tMax = 0;
    quakes.forEach(function (q) {
      if (q.mag > stats.maxMag) stats.maxMag = q.mag;
      sumM += q.mag;
      sumD += q.depth || 0;
      if (q.t < tMin) tMin = q.t;
      if (q.t > tMax) tMax = q.t;
    });
    stats.meanMag = stats.n ? sumM / stats.n : 0;
    stats.meanDepth = stats.n ? sumD / stats.n : 0;
    stats.spanHrs = tMax > tMin ? (tMax - tMin) / 3600000 : 0;
  }

  /** Offline sample so panel never bricks the score with empty "Load failed" only */
  function seedOfflineSample() {
    var now = Date.now();
    quakes = [
      { lon: -122.68, lat: 45.52, depth: 12, mag: 2.4, t: now - 3600000, place: "Portland, OR", id: "s1", url: MAP_USGS },
      { lon: -155.5, lat: 19.4, depth: 8, mag: 4.1, t: now - 7200000, place: "Hawaii", id: "s2", url: MAP_USGS },
      { lon: -118.2, lat: 34.05, depth: 15, mag: 3.2, t: now - 1800000, place: "Los Angeles, CA", id: "s3", url: MAP_USGS },
      { lon: -122.4, lat: 37.8, depth: 10, mag: 2.8, t: now - 5400000, place: "San Francisco, CA", id: "s4", url: MAP_USGS },
      { lon: 139.7, lat: 35.7, depth: 40, mag: 4.6, t: now - 900000, place: "Tokyo, Japan", id: "s5", url: MAP_USGS },
      { lon: -150.0, lat: 61.2, depth: 50, mag: 3.9, t: now - 1200000, place: "Alaska", id: "s6", url: MAP_USGS },
      { lon: 28.9, lat: 41.0, depth: 18, mag: 3.5, t: now - 2400000, place: "Istanbul", id: "s7", url: MAP_USGS },
      { lon: -71.5, lat: -33.4, depth: 25, mag: 4.0, t: now - 3000000, place: "Chile", id: "s8", url: MAP_USGS },
    ];
    recomputeStats();
  }

  function loadQuakes(force) {
    if (loading && !force) return;
    loading = true;
    lastErr = "";
    draw();
    var url = FEEDS[feedId] || FEEDS.day;
    /* USGS is usually CORS-open; if WK blocks, fall back to offline sample */
    fetch(url, { cache: "no-store", mode: "cors" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (geo) {
        quakes = [];
        var feats = (geo && geo.features) || [];
        feats.forEach(function (f) {
          var c = f.geometry && f.geometry.coordinates;
          var p = f.properties || {};
          if (!c || c.length < 2) return;
          quakes.push({
            lon: c[0],
            lat: c[1],
            depth: c[2] != null ? c[2] : p.depth || 0,
            mag: p.mag != null ? p.mag : 0,
            t: p.time || 0,
            place: p.place || "",
            id: f.id || p.code || String(p.time),
            url: p.url || MAP_USGS,
          });
        });
        if (quakes.length > 200) {
          quakes.sort(function (a, b) {
            return b.t - a.t;
          });
          quakes = quakes.slice(0, 200);
        }
        recomputeStats();
        loading = false;
        lastErr = "";
        draw();
        log(VER + " · quakes " + quakes.length + " · " + feedId);
      })
      .catch(function (e) {
        loading = false;
        lastErr = "offline sample · " + String(e && e.message ? e.message : e).slice(0, 40);
        seedOfflineSample();
        draw();
        log("geo load fail → offline sample · " + lastErr);
      });
  }

  function setHuntCard(h) {
    hunt = h;
    var el = document.getElementById("mg-geo-hunt");
    if (!el) return;
    if (!h) {
      el.textContent = "Scavenger: refresh or HUNT for a target clue.";
      return;
    }
    el.innerHTML =
      "<b>HUNT · " +
      (h.kind || "target") +
      "</b> — " +
      (h.title || "") +
      "<br/>" +
      (h.clue || "") +
      (h.url
        ? ' · <a href="#" id="mg-geo-hunt-go" style="color:#8cf">open clue →</a>'
        : "");
    var a = document.getElementById("mg-geo-hunt-go");
    if (a && h.url)
      a.onclick = function (ev) {
        if (ev) ev.preventDefault();
        nav(h.url);
      };
  }

  function pickHunt() {
    if (quakes.length) {
      var q = quakes[Math.floor(Math.random() * quakes.length)];
      setHuntCard({
        kind: "quake",
        title: "M" + q.mag.toFixed(1) + " · " + (q.place || "event").slice(0, 48),
        clue:
          "lon " +
          q.lon.toFixed(2) +
          " lat " +
          q.lat.toFixed(2) +
          " · depth " +
          (q.depth || 0).toFixed(0) +
          " km · follow pattern flow color (green→cyan→amber→red by mag) · type claim in search bar when found",
        url: q.url || MAP_USGS,
      });
      try {
        if (window.__mgSearchComms && window.__mgSearchComms.sendChat)
          window.__mgSearchComms.sendChat(
            "hunt · " + "M" + q.mag.toFixed(1) + " " + (q.place || "").slice(0, 40)
          );
      } catch (eH) {}
      return;
    }
    /* fallback property scavenger (Portland Maps spirit) */
    setHuntCard({
      kind: "property",
      title: "7000 WI/NE AIRPORT WAY · R316936",
      clue: "Year 1942 · INDUSTRIAL · 6400 sq ft · PDX Airport Area · Owner PORT OF PORTLAND · elev ~14 ft · type claim when verified",
      url: PDX_SAMPLE,
    });
    try {
      if (window.__mgSearchComms && window.__mgSearchComms.sendChat)
        window.__mgSearchComms.sendChat("hunt · PDX Airport Way parcel");
    } catch (eP) {}
  }

  function claimHunt() {
    try {
      if (window.__mgSearchComms && window.__mgSearchComms.claimHunt)
        return window.__mgSearchComms.claimHunt(hunt && hunt.title);
    } catch (e) {}
    try {
      if (window.__mgActivityBoard)
        window.__mgActivityBoard.submitRun("scavenger", {
          game: "scavenger",
          synopsis: "geo hunt · " + ((hunt && hunt.title) || "claim"),
        });
      if (window.__mgCollabDay) {
        if (!window.__mgCollabDay.day()) window.__mgCollabDay.start({});
        window.__mgCollabDay.chat("🏆 geo hunt claim");
        window.__mgCollabDay.shareScore();
      }
    } catch (e2) {}
    return true;
  }

  function pushToMaze() {
    if (!window.__mgMemoryMaze || !window.__mgMemoryMaze.ingestKey) return;
    var sorted = quakes.slice().sort(function (a, b) {
      return a.t - b.t;
    });
    sorted.slice(-40).forEach(function (q, i) {
      var nx = (q.lon + 180) / 360;
      var ny = (90 - q.lat) / 180;
      try {
        window.__mgMemoryMaze.ingestKey(String.fromCharCode(97 + (i % 26)), nx, ny);
      } catch (e) {}
    });
    log("geo → maze " + Math.min(40, sorted.length));
  }

  function openPanel() {
    open = true;
    ensurePanel();
    panel.classList.remove("hidden");
    if (!quakes.length) loadQuakes(true);
    else draw();
  }

  function close() {
    open = false;
    if (panel) panel.classList.add("hidden");
  }

  function toggle() {
    if (open) close();
    else openPanel();
  }

  window.__mgGeoPattern = {
    ver: VER,
    open: openPanel,
    close: close,
    toggle: toggle,
    isOpen: function () {
      return open;
    },
    load: loadQuakes,
    quakes: function () {
      return quakes;
    },
    stats: function () {
      return stats;
    },
    hunt: pickHunt,
    claim: claimHunt,
    report: function () {
      return (
        VER +
        " n=" +
        stats.n +
        " maxM=" +
        (stats.maxMag || 0).toFixed(1) +
        " feed=" +
        feedId +
        (open ? " open" : "")
      );
    },
  };
  log(VER + " · USGS pattern flow + data scavenger");
})();
