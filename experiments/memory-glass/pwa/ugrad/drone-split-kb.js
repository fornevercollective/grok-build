/* Split keyboard · kbatch.ugrad.ai style
 * Halves mount under L/R stick columns; center free for terminal to floor
 * VER: drone-split-kb-v2-column
 */
(function (global) {
  "use strict";
  var VER = "drone-split-kb-v2-column";

  var LEFT = {
    rows: [
      ["1", "2", "3", "4", "5"],
      ["q", "w", "e", "r", "t"],
      ["a", "s", "d", "f", "g"],
      ["z", "x", "c", "v", "b"],
    ],
  };
  var RIGHT = {
    rows: [
      ["6", "7", "8", "9", "0"],
      ["y", "u", "i", "o", "p"],
      ["h", "j", "k", "l", ";"],
      ["n", "m", ",", ".", "/"],
    ],
  };

  var buf = "";
  var shift = false;
  var listeners = [];
  var roots = []; // {el, side}
  var bufEls = [];
  var visible = true;

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn({ type: type, data: data, buf: buf }); } catch (e) {}
    });
  }

  function push(ch) {
    if (shift && ch.length === 1) {
      ch = ch.toUpperCase();
      shift = false;
      paintShift();
    }
    buf += ch;
    syncBuf();
    emit("type", ch);
  }

  function backspace() {
    if (!buf.length) return;
    buf = buf.slice(0, -1);
    syncBuf();
    emit("backspace", null);
  }

  function enter() {
    var line = buf;
    emit("enter", line);
    try {
      if (global.WebgridDroneHud && WebgridDroneHud.hotpipe) {
        if (line.charAt(0) === "{") {
          try { WebgridDroneHud.hotpipe.ingest(JSON.parse(line)); } catch (e1) {}
        }
      }
      if (typeof global.log === "function") global.log("kb · " + (line || "↵"), "ev");
    } catch (e) {}
    buf = "";
    syncBuf();
  }

  function syncBuf() {
    var t = buf || "type · kbatch split · ↵ send · ` capture";
    bufEls.forEach(function (el) {
      if (el) el.textContent = t;
    });
  }

  function paintShift() {
    roots.forEach(function (r) {
      if (r.el) r.el.classList.toggle("shift-on", shift);
    });
  }

  function keyBtn(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "skb-key" + (cls ? " " + cls : "");
    b.textContent = label;
    b.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      fn();
      b.classList.add("hit");
      setTimeout(function () { b.classList.remove("hit"); }, 90);
    });
    return b;
  }

  function paintHalf(side, def) {
    var wrap = document.createElement("div");
    wrap.className = "skb-half skb-" + side;
    def.rows.forEach(function (row, ri) {
      var rowEl = document.createElement("div");
      rowEl.className = "skb-row" + (ri === 2 ? " home" : "") + (ri === 3 ? " bottom" : "");
      row.forEach(function (k) {
        rowEl.appendChild(keyBtn(k, "", function () { push(k); }));
      });
      wrap.appendChild(rowEl);
    });
    return wrap;
  }

  function paintMods(compact) {
    var mid = document.createElement("div");
    mid.className = "skb-mods" + (compact ? " compact" : "");
    mid.appendChild(keyBtn("⇧", "mod shift", function () {
      shift = !shift;
      paintShift();
    }));
    mid.appendChild(keyBtn("spc", "space", function () { push(" "); }));
    mid.appendChild(keyBtn("⌫", "mod", function () { backspace(); }));
    mid.appendChild(keyBtn("↵", "mod enter", function () { enter(); }));
    mid.appendChild(keyBtn("esc", "mod", function () {
      buf = "";
      syncBuf();
      emit("esc", null);
      try {
        if (global.WebgridDroneHud && WebgridDroneHud.arm)
          global.WebgridDroneHud.arm(false);
      } catch (e) {}
    }));
    return mid;
  }

  /** Mount left half under left stick, right under right stick */
  function mountColumns(leftHost, rightHost) {
    ensureCss();
    roots = [];
    bufEls = [];
    if (leftHost) {
      leftHost.innerHTML = "";
      var L = document.createElement("div");
      L.className = "drone-split-kb skb-col skb-col-l";
      L.innerHTML =
        '<div class="skb-top">' +
        '  <span class="skb-brand">L · <b>kbatch</b></span>' +
        '  <span class="skb-buf"></span>' +
        "</div>" +
        '<div class="skb-body-col"></div>';
      var bodyL = L.querySelector(".skb-body-col");
      bodyL.appendChild(paintHalf("left", LEFT));
      bodyL.appendChild(paintMods(true));
      leftHost.appendChild(L);
      roots.push({ el: L, side: "left" });
      bufEls.push(L.querySelector(".skb-buf"));
    }
    if (rightHost) {
      rightHost.innerHTML = "";
      var R = document.createElement("div");
      R.className = "drone-split-kb skb-col skb-col-r";
      R.innerHTML =
        '<div class="skb-top">' +
        '  <span class="skb-brand">R · <b>kbatch</b></span>' +
        '  <span class="skb-buf"></span>' +
        '  <a class="skb-link" href="https://kbatch.ugrad.ai/" target="_blank" rel="noopener">↗</a>' +
        '  <button type="button" class="skb-toggle" title="Hide">▾</button>' +
        "</div>" +
        '<div class="skb-body-col"></div>';
      var bodyR = R.querySelector(".skb-body-col");
      bodyR.appendChild(paintMods(true));
      bodyR.appendChild(paintHalf("right", RIGHT));
      rightHost.appendChild(R);
      roots.push({ el: R, side: "right" });
      bufEls.push(R.querySelector(".skb-buf"));
      var hide = R.querySelector(".skb-toggle");
      if (hide) hide.onclick = function () { setVisible(!visible); };
    }
    syncBuf();

    window.addEventListener("keydown", onKey);
    return roots;
  }

  function onKey(e) {
    if (!visible) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var capturing = roots.some(function (r) {
      return r.el && r.el.classList.contains("capture");
    });
    if (!capturing && !buf.length) {
      if (e.key === "`") {
        e.preventDefault();
        roots.forEach(function (r) {
          if (r.el) r.el.classList.toggle("capture");
        });
        syncBuf();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      buf = "";
      syncBuf();
      roots.forEach(function (r) {
        if (r.el) r.el.classList.remove("capture");
      });
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      enter();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      push(e.key);
    }
  }

  function setVisible(on) {
    visible = !!on;
    roots.forEach(function (r) {
      if (r.el) r.el.classList.toggle("hidden", !visible);
    });
    // also toggle host columns
    document.querySelectorAll(".skb-host").forEach(function (h) {
      h.classList.toggle("hidden", !visible);
    });
    emit("visibility", visible);
  }

  function ensureCss() {
    if (document.getElementById("drone-split-kb-css")) return;
    var st = document.createElement("style");
    st.id = "drone-split-kb-css";
    st.textContent = [
      "/* column split KB under sticks — not full-bleed */",
      ".skb-host{flex:0 0 auto;z-index:5;border-top:1px solid rgba(120,200,255,.16);",
      "  background:linear-gradient(180deg,rgba(6,10,18,.98),rgba(2,4,10,.99));",
      "  min-height:0}",
      ".skb-host.hidden,.drone-split-kb.hidden{display:none!important}",
      ".drone-split-kb.skb-col{padding:6px 8px 10px;font:600 12px/1 -apple-system,system-ui,sans-serif}",
      ".drone-split-kb.capture{box-shadow:inset 0 1px 0 rgba(10,132,255,.35)}",
      ".skb-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;",
      "  font:600 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.05em;color:rgba(180,200,220,.5)}",
      ".skb-brand b{color:#7ad0ff}",
      ".skb-buf{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "  color:rgba(200,230,255,.7);font-size:11px;letter-spacing:0}",
      ".skb-link{color:#7ad0ff;text-decoration:none}",
      ".skb-toggle{appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);",
      "  color:rgba(255,255,255,.7);border-radius:8px;min-height:26px;min-width:28px;padding:2px 6px;cursor:pointer}",
      ".skb-body-col{display:flex;flex-direction:column;gap:6px;align-items:stretch}",
      ".skb-col-l .skb-body-col{align-items:stretch}",
      ".skb-col-r .skb-body-col{align-items:stretch}",
      ".skb-half{display:flex;flex-direction:column;gap:4px;width:100%}",
      ".skb-row{display:flex;gap:4px;justify-content:center}",
      ".skb-col-l .skb-row{justify-content:center}",
      ".skb-col-r .skb-row{justify-content:center}",
      ".skb-row.home .skb-key{box-shadow:inset 0 0 0 1px rgba(120,220,160,.28)}",
      ".skb-key{",
      "  appearance:none;border:1px solid rgba(255,255,255,.12);",
      "  background:rgba(36,40,48,.75);color:rgba(244,246,250,.95);",
      "  font:600 12px/1 -apple-system,system-ui,sans-serif;",
      "  flex:1 1 0;min-width:0;min-height:34px;padding:0 4px;border-radius:9px;cursor:pointer;",
      "  box-shadow:inset 0 .5px 0 rgba(255,255,255,.12),0 2px 6px rgba(0,0,0,.25);",
      "  transition:background .08s,transform .06s}",
      ".skb-key:hover{background:rgba(255,255,255,.14)}",
      ".skb-key.hit,.skb-key:active{transform:scale(.94);background:rgba(10,132,255,.3)}",
      ".skb-mods{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}",
      ".skb-mods .skb-key{min-height:32px;font-size:11px}",
      ".skb-key.space{background:rgba(10,132,255,.14);border-color:rgba(10,132,255,.32);letter-spacing:.06em}",
      ".skb-key.enter{background:rgba(48,209,88,.16);border-color:rgba(48,209,88,.35)}",
      ".drone-split-kb.shift-on .skb-key.shift{background:rgba(255,190,50,.25);border-color:rgba(255,190,50,.45)}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  global.DroneSplitKb = {
    version: VER,
    mount: function (host) {
      // legacy single host: treat as left-only
      return mountColumns(host, null);
    },
    mountColumns: mountColumns,
    setVisible: setVisible,
    on: function (fn) { listeners.push(fn); },
    getBuffer: function () { return buf; },
    clear: function () { buf = ""; syncBuf(); },
  };
})(typeof window !== "undefined" ? window : globalThis);
