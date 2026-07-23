/* Memory Glass · Live Collab Hub
 * 1) DRAW strokes stream into Agent Desk chat + Grok term (on the fly)
 * 2) Cursor-style element PICK — hover site structure, assess nodes, pin to desk
 * VER: mg-live-collab-v1
 */
(function () {
  "use strict";
  var VER = "mg-live-collab-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._liveCollabVer === VER) return;
  HP._liveCollabVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "collab-live");
    } catch (e) {}
  }

  var state = {
    ver: VER,
    pick: false,
    lastEl: null,
    lastAssess: null,
    strokeN: 0,
    pinned: [],
  };

  var box = null;
  var tip = null;
  var fab = null;
  var bc = null;
  try {
    bc = new BroadcastChannel("mg-annotate");
  } catch (eB) {
    bc = null;
  }

  /* ── fan-out to desk + term + bus ── */
  function desk() {
    return window.__mgAgentDesk || null;
  }
  function term() {
    return window.__mgGrokTerm || window.__mgQbitTerm || null;
  }
  function bus() {
    return window.__mgQbitBus || null;
  }

  function toDesk(role, text, meta) {
    var D = desk();
    if (!D) return false;
    try {
      if (!D.state || !D.state.open) {
        if (D.open) D.open();
      }
      if (D.pushLog) D.pushLog(role || "sys", text, meta || null);
      return true;
    } catch (e) {
      return false;
    }
  }

  function toTerm(line) {
    try {
      var T = term();
      if (T && T.push) {
        T.push("ok", String(line || ""));
        return true;
      }
      if (T && T.writeln) {
        T.writeln(String(line || ""));
        return true;
      }
      if (window.__mgGrokTerm && window.__mgGrokTerm.append) {
        window.__mgGrokTerm.append(String(line || ""));
        return true;
      }
    } catch (e) {}
    return false;
  }

  function toBus(kind, payload) {
    try {
      var B = bus();
      if (B && B.publish) {
        B.publish({
          src: "live-collab",
          kind: kind || "annotate",
          lane: "L3",
          prefix: "0:",
          payload: payload || {},
          fleet: { role: "collab", host: "mg" },
        });
      }
    } catch (e) {}
    try {
      if (bc)
        bc.postMessage({
          v: 1,
          t: kind || "event",
          id: "collab-hub",
          payload: payload || {},
          ts: Date.now(),
        });
    } catch (e2) {}
  }

  function fan(role, text, meta) {
    toDesk(role, text, meta);
    toTerm("[" + (role || "sys") + "] " + text);
    toBus("chat", { role: role, text: text, meta: meta || null });
  }

  /* ── element assessment (Cursor-style structure read) ── */
  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    var parts = [];
    var cur = el;
    var depth = 0;
    while (cur && cur.nodeType === 1 && depth < 6 && cur !== document.documentElement) {
      var part = cur.tagName.toLowerCase();
      if (cur.id) {
        part += "#" + cur.id;
        parts.unshift(part);
        break;
      }
      var cls =
        cur.className && typeof cur.className === "string"
          ? cur.className
              .trim()
              .split(/\s+/)
              .filter(function (c) {
                return c && c.indexOf("mg-") !== 0;
              })
              .slice(0, 2)
              .join(".")
          : "";
      if (cls) part += "." + cls;
      var parent = cur.parentElement;
      if (parent) {
        var sibs = parent.children;
        var same = 0;
        var idx = 0;
        for (var i = 0; i < sibs.length; i++) {
          if (sibs[i].tagName === cur.tagName) {
            same++;
            if (sibs[i] === cur) idx = same;
          }
        }
        if (same > 1) part += ":nth-of-type(" + idx + ")";
      }
      parts.unshift(part);
      cur = parent;
      depth++;
    }
    return parts.join(" > ");
  }

  function isMgChrome(el) {
    if (!el || !el.closest) return false;
    try {
      return !!(
        el.closest("#mg-root") ||
        el.closest("#mg-rec-chip") ||
        el.closest("#mg-agent-desk") ||
        el.closest("#mg-annotate-toolbar") ||
        el.closest("#mg-mini-draw-tb") ||
        el.closest("#mg-mini-draw-cv") ||
        el.closest("#mg-annotate-canvas") ||
        el.closest("#mg-pick-box") ||
        el.closest("#mg-pick-tip") ||
        el.closest("#mg-pick-fab") ||
        el.closest("#mg-live-collab-css") ||
        el.id && String(el.id).indexOf("mg-") === 0
      );
    } catch (e) {
      return false;
    }
  }

  function pageElFromPoint(x, y) {
    var list = [];
    try {
      list = document.elementsFromPoint(x, y) || [];
    } catch (e) {
      var one = document.elementFromPoint(x, y);
      if (one) list = [one];
    }
    for (var i = 0; i < list.length; i++) {
      if (!isMgChrome(list[i])) return list[i];
    }
    return null;
  }

  function assess(el) {
    if (!el || el.nodeType !== 1) return null;
    var r = el.getBoundingClientRect();
    var cs = {};
    try {
      cs = window.getComputedStyle(el);
    } catch (e) {}
    var text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120);
    var role = el.getAttribute("role") || "";
    var href = el.href || el.getAttribute("href") || "";
    var type = (el.type || "") + "";
    var issues = [];
    if (cs.pointerEvents === "none") issues.push("pointer-events:none");
    if (parseFloat(cs.opacity || "1") < 0.15) issues.push("near-invisible opacity");
    if (r.width < 2 || r.height < 2) issues.push("zero/near-zero box");
    if (cs.position === "fixed" || cs.position === "sticky")
      issues.push(cs.position + " chrome-ish");
    var z = cs.zIndex;
    if (z && z !== "auto" && parseInt(z, 10) > 1000) issues.push("high z-index " + z);
    var color = cs.color || "";
    var bg = cs.backgroundColor || "";
    if (/rgba?\(255,\s*255,\s*255/i.test(color) && /rgba?\(255,\s*255,\s*255/i.test(bg))
      issues.push("white-on-white risk");
    var a = {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      className:
        el.className && typeof el.className === "string"
          ? el.className.trim().slice(0, 80)
          : "",
      role: role,
      href: href ? String(href).slice(0, 120) : "",
      type: type,
      text: text,
      path: cssPath(el),
      box: {
        x: Math.round(r.x),
        y: Math.round(r.y),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
      style: {
        display: cs.display,
        position: cs.position,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        fontSize: cs.fontSize,
        color: color,
        bg: bg,
      },
      issues: issues,
      url: location.href,
      title: document.title || "",
    };
    return a;
  }

  function formatAssess(a) {
    if (!a) return "(no element)";
    var lines = [];
    lines.push(
      a.tag +
        (a.id ? "#" + a.id : "") +
        (a.className ? "." + a.className.split(/\s+/)[0] : "") +
        " · " +
        a.box.w +
        "×" +
        a.box.h +
        " @(" +
        a.box.x +
        "," +
        a.box.y +
        ")"
    );
    if (a.path) lines.push("path: " + a.path);
    if (a.text) lines.push('text: "' + a.text + '"');
    if (a.href) lines.push("href: " + a.href);
    if (a.role) lines.push("role: " + a.role);
    lines.push(
      "css: display=" +
        a.style.display +
        " pos=" +
        a.style.position +
        " z=" +
        a.style.zIndex +
        " font=" +
        a.style.fontSize
    );
    if (a.issues && a.issues.length) lines.push("⚠ " + a.issues.join("; "));
    else lines.push("✓ no obvious layout flags");
    return lines.join("\n");
  }

  /* ── pick UI ── */
  function ensureCss() {
    if (document.getElementById("mg-live-collab-css")) return;
    var st = document.createElement("style");
    st.id = "mg-live-collab-css";
    st.textContent = [
      "#mg-pick-box{",
      "  position:fixed;z-index:2147483630;pointer-events:none;display:none;",
      "  border:2px solid rgba(96,165,250,0.95);",
      "  background:rgba(59,130,246,0.12);",
      "  box-shadow:0 0 0 1px rgba(0,0,0,0.25),inset 0 0 0 1px rgba(255,255,255,0.15);",
      "  border-radius:4px;transition:top .04s,left .04s,width .04s,height .04s}",
      "#mg-pick-box.on{display:block}",
      "#mg-pick-tip{",
      "  position:fixed;z-index:2147483631;pointer-events:none;display:none;",
      "  max-width:min(420px,70vw);padding:8px 10px;border-radius:10px;",
      "  background:rgba(12,16,28,0.92);border:1px solid rgba(140,200,255,0.35);",
      "  color:#dce8ff;font:500 11px/1.35 ui-monospace,Menlo,monospace;",
      "  white-space:pre-wrap;box-shadow:0 12px 32px rgba(0,0,0,0.4)}",
      "#mg-pick-tip.on{display:block}",
      /* PICK lives in #mg-rec-chip (after BOARD) — hide orphan float */
      "#mg-pick-fab{display:none!important}",
      "html.mg-picking{cursor:crosshair!important}",
      "html.mg-picking #mg-mini-draw-cv,html.mg-picking #mg-annotate-canvas{",
      "  pointer-events:none!important}",
    ].join("");
    document.documentElement.appendChild(st);
  }

  function ensurePickUi() {
    ensureCss();
    if (!box) {
      box = document.createElement("div");
      box.id = "mg-pick-box";
      document.documentElement.appendChild(box);
    }
    if (!tip) {
      tip = document.createElement("div");
      tip.id = "mg-pick-tip";
      document.documentElement.appendChild(tip);
    }
  }

  function paintBox(el) {
    if (!box || !el) {
      if (box) box.classList.remove("on");
      if (tip) tip.classList.remove("on");
      return;
    }
    var r = el.getBoundingClientRect();
    box.style.left = Math.max(0, r.left - 2) + "px";
    box.style.top = Math.max(0, r.top - 2) + "px";
    box.style.width = Math.max(0, r.width + 4) + "px";
    box.style.height = Math.max(0, r.height + 4) + "px";
    box.classList.add("on");
    if (tip && state.lastAssess) {
      tip.textContent = formatAssess(state.lastAssess).slice(0, 500);
      var tx = Math.min(window.innerWidth - 280, Math.max(8, r.left));
      var ty = r.bottom + 8;
      if (ty + 120 > window.innerHeight) ty = Math.max(8, r.top - 130);
      tip.style.left = tx + "px";
      tip.style.top = ty + "px";
      tip.classList.add("on");
    }
  }

  function onPickMove(e) {
    if (!state.pick) return;
    var el = pageElFromPoint(e.clientX, e.clientY);
    if (!el || el === state.lastEl) {
      if (el) paintBox(el);
      return;
    }
    state.lastEl = el;
    state.lastAssess = assess(el);
    paintBox(el);
  }

  function onPickClick(e) {
    if (!state.pick) return;
    e.preventDefault();
    e.stopPropagation();
    var el = pageElFromPoint(e.clientX, e.clientY);
    if (!el) return;
    var a = assess(el);
    state.lastAssess = a;
    state.lastEl = el;
    state.pinned.push(a);
    if (state.pinned.length > 40) state.pinned = state.pinned.slice(-40);
    paintBox(el);
    var msg = "PICK · " + formatAssess(a);
    fan("sys", msg.slice(0, 700), { kind: "pick", assess: a });
    toBus("pick", { assess: a });
    /* diagnose line for agent */
    var diag = diagnose(a);
    if (diag) fan("ai", diag, { kind: "diagnose", assess: a });
  }

  function diagnose(a) {
    if (!a) return "";
    var bits = [];
    bits.push("Structure read on " + (a.url || location.hostname) + ".");
    bits.push(
      "Node `" +
        a.tag +
        (a.id ? "#" + a.id : "") +
        "` is " +
        a.box.w +
        "×" +
        a.box.h +
        " at (" +
        a.box.x +
        "," +
        a.box.y +
        ")."
    );
    if (a.style.position === "fixed" || a.style.position === "sticky") {
      bits.push(
        "It's " +
          a.style.position +
          " — likely site chrome. MG row-3 should sit above it (pad + glass), not blend into it."
      );
    }
    if (a.issues && a.issues.length) {
      bits.push("Flags: " + a.issues.join("; ") + ".");
    }
    if (/nav|header|menu/i.test(a.path + " " + a.className + " " + a.tag)) {
      bits.push(
        "Looks like navigation. Prefer padding-top under MG chrome so site nav starts below CTRL/INSPECT."
      );
    }
    if (a.box.y < 120 && a.box.w > window.innerWidth * 0.5) {
      bits.push(
        "Full-width top band — high collision risk with MG three-row header (your DRAW marks)."
      );
    }
    bits.push("Path: " + (a.path || "?").slice(0, 160));
    return bits.join(" ");
  }

  function setPick(on) {
    ensurePickUi();
    state.pick = !!on;
    try {
      document.documentElement.classList.toggle("mg-picking", state.pick);
      document.documentElement.classList.toggle("mg-drawing", false);
    } catch (e) {}
    ensureFab();
    if (fab) fab.classList.toggle("on", state.pick);
    if (state.pick) {
      /* pause draw if open */
      try {
        if (window.__mgMiniDraw && window.__mgMiniDraw.isActive && window.__mgMiniDraw.isActive())
          window.__mgMiniDraw.deactivate();
        if (
          window.__mgSiteAnnotate &&
          window.__mgSiteAnnotate.isActive &&
          window.__mgSiteAnnotate.isActive()
        )
          window.__mgSiteAnnotate.deactivate();
      } catch (e2) {}
      document.addEventListener("mousemove", onPickMove, true);
      document.addEventListener("click", onPickClick, true);
      fan(
        "sys",
        "PICK on · hover site structure · click to pin assessment into this desk (Cursor-style)"
      );
    } else {
      document.removeEventListener("mousemove", onPickMove, true);
      document.removeEventListener("click", onPickClick, true);
      if (box) box.classList.remove("on");
      if (tip) tip.classList.remove("on");
      state.lastEl = null;
      fan("sys", "PICK off");
    }
  }

  function togglePick() {
    setPick(!state.pick);
  }

  /* ── DRAW live bridge ── */
  function onStroke(stroke, meta) {
    state.strokeN++;
    var n = state.strokeN;
    var pts = (stroke && stroke.pts) || (stroke && stroke.points) || [];
    var last = pts.length ? pts[pts.length - 1] : null;
    var mid = pts.length ? pts[Math.floor(pts.length / 2)] : null;
    var under = null;
    if (mid) under = pageElFromPoint(mid.x, mid.y);
    else if (last) under = pageElFromPoint(last.x, last.y);
    var a = under ? assess(under) : null;
    var line =
      "DRAW stroke #" +
      n +
      (pts.length ? " · " + pts.length + " pts" : "") +
      (last ? " → (" + Math.round(last.x) + "," + Math.round(last.y) + ")" : "");
    if (a) {
      line +=
        " · under " +
        a.tag +
        (a.id ? "#" + a.id : "") +
        (a.text ? ' "' + a.text.slice(0, 40) + '"' : "");
    }
    /* throttle desk spam: every stroke but short */
    toDesk("sys", line.slice(0, 280), { kind: "stroke", n: n, assess: a });
    toTerm(line);
    toBus("stroke", { n: n, stroke: stroke, assess: a, meta: meta || null });
    if (a && (n === 1 || n % 3 === 0)) {
      var d = diagnose(a);
      if (d) toDesk("ai", d.slice(0, 400), { kind: "diagnose-live", assess: a });
    }
  }

  function onFix(packet) {
    fan(
      "sys",
      "FIX packet live · " +
        (packet && packet.strokes != null ? packet.strokes + " strokes" : "marks") +
        " · " +
        location.hostname,
      { kind: "fix", packet: packet || null }
    );
    if (packet && packet.md) {
      toDesk("you", (packet.note || "see DRAW marks").slice(0, 200));
      toDesk("ai", String(packet.md).slice(0, 600));
    }
  }

  function onDrawToggle(on) {
    fan("sys", on ? "DRAW live · strokes stream here · PICK for structure" : "DRAW off");
    if (on && state.pick) setPick(false);
  }

  /* ── public API ── */
  function ensureFab() {
    ensureCss();
    /* Prefer rec-chip #mg-rec-pick; sync .on state if present */
    fab = document.getElementById("mg-rec-pick") || document.getElementById("mg-pick-fab");
    if (fab) {
      fab.classList.toggle("on", state.pick);
    }
  }

  /* Listen annotate BC from other seats */
  if (bc) {
    bc.onmessage = function (ev) {
      try {
        var d = ev.data;
        if (!d || d.id === "collab-hub") return;
        if (d.t === "stroke" || d.t === "stroke-live") {
          toDesk("peer", "remote stroke · " + (d.id || "peer"), { remote: true });
        } else if (d.t === "fix") {
          toDesk("peer", "remote FIX · " + ((d.payload && d.payload.note) || ""), d.payload);
        } else if (d.t === "pick") {
          toDesk("peer", "remote PICK", d.payload);
        }
      } catch (e) {}
    };
  }

  /* Hook desk commands when available */
  function hookDesk() {
    var D = desk();
    if (!D || D._collabHooked) return;
    D._collabHooked = true;
    var orig = D.runLine || D.run;
    if (!orig) return;
    D.run = D.runLine = function (raw) {
      var line = String(raw || "").trim();
      var low = line.toLowerCase();
      if (low === "/pick" || low === "/probe") {
        togglePick();
        return "PICK " + (state.pick ? "on" : "off");
      }
      if (low === "/pick off" || low === "/probe off") {
        setPick(false);
        return "PICK off";
      }
      if (low.indexOf("/assess") === 0) {
        if (state.lastAssess) {
          fan("sys", formatAssess(state.lastAssess));
          fan("ai", diagnose(state.lastAssess));
          return "re-assessed last pick";
        }
        return "no pick yet — /pick then click an element";
      }
      if (low === "/drawlink" || low === "/live") {
        fan(
          "sys",
          "Live link ON · DRAW strokes + PICK assessments stream into this desk + term"
        );
        return "live collab " + VER;
      }
      return orig.call(D, raw);
    };
  }

  setTimeout(hookDesk, 400);
  setTimeout(hookDesk, 1200);
  setTimeout(ensureFab, 500);

  window.__mgLiveCollab = {
    ver: VER,
    fan: fan,
    toDesk: toDesk,
    toTerm: toTerm,
    onStroke: onStroke,
    onFix: onFix,
    onDrawToggle: onDrawToggle,
    pick: setPick,
    togglePick: togglePick,
    isPicking: function () {
      return state.pick;
    },
    assess: assess,
    lastAssess: function () {
      return state.lastAssess;
    },
    pinned: function () {
      return state.pinned.slice();
    },
    diagnose: diagnose,
    formatAssess: formatAssess,
    report: function () {
      return (
        VER +
        " pick=" +
        state.pick +
        " strokes=" +
        state.strokeN +
        " pinned=" +
        state.pinned.length +
        " desk=" +
        !!desk()
      );
    },
  };

  log(VER + " · DRAW↔DESK live · PICK structure assess");
})();
