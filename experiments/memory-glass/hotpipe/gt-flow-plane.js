/* Memory Glass · GT Flow Plane
 * KeyCDN-style data-flow + hop speed tests under the governance hood.
 * Color-signaled giraph hops (packet / proxy / edge) · IP bring-up tools ·
 * popup mitigation. No reverse-lookup / SocialBlade / Trends noise —
 * operator-grade path visibility (DEFCON / Kali respect).
 * VER: gt-flow-plane-v1
 */
(function () {
  "use strict";
  var VER = "gt-flow-plane-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._gtFlowVer === VER) return;
  HP._gtFlowVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "gt-flow");
    } catch (e) {}
  }

  var LS = "mg.gt.flow.v1";
  var state = {
    ver: VER,
    running: false,
    lastRun: 0,
    hops: [],
    edges: [],
    summary: null,
    ip: null,
    popup: {
      enabled: true,
      blocked: 0,
      allowed: 0,
      log: [],
    },
    pulse: 0,
    anim: 0,
  };

  try {
    var saved = JSON.parse(localStorage.getItem(LS) || "{}");
    if (saved.popup && typeof saved.popup.enabled === "boolean")
      state.popup.enabled = saved.popup.enabled;
  } catch (e0) {}

  function persistPopup() {
    try {
      localStorage.setItem(
        LS,
        JSON.stringify({ popup: { enabled: !!state.popup.enabled } })
      );
    } catch (e) {}
  }

  /* ── Color bands (KeyCDN / heat) ── */
  function latColor(ms) {
    if (ms == null || !isFinite(ms)) return "#6a6e78";
    if (ms < 0) return "#6a6e78";
    if (ms < 40) return "#50e6a0"; /* excellent */
    if (ms < 100) return "#a0c8ff"; /* good */
    if (ms < 250) return "#ffb060"; /* fair */
    if (ms < 600) return "#ff7070"; /* poor */
    return "#c04060"; /* critical */
  }

  function kindColor(kind) {
    var map = {
      glass: "#70e0ff",
      browser: "#a0c8ff",
      dns: "#c8a0ff",
      tls: "#ffb0e0",
      origin: "#50e6a0",
      edge: "#ffb060",
      proxy: "#c080ff",
      sw: "#e0a060",
      mesh: "#60e0c0",
      local: "#90ffa0",
      fail: "#ff5050",
    };
    return map[kind] || "#8a90a0";
  }

  /* ── KeyCDN-style path knowledge (static topology, measured RTT fills in) ── */
  var FLOW_KNOWLEDGE = [
    {
      id: "user",
      label: "User",
      kind: "glass",
      note: "Human · input device · glass surface",
    },
    {
      id: "glass",
      label: "Memory Glass",
      kind: "glass",
      note: "tao+wry WKWebView · hotpipe inject · dual drawers",
    },
    {
      id: "browser",
      label: "WebKit",
      kind: "browser",
      note: "Rendering · JS · network stack entry",
    },
    {
      id: "dns",
      label: "DNS",
      kind: "dns",
      note: "Name → address · resolver / DoH if enabled",
    },
    {
      id: "tcp_tls",
      label: "TCP · TLS",
      kind: "tls",
      note: "Handshake · ALPN · H2/H3 session",
    },
    {
      id: "proxy",
      label: "Proxy · SW",
      kind: "proxy",
      note: "Corporate proxy · VPN · ServiceWorker intercept",
    },
    {
      id: "edge",
      label: "Edge PoP",
      kind: "edge",
      note: "CDN anycast · KeyCDN-style cache layer",
    },
    {
      id: "origin",
      label: "Origin",
      kind: "origin",
      note: "Page host · API · app backend",
    },
  ];

  /* Probe targets — public static assets / health endpoints (timing only) */
  var PROBE_TARGETS = [
    {
      id: "origin_page",
      label: "Page origin",
      kind: "origin",
      url: function () {
        try {
          return location.origin + "/favicon.ico";
        } catch (e) {
          return null;
        }
      },
    },
    {
      id: "cf_edge",
      label: "Cloudflare edge",
      kind: "edge",
      url: "https://www.cloudflare.com/favicon.ico",
    },
    {
      id: "fastly_edge",
      label: "Fastly edge",
      kind: "edge",
      url: "https://www.fastly.com/favicon.ico",
    },
    {
      id: "akamai_edge",
      label: "Akamai edge",
      kind: "edge",
      url: "https://www.akamai.com/favicon.ico",
    },
    {
      id: "keycdn_probe",
      label: "KeyCDN tools",
      kind: "edge",
      url: "https://tools.keycdn.com/favicon.ico",
    },
    {
      id: "google_gstatic",
      label: "gstatic CDN",
      kind: "edge",
      url: "https://www.gstatic.com/generate_204",
    },
    {
      id: "cloudflare_trace",
      label: "CF trace",
      kind: "edge",
      url: "https://www.cloudflare.com/cdn-cgi/trace",
      text: true,
    },
  ];

  function navTimingHops() {
    var hops = [];
    try {
      var nav =
        performance.getEntriesByType &&
        performance.getEntriesByType("navigation")[0];
      if (!nav && performance.timing) {
        var t = performance.timing;
        var base = t.navigationStart || 0;
        function d(a, b) {
          if (!a || !b || a < base || b < base) return null;
          return Math.max(0, b - a);
        }
        hops.push({
          id: "dns_nav",
          label: "DNS (nav)",
          kind: "dns",
          ms: d(t.domainLookupStart, t.domainLookupEnd),
          phase: "dns",
        });
        hops.push({
          id: "tcp_nav",
          label: "TCP connect",
          kind: "tls",
          ms: d(t.connectStart, t.connectEnd),
          phase: "connect",
        });
        hops.push({
          id: "ttfb_nav",
          label: "TTFB",
          kind: "origin",
          ms: d(t.requestStart, t.responseStart),
          phase: "ttfb",
        });
        hops.push({
          id: "download_nav",
          label: "Download",
          kind: "origin",
          ms: d(t.responseStart, t.responseEnd),
          phase: "body",
        });
        hops.push({
          id: "dom_nav",
          label: "DOM interactive",
          kind: "browser",
          ms: d(t.navigationStart, t.domInteractive),
          phase: "dom",
        });
        return hops;
      }
      if (nav) {
        hops.push({
          id: "dns_nav",
          label: "DNS (nav)",
          kind: "dns",
          ms: nav.domainLookupEnd - nav.domainLookupStart,
          phase: "dns",
        });
        hops.push({
          id: "tcp_nav",
          label: "TCP connect",
          kind: "tls",
          ms: nav.connectEnd - nav.connectStart,
          phase: "connect",
        });
        if (nav.secureConnectionStart > 0) {
          hops.push({
            id: "tls_nav",
            label: "TLS handshake",
            kind: "tls",
            ms: nav.connectEnd - nav.secureConnectionStart,
            phase: "tls",
          });
        }
        hops.push({
          id: "ttfb_nav",
          label: "TTFB",
          kind: "origin",
          ms: nav.responseStart - nav.requestStart,
          phase: "ttfb",
        });
        hops.push({
          id: "download_nav",
          label: "Download",
          kind: "origin",
          ms: nav.responseEnd - nav.responseStart,
          phase: "body",
        });
        hops.push({
          id: "dom_nav",
          label: "DOM interactive",
          kind: "browser",
          ms: nav.domInteractive,
          phase: "dom",
        });
        hops.push({
          id: "load_nav",
          label: "Load event",
          kind: "browser",
          ms: nav.loadEventEnd > 0 ? nav.loadEventEnd : nav.duration,
          phase: "load",
        });
        if (nav.transferSize != null) {
          hops.push({
            id: "xfer_nav",
            label: "Transfer " + Math.round((nav.transferSize || 0) / 1024) + " KB",
            kind: "origin",
            ms: nav.duration,
            phase: "bytes",
            bytes: nav.transferSize,
          });
        }
      }
    } catch (e) {}
    return hops;
  }

  function proxyHints() {
    var hints = [];
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        hints.push({
          id: "sw_ctrl",
          label: "ServiceWorker controller",
          kind: "sw",
          ms: 0,
          phase: "proxy",
          note: "Intercept layer live",
        });
      }
    } catch (e) {}
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) {
        hints.push({
          id: "net_info",
          label:
            "Net · " +
            (c.effectiveType || c.type || "unknown") +
            (c.rtt != null ? " · rtt " + c.rtt + "ms" : "") +
            (c.downlink != null ? " · " + c.downlink + "Mb/s" : ""),
          kind: c.saveData ? "proxy" : "browser",
          ms: c.rtt != null ? c.rtt : null,
          phase: "connection",
          note: c.saveData ? "save-data on" : "",
        });
      }
    } catch (e2) {}
    return hints;
  }

  function probeOne(target) {
    return new Promise(function (resolve) {
      var url = typeof target.url === "function" ? target.url() : target.url;
      if (!url) {
        resolve({
          id: target.id,
          label: target.label,
          kind: target.kind,
          ms: null,
          ok: false,
          err: "no-url",
          phase: "probe",
        });
        return;
      }
      var t0 = performance.now();
      var done = false;
      function finish(ok, extra) {
        if (done) return;
        done = true;
        var ms = Math.round(performance.now() - t0);
        resolve(
          Object.assign(
            {
              id: target.id,
              label: target.label,
              kind: target.kind,
              ms: ms,
              ok: !!ok,
              phase: "probe",
              url: url,
            },
            extra || {}
          )
        );
      }
      var timer = setTimeout(function () {
        finish(false, { err: "timeout" });
      }, 8000);
      if (target.text) {
        fetch(url, { mode: "cors", cache: "no-store", credentials: "omit" })
          .then(function (r) {
            return r.text().then(function (txt) {
              clearTimeout(timer);
              var meta = {};
              try {
                txt.split("\n").forEach(function (line) {
                  var p = line.split("=");
                  if (p.length >= 2) meta[p[0]] = p.slice(1).join("=").trim();
                });
              } catch (eP) {}
              finish(r.ok || r.type === "opaque", {
                trace: meta,
                note: meta.colo
                  ? "PoP " + meta.colo + (meta.loc ? " · " + meta.loc : "")
                  : "",
              });
            });
          })
          .catch(function (err) {
            clearTimeout(timer);
            /* CORS may fail — fall back to no-cors timing */
            var t1 = performance.now();
            fetch(url, { mode: "no-cors", cache: "no-store" })
              .then(function () {
                finish(true, {
                  ms: Math.round(performance.now() - t1),
                  note: "no-cors timing",
                });
              })
              .catch(function () {
                finish(false, { err: String(err && err.message ? err.message : err).slice(0, 48) });
              });
          });
        return;
      }
      /* Image probe — works cross-origin for timing */
      var img = new Image();
      img.onload = function () {
        clearTimeout(timer);
        finish(true);
      };
      img.onerror = function () {
        clearTimeout(timer);
        /* error still measures RTT to edge in many cases */
        finish(true, { note: "status-err · timed" });
      };
      img.referrerPolicy = "no-referrer";
      img.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "mg_gt=" + Date.now();
    });
  }

  function buildEdges(hops) {
    var edges = [];
    for (var i = 0; i < hops.length - 1; i++) {
      edges.push({
        from: hops[i].id,
        to: hops[i + 1].id,
        ms: hops[i + 1].ms,
        color: latColor(hops[i + 1].ms),
      });
    }
    return edges;
  }

  function layoutHops(hops, w, h) {
    var n = hops.length || 1;
    var padX = 36;
    var padY = 28;
    var usableW = Math.max(80, w - padX * 2);
    var usableH = Math.max(40, h - padY * 2);
    /* Giraph-ish layered: zigzag columns */
    return hops.map(function (hop, i) {
      var col = i % Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))));
      var row = Math.floor(i / Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n)))));
      var cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(n))));
      var rows = Math.ceil(n / cols) || 1;
      var x = padX + (col + 0.5) * (usableW / cols);
      var y = padY + (row + 0.5) * (usableH / rows);
      /* slight organic offset so edges don't stack */
      x += (i % 2 === 0 ? -1 : 1) * 6;
      return Object.assign({}, hop, { x: x, y: y });
    });
  }

  function runSpeedTest(opts, cb) {
    opts = opts || {};
    if (state.running) {
      if (cb) cb({ ok: false, reason: "busy" });
      return Promise.resolve({ ok: false, reason: "busy" });
    }
    state.running = true;
    state.lastRun = Date.now();
    log("ok", VER + " · speed test start");

    var localHops = [
      {
        id: "user_glass",
        label: "User · Glass",
        kind: "glass",
        ms: 0,
        phase: "local",
        note: "WKWebView surface",
      },
      {
        id: "js_tick",
        label: "JS tick",
        kind: "browser",
        ms: 0,
        phase: "local",
      },
    ];
    var tJs = performance.now();
    /* burn one rAF for paint hop */
    return new Promise(function (resolveOuter) {
      requestAnimationFrame(function () {
        localHops[1].ms = Math.round(performance.now() - tJs);
        var nav = navTimingHops();
        var proxy = proxyHints();
        var targets = PROBE_TARGETS.slice();
        if (opts.only) {
          targets = targets.filter(function (t) {
            return opts.only.indexOf(t.id) >= 0;
          });
        }
        Promise.all(targets.map(probeOne)).then(function (probes) {
          var hops = localHops.concat(nav).concat(proxy).concat(probes);
          /* normalize ms */
          hops.forEach(function (h) {
            if (h.ms != null && isFinite(h.ms)) h.ms = Math.max(0, Math.round(h.ms));
            h.color = latColor(h.ms);
            h.fill = kindColor(h.kind);
          });
          state.hops = hops;
          state.edges = buildEdges(hops);
          var measured = hops.filter(function (h) {
            return h.ms != null && isFinite(h.ms) && h.phase === "probe";
          });
          var avg = 0;
          if (measured.length) {
            avg =
              measured.reduce(function (s, h) {
                return s + h.ms;
              }, 0) / measured.length;
          }
          var best = measured.slice().sort(function (a, b) {
            return a.ms - b.ms;
          })[0];
          var worst = measured.slice().sort(function (a, b) {
            return b.ms - a.ms;
          })[0];
          state.summary = {
            n: hops.length,
            probes: measured.length,
            avgMs: Math.round(avg),
            best: best ? { id: best.id, ms: best.ms, label: best.label } : null,
            worst: worst
              ? { id: worst.id, ms: worst.ms, label: worst.label }
              : null,
            t: Date.now(),
            knowledge: FLOW_KNOWLEDGE,
          };
          state.running = false;
          try {
            if (window.__mgLark && window.__mgLark.setHops)
              window.__mgLark.setHops(hops.length);
            else if (window.__mgLark && window.__mgLark.state)
              window.__mgLark.state.hops = hops.length;
          } catch (eL) {}
          paintAll();
          startAnim();
          log(
            "ok",
            VER +
              " · speed ok n=" +
              hops.length +
              " avg=" +
              state.summary.avgMs +
              "ms"
          );
          var out = { ok: true, hops: hops, summary: state.summary };
          if (cb) cb(out);
          resolveOuter(out);
        });
      });
    });
  }

  /* ── IP / connection bring-up tools (no reverse lookup / Trends) ── */
  function collectIpTools() {
    var info = {
      online: !!navigator.onLine,
      secure: !!window.isSecureContext,
      origin: "",
      host: "",
      protocol: "",
      connection: null,
      languages: navigator.languages || [navigator.language],
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      cookieEnabled: !!navigator.cookieEnabled,
      storageEstimate: null,
      webrtcLocal: [],
      crossOriginIsolated: !!window.crossOriginIsolated,
      userAgent: (navigator.userAgent || "").slice(0, 120),
    };
    try {
      info.origin = location.origin || "";
      info.host = location.host || "";
      info.protocol = location.protocol || "";
    } catch (e) {}
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c) {
        info.connection = {
          type: c.type || null,
          effectiveType: c.effectiveType || null,
          rtt: c.rtt != null ? c.rtt : null,
          downlink: c.downlink != null ? c.downlink : null,
          saveData: !!c.saveData,
        };
      }
    } catch (e2) {}
    state.ip = info;
    /* async enrich */
    try {
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(function (est) {
          if (state.ip) {
            state.ip.storageEstimate = {
              quota: est.quota,
              usage: est.usage,
            };
            paintIpPanel();
          }
        });
      }
    } catch (e3) {}
    collectWebRtcLocals();
    return info;
  }

  function collectWebRtcLocals() {
    /* Local ICE candidates only — help users see LAN/host for bring-up.
     * Not a reverse-lookup or OSINT scrape. */
    try {
      if (!window.RTCPeerConnection) return;
      var pc = new RTCPeerConnection({ iceServers: [] });
      var found = {};
      pc.createDataChannel("mg-gt-ip");
      pc.onicecandidate = function (ev) {
        if (!ev || !ev.candidate || !ev.candidate.candidate) {
          if (!ev.candidate) {
            try {
              pc.close();
            } catch (eC) {}
          }
          return;
        }
        var cand = ev.candidate.candidate;
        /* host candidates: typ host */
        if (cand.indexOf(" typ host") < 0 && cand.indexOf(" typ srflx") < 0)
          return;
        var m = cand.match(
          /([0-9]{1,3}(?:\.[0-9]{1,3}){3}|[a-fA-F0-9:]+)/
        );
        if (!m) return;
        var ip = m[1];
        if (found[ip]) return;
        found[ip] = 1;
        if (state.ip) {
          state.ip.webrtcLocal.push({
            ip: ip,
            typ: cand.indexOf(" typ host") >= 0 ? "host" : "srflx",
          });
          paintIpPanel();
        }
      };
      pc.createOffer()
        .then(function (o) {
          return pc.setLocalDescription(o);
        })
        .catch(function () {
          try {
            pc.close();
          } catch (e) {}
        });
      setTimeout(function () {
        try {
          pc.close();
        } catch (e) {}
      }, 2500);
    } catch (eW) {}
  }

  /* ── Popup mitigation (operator guard, not a silent black-hole) ── */
  var _openOrig = null;
  var _alertOrig = null;
  var _confirmOrig = null;
  var _promptOrig = null;
  var _dialogBurst = 0;
  var _dialogBurstT = 0;

  function pushPopupLog(entry) {
    state.popup.log.push(
      Object.assign({ t: Date.now() }, entry || {})
    );
    if (state.popup.log.length > 80) state.popup.log = state.popup.log.slice(-60);
    paintPopupPanel();
    try {
      if (window.__mgDevLog)
        window.__mgDevLog(
          entry && entry.blocked ? "warn" : "ok",
          "popup " +
            (entry && entry.blocked ? "block" : "allow") +
            " · " +
            String((entry && entry.url) || "").slice(0, 80),
          "gt-popup"
        );
    } catch (e) {}
  }

  function installPopupGuard() {
    if (window.__mgGtPopupGuard) return;
    window.__mgGtPopupGuard = true;
    _openOrig = window.open;
    window.open = function (url, name, features) {
      var u = String(url || "");
      if (!state.popup.enabled) {
        state.popup.allowed++;
        pushPopupLog({ blocked: false, url: u, via: "window.open" });
        return _openOrig.apply(window, arguments);
      }
      /* allow same-origin intentional opens with explicit name */
      var same = false;
      try {
        same = u.indexOf(location.origin) === 0 || u.charAt(0) === "/" || u.charAt(0) === "#";
      } catch (e) {}
      if (same && name && name !== "_blank") {
        state.popup.allowed++;
        pushPopupLog({ blocked: false, url: u, via: "window.open-same" });
        return _openOrig.apply(window, arguments);
      }
      state.popup.blocked++;
      pushPopupLog({
        blocked: true,
        url: u,
        via: "window.open",
        name: String(name || ""),
        features: String(features || "").slice(0, 64),
      });
      return null;
    };

    function rateLimitDialog(kind, orig, args) {
      var now = Date.now();
      if (now - _dialogBurstT > 2000) {
        _dialogBurst = 0;
        _dialogBurstT = now;
      }
      _dialogBurst++;
      if (state.popup.enabled && _dialogBurst > 3) {
        state.popup.blocked++;
        pushPopupLog({ blocked: true, url: kind, via: "dialog-flood" });
        return kind === "confirm" ? false : kind === "prompt" ? null : undefined;
      }
      return orig.apply(window, args);
    }

    _alertOrig = window.alert;
    window.alert = function () {
      return rateLimitDialog("alert", _alertOrig, arguments);
    };
    _confirmOrig = window.confirm;
    window.confirm = function () {
      return rateLimitDialog("confirm", _confirmOrig, arguments);
    };
    _promptOrig = window.prompt;
    window.prompt = function () {
      return rateLimitDialog("prompt", _promptOrig, arguments);
    };

    /* Capture blank-target navigations that act like popups */
    document.addEventListener(
      "click",
      function (ev) {
        if (!state.popup.enabled) return;
        var a = ev.target && ev.target.closest ? ev.target.closest("a[target=_blank]") : null;
        if (!a) return;
        var rel = (a.getAttribute("rel") || "").toLowerCase();
        /* allow explicit noopener tabs — still log */
        if (rel.indexOf("noopener") >= 0) {
          pushPopupLog({
            blocked: false,
            url: a.href || "",
            via: "a_blank_noopener",
          });
          state.popup.allowed++;
          return;
        }
        /* soft-mitigate: force noopener + log (don't preventDefault — keep UX) */
        try {
          a.setAttribute("rel", (rel + " noopener noreferrer").trim());
        } catch (eR) {}
        pushPopupLog({
          blocked: false,
          url: a.href || "",
          via: "a_blank_hardened",
        });
        state.popup.allowed++;
      },
      true
    );

    log("ok", VER + " · popup guard installed");
  }

  function setPopupEnabled(on) {
    state.popup.enabled = !!on;
    persistPopup();
    paintPopupPanel();
  }

  /* ── Canvas giraph ── */
  var canvasEl = null;
  var hopTableEl = null;
  var ipPanelEl = null;
  var popupPanelEl = null;
  var statusEl = null;
  var embedRoot = null;

  function ensureCss() {
    if (document.getElementById("mg-gt-flow-css")) return;
    var st = document.createElement("style");
    st.id = "mg-gt-flow-css";
    st.textContent = [
      "#mg-gt-flow-root{display:flex;flex-direction:column;gap:8px;min-height:0}",
      "#mg-gt-flow-root .gtf-hd{",
      "  display:flex;flex-wrap:wrap;gap:6px;align-items:center}",
      "#mg-gt-flow-root .gtf-hd button{",
      "  appearance:none;cursor:pointer;border:0;border-radius:10px;",
      "  padding:8px 10px;font:600 10px/1 -apple-system,system-ui;",
      "  letter-spacing:0.04em;text-transform:uppercase;",
      "  background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.9)}",
      "#mg-gt-flow-root .gtf-hd button.hot{background:rgba(10,132,255,0.28)}",
      "#mg-gt-flow-root .gtf-hd button.ok{background:rgba(48,209,88,0.22)}",
      "#mg-gt-flow-root .gtf-hd button.warn{background:rgba(255,160,80,0.22)}",
      "#mg-gt-flow-root .gtf-hd button.on{box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35)}",
      "#mg-gt-flow-cv{",
      "  width:100%;height:168px;border-radius:14px;display:block;",
      "  background:rgba(8,10,14,0.72);border:1px solid rgba(255,255,255,0.1);",
      "  box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.08)}",
      "#mg-gt-flow-table{",
      "  max-height:min(28vh,260px);overflow:auto;border-radius:12px;",
      "  background:rgba(255,255,255,0.04);padding:4px}",
      "#mg-gt-flow-table .row{",
      "  display:grid;grid-template-columns:10px 1fr auto auto;gap:8px;",
      "  align-items:center;padding:6px 8px;border-radius:8px;",
      "  font:500 11px/1.25 -apple-system,system-ui;color:rgba(255,255,255,0.88)}",
      "#mg-gt-flow-table .row:nth-child(odd){background:rgba(255,255,255,0.03)}",
      "#mg-gt-flow-table .dot{width:8px;height:8px;border-radius:50%}",
      "#mg-gt-flow-table .ms{font:600 11px/1 ui-monospace,Menlo,monospace;",
      "  color:rgba(200,220,255,0.9)}",
      "#mg-gt-flow-table .kind{font:600 9px/1 system-ui;letter-spacing:0.06em;",
      "  text-transform:uppercase;color:rgba(255,255,255,0.38)}",
      "#mg-gt-flow-ip,#mg-gt-flow-popup{",
      "  padding:10px;border-radius:12px;background:rgba(255,255,255,0.06);",
      "  font:500 11px/1.4 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.72);",
      "  white-space:pre-wrap;word-break:break-word}",
      "#mg-gt-flow-ip b,#mg-gt-flow-popup b{color:rgba(255,255,255,0.92);font-weight:600}",
      "#mg-gt-flow-status{",
      "  font:500 10px/1.3 ui-monospace,Menlo,monospace;color:rgba(255,255,255,0.45);",
      "  padding:2px 2px 6px}",
      "#mg-gt-flow-legend{display:flex;flex-wrap:wrap;gap:8px;padding:0 2px;",
      "  font:600 9px/1 system-ui;letter-spacing:0.04em;text-transform:uppercase;",
      "  color:rgba(255,255,255,0.4)}",
      "#mg-gt-flow-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;",
      "  margin-right:4px;vertical-align:middle}",
      "#mg-gt-flow-know{",
      "  display:flex;flex-wrap:wrap;gap:4px;padding:2px 0 4px}",
      "#mg-gt-flow-know span{",
      "  font:600 9px/1 system-ui;letter-spacing:0.03em;padding:5px 8px;border-radius:999px;",
      "  background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.55)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function drawGraph() {
    if (!canvasEl) return;
    var cv = canvasEl;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = cv.clientWidth || 320;
    var h = cv.clientHeight || 168;
    if (cv.width !== Math.floor(w * dpr) || cv.height !== Math.floor(h * dpr)) {
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
    }
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    /* grid */
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx < w; gx += 24) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (var gy = 0; gy < h; gy += 24) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    var hops = state.hops.length
      ? state.hops
      : FLOW_KNOWLEDGE.map(function (k) {
          return {
            id: k.id,
            label: k.label,
            kind: k.kind,
            ms: null,
            color: kindColor(k.kind),
            fill: kindColor(k.kind),
          };
        });
    var nodes = layoutHops(hops, w, h);
    var byId = {};
    nodes.forEach(function (n) {
      byId[n.id] = n;
    });

    /* edges */
    for (var i = 0; i < nodes.length - 1; i++) {
      var a = nodes[i];
      var b = nodes[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = b.color || latColor(b.ms) || "rgba(255,255,255,0.2)";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      /* packet pulse */
      var t = (state.pulse + i * 0.12) % 1;
      var px = a.x + (b.x - a.x) * t;
      var py = a.y + (b.y - a.y) * t;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = b.color || "#fff";
      ctx.shadowColor = b.color || "#fff";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* nodes */
    nodes.forEach(function (n, idx) {
      var r = 9;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.fill || kindColor(n.kind);
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = n.color || latColor(n.ms) || "rgba(255,255,255,0.35)";
      ctx.stroke();
      ctx.font = "600 9px -apple-system,system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.textAlign = "center";
      var lab = (n.label || n.id || "").slice(0, 14);
      ctx.fillText(lab, n.x, n.y + r + 12);
      if (n.ms != null && isFinite(n.ms)) {
        ctx.font = "600 8px ui-monospace,Menlo,monospace";
        ctx.fillStyle = latColor(n.ms);
        ctx.fillText(n.ms + "ms", n.x, n.y + r + 22);
      }
    });

    /* title strip */
    ctx.textAlign = "left";
    ctx.font = "600 9px -apple-system,system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(
      state.running
        ? "SPEED · probing hops…"
        : state.summary
          ? "FLOW · " +
            state.summary.n +
            " hops · avg " +
            state.summary.avgMs +
            "ms"
          : "FLOW · KeyCDN-style path · run SPEED",
      10,
      14
    );
  }

  function startAnim() {
    if (state.anim) return;
    function tick() {
      state.pulse = (state.pulse + 0.018) % 1;
      drawGraph();
      if (state.hops.length || state.running) {
        state.anim = requestAnimationFrame(tick);
      } else {
        state.anim = 0;
      }
    }
    state.anim = requestAnimationFrame(tick);
  }

  function paintHopTable() {
    if (!hopTableEl) return;
    var hops = state.hops;
    if (!hops.length) {
      hopTableEl.innerHTML =
        '<div class="row"><span class="dot" style="background:#6a6e78"></span>' +
        "<span>No probes yet · hit SPEED</span><span class=\"kind\">—</span><span class=\"ms\">—</span></div>";
      return;
    }
    hopTableEl.innerHTML = hops
      .map(function (h) {
        return (
          '<div class="row" title="' +
          String(h.note || h.url || h.phase || "").replace(/"/g, "") +
          '">' +
          '<span class="dot" style="background:' +
          (h.color || latColor(h.ms)) +
          '"></span>' +
          "<span>" +
          String(h.label || h.id).replace(/</g, "&lt;") +
          (h.note
            ? ' <span style="opacity:0.45">· ' +
              String(h.note).replace(/</g, "&lt;").slice(0, 40) +
              "</span>"
            : "") +
          "</span>" +
          '<span class="kind">' +
          String(h.kind || h.phase || "") +
          "</span>" +
          '<span class="ms">' +
          (h.ms == null || !isFinite(h.ms) ? "—" : h.ms + "ms") +
          "</span></div>"
        );
      })
      .join("");
  }

  function paintIpPanel() {
    if (!ipPanelEl) return;
    var ip = state.ip || collectIpTools();
    var lines = [];
    lines.push("IP · connection bring-up  <b>(no reverse / Trends)</b>");
    lines.push("online  <b>" + (ip.online ? "yes" : "no") + "</b>  · secure  <b>" + (ip.secure ? "yes" : "no") + "</b>");
    lines.push("origin  <b>" + String(ip.origin || "—") + "</b>");
    lines.push("host    <b>" + String(ip.host || "—") + "</b>");
    if (ip.connection) {
      lines.push(
        "net     <b>" +
          (ip.connection.effectiveType || ip.connection.type || "?") +
          "</b>" +
          (ip.connection.rtt != null ? "  rtt <b>" + ip.connection.rtt + "ms</b>" : "") +
          (ip.connection.downlink != null
            ? "  ↓ <b>" + ip.connection.downlink + "Mb/s</b>"
            : "") +
          (ip.connection.saveData ? "  save-data" : "")
      );
    } else {
      lines.push("net     <b>Network Information API n/a</b>");
    }
    if (ip.webrtcLocal && ip.webrtcLocal.length) {
      lines.push(
        "local   <b>" +
          ip.webrtcLocal
            .map(function (c) {
              return c.ip + " (" + c.typ + ")";
            })
            .join(" · ") +
          "</b>"
      );
    } else {
      lines.push("local   <b>ICE pending…</b>  (host candidates for LAN bring-up)");
    }
    if (ip.storageEstimate) {
      lines.push(
        "storage <b>" +
          Math.round((ip.storageEstimate.usage || 0) / 1048576) +
          " / " +
          Math.round((ip.storageEstimate.quota || 0) / 1048576) +
          " MB</b>"
      );
    }
    lines.push(
      "ctx     isolated=<b>" +
        (ip.crossOriginIsolated ? "yes" : "no") +
        "</b>  hw=<b>" +
        (ip.hardwareConcurrency || "?") +
        "</b>"
    );
    ipPanelEl.innerHTML = lines.join("\n");
  }

  function paintPopupPanel() {
    if (!popupPanelEl) return;
    var p = state.popup;
    var last = (p.log || []).slice(-6).reverse();
    var lines = [];
    lines.push(
      "POPUP mitigation  <b>" +
        (p.enabled ? "ON" : "OFF") +
        "</b>  blocked <b>" +
        p.blocked +
        "</b>  allowed <b>" +
        p.allowed +
        "</b>"
    );
    if (!last.length) {
      lines.push("log empty · window.open + dialog flood + _blank harden");
    } else {
      last.forEach(function (e) {
        lines.push(
          (e.blocked ? "⛔ " : "✓ ") +
            String(e.via || "") +
            " · " +
            String(e.url || "").slice(0, 56)
        );
      });
    }
    popupPanelEl.innerHTML = lines.join("\n");
  }

  function paintStatus() {
    if (!statusEl) return;
    var s = state.summary;
    statusEl.textContent = s
      ? VER +
        " · " +
        s.n +
        " hops · avg " +
        s.avgMs +
        "ms" +
        (s.best ? " · best " + s.best.label + " " + s.best.ms + "ms" : "") +
        (s.worst ? " · worst " + s.worst.label + " " + s.worst.ms + "ms" : "")
      : VER + " · KeyCDN-style flow · ready";
  }

  function paintAll() {
    drawGraph();
    paintHopTable();
    paintIpPanel();
    paintPopupPanel();
    paintStatus();
  }

  function exportFlow() {
    var snap = {
      ver: VER,
      t: Date.now(),
      summary: state.summary,
      hops: state.hops,
      edges: state.edges,
      knowledge: FLOW_KNOWLEDGE,
      ip: state.ip,
      popup: {
        enabled: state.popup.enabled,
        blocked: state.popup.blocked,
        allowed: state.popup.allowed,
        log: state.popup.log.slice(-40),
      },
    };
    try {
      var blob = new Blob([JSON.stringify(snap, null, 2)], {
        type: "application/json",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "mg-gt-flow-" + Date.now() + ".json";
      a.click();
      log("ok", VER + " · flow export");
    } catch (e) {
      log("err", "export fail");
    }
    return snap;
  }

  function embedInto(host) {
    if (!host) return false;
    ensureCss();
    installPopupGuard();
    embedRoot = host;
    host.innerHTML = "";
    host.id = host.id || "mg-gt-flow-host";
    var root = document.createElement("div");
    root.id = "mg-gt-flow-root";

    var hd = document.createElement("div");
    hd.className = "gtf-hd";
    function btn(label, cls, fn) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (cls) b.className = cls;
      b.onclick = function (ev) {
        if (ev) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        fn();
      };
      hd.appendChild(b);
      return b;
    }
    btn("SPEED", "hot", function () {
      runSpeedTest({}, function () {});
    });
    btn("IP", "ok", function () {
      collectIpTools();
      paintIpPanel();
    });
    var popBtn = btn(
      state.popup.enabled ? "POPUP ON" : "POPUP OFF",
      state.popup.enabled ? "on warn" : "warn",
      function () {
        setPopupEnabled(!state.popup.enabled);
        popBtn.textContent = state.popup.enabled ? "POPUP ON" : "POPUP OFF";
        popBtn.className = state.popup.enabled ? "on warn" : "warn";
      }
    );
    btn("EXPORT", "", function () {
      exportFlow();
    });
    btn("CLEAR", "", function () {
      state.hops = [];
      state.edges = [];
      state.summary = null;
      paintAll();
    });
    root.appendChild(hd);

    var know = document.createElement("div");
    know.id = "mg-gt-flow-know";
    FLOW_KNOWLEDGE.forEach(function (k) {
      var s = document.createElement("span");
      s.style.borderLeft = "3px solid " + kindColor(k.kind);
      s.textContent = k.label;
      s.title = k.note;
      know.appendChild(s);
    });
    root.appendChild(know);

    var legend = document.createElement("div");
    legend.id = "mg-gt-flow-legend";
    [
      [40, "<40ms"],
      [80, "40–100"],
      [180, "100–250"],
      [400, "250–600"],
      [900, ">600"],
    ].forEach(function (pair) {
      var sp = document.createElement("span");
      sp.innerHTML =
        "<i style=\"background:" + latColor(pair[0]) + "\"></i>" + pair[1];
      legend.appendChild(sp);
    });
    root.appendChild(legend);

    canvasEl = document.createElement("canvas");
    canvasEl.id = "mg-gt-flow-cv";
    canvasEl.setAttribute("aria-label", "GT hop flow giraph");
    root.appendChild(canvasEl);

    hopTableEl = document.createElement("div");
    hopTableEl.id = "mg-gt-flow-table";
    root.appendChild(hopTableEl);

    ipPanelEl = document.createElement("div");
    ipPanelEl.id = "mg-gt-flow-ip";
    root.appendChild(ipPanelEl);

    popupPanelEl = document.createElement("div");
    popupPanelEl.id = "mg-gt-flow-popup";
    root.appendChild(popupPanelEl);

    statusEl = document.createElement("div");
    statusEl.id = "mg-gt-flow-status";
    root.appendChild(statusEl);

    host.appendChild(root);
    collectIpTools();
    paintAll();
    startAnim();
    /* auto first probe lightly after embed */
    setTimeout(function () {
      if (!state.hops.length && !state.running) runSpeedTest({});
    }, 400);
    return true;
  }

  /* boot guard early so popups are mitigated even before GT opens */
  installPopupGuard();

  window.__mgGtFlow = {
    ver: VER,
    state: state,
    knowledge: FLOW_KNOWLEDGE,
    runSpeedTest: runSpeedTest,
    collectIpTools: collectIpTools,
    setPopupEnabled: setPopupEnabled,
    exportFlow: exportFlow,
    embedInto: embedInto,
    paint: paintAll,
    latColor: latColor,
    report: function () {
      var s = state.summary;
      return (
        VER +
        " hops=" +
        (state.hops.length || 0) +
        (s ? " avg=" + s.avgMs + "ms" : "") +
        " popup=" +
        (state.popup.enabled ? "on" : "off") +
        " blk=" +
        state.popup.blocked
      );
    },
  };

  log("ok", VER + " · flow plane ready (speed · giraph · ip · popup)");
})();
