/* Memory Glass · Ego batch + 21-kpt hands (Perceptron-shaped local path)
 * - Local MediaPipe Hands / heuristic → H1 air pointer + H2 pen tip
 * - Atomic action taxonomy (Perceptron-style labels, offline)
 * - Still-pipe ego batch record (POST /ego/*)
 * - Optional Perceptron API when window.__MG_PERCEPTRON_KEY or localStorage set
 * Inject after research.js. No PAGE body thrash.
 */
(function () {
  "use strict";
  var VER = "ego-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._egoVer === VER) return;
  HP._egoVer = VER;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "info", String(m || ""), "ego");
    } catch (e) {}
  }
  function ok(m) {
    log("ok", m);
  }
  function warn(m) {
    log("warn", m);
  }

  var isMain = !!document.getElementById("mg-root");
  var isInspect = !!document.getElementById("pip-wrap");
  var STILL = "http://127.0.0.1:9877";

  /* Perceptron-style 16-action taxonomy (local classifier is heuristic) */
  var TAXONOMY = [
    "reaching",
    "grasping",
    "pinching",
    "lifting",
    "holding",
    "placing",
    "inserting",
    "pushing",
    "pulling",
    "rotating",
    "opening",
    "closing",
    "releasing",
    "pointing",
    "idle",
    "occluded",
  ];

  var state = {
    ver: VER,
    recording: false,
    batchId: null,
    framesSent: 0,
    events: [],
    lastHands: null,
    lastAction: "idle",
    lastActionT: 0,
    apiKey: null,
    apiBase: "https://api.perceptron.inc", // placeholder; override if EA docs differ
  };

  try {
    state.apiKey =
      window.__MG_PERCEPTRON_KEY ||
      localStorage.getItem("mg.perceptron.key") ||
      null;
    var ab = localStorage.getItem("mg.perceptron.base");
    if (ab) state.apiBase = ab;
  } catch (e) {}

  function dist(a, b) {
    if (!a || !b) return 99;
    var dx = a.x - b.x,
      dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Map 21 landmarks → atomic action label (offline stand-in for Perceptron taxonomy) */
  function classifyHand(lm) {
    if (!lm || lm.length < 21) return { action: "occluded", conf: 0.2, pinch: 1, expand: 0 };
    var wrist = lm[0],
      thumb = lm[4],
      index = lm[8],
      mid = lm[12],
      ring = lm[16],
      pinky = lm[20];
    var pinch = dist(thumb, index);
    var open =
      (dist(wrist, index) + dist(wrist, mid) + dist(wrist, ring) + dist(wrist, pinky)) / 4;
    var expand = Math.max(0, Math.min(1.5, open / 0.22 - 0.3));
    var action = "idle";
    var conf = 0.55;
    if (pinch < 0.045) {
      action = "pinching";
      conf = 0.85;
    } else if (pinch < 0.07 && expand < 0.5) {
      action = "grasping";
      conf = 0.75;
    } else if (expand > 0.9) {
      action = "reaching";
      conf = 0.7;
    } else if (index.y < wrist.y - 0.08 && pinch > 0.08) {
      action = "pointing";
      conf = 0.8;
    } else if (expand > 0.45 && expand < 0.85) {
      action = "holding";
      conf = 0.6;
    }
    return {
      action: action,
      conf: conf,
      pinch: pinch,
      expand: expand,
      index: { x: index.x, y: index.y, z: index.z || 0 },
      thumb: { x: thumb.x, y: thumb.y },
      wrist: { x: wrist.x, y: wrist.y },
    };
  }

  function pushEvent(ev) {
    state.events.push(ev);
    while (state.events.length > 200) state.events.shift();
    /* bridge to research pack */
    try {
      if (window.__mgResearch && window.__mgResearch.state && window.__mgResearch.state.pack) {
        var p = window.__mgResearch.state.pack;
        if (!p.ego_events) p.ego_events = [];
        p.ego_events.push(ev);
        while (p.ego_events.length > 80) p.ego_events.shift();
        if (typeof window.__mgResearch.persist === "function") {
          /* no public persist — touch notes */
        }
      }
    } catch (e) {}
    /* IPC air pointer from index tip */
    try {
      if (ev.index && window.ipc && window.ipc.postMessage) {
        window.ipc.postMessage(
          JSON.stringify({
            op: "track_hand",
            present: true,
            nx: +ev.index.x.toFixed(4),
            ny: +ev.index.y.toFixed(4),
            pinch: +(ev.pinch != null ? Math.min(1.8, ev.pinch * 12) : 1).toFixed(3),
            expand: +(ev.expand || 0).toFixed(3),
            conf: +(ev.conf || 0.5).toFixed(3),
            engine: "ego-" + (ev.action || "hand"),
          })
        );
      }
    } catch (e2) {}
  }

  function observeHandsFromLive() {
    var hg = window.__mgHandGesture;
    if (!hg || !hg.present || !hg.hands || !hg.hands[0]) return null;
    var lm = hg.hands[0];
    var c = classifyHand(lm);
    state.lastHands = lm;
    var now = Date.now();
    if (c.action !== state.lastAction || now - state.lastActionT > 400) {
      state.lastAction = c.action;
      state.lastActionT = now;
      pushEvent({
        t: now,
        action: c.action,
        conf: c.conf,
        pinch: c.pinch,
        expand: c.expand,
        index: c.index,
        source: hg.engine || "hands",
        taxonomy: TAXONOMY,
      });
    } else {
      /* continuous pointer */
      pushEvent({
        t: now,
        action: c.action,
        conf: c.conf * 0.9,
        pinch: c.pinch,
        expand: c.expand,
        index: c.index,
        source: hg.engine || "hands",
        continuous: true,
      });
    }
    return c;
  }

  /* ── Still-pipe ego batch HTTP ── */
  function egoPost(path, body, isJson) {
    return fetch(STILL + path, {
      method: "POST",
      headers: isJson ? { "Content-Type": "application/json" } : {},
      body: body || null,
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function (e) {
        warn("ego http " + path + " " + e);
        return null;
      });
  }

  function startBatch(meta) {
    return egoPost(
      "/ego/start",
      JSON.stringify(
        Object.assign({ ver: VER, topic: (window.__mgResearch && window.__mgResearch.state.topic) || "" }, meta || {})
      ),
      true
    ).then(function (j) {
      if (j && j.ok) {
        state.recording = true;
        state.batchId = j.batch;
        state.framesSent = 0;
        ok("ego batch start · " + j.batch);
      }
      return j;
    });
  }

  function endBatch() {
    return egoPost("/ego/end", "{}", true).then(function (j) {
      state.recording = false;
      if (j && j.batch) {
        ok("ego batch end · frames " + (j.batch.frames || state.framesSent));
        try {
          if (window.__mgResearch) {
            window.__mgResearch.state.pack = window.__mgResearch.state.pack || {};
            window.__mgResearch.state.pack.ego_batch = j.batch;
            if (window.__mgResearch.exportPack) {
              /* optional auto export */
            }
          }
        } catch (e) {}
      }
      return j;
    });
  }

  function sendFrameBlob(blob) {
    if (!blob) return Promise.resolve(null);
    return fetch(STILL + "/ego/frame", { method: "POST", body: blob })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.ok) {
          state.framesSent++;
          state.recording = true;
          state.batchId = j.batch || state.batchId;
        }
        return j;
      })
      .catch(function () {
        return null;
      });
  }

  function grabLiveJpg() {
    return fetch(STILL + "/live.jpg?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no live");
        return r.blob();
      })
      .catch(function () {
        return null;
      });
  }

  var recordTimer = null;
  function startRecording(hz) {
    hz = hz || 2;
    if (recordTimer) return;
    startBatch({ hz: hz }).then(function () {
      recordTimer = setInterval(function () {
        grabLiveJpg().then(function (b) {
          if (b) sendFrameBlob(b);
        });
        observeHandsFromLive();
      }, Math.max(200, 1000 / hz));
      ok("ego record · " + hz + " Hz");
    });
  }

  function stopRecording() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
    return endBatch();
  }

  /* Optional Perceptron API batch (early access) — posts manifest path + note */
  function submitPerceptronStub(batchInfo) {
    if (!state.apiKey) {
      warn("no PERCEPTRON key — local taxonomy only (set localStorage mg.perceptron.key)");
      return Promise.resolve({ ok: false, local: true, events: state.events.slice(-40) });
    }
    /* EA API shape may differ — keep payload honest + local fallback */
    var payload = {
      type: "egocentric_episode",
      source: "memory-glass-still-pipe",
      batch: batchInfo || { id: state.batchId, frames: state.framesSent },
      local_events: state.events.slice(-100),
      taxonomy: TAXONOMY,
      note: "Memory Glass offline path; replace with official EA endpoint when key provisioned",
    };
    return fetch(state.apiBase + "/v1/egocentric/annotate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + state.apiKey,
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, status: r.status, body: j };
        });
      })
      .catch(function (e) {
        warn("perceptron api " + e);
        return { ok: false, err: String(e), local_events: state.events.slice(-40) };
      });
  }

  window.__mgEgo = {
    ver: VER,
    state: state,
    taxonomy: TAXONOMY,
    classifyHand: classifyHand,
    observeHands: observeHandsFromLive,
    startRecording: startRecording,
    stopRecording: stopRecording,
    startBatch: startBatch,
    endBatch: endBatch,
    sendFrameBlob: sendFrameBlob,
    submitPerceptron: submitPerceptronStub,
    events: function () {
      return state.events.slice();
    },
  };

  /* observe loop on inspect (hands already tracked) */
  if (isInspect) {
    setInterval(function () {
      observeHandsFromLive();
    }, 180);

    if (!document.getElementById("mg-ego-btns")) {
      var row = document.createElement("div");
      row.id = "mg-ego-btns";
      row.style.cssText = "order:0;display:flex;gap:4px;flex-wrap:wrap;margin:0 0 4px";
      function btn(label, fn) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = label;
        b.style.cssText =
          "font:600 8px ui-monospace,Menlo,monospace;padding:3px 6px;" +
          "border:1px solid rgba(200,160,120,0.4);border-radius:3px;" +
          "background:rgba(20,14,10,0.9);color:rgba(255,210,170,0.95);cursor:pointer";
        b.onclick = fn;
        row.appendChild(b);
      }
      btn("EGO REC", function () {
        startRecording(2);
      });
      btn("EGO STOP", function () {
        stopRecording().then(function (j) {
          submitPerceptronStub(j && j.batch);
          try {
            if (window.__mgResearch && window.__mgResearch.exportPack) window.__mgResearch.exportPack();
          } catch (e) {}
        });
      });
      btn("EGO→PACK", function () {
        try {
          if (window.__mgResearch && window.__mgResearch.state.pack) {
            window.__mgResearch.state.pack.ego_events = state.events.slice(-60);
            window.__mgResearch.state.pack.ego_taxonomy = TAXONOMY;
            if (window.__mgResearch.exportPack) window.__mgResearch.exportPack();
            ok("ego events → research pack");
          }
        } catch (e) {
          warn(String(e));
        }
      });
      var stage = document.getElementById("stage");
      if (stage) stage.insertBefore(row, stage.firstChild);
    }
    ok("ego-v1 · taxonomy + batch · Perceptron-shaped local path");
  }

  if (isMain) {
    ok("ego-v1 · main calm · hands via inspect IPC only");
  }
})();
