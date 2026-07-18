/* Memory Glass · floating Neuralink-style keyboard + kbatch tools
 * Large hit targets for cursor / BCI / agent; glass morphism Dragon chrome.
 * Integrates kbatch.ugrad.ai tool shortcuts + blank keyboard path viz.
 * VER: float-kb-v1
 */
(function () {
  "use strict";
  var VER = "float-kb-v2-playclear";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._floatKbVer === VER) return;
  HP._floatKbVer = VER;

  /* A: never mount on inspect surface */
  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (eInsp) {}

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m), "float-kb");
    } catch (e) {}
  }

  var ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ];
  var buf = "";
  var pathPts = [];
  var open = false; /* B: off until KEYBOARD */
  var el, bufEl, pathCv;

  var TOOLS = [
    {
      id: "kbatch",
      label: "KBATCH",
      url: "https://kbatch.ugrad.ai/",
    },
    {
      id: "dojo",
      label: "DOJO",
      url: "https://kbatch.ugrad.ai/dojo/",
    },
    {
      id: "learn",
      label: "LEARN",
      url: "https://kbatch.ugrad.ai/learn",
    },
    {
      id: "blank",
      label: "BLANK",
      url: "https://fornevercollective.github.io/blank/",
    },
    {
      id: "analyze",
      label: "ANALYZE",
      fn: function () {
        analyzeBuf();
      },
    },
    {
      id: "send",
      label: "SEND",
      fn: function () {
        sendBuf();
      },
    },
  ];

  function ensureCss() {
    try {
      if (window.__mgSxRail) window.__mgSxRail.ensure();
    } catch (e) {}
  }

  function measure() {
    try {
      var h = open && el ? el.offsetHeight : 0;
      document.documentElement.style.setProperty("--mg-kb-h", h + (h ? 10 : 0) + "px");
      if (window.__mgGlassCap && window.__mgGlassCap.measure) window.__mgGlassCap.measure();
    } catch (e) {}
  }

  function setOpen(on) {
    open = !!on;
    if (el) el.classList.toggle("hidden", !open);
    measure();
  }

  function nav(url) {
    try {
      if (window.ipc) window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else window.open(url, "_blank");
    } catch (e) {
      window.open(url, "_blank");
    }
  }

  function pressKey(ch, keyEl) {
    if (keyEl) {
      keyEl.classList.add("lit");
      setTimeout(function () {
        keyEl.classList.remove("lit");
      }, 120);
    }
    if (ch === "⌫") {
      buf = buf.slice(0, -1);
    } else if (ch === "SPC") {
      buf += " ";
    } else if (ch === "CLR") {
      buf = "";
      pathPts = [];
    } else if (ch === "↵") {
      sendBuf();
      return;
    } else {
      buf += ch;
    }
    if (bufEl) bufEl.textContent = buf || "…";
    try {
      if (window.__mgBlochSolve && window.__mgBlochSolve.onKeyHop && ch.length === 1)
        window.__mgBlochSolve.onKeyHop(ch);
    } catch (eB) {}
    /* path for kbatch-style geometry */
    if (keyEl) {
      var r = keyEl.getBoundingClientRect();
      var pr = el.getBoundingClientRect();
      pathPts.push({
        x: (r.left + r.width / 2 - pr.left) / pr.width,
        y: (r.top + r.height / 2 - pr.top) / pr.height,
        ch: ch,
        t: Date.now(),
      });
      if (pathPts.length > 64) pathPts.shift();
      drawPath();
    }
  }

  function drawPath() {
    if (!pathCv || pathPts.length < 2) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = pathCv.clientWidth || 400;
    var h = pathCv.clientHeight || 28;
    pathCv.width = Math.floor(w * dpr);
    pathCv.height = Math.floor(h * dpr);
    var ctx = pathCv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(120,200,255,0.75)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    pathPts.forEach(function (p, i) {
      var x = p.x * w,
        y = p.y * h * 0.3 + h * 0.35;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function analyzeBuf() {
    var text = (buf || "").trim();
    if (!text) {
      log("empty buffer");
      return;
    }
    /* Open kbatch with query — path geometry lives on site */
    var u =
      "https://kbatch.ugrad.ai/?q=" +
      encodeURIComponent(text) +
      "&layout=qwerty&from=mg-float-kb";
    nav(u);
    try {
      var payload = {
        type: "kbatch-blank-bridge",
        schema: "kbatch-blank-v1",
        source: "mg-float-kb",
        text: text,
        layout: "qwerty",
        path: pathPts.slice(),
        ts: Date.now(),
      };
      var bc = new BroadcastChannel("kbatch-blank");
      bc.postMessage(payload);
      bc.close();
    } catch (e) {}
    log("analyze «" + text.slice(0, 32) + "»");
  }

  function sendBuf() {
    var text = buf;
    if (!text) return;
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "clipboard_copy", text: text }));
      else if (navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
    /* try inject into focused field */
    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) {
        if (ae.isContentEditable) ae.textContent = (ae.textContent || "") + text;
        else ae.value = (ae.value || "") + text;
      }
    } catch (e2) {}
    log("send «" + text.slice(0, 40) + "»");
  }

  function mount() {
    ensureCss();
    if (document.getElementById("mg-float-kb")) return;
    el = document.createElement("div");
    el.id = "mg-float-kb";
    el.innerHTML =
      '<div class="kb-top">' +
      '  <div class="ttl">. float keyboard · neuralink hit targets · kbatch</div>' +
      '  <div class="kb-tools" id="mg-kb-tools"></div>' +
      "</div>" +
      '<div class="kb-buf" id="mg-kb-buf">…</div>' +
      '<div class="kb-rows" id="mg-kb-rows"></div>' +
      '<div class="kb-path"><canvas id="mg-kb-path"></canvas></div>';
    (document.body || document.documentElement).appendChild(el);
    bufEl = el.querySelector("#mg-kb-buf");
    pathCv = el.querySelector("#mg-kb-path");

    var tools = el.querySelector("#mg-kb-tools");
    TOOLS.forEach(function (T) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = T.label;
      b.onclick = function () {
        if (T.url) nav(T.url);
        else if (T.fn) T.fn();
      };
      tools.appendChild(b);
    });
    var hide = document.createElement("button");
    hide.type = "button";
    hide.textContent = "HIDE";
    hide.onclick = function () {
      setOpen(false);
    };
    tools.appendChild(hide);

    var rowsEl = el.querySelector("#mg-kb-rows");
    ROWS.forEach(function (row, ri) {
      var rowEl = document.createElement("div");
      rowEl.className = "kb-row";
      if (ri === 1) rowEl.style.paddingLeft = "14px";
      if (ri === 2) rowEl.style.paddingLeft = "28px";
      row.forEach(function (ch) {
        var k = document.createElement("button");
        k.type = "button";
        k.className = "kb-key";
        k.textContent = ch;
        k.onclick = function () {
          pressKey(ch, k);
        };
        rowEl.appendChild(k);
      });
      if (ri === 2) {
        var bk = document.createElement("button");
        bk.type = "button";
        bk.className = "kb-key wide tool";
        bk.textContent = "⌫";
        bk.onclick = function () {
          pressKey("⌫", bk);
        };
        rowEl.appendChild(bk);
      }
      rowsEl.appendChild(rowEl);
    });
    var bot = document.createElement("div");
    bot.className = "kb-row";
    [
      ["CLR", "tool"],
      ["SPC", "space"],
      ["↵", "wide tool"],
    ].forEach(function (pair) {
      var k = document.createElement("button");
      k.type = "button";
      k.className = "kb-key " + pair[1];
      k.textContent = pair[0] === "SPC" ? "space" : pair[0];
      k.onclick = function () {
        pressKey(pair[0], k);
      };
      bot.appendChild(k);
    });
    rowsEl.appendChild(bot);

    setOpen(false);
    measure();
    window.addEventListener("resize", measure);
    log(VER + " · floating glass keyboard + kbatch tools");
  }

  window.__mgFloatKb = {
    ver: VER,
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    toggle: function () {
      setOpen(!open);
    },
    isOpen: function () {
      return open;
    },
    buffer: function () {
      return buf;
    },
    setBuffer: function (t) {
      buf = String(t || "");
      if (bufEl) bufEl.textContent = buf || "…";
    },
    report: function () {
      return VER + " open=" + open + " buf=" + buf.length;
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    setTimeout(mount, 80);
  }
})();
