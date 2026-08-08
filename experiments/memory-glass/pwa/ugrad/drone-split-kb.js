/* Split keyboard · kbatch.ugrad.ai / Shadow Live style
 * Two-hand QWERTY · palm gap · type into drone terminal / hotpipe
 * VER: drone-split-kb-v1
 */
(function (global) {
  "use strict";
  var VER = "drone-split-kb-v1";

  // Physical path split (kbatch: same path, two hands)
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
  var el = null;
  var bufEl = null;
  var visible = true;

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try {
        fn({ type: type, data: data, buf: buf });
      } catch (e) {}
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
    // hotpipe / drone log
    try {
      if (global.WebgridDroneHud && WebgridDroneHud.hotpipe) {
        if (line.charAt(0) === "{" || line.charAt(0) === "/") {
          try {
            var j = JSON.parse(line);
            WebgridDroneHud.hotpipe.ingest(j);
          } catch (e1) {
            if (line.indexOf("/drone") === 0 || line.indexOf("/") === 0) {
              WebgridDroneHud.cmd &&
                WebgridDroneHud.cmd(line.replace(/^\/drone\s*/, "").trim() || "help");
            } else if (global.log) {
              /* main page log */
            }
          }
        }
      }
      if (typeof global.log === "function") {
        global.log("kb · " + (line || "↵"), "ev");
      }
    } catch (e) {}
    buf = "";
    syncBuf();
  }

  function syncBuf() {
    if (bufEl) bufEl.textContent = buf || "type · kbatch split path · ↵ send";
  }

  function paintShift() {
    if (!el) return;
    el.classList.toggle("shift-on", shift);
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
      setTimeout(function () {
        b.classList.remove("hit");
      }, 90);
    });
    return b;
  }

  function paintHalf(side, def) {
    var wrap = document.createElement("div");
    wrap.className = "skb-half skb-" + side;
    def.rows.forEach(function (row, ri) {
      var rowEl = document.createElement("div");
      rowEl.className = "skb-row";
      if (ri === 2) rowEl.classList.add("home");
      if (ri === 3) rowEl.classList.add("bottom");
      row.forEach(function (k) {
        rowEl.appendChild(
          keyBtn(k, "", function () {
            push(k);
          })
        );
      });
      wrap.appendChild(rowEl);
    });
    return wrap;
  }

  function mount(host) {
    if (!host) return null;
    ensureCss();
    el = document.createElement("div");
    el.id = "drone-split-kb";
    el.className = "drone-split-kb";
    el.innerHTML =
      '<div class="skb-top">' +
      '  <span class="skb-brand">SPLIT KB · <b>kbatch</b></span>' +
      '  <span class="skb-buf" id="skb-buf">type · kbatch split path · ↵ send</span>' +
      '  <a class="skb-link" href="https://kbatch.ugrad.ai/" target="_blank" rel="noopener">kbatch.ugrad.ai</a>' +
      '  <button type="button" class="skb-toggle" id="skb-hide" title="Hide keyboard">▾</button>' +
      "</div>" +
      '<div class="skb-body" id="skb-body"></div>';
    host.appendChild(el);
    bufEl = el.querySelector("#skb-buf");
    var body = el.querySelector("#skb-body");

    var left = paintHalf("left", LEFT);
    var mid = document.createElement("div");
    mid.className = "skb-mid";
    mid.appendChild(
      keyBtn("⇧", "mod shift", function () {
        shift = !shift;
        paintShift();
      })
    );
    mid.appendChild(
      keyBtn("space", "space", function () {
        push(" ");
      })
    );
    mid.appendChild(
      keyBtn("⌫", "mod", function () {
        backspace();
      })
    );
    mid.appendChild(
      keyBtn("↵", "mod enter", function () {
        enter();
      })
    );
    mid.appendChild(
      keyBtn("esc", "mod", function () {
        buf = "";
        syncBuf();
        emit("esc", null);
        try {
          if (global.WebgridDroneHud && WebgridDroneHud.arm)
            global.WebgridDroneHud.arm(false);
        } catch (e) {}
      })
    );
    var right = paintHalf("right", RIGHT);

    body.appendChild(left);
    body.appendChild(mid);
    body.appendChild(right);

    el.querySelector("#skb-hide").onclick = function () {
      setVisible(!visible);
    };

    // physical keyboard passthrough when focused on page
    window.addEventListener("keydown", function (e) {
      if (!visible) return;
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA"))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // don't steal drone flight keys when not intending type - only if buffer active or Shift+letter
      // Allow always for printable when skb focused class
      if (!el.classList.contains("capture") && !buf.length) {
        // only capture if user already started typing via on-screen kb
        // physical: enable with backtick toggle
        if (e.key === "`") {
          e.preventDefault();
          el.classList.toggle("capture");
          syncBuf();
          return;
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        buf = "";
        syncBuf();
        el.classList.remove("capture");
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
    });

    return el;
  }

  function setVisible(on) {
    visible = !!on;
    if (el) el.classList.toggle("hidden", !visible);
    emit("visibility", visible);
  }

  function ensureCss() {
    if (document.getElementById("drone-split-kb-css")) return;
    var st = document.createElement("style");
    st.id = "drone-split-kb-css";
    st.textContent = [
      ".drone-split-kb{",
      "  flex:0 0 auto;z-index:50;",
      "  background:linear-gradient(180deg,rgba(8,12,20,.98),rgba(2,4,8,.99));",
      "  border-top:1px solid rgba(120,200,255,.2);",
      "  box-shadow:0 -8px 32px rgba(0,0,0,.45);",
      "  font:600 12px/1 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;",
      "  color:rgba(240,248,255,.92);",
      "  user-select:none;",
      "}",
      ".drone-split-kb.hidden{display:none}",
      ".drone-split-kb.capture{box-shadow:0 -8px 32px rgba(10,132,255,.2),inset 0 1px 0 rgba(120,200,255,.25)}",
      ".skb-top{display:flex;align-items:center;gap:10px;padding:6px 12px 4px;",
      "  font:600 10px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;color:rgba(180,200,220,.55)}",
      ".skb-brand b{color:#7ad0ff}",
      ".skb-buf{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "  color:rgba(200,230,255,.75);font-size:12px;letter-spacing:0}",
      ".skb-link{color:#7ad0ff;text-decoration:none;text-transform:none;letter-spacing:0}",
      ".skb-link:hover{text-decoration:underline}",
      ".skb-toggle{appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);",
      "  color:rgba(255,255,255,.7);border-radius:8px;min-height:28px;min-width:32px;padding:4px 8px;cursor:pointer}",
      ".skb-body{display:grid;grid-template-columns:1fr minmax(120px,18vw) 1fr;gap:10px;",
      "  padding:6px 12px 12px;align-items:end}",
      ".skb-half{display:flex;flex-direction:column;gap:5px}",
      ".skb-left{align-items:flex-end}",
      ".skb-right{align-items:flex-start}",
      ".skb-row{display:flex;gap:5px;justify-content:center}",
      ".skb-left .skb-row{justify-content:flex-end}",
      ".skb-right .skb-row{justify-content:flex-start}",
      ".skb-row.home .skb-key{box-shadow:inset 0 0 0 1px rgba(120,220,160,.25)}",
      ".skb-key{",
      "  appearance:none;border:1px solid rgba(255,255,255,.12);",
      "  background:rgba(36,40,48,.72);color:rgba(244,246,250,.95);",
      "  font:600 13px/1 -apple-system,system-ui,sans-serif;",
      "  min-width:34px;min-height:38px;padding:0 8px;border-radius:10px;cursor:pointer;",
      "  box-shadow:inset 0 .5px 0 rgba(255,255,255,.12),0 2px 8px rgba(0,0,0,.25);",
      "  backdrop-filter:blur(12px);transition:background .08s,transform .06s}",
      ".skb-key:hover{background:rgba(255,255,255,.14)}",
      ".skb-key.hit,.skb-key:active{transform:scale(.94);background:rgba(10,132,255,.28)}",
      ".skb-key.mod{min-width:48px;font-size:12px;color:rgba(200,220,255,.85)}",
      ".skb-key.space{min-width:72px;flex:1;letter-spacing:.12em;font-size:11px;",
      "  background:rgba(10,132,255,.12);border-color:rgba(10,132,255,.3)}",
      ".skb-key.enter{background:rgba(48,209,88,.16);border-color:rgba(48,209,88,.35)}",
      ".drone-split-kb.shift-on .skb-key.shift{background:rgba(255,190,50,.25);border-color:rgba(255,190,50,.45)}",
      ".skb-mid{display:flex;flex-direction:column;gap:5px;align-items:stretch;justify-content:flex-end;padding-bottom:0}",
      ".skb-mid .skb-key{width:100%}",
      "@media(max-width:900px){",
      "  .skb-body{grid-template-columns:1fr;gap:8px}",
      "  .skb-left,.skb-right{align-items:center}",
      "  .skb-left .skb-row,.skb-right .skb-row{justify-content:center}",
      "}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  global.DroneSplitKb = {
    version: VER,
    mount: mount,
    setVisible: setVisible,
    on: function (fn) {
      listeners.push(fn);
    },
    getBuffer: function () {
      return buf;
    },
    clear: function () {
      buf = "";
      syncBuf();
    },
    LAYOUT: { left: LEFT, right: RIGHT },
  };
})(typeof window !== "undefined" ? window : globalThis);
