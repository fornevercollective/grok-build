/* Glyph tools form — debate handoff extension (arena-handoff.json)
 * Aligns Glyph · DINOv3 tab with Decimen/LT peel contracts + video quantum lift.
 * Schema: fc-glyph-tools-form-v1
 */
(function (global) {
  "use strict";
  var VER = "glyph-tools-form-v1";
  var HANDOFF_URL = "data/arena-handoff.json";
  var LS = "mg.glyph.tools.form.v1";

  var DEFAULTS = {
    one_hot_path: true, /* race XOR dense peel */
    peels: {
      mode: "dense", /* dense | zxing | hybrid */
      patches: 32, /* 4–64 grid; hi-res dense map */
      res: 640, /* working plane px: 320|480|640|768|960 */
      color_mode: "hybrid", /* luma | rgb | chroma | hybrid */
      dino_hook: true,
      fountain_soak: false,
    },
    regions: {
      priority: [
        "logo_sphere",
        "lower_third",
        "ticker",
        "left_pillar",
        "right_pillar",
        "bug",
      ],
      free_mask_frac: 0.4781,
      tx_frac: 0.4136,
    },
    calib: {
      cast_align: "8x4@1080",
      track_error_px: 0,
    },
    decimen: {
      header_bytes: 20,
      ecc: "L",
      magic: "0xD1 0x0C",
      decode: "zxing-wasm",
    },
    video_lift: {
      url: "",
      prefer: "ffplay", /* ffplay | blank | gy */
      ytdlp: true,
      hwaccel: "auto",
      qbit_lift: true,
      multiplex: ["rubik", "bloch", "glyph_dense", "tensor_lane"],
    },
  };

  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS) || "{}");
      return merge(DEFAULTS, s);
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }
  function saveState(st) {
    try {
      localStorage.setItem(LS, JSON.stringify(st));
    } catch (e) {}
  }
  function merge(a, b) {
    var o = JSON.parse(JSON.stringify(a));
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]))
        o[k] = merge(o[k] || {}, b[k]);
      else o[k] = b[k];
    });
    return o;
  }

  function ensureCss() {
    if (document.getElementById("glyph-tools-form-css")) return;
    var st = document.createElement("style");
    st.id = "glyph-tools-form-css";
    st.textContent = [
      ".gtf{font:600 11px/1.4 system-ui,sans-serif;color:var(--ink,#e8ecf1)}",
      ".gtf fieldset{border:1px solid var(--line,#2a3038);border-radius:10px;",
      "  margin:0 0 10px;padding:10px 12px;background:rgba(0,0,0,.22)}",
      ".gtf legend{padding:0 6px;letter-spacing:.08em;text-transform:uppercase;",
      "  font-size:9px;color:var(--mut,#8b93a0)}",
      ".gtf label{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:4px 0;",
      "  color:var(--mut,#8b93a0);font-size:11px}",
      ".gtf input[type=text],.gtf input[type=number],.gtf select{",
      "  background:#0a0c10;border:1px solid #2a3038;color:inherit;border-radius:6px;",
      "  padding:4px 6px;font:600 11px ui-monospace,Menlo,monospace;max-width:100%}",
      ".gtf input[type=text]{flex:1;min-width:12rem}",
      ".gtf .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}",
      ".gtf button{appearance:none;border:1px solid #2a3038;background:#141a22;color:inherit;",
      "  border-radius:999px;padding:5px 10px;font:650 11px system-ui;cursor:pointer}",
      ".gtf button.primary{background:#38bdf8;border-color:#38bdf8;color:#0a0c10}",
      ".gtf .hint{font-size:10px;color:#8b93a0;margin:4px 0 0;line-height:1.4}",
      ".gtf .ok{color:#4ade80}.gtf .warn{color:#fbbf24}",
      ".gtf .pipe{font:600 10px ui-monospace,Menlo,monospace;color:#7dd3fc;",
      "  background:rgba(0,0,0,.35);border-radius:8px;padding:8px;margin:6px 0;white-space:pre-wrap}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  function mount(host, opts) {
    ensureCss();
    opts = opts || {};
    var st = loadState();
    host.className = (host.className || "") + " gtf";
    host.innerHTML = "";

    var handoff = null;
    function status(msg, cls) {
      var el = host.querySelector("[data-gtf=status]");
      if (el) {
        el.className = "hint " + (cls || "");
        el.textContent = msg;
      }
    }

    function formHtml() {
      return (
        '<div data-gtf=status class="hint">Loading handoff…</div>' +
        '<fieldset><legend>Handoff · one hot path</legend>' +
        '<label><input type="checkbox" data-k="one_hot_path"' +
        (st.one_hot_path ? " checked" : "") +
        "/> race XOR dense peel (never co-run)</label>" +
        '<div class="hint">task_id=<b>webgrid-chase</b> · arc.prize_relevant=<b>false</b> · paint ~588 BPS / 60 Hz</div>' +
        "</fieldset>" +
        '<fieldset><legend>Glyph peel · DINOv3 seat</legend>' +
        '<label>Mode <select data-k="peels.mode">' +
        ["dense", "zxing", "hybrid"]
          .map(function (m) {
            return (
              '<option value="' +
              m +
              '"' +
              (st.peels.mode === m ? " selected" : "") +
              ">" +
              m +
              "</option>"
            );
          })
          .join("") +
        "</select></label>" +
        '<label>Patches <input type="number" data-k="peels.patches" min="4" max="64" value="' +
        st.peels.patches +
        '" title="grid n×n (4–64)"/></label>' +
        '<label>Res <select data-k="peels.res">' +
        [320, 480, 640, 768, 960]
          .map(function (r) {
            return (
              '<option value="' +
              r +
              '"' +
              (String(st.peels.res || 640) === String(r) ? " selected" : "") +
              ">" +
              r +
              "px</option>"
            );
          })
          .join("") +
        "</select></label>" +
        '<label>Color <select data-k="peels.color_mode">' +
        ["hybrid", "luma", "rgb", "chroma"]
          .map(function (m) {
            return (
              '<option value="' +
              m +
              '"' +
              ((st.peels.color_mode || "hybrid") === m ? " selected" : "") +
              ">" +
              m +
              "</option>"
            );
          })
          .join("") +
        "</select></label>" +
        '<label><input type="checkbox" data-k="peels.dino_hook"' +
        (st.peels.dino_hook ? " checked" : "") +
        "/> use __dinoInfer when present</label>" +
        '<label><input type="checkbox" data-k="peels.fountain_soak"' +
        (st.peels.fountain_soak ? " checked" : "") +
        "/> fountain QR soak (bulk theater only)</label>" +
        '<div class="hint">ROI priority: ' +
        st.regions.priority.join(" → ") +
        " · free_mask≈" +
        st.regions.free_mask_frac +
        " · hi-res dense: up to 64² @ 960px · color hybrid scores luma+RGB+chroma</div>" +
        "</fieldset>" +
        '<fieldset><legend>Decimen contract</legend>' +
        '<div class="hint">header <b>' +
        st.decimen.header_bytes +
        "B</b> · ECC <b>" +
        st.decimen.ecc +
        "</b> · magic <b>" +
        st.decimen.magic +
        "</b> · " +
        st.decimen.decode +
        " · progress=frames_collected</div>" +
        '<div class="pipe">frame → ROI → dense|zxing → Decimen header → LT add_frame → assemble/fnv → thin glyph ticket</div>' +
        "</fieldset>" +
        '<fieldset><legend>Video quantum lift · Colossus / Dojo path</legend>' +
        '<label>URL <input type="text" data-k="video_lift.url" placeholder="https://… youtube / file / stream" value="' +
        (st.video_lift.url || "").replace(/"/g, "&quot;") +
        '"/></label>' +
        '<label>Prefer <select data-k="video_lift.prefer">' +
        ["ffplay", "blank", "gy"]
          .map(function (m) {
            return (
              '<option value="' +
              m +
              '"' +
              (st.video_lift.prefer === m ? " selected" : "") +
              ">" +
              m +
              "</option>"
            );
          })
          .join("") +
        "</select></label>" +
        '<label><input type="checkbox" data-k="video_lift.ytdlp"' +
        (st.video_lift.ytdlp ? " checked" : "") +
        "/> yt-dlp resolve</label>" +
        '<label><input type="checkbox" data-k="video_lift.qbit_lift"' +
        (st.video_lift.qbit_lift ? " checked" : "") +
        "/> qbit codec quantum lift</label>" +
        '<div class="hint">yt-dlp → ffmpeg (hwaccel) → ffplay · lift tags via QbitCodec → multiplex Rubik/Bloch/glyph dense</div>' +
        '<div class="hint">Terminal: <b>/watch glyph</b> · <b>/watch popout glyph [URL]</b> · o = quantum-lift + this form</div>' +
        '<div class="row">' +
        '<button type="button" class="primary" data-act="lift">Lift + play</button>' +
        '<button type="button" data-act="probe">Probe</button>' +
        '<button type="button" data-act="ytdlp">yt-dlp -F</button>' +
        '<button type="button" data-act="multiplex">Multiplex BC</button>' +
        '<button type="button" data-act="open-arena">Glyph tab</button>' +
        '<button type="button" data-act="watch-popout">/watch popout cmd</button>' +
        "</div>" +
        '<div class="pipe" data-gtf=cmd>bash scripts/mg-quantum-video-lift.sh lift "URL"</div>' +
        "</fieldset>" +
        '<fieldset><legend>Publish</legend>' +
        '<div class="row">' +
        '<button type="button" class="primary" data-act="apply">Apply → dense lab</button>' +
        '<button type="button" data-act="export">Export JSON</button>' +
        '<button type="button" data-act="reload-handoff">Reload handoff</button>' +
        "</div>" +
        '<div class="hint">BC: ugrad-glyph-dense · ugrad-rubik-lang · ugrad-tensor-lane · ugrad-glyph-tools</div>' +
        "</fieldset>"
      );
    }

    host.innerHTML = formHtml();

    function readForm() {
      host.querySelectorAll("[data-k]").forEach(function (el) {
        var path = el.getAttribute("data-k").split(".");
        var cur = st;
        for (var i = 0; i < path.length - 1; i++) {
          cur[path[i]] = cur[path[i]] || {};
          cur = cur[path[i]];
        }
        var key = path[path.length - 1];
        if (el.type === "checkbox") cur[key] = el.checked;
        else if (el.type === "number") cur[key] = parseInt(el.value, 10);
        else if (key === "res" || key === "patches")
          cur[key] = parseInt(el.value, 10) || el.value;
        else cur[key] = el.value;
      });
      saveState(st);
      return st;
    }

    function cmdLine(op) {
      var s = readForm();
      var u = s.video_lift.url || "URL";
      var root =
        "/Volumes/qbitOS/00.dev/projects/grok-build/experiments/memory-glass";
      var gb = "/Volumes/qbitOS/00.dev/projects/grok-build";
      if (op === "watch-popout" || op === "glyph-popout") {
        return (
          'bash "' +
          gb +
          '/scripts/live-demux/glyph-watch-popout.sh" ' +
          (u && u !== "URL" ? JSON.stringify(u) : "--arena-only")
        );
      }
      return (
        'bash "' +
        root +
        "/scripts/mg-quantum-video-lift.sh\" " +
        op +
        " " +
        JSON.stringify(u)
      );
    }

    function paintCmd(op) {
      var el = host.querySelector("[data-gtf=cmd]");
      if (el) el.textContent = cmdLine(op || "lift");
    }

    function nativeOrClipboard(op) {
      var s = readForm();
      var url = s.video_lift.url;
      paintCmd(op);
      if (window.__mgVideo) {
        if (op === "ffplay" || op === "lift") return window.__mgVideo.ffplay(url);
        if (op === "probe") return window.__mgVideo.probe
          ? window.__mgVideo.probe(url)
          : window.__mgVideo.ffplay && null;
        if (op === "ytdlp") return window.__mgVideo.ytdlp(url);
        if (op === "blank") return window.__mgVideo.popBlank(url);
      }
      try {
        if (window.ipc)
          window.ipc.postMessage(
            JSON.stringify({
              op: "media_feed",
              media_op: op === "lift" ? "ffplay" : op,
              url: url,
              quantum_lift: !!s.video_lift.qbit_lift,
              multiplex: s.video_lift.multiplex,
            })
          );
      } catch (e) {}
      try {
        if (navigator.clipboard && navigator.clipboard.writeText)
          navigator.clipboard.writeText(cmdLine(op === "lift" ? "lift" : op));
      } catch (e2) {}
      status("cmd copied · " + op + " (run in shell if no ipc)", "warn");
      return { ok: true, via: "clipboard" };
    }

    function publishTools() {
      var s = readForm();
      var msg = {
        schema: "fc-glyph-tools-form-v1",
        ver: VER,
        t: Date.now(),
        handoff: handoff
          ? {
              schema: handoff.schema,
              rates: handoff.rates,
              geometry: handoff.geometry,
              decimen_contract: handoff.decimen_contract,
              qr_pipeline: handoff.qr_pipeline,
            }
          : null,
        form: s,
        honesty: {
          prize_relevant: false,
          one_hot_path: s.one_hot_path,
          lab_bps_neq_arc: true,
        },
      };
      try {
        new BroadcastChannel("ugrad-glyph-tools").postMessage(msg);
      } catch (e) {}
      try {
        new BroadcastChannel("ugrad-glyph-dense").postMessage({
          schema: "ugrad-glyph-dense-v1",
          t: Date.now(),
          tools_form: true,
          patches: s.peels.patches,
          res: s.peels.res,
          color_mode: s.peels.color_mode,
          mode: s.peels.mode,
        });
      } catch (e2) {}
      if (opts.onApply) opts.onApply(s, msg);
      status("published tools form · BC ugrad-glyph-tools", "ok");
      return msg;
    }

    function multiplexLift() {
      var s = readForm();
      var envelope = {
        schema: "fc-quantum-video-lift-v1",
        t: Date.now(),
        url: s.video_lift.url,
        qbit: s.video_lift.qbit_lift,
        multiplex: s.video_lift.multiplex,
        note: "plain video → qbit lift → rubik/bloch/glyph dense seats",
      };
      /* qbit lift if codec present */
      if (s.video_lift.qbit_lift && global.QbitCodec) {
        try {
          var q = global.QbitCodec;
          var payload =
            "n: video-lift\n0: stream " +
            (s.video_lift.url || "").slice(0, 80) +
            "\n+3: multiplex " +
            (s.video_lift.multiplex || []).join(",");
          envelope.qbit_sample =
            typeof q.encode === "function"
              ? q.encode(payload)
              : typeof q.pack === "function"
                ? q.pack(payload)
                : String(payload);
        } catch (eQ) {
          envelope.qbit_err = String(eQ);
        }
      }
      ["ugrad-rubik-lang", "ugrad-tensor-lane", "ugrad-glyph-dense"].forEach(
        function (ch) {
          try {
            new BroadcastChannel(ch).postMessage(
              Object.assign({}, envelope, { channel: ch })
            );
          } catch (e) {}
        }
      );
      /* bloch solve bus if present */
      try {
        if (window.__mgBloch && window.__mgBloch.pulse)
          window.__mgBloch.pulse({ from: "video-lift", t: Date.now() });
      } catch (eB) {}
      status("multiplexed lift envelope → rubik · tensor · glyph", "ok");
      return envelope;
    }

    host.addEventListener("change", function () {
      readForm();
      paintCmd("lift");
    });
    host.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "apply") {
        var s = publishTools();
        /* push peel settings onto arena controls */
        if (s.form && s.form.peels) {
          var pin = document.getElementById("glyph-patches");
          if (pin) {
            var pn = parseInt(s.form.peels.patches, 10) || 32;
            pin.value = String(Math.max(4, Math.min(64, pn)));
          }
          var cin = document.getElementById("glyph-color");
          if (cin && s.form.peels.color_mode) cin.value = s.form.peels.color_mode;
          var rin = document.getElementById("glyph-res");
          if (rin && s.form.peels.res) {
            rin.value = String(s.form.peels.res);
            if (rin.onchange) rin.onchange();
          }
        }
        if (typeof window.glyphEstimate === "function") window.glyphEstimate();
      } else if (act === "export") {
        var blob = new Blob(
          [JSON.stringify(publishTools(), null, 2)],
          { type: "application/json" }
        );
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "glyph-tools-form.json";
        a.click();
      } else if (act === "reload-handoff") loadHandoff();
      else if (act === "lift") {
        nativeOrClipboard("lift");
        multiplexLift();
      } else if (act === "probe") nativeOrClipboard("probe");
      else if (act === "ytdlp") nativeOrClipboard("ytdlp");
      else if (act === "watch-popout") {
        paintCmd("watch-popout");
        try {
          if (navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText(cmdLine("watch-popout"));
        } catch (eW) {}
        status(
          "copied /watch glyph pop-out cmd · run in shell (or /watch popout glyph)",
          "ok"
        );
      } else if (act === "multiplex") multiplexLift();
      else if (act === "open-arena") {
        if (location.pathname.indexOf("ugrad-arena") >= 0) {
          if (window.UgradArena && window.UgradArena.setMode)
            window.UgradArena.setMode("glyph");
        } else location.href = "ugrad-arena.html?mode=glyph";
      }
    });

    function loadHandoff() {
      fetch(HANDOFF_URL + "?t=" + Date.now(), { cache: "no-store" })
        .then(function (r) {
          return r.json();
        })
        .then(function (j) {
          handoff = j;
          if (j.geometry && j.geometry.regions_priority)
            st.regions.priority = j.geometry.regions_priority;
          if (j.geometry) {
            st.regions.free_mask_frac = j.geometry.free_mask_frac;
            st.regions.tx_frac = j.geometry.tx_regions_frac;
          }
          if (j.decimen_contract) {
            st.decimen.header_bytes = j.decimen_contract.header_bytes;
            st.decimen.ecc = j.decimen_contract.ecc;
            st.decimen.magic = j.decimen_contract.magic;
            st.decimen.decode = j.decimen_contract.decode;
          }
          saveState(st);
          host.innerHTML = formHtml();
          status(
            "handoff " +
              (j.schema || "ok") +
              " · paint_ceiling " +
              ((j.rates && j.rates.paint_ceiling_bps_30x30) || 588),
            "ok"
          );
          paintCmd("lift");
        })
        .catch(function (e) {
          status("handoff offline · using defaults · " + e, "warn");
          paintCmd("lift");
        });
    }

    loadHandoff();
    return {
      ver: VER,
      getState: function () {
        return readForm();
      },
      publish: publishTools,
      reload: loadHandoff,
    };
  }

  global.GlyphToolsForm = { ver: VER, mount: mount, DEFAULTS: DEFAULTS };
})(typeof window !== "undefined" ? window : this);
