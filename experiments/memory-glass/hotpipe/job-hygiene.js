/* Memory Glass · JOB HYGIENE
 * Competitive patch vs Safari-class zombie downloads ("*" · Preparing forever · cancel dead).
 * Field finding → product strength: every download/nav job has id, cancel, TTL, safe name.
 * VER: job-hygiene-v2
 *
 * API: window.__mgJobHygiene
 *   .arm() .status() .sweep() .sanitizePaste(s) .createJob(opts) .cancel(id) .clearAll()
 *   .learn(finding)  — record field trigger for later features
 *   .soakProbe()     — self-test garbage paste / zombie prepare
 *   .extractUrls(s)  — multi-line paste with buried URLs
 *   .blobSpool(url)  — rate-limit blob: download storms
 *   .onReloadGuard() — fail open preparing/transfer jobs on unload
 */
(function () {
  "use strict";
  var VER = "job-hygiene-v2";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._jobHygieneVer === VER && window.__mgJobHygiene) return;
  HP._jobHygieneVer = VER;

  var PREPARE_TTL_MS = 8000;
  var SWEEP_MS = 2000;
  var MAX_JOBS = 48;
  var BLOB_WINDOW_MS = 3000;
  var BLOB_MAX = 6;
  var IFRAME_DL_MAX = 4;
  var blobHits = [];
  var iframeHits = [];
  var jobs = Object.create(null);
  var findings = [];
  var armed = false;
  var timer = null;
  var seq = 0;

  function log(lvl, m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog(lvl || "ok", String(m || ""), "hygiene");
    } catch (e) {}
  }

  function now() {
    return Date.now();
  }

  function uid() {
    seq += 1;
    return "mgj-" + now().toString(36) + "-" + seq;
  }

  /** Pull https? URLs out of multi-line terminal paste (buried URL case) */
  function extractUrls(raw) {
    var s = String(raw == null ? "" : raw);
    s = s.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "");
    var re = /https?:\/\/[^\s<>"'`]+/gi;
    var out = [];
    var m;
    while ((m = re.exec(s)) !== null) {
      var u = m[0].replace(/[.,);]+$/, "");
      if (out.indexOf(u) < 0) out.push(u);
    }
    return out;
  }

  /** Strip terminal paste garbage that creates Safari-style * jobs */
  function sanitizePaste(raw) {
    var s = String(raw == null ? "" : raw);
    // strip ANSI, C0 controls except tab/newline then flatten
    s = s.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "");
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
    s = s.replace(/\r\n?/g, "\n").trim();
    // multi-line: prefer first buried URL, else first non-empty line
    if (s.indexOf("\n") >= 0) {
      var urls = extractUrls(s);
      if (urls.length) {
        learn({ kind: "multiline_buried_url", n: urls.length, at: now() });
        return { ok: true, value: urls[0], kind: "url", urls: urls };
      }
      var lines = s.split("\n");
      for (var i = 0; i < lines.length; i++) {
        var L = lines[i].trim();
        if (L) {
          s = L;
          break;
        }
      }
    }
    // lone star / empty / pure punctuation is not a navigation target
    if (!s || s === "*" || s === "." || s === "…" || /^[*?]+$/.test(s)) {
      return { ok: false, reason: "empty_or_star", value: "" };
    }
    // accidental shell fragments
    if (/^(ls|cd|pwd|cat|open|curl)\s/i.test(s) && !/^https?:\/\//i.test(s)) {
      return { ok: false, reason: "shell_fragment", value: s.slice(0, 120) };
    }
    // bare path that is not a URL — still allow file:// if explicit
    if (/^https?:\/\//i.test(s) || /^file:\/\//i.test(s) || /^about:/i.test(s)) {
      return { ok: true, value: s, kind: "url" };
    }
    // domain-like
    if (/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(s)) {
      return { ok: true, value: "https://" + s, kind: "domain" };
    }
    // search query (allow)
    if (s.length >= 2 && s.length < 500) {
      return { ok: true, value: s, kind: "query" };
    }
    return { ok: false, reason: "rejected", value: s.slice(0, 80) };
  }

  function rateWindow(arr, max, windowMs, kind) {
    var t = now();
    while (arr.length && t - arr[0] > windowMs) arr.shift();
    if (arr.length >= max) {
      learn({ kind: kind, n: arr.length, at: t });
      return false;
    }
    arr.push(t);
    return true;
  }

  /** Blob download storms → spool / reject excess */
  function blobSpool(url, filename) {
    if (!rateWindow(blobHits, BLOB_MAX, BLOB_WINDOW_MS, "blob_storm")) {
      log("warn", "blob storm · spool reject");
      return { ok: false, reason: "blob_storm" };
    }
    var job = createJob({
      filename: filename || "blob.bin",
      url: String(url || "blob:").slice(0, 2000),
      note: "blob_spool",
    });
    if (!job) return { ok: false, reason: "rejected_job" };
    setState(job.id, "transfer");
    return { ok: true, job: job };
  }

  /** iframe download floods */
  function allowIframeDownload(origin) {
    if (!rateWindow(iframeHits, IFRAME_DL_MAX, BLOB_WINDOW_MS, "iframe_download_flood")) {
      log("warn", "iframe flood · block " + String(origin || "").slice(0, 60));
      return false;
    }
    return true;
  }

  /** Reload mid-download race: never leave preparing forever after unload */
  function onReloadGuard() {
    var n = 0;
    for (var k in jobs) {
      var j = jobs[k];
      if (!j) continue;
      if (j.state === "preparing" || j.state === "transfer") {
        j.state = "failed";
        j.note = (j.note || "") + " · reload_mid_download";
        j.updated_at = now();
        n++;
        learn({ kind: "reload_mid_download", id: j.id, filename: j.filename, at: now() });
      }
    }
    if (n) log("ok", "reload guard · failed " + n);
    return n;
  }

  function safeFilename(name, fallback) {
    var n = String(name == null ? "" : name).trim();
    n = n.replace(/[\u0000-\u001F\u007F]/g, "");
    n = n.replace(/[\/\\:*?"<>|]/g, "_");
    if (!n || n === "*" || n === "." || n === "..") n = fallback || "download";
    if (n.length > 180) n = n.slice(0, 180);
    return n;
  }

  function countJobs() {
    var n = 0;
    for (var k in jobs) if (Object.prototype.hasOwnProperty.call(jobs, k)) n++;
    return n;
  }

  function createJob(opts) {
    opts = opts || {};
    // refuse UI row without cancel path — Safari zombie root cause
    var id = opts.id || uid();
    var rawName = String(opts.filename == null ? "" : opts.filename).trim();
    // explicit reject of star/empty before sanitize rewrites (Safari zombie class)
    if (!rawName || rawName === "*" || /^[*?]+$/.test(rawName)) {
      log("warn", "reject job · star/empty filename");
      learn({
        kind: "reject_star_filename",
        raw: rawName,
        at: now(),
      });
      return null;
    }
    var fn = safeFilename(opts.filename, "download");
    if (fn === "*" || !fn) {
      log("warn", "reject job · bad filename");
      learn({
        kind: "reject_star_filename",
        raw: String(opts.filename || ""),
        at: now(),
      });
      return null;
    }
    while (countJobs() >= MAX_JOBS) {
      // drop oldest terminal jobs first
      var oldest = null;
      var oldestT = Infinity;
      for (var k in jobs) {
        var j0 = jobs[k];
        if (j0 && j0.created_at < oldestT) {
          oldestT = j0.created_at;
          oldest = k;
        }
      }
      if (oldest) delete jobs[oldest];
      else break;
    }
    var job = {
      id: id,
      origin: String(opts.origin || (typeof location !== "undefined" ? location.origin : "") || ""),
      url: String(opts.url || "").slice(0, 2000),
      filename: fn,
      state: "preparing",
      created_at: now(),
      deadline: now() + (opts.ttl_ms || PREPARE_TTL_MS),
      bytes: 0,
      path: opts.path || null,
      cancel_token: true,
      note: opts.note || "",
    };
    jobs[id] = job;
    log("ok", "job " + id + " preparing · " + fn);
    return job;
  }

  function setState(id, state, extra) {
    var j = jobs[id];
    if (!j) return false;
    j.state = state;
    j.updated_at = now();
    if (extra && typeof extra === "object") {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) j[k] = extra[k];
      }
    }
    if (state === "transfer") {
      j.deadline = now() + 120000;
    }
    if (state === "done" || state === "failed" || state === "cancelled") {
      j.deadline = now() + 30000; // keep brief for UI then sweep
    }
    return true;
  }

  function cancel(id) {
    var j = jobs[id];
    if (!j) return false;
    // ALWAYS succeeds even if network gone — Safari gap
    j.state = "cancelled";
    j.cancel_token = false;
    j.updated_at = now();
    j.deadline = now() + 1500;
    log("ok", "cancel " + id + " (always)");
    return true;
  }

  function clearAll() {
    var n = 0;
    for (var k in jobs) {
      delete jobs[k];
      n++;
    }
    log("ok", "clearAll · " + n);
    return n;
  }

  function sweep() {
    var t = now();
    var removed = 0;
    var timed = 0;
    for (var k in jobs) {
      var j = jobs[k];
      if (!j) continue;
      if (j.state === "preparing" && t > j.deadline) {
        j.state = "failed";
        j.note = (j.note || "") + " · prepare_ttl";
        j.updated_at = t;
        timed++;
        learn({
          kind: "prepare_ttl",
          id: j.id,
          filename: j.filename,
          at: t,
        });
        // remove after marking failed
        delete jobs[k];
        removed++;
        continue;
      }
      if (
        (j.state === "failed" || j.state === "cancelled" || j.state === "done") &&
        t > j.deadline
      ) {
        delete jobs[k];
        removed++;
      }
    }
    if (removed) log("ok", "sweep · removed " + removed + (timed ? " (ttl " + timed + ")" : ""));
    paintBadge();
    return { removed: removed, timed: timed, live: countJobs() };
  }

  function learn(finding) {
    findings.push(finding || {});
    if (findings.length > 80) findings = findings.slice(-60);
    try {
      window.dispatchEvent(
        new CustomEvent("mg-field-trigger", { detail: finding })
      );
    } catch (e) {}
    try {
      if (window.__mgWebInspect && window.__mgWebInspect.onFieldTrigger) {
        window.__mgWebInspect.onFieldTrigger(finding);
      }
    } catch (e2) {}
  }

  function list() {
    var out = [];
    for (var k in jobs) {
      if (Object.prototype.hasOwnProperty.call(jobs, k)) out.push(jobs[k]);
    }
    out.sort(function (a, b) {
      return (b.created_at || 0) - (a.created_at || 0);
    });
    return out;
  }

  function status() {
    return {
      ver: VER,
      armed: armed,
      prepare_ttl_ms: PREPARE_TTL_MS,
      jobs: list(),
      findings: findings.slice(-12),
      advantage:
        "MG never keeps Preparing forever · cancel always works · * filenames rejected",
    };
  }

  function paintBadge() {
    try {
      var el = document.getElementById("mg-job-hygiene-badge");
      var n = countJobs();
      if (!n) {
        if (el) el.style.display = "none";
        return;
      }
      if (!el) {
        el = document.createElement("div");
        el.id = "mg-job-hygiene-badge";
        el.title = "Job hygiene · click to sweep/clear";
        el.style.cssText =
          "position:fixed;right:12px;top:48px;z-index:2147483005;pointer-events:auto;" +
          "font:700 10px/1 ui-monospace,Menlo,monospace;letter-spacing:0.06em;" +
          "padding:6px 10px;border-radius:999px;cursor:pointer;" +
          "background:rgba(12,16,22,0.88);border:1px solid rgba(120,200,255,0.35);" +
          "color:rgba(180,220,255,0.95);backdrop-filter:blur(12px)";
        el.onclick = function () {
          sweep();
          clearAll();
        };
        (document.body || document.documentElement).appendChild(el);
      }
      el.style.display = "block";
      el.textContent = "JOBS " + n;
    } catch (e) {}
  }

  /** Intercept anchor downloads that would create nameless / star files */
  function hookAnchors() {
    if (window.__mgJobHygieneAnchorHook) return;
    window.__mgJobHygieneAnchorHook = true;
    document.addEventListener(
      "click",
      function (ev) {
        try {
          var t = ev.target;
          if (!t || !t.closest) return;
          var a = t.closest("a[download]");
          if (!a) return;
          var name = a.getAttribute("download");
          var safe = safeFilename(name, "download");
          if (safe !== name) {
            a.setAttribute("download", safe);
            learn({ kind: "sanitize_download_attr", from: name, to: safe, at: now() });
          }
          createJob({
            filename: safe,
            url: a.href || "",
            origin: location.origin,
            note: "a[download]",
          });
          // move preparing → transfer shortly; real browser handles bytes
          var last = list()[0];
          if (last) {
            setTimeout(function () {
              setState(last.id, "transfer");
              setTimeout(function () {
                setState(last.id, "done");
              }, 400);
            }, 50);
          }
        } catch (e) {}
      },
      true
    );
  }

  /** Omnibox / paste guard helper for chrome that calls into hygiene */
  function guardNavigateInput(raw) {
    var r = sanitizePaste(raw);
    if (!r.ok) {
      learn({ kind: "block_navigate", reason: r.reason, raw: String(raw || "").slice(0, 80), at: now() });
      log("warn", "block navigate · " + r.reason);
      return r;
    }
    return r;
  }

  function soakProbe() {
    var cases = [
      "*",
      "  *  ",
      "\u001b[31mls\n*",
      "",
      "..",
      "https://example.com/x",
      "zzz.zzz.com/zz.html",
      "noise\nsee https://example.com/buried\nmore",
      "ls -la\n*",
    ];
    var report = [];
    cases.forEach(function (c) {
      var r = sanitizePaste(c);
      report.push({ input: String(c).slice(0, 40), ok: r.ok, kind: r.kind || r.reason, value: r.value || "" });
    });
    // ensure createJob rejects star
    var bad = createJob({ filename: "*", url: "https://example.invalid/*" });
    var good = createJob({ filename: "ok.bin", url: "https://example.invalid/ok.bin", ttl_ms: 500 });
    var storm = 0;
    for (var i = 0; i < BLOB_MAX + 2; i++) {
      if (!blobSpool("blob:soak-" + i, "soak-" + i + ".bin").ok) storm++;
    }
    if (good) {
      setTimeout(function () {
        sweep();
      }, 600);
    }
    log("ok", "soakProbe · cases " + report.length + " · starJob=" + !!bad + " · stormRejects=" + storm);
    return {
      cases: report,
      starRejected: !bad,
      goodCreated: !!good,
      blobStormRejects: storm,
      buriedUrlOk: !!(report[7] && report[7].ok),
    };
  }

  function arm() {
    if (armed) return status();
    armed = true;
    hookAnchors();
    try {
      window.addEventListener("pagehide", onReloadGuard);
      window.addEventListener("beforeunload", onReloadGuard);
    } catch (eU) {}
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      sweep();
    }, SWEEP_MS);
    log("ok", VER + " armed · prepare_ttl=" + PREPARE_TTL_MS + "ms");
    learn({ kind: "arm", at: now(), ver: VER });
    return status();
  }

  function disarm() {
    armed = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    log("ok", "disarmed");
  }

  window.__mgJobHygiene = {
    ver: VER,
    arm: arm,
    disarm: disarm,
    status: status,
    sweep: sweep,
    sanitizePaste: sanitizePaste,
    extractUrls: extractUrls,
    safeFilename: safeFilename,
    guardNavigateInput: guardNavigateInput,
    createJob: createJob,
    setState: setState,
    cancel: cancel,
    clearAll: clearAll,
    list: list,
    learn: learn,
    soakProbe: soakProbe,
    blobSpool: blobSpool,
    allowIframeDownload: allowIframeDownload,
    onReloadGuard: onReloadGuard,
    findings: function () {
      return findings.slice();
    },
  };

  // Auto-arm on main surfaces (not inspect dual-pane paint)
  try {
    if (!document.getElementById("pip-wrap")) {
      arm();
    }
  } catch (e) {
    arm();
  }
})();
