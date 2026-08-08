/* Raster basemap tiles + flight overlays · never black-only canvas */
(function (global) {
  "use strict";
  var VER = "drone-map-v1";
  // Carto dark · OSM-compatible XYZ (no API key)
  var BASEMAPS = {
    "carto-dark": {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      sub: ["a", "b", "c", "d"],
      maxZ: 19,
      attr: "© OSM · CARTO"
    },
    "carto-voyager": {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      sub: ["a", "b", "c", "d"],
      maxZ: 19,
      attr: "© OSM · CARTO"
    },
    osm: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      sub: [""],
      maxZ: 19,
      attr: "© OSM"
    }
  };

  function lon2tile(lon, z) { return Math.floor(((lon + 180) / 360) * Math.pow(2, z)); }
  function lat2tile(lat, z) {
    var r = (lat * Math.PI) / 180;
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z));
  }
  function tile2lon(x, z) { return (x / Math.pow(2, z)) * 360 - 180; }
  function tile2lat(y, z) {
    var n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }

  function create(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var state = {
      basemap: opts.basemap || "carto-dark",
      // default near PDX / lab
      center: opts.center || { lat: 45.52, lon: -122.68 },
      zoom: opts.zoom || 14,
      tilesLoaded: 0,
      tilesPending: 0,
      tilesFailed: 0,
      cache: Object.create(null),
      path: [],
      units: [],
      home: null,
      slam: [],
      tracks: [],
      mode: "tiles" // tiles | hub | particle | lane
    };
    var drag = null;

    function bm() { return BASEMAPS[state.basemap] || BASEMAPS["carto-dark"]; }

    function tileUrl(z, x, y) {
      var b = bm();
      var s = b.sub[Math.abs(x + y) % b.sub.length] || "a";
      return b.url
        .replace("{s}", s)
        .replace("{z}", z)
        .replace("{x}", x)
        .replace("{y}", y)
        .replace("{r}", "");
    }

    function loadTile(z, x, y) {
      var key = z + "/" + x + "/" + y + "/" + state.basemap;
      if (state.cache[key]) return state.cache[key];
      var img = new Image();
      img.crossOrigin = "anonymous";
      state.tilesPending++;
      state.cache[key] = { img: img, ready: false, fail: false };
      img.onload = function () {
        state.cache[key].ready = true;
        state.tilesLoaded++;
        state.tilesPending = Math.max(0, state.tilesPending - 1);
      };
      img.onerror = function () {
        state.cache[key].fail = true;
        state.tilesFailed++;
        state.tilesPending = Math.max(0, state.tilesPending - 1);
      };
      img.src = tileUrl(z, x, y);
      return state.cache[key];
    }

    function project(lat, lon) {
      var z = state.zoom;
      var n = Math.pow(2, z);
      var x = ((lon + 180) / 360) * n;
      var r = (lat * Math.PI) / 180;
      var y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
      var cx = ((state.center.lon + 180) / 360) * n;
      var cr = (state.center.lat * Math.PI) / 180;
      var cy = ((1 - Math.log(Math.tan(cr) + 1 / Math.cos(cr)) / Math.PI) / 2) * n;
      var scale = 256;
      return {
        x: (x - cx) * scale + canvas.width / 2,
        y: (y - cy) * scale + canvas.height / 2
      };
    }

    function drawTiles() {
      var z = Math.min(bm().maxZ, Math.max(1, state.zoom | 0));
      var w = canvas.width, h = canvas.height;
      var n = Math.pow(2, z);
      var cx = ((state.center.lon + 180) / 360) * n;
      var cr = (state.center.lat * Math.PI) / 180;
      var cy = ((1 - Math.log(Math.tan(cr) + 1 / Math.cos(cr)) / Math.PI) / 2) * n;
      var scale = 256;
      var tilesX = Math.ceil(w / scale) + 2;
      var tilesY = Math.ceil(h / scale) + 2;
      var tx0 = Math.floor(cx - tilesX / 2);
      var ty0 = Math.floor(cy - tilesY / 2);

      ctx.fillStyle = "#0a0e14";
      ctx.fillRect(0, 0, w, h);

      for (var ty = ty0; ty < ty0 + tilesY + 1; ty++) {
        for (var tx = tx0; tx < tx0 + tilesX + 1; tx++) {
          if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
          var t = loadTile(z, tx, ty);
          var px = (tx - cx) * scale + w / 2;
          var py = (ty - cy) * scale + h / 2;
          if (t.ready && t.img.complete) {
            try { ctx.drawImage(t.img, px, py, scale, scale); } catch (e) {}
          } else {
            ctx.fillStyle = "#121820";
            ctx.fillRect(px, py, scale - 1, scale - 1);
            ctx.strokeStyle = "rgba(92,200,255,.08)";
            ctx.strokeRect(px, py, scale, scale);
          }
        }
      }
    }

    function drawOverlays() {
      // home
      if (state.home) {
        var hp = project(state.home.lat, state.home.lon);
        ctx.fillStyle = "#f0b429";
        ctx.beginPath();
        ctx.arc(hp.x, hp.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "600 10px IBM Plex Mono, monospace";
        ctx.fillText("HOME", hp.x + 8, hp.y + 3);
      }
      // path
      if (state.path && state.path.length) {
        ctx.strokeStyle = "rgba(92,200,255,.75)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        state.path.forEach(function (p, i) {
          var pt = project(p.lat, p.lon);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        state.path.forEach(function (p, i) {
          var pt = project(p.lat, p.lon);
          ctx.fillStyle = p.done ? "#3dd68c" : p.cur ? "#5cc8ff" : "#6f8499";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      // SLAM keypoints
      if (state.slam && state.slam.length) {
        ctx.fillStyle = "rgba(92,200,255,.55)";
        state.slam.forEach(function (p) {
          var pt = project(p.lat, p.lon);
          ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        });
      }
      // track trails
      if (state.tracks) {
        state.tracks.forEach(function (tr) {
          if (!tr.trail || !tr.trail.length) return;
          ctx.strokeStyle = tr.color || "rgba(61,214,140,.7)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          tr.trail.forEach(function (p, i) {
            var pt = project(p.lat, p.lon);
            if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        });
      }
      // units
      (state.units || []).forEach(function (u) {
        var pt = project(u.lat, u.lon);
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(((u.hdg || 0) * Math.PI) / 180);
        ctx.fillStyle = u.active ? "#5cc8ff" : "#8aa0b5";
        ctx.beginPath();
        ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        if (u.active) {
          ctx.strokeStyle = "rgba(92,200,255,.5)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    function draw() {
      drawTiles();
      drawOverlays();
    }

    function status() {
      return {
        basemap: state.basemap,
        zoom: state.zoom,
        center: state.center,
        tilesLoaded: state.tilesLoaded,
        tilesPending: state.tilesPending,
        tilesFailed: state.tilesFailed,
        mode: state.mode,
        attr: bm().attr
      };
    }

    canvas.addEventListener("mousedown", function (e) {
      drag = { x: e.clientX, y: e.clientY, lon: state.center.lon, lat: state.center.lat };
    });
    window.addEventListener("mouseup", function () { drag = null; });
    window.addEventListener("mousemove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      var z = state.zoom;
      var scale = 256 * Math.pow(2, z);
      state.center.lon = drag.lon - (dx / scale) * 360;
      state.center.lat = drag.lat + (dy / scale) * 170;
      state.center.lat = Math.max(-85, Math.min(85, state.center.lat));
    });
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      state.zoom = Math.max(2, Math.min(18, state.zoom + (e.deltaY > 0 ? -1 : 1)));
    }, { passive: false });
    canvas.addEventListener("click", function (e) {
      if (opts.onClick) {
        var rect = canvas.getBoundingClientRect();
        var sx = ((e.clientX - rect.left) / rect.width) * canvas.width;
        var sy = ((e.clientY - rect.top) / rect.height) * canvas.height;
        // inverse project approx
        var z = state.zoom;
        var n = Math.pow(2, z);
        var scale = 256;
        var cx = ((state.center.lon + 180) / 360) * n;
        var cr = (state.center.lat * Math.PI) / 180;
        var cy = ((1 - Math.log(Math.tan(cr) + 1 / Math.cos(cr)) / Math.PI) / 2) * n;
        var tx = cx + (sx - canvas.width / 2) / scale;
        var ty = cy + (sy - canvas.height / 2) / scale;
        var lon = tile2lon(tx, z);
        var lat = tile2lat(ty, z);
        opts.onClick({ lat: lat, lon: lon, sx: sx, sy: sy });
      }
    });

    return {
      version: VER,
      state: state,
      draw: draw,
      status: status,
      setBasemap: function (id) {
        if (BASEMAPS[id]) { state.basemap = id; state.cache = Object.create(null); }
      },
      setCenter: function (lat, lon) { state.center = { lat: lat, lon: lon }; },
      setZoom: function (z) { state.zoom = z; },
      setPath: function (p) { state.path = p || []; },
      setUnits: function (u) { state.units = u || []; },
      setHome: function (h) { state.home = h; },
      setSlam: function (s) { state.slam = s || []; },
      setTracks: function (t) { state.tracks = t || []; },
      setMode: function (m) { state.mode = m; },
      project: project,
      BASEMAPS: BASEMAPS
    };
  }

  global.DroneMap = { version: VER, create: create, BASEMAPS: BASEMAPS };
})(typeof window !== "undefined" ? window : globalThis);
