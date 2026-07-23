/* Memory Glass · Site Annotate (DRAW)
 * Bottom-left FAB → fullscreen canvas over the live page (nterminal screenAnnotate +
 * term-snap FIX packet). Strokes broadcast live over mg-annotate BC + qbit bus so
 * Grok / peer seats see marks and ship on-the-fly fixes.
 * VER: mg-site-annotate-v3-live
 */
(function () {
  "use strict";
  var VER = "mg-site-annotate-v3-live";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._siteAnnotateVer === VER) return;
  HP._siteAnnotateVer = VER;

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "draw");
    } catch (e) {}
  }

  var seatId = "draw-" + Math.random().toString(36).slice(2, 8);
  try {
    var stored = localStorage.getItem("mg.mesh.seat");
    if (stored) seatId = "draw-" + String(stored).slice(0, 10);
  } catch (eS) {}

  var COLORS = ["#f87171", "#c9a84c", "#34d399", "#22d3ee", "#c084fc", "#ffffff"];
  var state = {
    ver: VER,
    active: false,
    tool: "pen",
    color: COLORS[0],
    lineWidth: 2.5,
    strokes: [],
    remoteStrokes: [],
    current: null,
    regions: [],
    annotationId: 0,
    chat: [],
    live: true,
    peers: {},
  };

  var canvas = null;
  var ctx = null;
  var toolbar = null;
  var chatPanel = null;
  var chatLog = null;
  var fab = null;
  var bc = null;
  var mesh = null;

  try {
    bc = new BroadcastChannel("mg-annotate");
  } catch (eB) {
    bc = null;
  }
  try {
    mesh = new BroadcastChannel("mg-mesh");
  } catch (eM) {
    mesh = null;
  }

  function bus() {
    return window.__mgQbitBus || null;
  }

  function pub(kind, payload) {
    var B = bus();
    if (!B || !B.publish) return null;
    try {
      return B.publish({
        src: "site-annotate",
        kind: kind || "annotate",
        lane: "L3",
        prefix: "0:",
        withGlyph: true,
        payload: Object.assign(
          { seat: seatId, url: location.href, ver: VER },
          payload || {}
        ),
        fleet: { role: "annotate", host: "mg" },
      });
    } catch (e) {
      return null;
    }
  }

  function broadcast(type, payload) {
    var msg = {
      v: 1,
      t: type || "stroke",
      id: seatId,
      url: location.href,
      payload: payload || {},
      ts: Date.now(),
    };
    try {
      if (bc) bc.postMessage(msg);
    } catch (e) {}
    try {
      if (mesh) {
        mesh.postMessage({
          v: 2,
          t: "annotate",
          id: seatId,
          role: "annotate",
          payload: { type: type, data: payload || {}, url: location.href },
          ts: msg.ts,
        });
      }
    } catch (e2) {}
    return msg;
  }

  function ensureCss() {
    if (document.getElementById("mg-annotate-css")) return;
    var st = document.createElement("style");
    st.id = "mg-annotate-css";
    st.textContent = [
      /* FAB lives in #mg-rec-chip; orphan float only as rare fallback (hidden when rec present) */
      "#mg-draw-fab{display:none!important}",
      "#mg-rec-chip #mg-rec-draw.on,#mg-draw-fab.on{border-color:rgba(248,113,113,0.85);color:#fecaca;",
      "  background:rgba(80,24,32,0.55)}",
      "#mg-annotate-canvas{",
      "  position:fixed;inset:0;z-index:2147483600;display:none;",
      "  cursor:crosshair;pointer-events:none;touch-action:none}",
      "#mg-annotate-canvas.on{display:block;pointer-events:auto}",
      "#mg-annotate-toolbar{",
      "  position:fixed;top:calc(12px + var(--mg-chrome-h,72px));left:50%;",
      "  transform:translateX(-50%);z-index:2147483601;display:none;",
      "  flex-direction:row;flex-wrap:wrap;gap:4px;align-items:center;",
      "  padding:6px 10px;max-width:94vw;",
      "  background:rgba(12,16,28,0.88);backdrop-filter:blur(24px);",
      "  -webkit-backdrop-filter:blur(24px);",
      "  border:1px solid rgba(248,113,113,0.28);border-radius:12px;",
      "  box-shadow:0 12px 40px rgba(0,0,0,0.4);pointer-events:auto;",
      "  font:600 11px/1 system-ui;color:rgba(236,242,250,0.92)}",
      "#mg-annotate-toolbar.on{display:flex}",
      "#mg-annotate-toolbar .ann-tool,#mg-annotate-toolbar .ann-act{",
      "  appearance:none;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(255,255,255,0.05);color:rgba(230,236,250,0.88);",
      "  font:650 12px/1 system-ui;padding:7px 9px;border-radius:8px;cursor:pointer}",
      "#mg-annotate-toolbar .ann-tool.active{border-color:rgba(248,113,113,0.7);",
      "  color:#fecaca;background:rgba(120,40,50,0.35)}",
      "#mg-annotate-toolbar .ann-act.fix{border-color:rgba(52,211,153,0.55);",
      "  color:#6ee7b7;background:rgba(16,80,50,0.35)}",
      "#mg-annotate-toolbar .ann-act.chat{border-color:rgba(140,200,255,0.45);",
      "  color:#9fd0ff}",
      "#mg-annotate-toolbar .ann-colors{display:flex;gap:4px;margin:0 4px}",
      "#mg-annotate-toolbar .ann-color{",
      "  width:16px;height:16px;border-radius:50%;cursor:pointer;",
      "  border:2px solid transparent;box-sizing:border-box}",
      "#mg-annotate-toolbar .ann-color.active{border-color:#fff;",
      "  box-shadow:0 0 0 1px rgba(0,0,0,0.4)}",
      "#mg-annotate-toolbar .ann-meta{font:500 10px/1 ui-monospace,Menlo,monospace;",
      "  color:rgba(180,200,220,0.75);margin:0 6px;max-width:28vw;overflow:hidden;",
      "  text-overflow:ellipsis;white-space:nowrap}",
      "#mg-annotate-chat{",
      "  position:fixed;right:16px;bottom:16px;z-index:2147483602;",
      "  width:min(360px,92vw);max-height:min(42vh,420px);display:none;",
      "  flex-direction:column;pointer-events:auto;",
      "  background:rgba(12,16,28,0.9);backdrop-filter:blur(28px);",
      "  border:1px solid rgba(140,190,255,0.28);border-radius:14px;",
      "  box-shadow:0 16px 48px rgba(0,0,0,0.45);overflow:hidden;",
      "  font:500 12px/1.4 system-ui;color:rgba(236,242,250,0.94)}",
      "#mg-annotate-chat.on{display:flex}",
      "#mg-annotate-chat .hd{padding:8px 12px;font:650 10px/1 system-ui;",
      "  letter-spacing:0.12em;text-transform:uppercase;color:rgba(160,210,255,0.9);",
      "  border-bottom:1px solid rgba(255,255,255,0.08);display:flex;",
      "  justify-content:space-between;align-items:center}",
      "#mg-annotate-chat .log{flex:1;min-height:120px;max-height:28vh;overflow:auto;",
      "  padding:8px 12px;font:500 11px/1.45 ui-monospace,Menlo,monospace}",
      "#mg-annotate-chat .msg{margin:0 0 8px}",
      "#mg-annotate-chat .role{font-weight:700;margin-right:6px}",
      "#mg-annotate-chat .role.you{color:rgba(180,255,200,0.9)}",
      "#mg-annotate-chat .role.sys{color:rgba(255,200,140,0.9)}",
      "#mg-annotate-chat .role.ai{color:rgba(180,200,255,0.95)}",
      "#mg-annotate-chat .role.peer{color:rgba(248,180,180,0.95)}",
      "#mg-annotate-chat .composer{display:flex;gap:6px;padding:8px 10px;",
      "  border-top:1px solid rgba(255,255,255,0.08)}",
      "#mg-annotate-chat input{flex:1;appearance:none;border:1px solid rgba(255,255,255,0.12);",
      "  background:rgba(0,0,0,0.28);color:inherit;border-radius:10px;padding:8px 10px;",
      "  font:500 12px/1.3 system-ui}",
      "#mg-annotate-chat button{appearance:none;border:1px solid rgba(140,200,255,0.4);",
      "  background:rgba(60,120,200,0.25);color:#b8d8ff;border-radius:10px;",
      "  font:650 10px/1 system-ui;letter-spacing:0.06em;padding:8px 12px;cursor:pointer}",
    ].join("");
    document.documentElement.appendChild(st);
  }

  function allStrokes() {
    return state.strokes.concat(state.remoteStrokes);
  }

  function redraw() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allStrokes().forEach(drawStroke);
    if (state.current) drawStroke(state.current);
  }

  function drawStroke(s) {
    if (!s || !ctx) return;
    if (s.type === "pen" || s.type === "eraser") {
      if (!s.points || s.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (var i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.strokeStyle = s.type === "eraser" ? "rgba(5,5,12,0.85)" : s.color;
      ctx.lineWidth = s.type === "eraser" ? 14 : s.width || state.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    } else if (s.type === "arrow") {
      var dx = s.ex - s.sx;
      var dy = s.ey - s.sy;
      var angle = Math.atan2(dy, dx);
      var len = Math.sqrt(dx * dx + dy * dy);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(s.ex, s.ey);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || state.lineWidth;
      ctx.lineCap = "round";
      ctx.stroke();
      var headLen = Math.min(16, len * 0.3);
      ctx.beginPath();
      ctx.moveTo(s.ex, s.ey);
      ctx.lineTo(
        s.ex - headLen * Math.cos(angle - 0.4),
        s.ey - headLen * Math.sin(angle - 0.4)
      );
      ctx.moveTo(s.ex, s.ey);
      ctx.lineTo(
        s.ex - headLen * Math.cos(angle + 0.4),
        s.ey - headLen * Math.sin(angle + 0.4)
      );
      ctx.stroke();
    } else if (s.type === "rect") {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width || state.lineWidth;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(s.sx, s.sy, s.ex - s.sx, s.ey - s.sy);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(248,113,113,0.06)";
      ctx.fillRect(s.sx, s.sy, s.ex - s.sx, s.ey - s.sy);
      if (s.label) {
        ctx.font = "bold 11px ui-monospace,Menlo,monospace";
        ctx.fillStyle = s.color;
        ctx.fillText(s.label, s.sx + 4, Math.min(s.sy, s.ey) - 4);
      }
    } else if (s.type === "text") {
      ctx.font = "bold 13px ui-monospace,Menlo,monospace";
      ctx.fillStyle = s.color;
      ctx.fillText(s.text || "", s.sx, s.sy);
    }
  }

  function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redraw();
  }

  function pt(e) {
    if (e.touches && e.touches[0]) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function compactStroke(s) {
    if (!s) return null;
    var o = {
      type: s.type,
      color: s.color,
      width: s.width,
      id: s.id,
      seat: s.seat || seatId,
      remote: !!s.remote,
    };
    if (s.points) {
      /* downsample long pens for live wire */
      var pts = s.points;
      if (pts.length > 48) {
        var step = Math.ceil(pts.length / 40);
        var slim = [];
        for (var i = 0; i < pts.length; i += step) slim.push(pts[i]);
        if (slim[slim.length - 1] !== pts[pts.length - 1]) slim.push(pts[pts.length - 1]);
        o.points = slim;
      } else {
        o.points = pts.slice();
      }
    }
    if (s.sx != null) {
      o.sx = s.sx;
      o.sy = s.sy;
      o.ex = s.ex;
      o.ey = s.ey;
    }
    if (s.text) o.text = s.text;
    if (s.label) o.label = s.label;
    return o;
  }

  function emitStroke(s, livePartial) {
    if (!state.live || !s) return;
    var payload = compactStroke(s);
    if (!payload) return;
    payload.partial = !!livePartial;
    broadcast(livePartial ? "stroke-live" : "stroke", payload);
    if (!livePartial) {
      pub("annotate", {
        event: "stroke",
        stroke: payload,
        n: state.strokes.length,
        regions: state.regions.length,
      });
    }
  }

  function domAt(x, y) {
    try {
      var els = document.elementsFromPoint(x, y) || [];
      return els
        .filter(function (el) {
          if (!el || !el.tagName) return false;
          var id = el.id || "";
          if (id.indexOf("mg-annotate") === 0 || id === "mg-draw-fab") return false;
          return true;
        })
        .slice(0, 4)
        .map(function (el) {
          var tag = el.tagName.toLowerCase();
          var id = el.id ? "#" + el.id : "";
          var cls =
            el.className && typeof el.className === "string"
              ? "." + el.className.split(/\s+/)[0]
              : "";
          var text = (el.textContent || "").trim().substring(0, 60);
          return tag + id + cls + (text ? ' "' + text + '"' : "");
        })
        .join(" > ");
    } catch (e) {
      return "";
    }
  }

  function describe() {
    var lines = [];
    lines.push("Screen annotations on " + location.href);
    lines.push("title: " + (document.title || "(untitled)"));
    lines.push(
      "strokes: " +
        state.strokes.length +
        " local · " +
        state.remoteStrokes.length +
        " remote · regions: " +
        state.regions.length
    );
    state.regions.forEach(function (r) {
      lines.push(
        "Region #" +
          r.id +
          ": " +
          Math.round(r.w) +
          "×" +
          Math.round(r.h) +
          " @ (" +
          Math.round(r.x) +
          "," +
          Math.round(r.y) +
          ")"
      );
      var ctxDom = domAt(r.x + r.w / 2, r.y + r.h / 2);
      if (ctxDom) lines.push("  DOM: " + ctxDom);
    });
    var pens = state.strokes.filter(function (s) {
      return s.type === "pen";
    }).length;
    var arrows = state.strokes.filter(function (s) {
      return s.type === "arrow";
    }).length;
    var texts = state.strokes.filter(function (s) {
      return s.type === "text";
    });
    if (pens) lines.push("pen highlights: " + pens);
    if (arrows) lines.push("arrows: " + arrows);
    texts.forEach(function (t) {
      lines.push('label: "' + t.text + '" @ (' + Math.round(t.sx) + "," + Math.round(t.sy) + ")");
    });
    return lines.join("\n");
  }

  function buildFixPacket(note) {
    var desc = describe();
    var md = [
      "# FIX packet · Memory Glass site annotate",
      "",
      "- **URL:** " + location.href,
      "- **Title:** " + (document.title || "(untitled)"),
      "- **Seat:** " + seatId,
      "- **When:** " + new Date().toISOString(),
      "- **Strokes:** " + state.strokes.length + " local / " + state.remoteStrokes.length + " remote",
      "- **Regions:** " + state.regions.length,
      "",
      "## What I marked",
      "",
      "```",
      desc,
      "```",
      "",
      "## Ask Grok",
      "",
      note
        ? note
        : "See the live annotations on this page. Collaborate: describe the issues, propose CSS/DOM/layout fixes, and apply changes on the fly where possible.",
      "",
      "## Action",
      "",
      "1. Treat marks as ground truth (red/yellow/green = priority by color if present).",
      "2. Prefer surgical hotpipe / CSS / product fixes over rewrites.",
      "3. Reply with concrete diffs or inject-ready snippets.",
      "",
      "— shipped from " + VER,
      "",
    ].join("\n");
    return {
      md: md,
      description: desc,
      url: location.href,
      title: document.title || "",
      strokes: state.strokes.length,
      regions: state.regions.slice(),
      note: note || "",
      ts: Date.now(),
      seat: seatId,
      ver: VER,
    };
  }

  function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(
          function () {
            return true;
          },
          function () {
            return false;
          }
        );
      }
    } catch (e) {}
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Promise.resolve(!!ok);
    } catch (e2) {
      return Promise.resolve(false);
    }
  }

  function shipFix(note) {
    var packet = buildFixPacket(note);
    pub("fix", {
      event: "annotate-fix",
      packet: {
        url: packet.url,
        title: packet.title,
        strokes: packet.strokes,
        regions: packet.regions.length,
        note: packet.note,
        description: packet.description.slice(0, 1200),
      },
    });
    broadcast("fix", {
      url: packet.url,
      note: packet.note,
      strokes: packet.strokes,
      regions: packet.regions.length,
      description: packet.description.slice(0, 800),
    });
    copyText(packet.md).then(function (ok) {
      addChat(
        "sys",
        ok
          ? "FIX packet on clipboard · paste into Grok / desk"
          : "FIX packet built (clipboard blocked)"
      );
    });
    try {
      if (window.__mgAgentDesk) {
        if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
        if (window.__mgAgentDesk.pushLog) {
          window.__mgAgentDesk.pushLog(
            "sys",
            "DRAW FIX · " +
              packet.strokes +
              " strokes · " +
              packet.regions.length +
              " regions · " +
              location.hostname
          );
          window.__mgAgentDesk.pushLog("you", packet.note || "fix on-the-fly from site annotate");
          window.__mgAgentDesk.pushLog("ai", packet.description.slice(0, 400));
        }
        if (window.__mgAgentDesk.run) {
          window.__mgAgentDesk.run(
            "/verify annotate fix " + location.hostname + " · " + (packet.note || "see marks").slice(0, 80)
          );
        }
      }
    } catch (eD) {}
    try {
      var T = window.__mgQbitTruss;
      if (T && T.handoff) {
        T.handoff({
          product: "memory-glass",
          to: "grok-fix",
          summary: "site annotate FIX · " + location.hostname,
          prompt: packet.md.slice(0, 2400),
        });
      }
    } catch (eT) {}
    log("FIX shipped · strokes=" + packet.strokes);
    return packet;
  }

  function addChat(role, text) {
    var row = { role: role, text: String(text || "").slice(0, 600), t: Date.now() };
    state.chat.push(row);
    if (state.chat.length > 80) state.chat = state.chat.slice(-80);
    if (!chatLog) return;
    var div = document.createElement("div");
    div.className = "msg";
    div.innerHTML =
      '<span class="role ' +
      role +
      '">' +
      role +
      "</span>" +
      escapeHtml(row.text);
    chatLog.appendChild(div);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function askCollab(question) {
    var q = String(question || "").trim();
    if (!q) return;
    addChat("you", q);
    var packet = buildFixPacket(q);
    broadcast("ask", { question: q, description: packet.description.slice(0, 600) });
    pub("annotate", { event: "ask", question: q, description: packet.description.slice(0, 800) });
    try {
      if (window.__mgAgentDesk) {
        if (window.__mgAgentDesk.open) window.__mgAgentDesk.open();
        if (window.__mgAgentDesk.pushLog) {
          window.__mgAgentDesk.pushLog("sys", "DRAW collab ask");
          window.__mgAgentDesk.pushLog("you", q);
          window.__mgAgentDesk.pushLog("ai", packet.description.slice(0, 350));
        }
        if (window.__mgAgentDesk.run) {
          window.__mgAgentDesk.run(
            (state.tool === "rect" ? "/build " : "/verify ") +
              "site annotate: " +
              q.slice(0, 120) +
              " · " +
              location.hostname
          );
        }
      }
    } catch (e) {}
    copyText(
      "COLLAB DRAW · " + location.href + "\n\n" + packet.description + "\n\nUser: " + q
    );
    addChat(
      "sys",
      "Shared with bus + desk · FIX text on clipboard. Grok can apply fixes live."
    );
    /* Heuristic local reply so the loop feels alive without cloud */
    var hint = localHint(q, packet);
    if (hint) addChat("ai", hint);
  }

  function localHint(q, packet) {
    var lower = (q + " " + packet.description).toLowerCase();
    if (/header|chrome|ctrl|inspect|row|overlap|cover|obscur/.test(lower)) {
      return "Likely chrome stacking — check mg-chrome-tokens three-row + pinShellControls; keep CTRL/INSPECT on row3 only.";
    }
    if (/lag|slow|jank|fps|perf/.test(lower)) {
      return "Perf: reduce float redraws (float-layout), throttle bus high-rate kinds, pause webgrid when idle.";
    }
    if (/button|click|z-index|pointer/.test(lower)) {
      return "Hit-target: raise z-index of the marked control or drop a blocking overlay (annotate canvas is off when DRAW closed).";
    }
    if (/color|contrast|text/.test(lower)) {
      return "Visual: increase contrast on marked nodes; glass underlay on light sites if chrome falls into page.";
    }
    if (packet.regions.length) {
      return (
        "You marked " +
        packet.regions.length +
        " region(s). Ship FIX (green) so peers get clipboard packet + desk verify lane."
      );
    }
    return "Marks live on mg-annotate channel. Ship FIX or keep drawing — peers see strokes as you lift the pen.";
  }

  function syncChip() {
    try {
      var btn = document.getElementById("mg-rec-draw");
      if (btn) btn.classList.toggle("on", !!state.active);
      if (fab) fab.classList.toggle("on", !!state.active);
    } catch (e) {}
  }

  function activate() {
    ensureUi();
    state.active = true;
    try {
      document.documentElement.classList.add("mg-drawing");
    } catch (eD) {}
    if (canvas) canvas.classList.add("on");
    if (toolbar) toolbar.classList.add("on");
    syncChip();
    resize();
    updateMeta();
    broadcast("presence", { active: true });
    pub("annotate", { event: "on" });
    addChat("sys", "DRAW on · pen over page · peers see live strokes · ⌘⇧A / Esc");
    log("annotate ON");
  }

  function deactivate() {
    state.active = false;
    state.current = null;
    try {
      document.documentElement.classList.remove("mg-drawing");
    } catch (eD) {}
    if (canvas) canvas.classList.remove("on");
    if (toolbar) toolbar.classList.remove("on");
    if (chatPanel) chatPanel.classList.remove("on");
    syncChip();
    broadcast("presence", { active: false });
    pub("annotate", { event: "off" });
    log("annotate OFF");
  }

  function toggle() {
    if (state.active) deactivate();
    else activate();
  }

  function clearAll(localOnly) {
    state.strokes = [];
    state.regions = [];
    if (!localOnly) state.remoteStrokes = [];
    state.current = null;
    redraw();
    if (!localOnly) {
      broadcast("clear", {});
      pub("annotate", { event: "clear" });
    }
  }

  function undo() {
    var s = state.strokes.pop();
    if (s && s.id) {
      state.regions = state.regions.filter(function (r) {
        return r.id !== s.id;
      });
    }
    redraw();
    updateMeta();
    broadcast("undo", { id: s && s.id });
  }

  function updateMeta() {
    if (!toolbar) return;
    var meta = toolbar.querySelector(".ann-meta");
    if (!meta) return;
    var peerN = Object.keys(state.peers).length;
    meta.textContent =
      state.strokes.length +
      "·" +
      state.remoteStrokes.length +
      " r" +
      state.regions.length +
      (peerN ? " · peers " + peerN : "") +
      " · " +
      (location.hostname || "page");
  }

  function onPointerDown(e) {
    if (!state.active) return;
    e.preventDefault();
    var p = pt(e);
    if (state.tool === "pen" || state.tool === "eraser") {
      state.current = {
        type: state.tool,
        color: state.color,
        width: state.lineWidth,
        points: [{ x: p.x, y: p.y }],
        seat: seatId,
      };
    } else if (state.tool === "arrow" || state.tool === "rect") {
      state.current = {
        type: state.tool,
        color: state.color,
        width: state.lineWidth,
        sx: p.x,
        sy: p.y,
        ex: p.x,
        ey: p.y,
        seat: seatId,
      };
    } else if (state.tool === "text") {
      var label = window.prompt("Annotation label:");
      if (label) {
        var t = {
          type: "text",
          color: state.color,
          sx: p.x,
          sy: p.y,
          text: label,
          id: ++state.annotationId,
          seat: seatId,
        };
        state.strokes.push(t);
        redraw();
        emitStroke(t, false);
        updateMeta();
      }
    }
  }

  var liveTick = 0;
  function onPointerMove(e) {
    if (!state.current) return;
    e.preventDefault();
    var p = pt(e);
    if (state.current.type === "pen" || state.current.type === "eraser") {
      state.current.points.push({ x: p.x, y: p.y });
      liveTick++;
      if (liveTick % 4 === 0) emitStroke(state.current, true);
    } else {
      state.current.ex = p.x;
      state.current.ey = p.y;
      if (liveTick++ % 3 === 0) emitStroke(state.current, true);
    }
    redraw();
  }

  function onPointerUp(e) {
    if (!state.current) return;
    e.preventDefault();
    var p = pt(e);
    if (state.current.type === "rect" || state.current.type === "arrow") {
      state.current.ex = p.x;
      state.current.ey = p.y;
    }
    if (state.current.type === "rect") {
      var w = Math.abs(state.current.ex - state.current.sx);
      var h = Math.abs(state.current.ey - state.current.sy);
      if (w > 10 && h > 10) {
        state.current.id = ++state.annotationId;
        state.current.label = "R#" + state.annotationId;
        state.regions.push({
          id: state.current.id,
          x: Math.min(state.current.sx, state.current.ex),
          y: Math.min(state.current.sy, state.current.ey),
          w: w,
          h: h,
          color: state.current.color,
        });
      } else {
        state.current = null;
        redraw();
        return;
      }
    } else {
      state.current.id = state.current.id || ++state.annotationId;
    }
    if (
      (state.current.type === "pen" || state.current.type === "eraser") &&
      (!state.current.points || state.current.points.length < 2)
    ) {
      state.current = null;
      return;
    }
    state.strokes.push(state.current);
    emitStroke(state.current, false);
    state.current = null;
    redraw();
    updateMeta();
  }

  function applyRemoteStroke(payload, fromId, partial) {
    if (!payload || fromId === seatId) return;
    state.peers[fromId] = { id: fromId, ts: Date.now() };
    var s = Object.assign({}, payload, { remote: true, seat: fromId });
    if (partial) {
      /* keep one in-flight remote stroke per seat */
      state.remoteStrokes = state.remoteStrokes.filter(function (r) {
        return !(r.seat === fromId && r._live);
      });
      s._live = true;
      state.remoteStrokes.push(s);
    } else {
      state.remoteStrokes = state.remoteStrokes.filter(function (r) {
        return !(r.seat === fromId && r._live);
      });
      s._live = false;
      /* replace same id if any */
      if (s.id) {
        state.remoteStrokes = state.remoteStrokes.filter(function (r) {
          return !(r.id === s.id && r.seat === fromId);
        });
      }
      state.remoteStrokes.push(s);
      if (s.type === "rect" && s.id) {
        state.regions = state.regions.filter(function (r) {
          return !(r.id === s.id && r.seat === fromId);
        });
        state.regions.push({
          id: s.id,
          x: Math.min(s.sx, s.ex),
          y: Math.min(s.sy, s.ey),
          w: Math.abs(s.ex - s.sx),
          h: Math.abs(s.ey - s.sy),
          color: s.color,
          seat: fromId,
        });
      }
    }
    if (state.remoteStrokes.length > 200) {
      state.remoteStrokes = state.remoteStrokes.slice(-160);
    }
    if (state.active) redraw();
    updateMeta();
  }

  function onBcMsg(data) {
    if (!data || data.id === seatId) return;
    state.peers[data.id] = { id: data.id, ts: Date.now(), t: data.t };
    if (data.t === "stroke" || data.t === "stroke-live") {
      applyRemoteStroke(data.payload, data.id, data.t === "stroke-live");
    } else if (data.t === "clear") {
      state.remoteStrokes = [];
      if (state.active) redraw();
      addChat("peer", (data.id || "peer") + " cleared");
    } else if (data.t === "fix") {
      addChat(
        "peer",
        "FIX from " +
          (data.id || "peer") +
          " · " +
          ((data.payload && data.payload.note) || "marks")
      );
    } else if (data.t === "ask") {
      addChat(
        "peer",
        "ask: " + ((data.payload && data.payload.question) || "").slice(0, 120)
      );
    } else if (data.t === "presence") {
      updateMeta();
    }
  }

  if (bc) {
    bc.onmessage = function (ev) {
      try {
        onBcMsg(ev.data);
      } catch (e) {}
    };
  }
  if (mesh) {
    mesh.onmessage = function (ev) {
      try {
        var d = ev.data;
        if (!d || d.id === seatId) return;
        if (d.t === "annotate" && d.payload) {
          onBcMsg({
            id: d.id,
            t: d.payload.type || "stroke",
            payload: d.payload.data || d.payload,
          });
        }
      } catch (e) {}
    };
  }

  function ensureUi() {
    ensureCss();
    /* Entry lives on #mg-rec-draw (session-recorder chip). No second float FAB. */
    if (!fab) {
      fab = document.getElementById("mg-draw-fab");
      if (fab) fab.style.display = "none";
    }
    if (!canvas) {
      canvas = document.getElementById("mg-annotate-canvas");
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "mg-annotate-canvas";
        document.documentElement.appendChild(canvas);
      }
      ctx = canvas.getContext("2d");
      canvas.addEventListener("mousedown", onPointerDown);
      canvas.addEventListener("mousemove", onPointerMove);
      canvas.addEventListener("mouseup", onPointerUp);
      canvas.addEventListener("mouseleave", function () {
        if (state.current) onPointerUp({ preventDefault: function () {}, clientX: state.current.ex || 0, clientY: state.current.ey || 0 });
      });
      canvas.addEventListener("touchstart", onPointerDown, { passive: false });
      canvas.addEventListener("touchmove", onPointerMove, { passive: false });
      canvas.addEventListener("touchend", onPointerUp, { passive: false });
    }
    if (!toolbar) {
      toolbar = document.getElementById("mg-annotate-toolbar");
      if (!toolbar) {
        toolbar = document.createElement("div");
        toolbar.id = "mg-annotate-toolbar";
        toolbar.innerHTML =
          '<button class="ann-tool active" data-tool="pen" title="Pen">✎</button>' +
          '<button class="ann-tool" data-tool="arrow" title="Arrow">→</button>' +
          '<button class="ann-tool" data-tool="rect" title="Region">▢</button>' +
          '<button class="ann-tool" data-tool="text" title="Text">T</button>' +
          '<button class="ann-tool" data-tool="eraser" title="Eraser">⌫</button>' +
          '<div class="ann-colors">' +
          COLORS.map(function (c, i) {
            return (
              '<span class="ann-color' +
              (i === 0 ? " active" : "") +
              '" data-color="' +
              c +
              '" style="background:' +
              c +
              '"></span>'
            );
          }).join("") +
          "</div>" +
          '<button class="ann-act" data-act="undo" title="Undo">↩</button>' +
          '<button class="ann-act" data-act="clear" title="Clear">∅</button>' +
          '<button class="ann-act chat" data-act="chat" title="Collab chat">💬</button>' +
          '<button class="ann-act fix" data-act="fix" title="Ship FIX packet">FIX</button>' +
          '<button class="ann-act" data-act="close" title="Close">✕</button>' +
          '<span class="ann-meta">ready</span>';
        document.documentElement.appendChild(toolbar);
        toolbar.querySelectorAll(".ann-tool").forEach(function (btn) {
          btn.addEventListener("click", function () {
            toolbar.querySelectorAll(".ann-tool").forEach(function (b) {
              b.classList.remove("active");
            });
            btn.classList.add("active");
            state.tool = btn.getAttribute("data-tool") || "pen";
            if (canvas) {
              canvas.style.cursor =
                state.tool === "eraser"
                  ? "cell"
                  : state.tool === "text"
                    ? "text"
                    : "crosshair";
            }
          });
        });
        toolbar.querySelectorAll(".ann-color").forEach(function (el) {
          el.addEventListener("click", function () {
            toolbar.querySelectorAll(".ann-color").forEach(function (c) {
              c.classList.remove("active");
            });
            el.classList.add("active");
            state.color = el.getAttribute("data-color") || COLORS[0];
          });
        });
        toolbar.querySelectorAll(".ann-act").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var act = btn.getAttribute("data-act");
            if (act === "undo") undo();
            else if (act === "clear") clearAll(false);
            else if (act === "close") deactivate();
            else if (act === "chat") {
              if (chatPanel) chatPanel.classList.toggle("on");
              var inp = document.getElementById("mg-ann-chat-in");
              if (inp) inp.focus();
            } else if (act === "fix") {
              shipFix("");
            }
          });
        });
      }
    }
    if (!chatPanel) {
      chatPanel = document.getElementById("mg-annotate-chat");
      if (!chatPanel) {
        chatPanel = document.createElement("div");
        chatPanel.id = "mg-annotate-chat";
        chatPanel.innerHTML =
          '<div class="hd"><span>DRAW · collab</span><span id="mg-ann-chat-x" style="cursor:pointer;opacity:0.7">✕</span></div>' +
          '<div class="log" id="mg-ann-chat-log"></div>' +
          '<div class="composer"><input id="mg-ann-chat-in" placeholder="What should Grok fix?" />' +
          '<button type="button" id="mg-ann-chat-send">ASK</button></div>';
        document.documentElement.appendChild(chatPanel);
        chatLog = chatPanel.querySelector("#mg-ann-chat-log");
        var x = chatPanel.querySelector("#mg-ann-chat-x");
        if (x)
          x.onclick = function () {
            chatPanel.classList.remove("on");
          };
        var send = chatPanel.querySelector("#mg-ann-chat-send");
        var input = chatPanel.querySelector("#mg-ann-chat-in");
        function doSend() {
          if (!input) return;
          var v = input.value.trim();
          if (!v) return;
          input.value = "";
          askCollab(v);
        }
        if (send) send.onclick = doSend;
        if (input)
          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
              e.preventDefault();
              doSend();
            }
          });
      } else {
        chatLog = chatPanel.querySelector("#mg-ann-chat-log");
      }
    }
  }

  window.addEventListener("resize", function () {
    if (state.active) resize();
  });

  document.addEventListener(
    "keydown",
    function (e) {
      if (e.key === "Escape" && state.active) {
        e.preventDefault();
        deactivate();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        toggle();
      }
    },
    true
  );

  /* subscribe bus for remote fix echoes */
  try {
    if (bus() && bus().subscribe) {
      bus().subscribe("annotate", function (env) {
        try {
          if (!env || !env.payload || env.src === "site-annotate") return;
          if (env.payload.event === "stroke" && env.payload.stroke) {
            applyRemoteStroke(env.payload.stroke, env.payload.seat || env.src, false);
          }
        } catch (e) {}
      });
      bus().subscribe("fix", function (env) {
        try {
          if (!env || !env.payload) return;
          if (env.src === "site-annotate") return;
          addChat("peer", "bus FIX · " + ((env.payload.note || env.kind || "").toString().slice(0, 80)));
        } catch (e2) {}
      });
    }
  } catch (eSub) {}

  ensureUi();

  window.__mgSiteAnnotate = {
    ver: VER,
    activate: activate,
    deactivate: deactivate,
    toggle: toggle,
    isActive: function () {
      return state.active;
    },
    clear: function () {
      clearAll(false);
    },
    describe: describe,
    shipFix: shipFix,
    ask: askCollab,
    getStrokes: function () {
      return state.strokes.slice();
    },
    getRegions: function () {
      return state.regions.slice();
    },
    report: function () {
      return (
        VER +
        " active=" +
        state.active +
        " strokes=" +
        state.strokes.length +
        " remote=" +
        state.remoteStrokes.length +
        " regions=" +
        state.regions.length +
        " seat=" +
        seatId
      );
    },
  };

  /* nterminal-compatible alias */
  window.screenAnnotate = {
    activate: activate,
    deactivate: deactivate,
    isActive: function () {
      return state.active;
    },
    getStrokes: function () {
      return state.strokes.slice();
    },
    getRegions: function () {
      return state.regions.slice();
    },
    describe: describe,
    askAI: askCollab,
    clear: function () {
      clearAll(false);
    },
    snapshot: function () {
      return shipFix("snapshot");
    },
  };

  log(VER + " · DRAW in #mg-rec-chip · live BC mg-annotate");
})();
