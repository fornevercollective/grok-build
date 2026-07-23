/* Memory Glass · phone loud speak (single layer)
 * One Audio element · claim-before-play · no m4a+WebSpeech stack · no double poll
 * VER: phone-speak-v4-single
 */
(function (global) {
  "use strict";
  var VER = "phone-speak-v4-single";
  if (global.__mgPhoneSpeak && global.__mgPhoneSpeak.ver === VER) return;

  var BASE = global.MG_STILL_BASE || location.origin;
  var lastSpokeEpoch = 0;
  var lastSpokeText = "";
  var lastPlayedKey = "";
  var unlocked = false;
  var speaking = false;
  var playGen = 0; /* bump to cancel in-flight */
  var pending = null;
  var sharedAudio = null;
  var preferFileOnly = true; /* never stack Web Speech under m4a */
  var speakOn = true;
  try {
    if (localStorage.getItem("mg.phone.speak") === "0") speakOn = false;
  } catch (e) {}

  function log(msg) {
    try {
      console.log("[mg-speak]", msg);
    } catch (e) {}
  }

  function toast(msg) {
    try {
      var el = document.getElementById("toast") || document.getElementById("cd-status");
      if (el) {
        if (el.id === "toast") {
          el.textContent = msg;
          el.classList.add("show");
          setTimeout(function () {
            el.classList.remove("show");
          }, 2000);
        } else {
          el.textContent = msg;
        }
      }
    } catch (e) {}
  }

  function msgKey(msg) {
    if (!msg) return "";
    var ep = Number(msg.epoch || 0);
    var id = msg.tts_id || "";
    var url = msg.tts || "";
    var text = String(msg.text || "").slice(0, 80);
    /* prefer stable server id; fall back to epoch+text */
    if (id) return "id:" + id;
    if (url && url.indexOf("/tts/") === 0 && url.indexOf("latest") < 0) return "url:" + url;
    if (ep) return "ep:" + ep + ":" + text;
    return "t:" + text;
  }

  function stopAll() {
    playGen += 1;
    speaking = false;
    try {
      if (sharedAudio) {
        sharedAudio.onended = null;
        sharedAudio.onerror = null;
        sharedAudio.pause();
        sharedAudio.removeAttribute("src");
        sharedAudio.load();
      }
    } catch (e) {}
    try {
      if (global.speechSynthesis) global.speechSynthesis.cancel();
    } catch (e2) {}
  }

  function ensureAudio() {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.setAttribute("playsinline", "true");
      sharedAudio.setAttribute("webkit-playsinline", "true");
      sharedAudio.preload = "auto";
      sharedAudio.volume = 1;
    }
    return sharedAudio;
  }

  function unlock() {
    unlocked = true;
    try {
      if (global.speechSynthesis) global.speechSynthesis.resume();
    } catch (e) {}
    try {
      var a = ensureAudio();
      a.src =
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
      a.volume = 0.01;
      var p = a.play();
      if (p && p.then) {
        p.then(function () {
          try {
            a.pause();
            a.currentTime = 0;
          } catch (e3) {}
          a.volume = 1;
        }).catch(function () {});
      }
    } catch (e2) {}
    toast("speaker on · single layer");
    if (pending) {
      var m = pending;
      pending = null;
      speakMessage(m, true);
    }
    return true;
  }

  function setSpeak(on) {
    speakOn = !!on;
    try {
      localStorage.setItem("mg.phone.speak", speakOn ? "1" : "0");
    } catch (e) {}
    if (!speakOn) stopAll();
    return speakOn;
  }

  function playUrl(url, gen) {
    return new Promise(function (resolve) {
      if (!url) {
        resolve(false);
        return;
      }
      try {
        var a = ensureAudio();
        /* hard stop previous layer before new src */
        try {
          a.pause();
          a.onended = null;
          a.onerror = null;
        } catch (e0) {}
        var full = url + (url.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          if (gen !== playGen) {
            resolve(false);
            return;
          }
          resolve(!!ok);
        }
        a.onended = function () {
          finish(true);
        };
        a.onerror = function () {
          finish(false);
        };
        a.volume = 1;
        a.src = full;
        var p = a.play();
        if (p && p.then) {
          p.then(function () {
            /* playing — only this gen owns the speaker */
            if (gen !== playGen) {
              try {
                a.pause();
              } catch (e) {}
              finish(false);
            }
          }).catch(function (err) {
            log("play blocked: " + (err && err.message ? err.message : err));
            finish(false);
          });
        } else {
          setTimeout(function () {
            if (!done) finish(a.currentTime > 0 || !a.paused);
          }, 400);
        }
      } catch (e) {
        resolve(false);
      }
    });
  }

  function speakText(text, gen) {
    text = String(text || "").trim();
    if (!text) return Promise.resolve(false);
    return new Promise(function (resolve) {
      try {
        if (!global.speechSynthesis) {
          resolve(false);
          return;
        }
        if (gen !== playGen) {
          resolve(false);
          return;
        }
        global.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(text.slice(0, 500));
        u.rate = 1.02;
        u.pitch = 1;
        u.lang = "en-US";
        u.onend = function () {
          resolve(gen === playGen);
        };
        u.onerror = function () {
          resolve(false);
        };
        global.speechSynthesis.speak(u);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function speakMessage(msg, force) {
    if (!speakOn || !msg) return Promise.resolve({ ok: false, reason: "off" });
    if (msg.role && msg.role !== "assistant")
      return Promise.resolve({ ok: false, reason: "role" });

    var text = String(msg.text || "").trim();
    var ep = Number(msg.epoch || 0);
    var key = msgKey(msg);

    if (!force) {
      if (key && key === lastPlayedKey)
        return Promise.resolve({ ok: false, reason: "dup-key" });
      if (ep && ep <= lastSpokeEpoch && text && text === lastSpokeText)
        return Promise.resolve({ ok: false, reason: "old" });
      /* ignore near-duplicate text within 2.5s (double agent replies) */
      if (
        text &&
        text === lastSpokeText &&
        Date.now() / 1000 - lastSpokeEpoch < 2.5
      )
        return Promise.resolve({ ok: false, reason: "dup-text" });
    }

    if (!text && !msg.tts && !msg.tts_latest)
      return Promise.resolve({ ok: false, reason: "empty" });

    if (!unlocked) {
      pending = msg;
      toast("tap Speaker for sound");
      return Promise.resolve({ ok: false, reason: "locked" });
    }

    if (speaking && !force) {
      /* replace pending with newer; do not stack layers */
      pending = msg;
      return Promise.resolve({ ok: false, reason: "busy" });
    }

    /* claim immediately so poll + onMessages can't double-fire */
    lastPlayedKey = key || lastPlayedKey;
    lastSpokeEpoch = ep || Date.now() / 1000;
    lastSpokeText = text || lastSpokeText;

    stopAll(); /* cancel prior layer */
    var gen = playGen; /* stopAll bumped gen; re-read after stop */
    /* stopAll increments playGen — capture after */
    gen = playGen;
    speaking = true;

    /* Prefer the unique file for THIS reply — not always latest.m4a (avoids replaying wrong layer) */
    var ttsUrl = msg.tts || msg.tts_latest || null;
    if (ttsUrl && ttsUrl.charAt(0) === "/") ttsUrl = BASE + ttsUrl;
    else if (!ttsUrl) ttsUrl = BASE + "/tts/latest.m4a";

    return playUrl(ttsUrl, gen)
      .then(function (ok) {
        if (gen !== playGen) {
          speaking = false;
          return { ok: false, reason: "cancelled" };
        }
        if (ok) {
          speaking = false;
          toast("speaking");
          flushPending();
          return { ok: true, via: "file" };
        }
        /* file failed — only then Web Speech (never both) */
        if (preferFileOnly && !text) {
          speaking = false;
          /* allow retry of same key if file failed */
          if (lastPlayedKey === key) lastPlayedKey = "";
          return { ok: false, via: "fail" };
        }
        return speakText(text, gen).then(function (ok2) {
          speaking = false;
          if (ok2) {
            toast("speaking");
            flushPending();
            return { ok: true, via: "webspeech" };
          }
          if (lastPlayedKey === key) lastPlayedKey = "";
          pending = msg;
          unlocked = false;
          toast("tap Speaker · blocked");
          return { ok: false, via: "fail" };
        });
      })
      .catch(function () {
        speaking = false;
        if (lastPlayedKey === key) lastPlayedKey = "";
        return { ok: false, reason: "err" };
      });
  }

  function flushPending() {
    if (!pending || speaking) return;
    var m = pending;
    var k = msgKey(m);
    if (k && k === lastPlayedKey) {
      pending = null;
      return;
    }
    pending = null;
    speakMessage(m, false);
  }

  function onMessages(messages) {
    if (!messages || !messages.length) return;
    var lastA = null;
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && messages[i].role === "assistant") {
        lastA = messages[i];
        break;
      }
    }
    if (!lastA) return;
    speakMessage(lastA, false);
  }

  var lastPullId = "";
  function pullLatestTts(force) {
    return fetch(BASE + "/tts/latest.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (t) {
        if (!t || !t.t) return;
        var age = Date.now() / 1000 - Number(t.t);
        if (age > 60 && !force) return;
        var id = String(t.id || t.t);
        if (!force && id === lastPullId) return;
        if (!force && ("id:" + id) === lastPlayedKey) return;
        lastPullId = id;
        var msg = {
          role: "assistant",
          text: t.text || "",
          epoch: Number(t.t) || Date.now() / 1000,
          tts: t.url || null, /* specific file, not latest alias */
          tts_latest: t.latest || "/tts/latest.m4a",
          tts_id: id,
          speak: true,
        };
        return speakMessage(msg, !!force);
      })
      .catch(function () {});
  }

  function fleetRegister(extra) {
    extra = extra || {};
    var body = {
      id:
        extra.id ||
        localStorage.getItem("mg.fleet.id") ||
        "phone-" + Math.random().toString(36).slice(2, 8),
      role: extra.role || "phone",
      name: extra.name || "Phone PWA",
      host: location.hostname,
      ports: { page: location.port || "" },
      caps: ["mic", "cam", "talk", "loud-tts"],
      ua: (navigator.userAgent || "").slice(0, 120),
      meta: { path: location.pathname, ver: VER },
    };
    try {
      localStorage.setItem("mg.fleet.id", body.id);
    } catch (e) {}
    return fetch(BASE + "/fleet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  ["pointerdown", "touchstart", "click", "keydown"].forEach(function (ev) {
    document.addEventListener(
      ev,
      function () {
        if (!unlocked) unlock();
      },
      { once: false, passive: true }
    );
  });

  /* Backup poll only — onMessages is primary; longer interval cuts layers */
  setInterval(function () {
    if (speakOn && unlocked && !speaking) pullLatestTts(false);
  }, 2800);

  function wireButtons() {
    ["btn-speaker", "btn-unlock", "btn-hold", "btn-hold-ctl", "btn-hold-hdr"].forEach(
      function (id) {
        var b = document.getElementById(id);
        if (!b || b.__mgSpeakWired) return;
        b.__mgSpeakWired = true;
        b.addEventListener(
          "pointerdown",
          function () {
            unlock();
          },
          { passive: true }
        );
      }
    );
    var sp = document.getElementById("btn-speaker");
    if (sp && !sp.__mgSpeakClick) {
      sp.__mgSpeakClick = true;
      sp.addEventListener("click", function () {
        unlock();
        /* force replay latest once — stops first */
        stopAll();
        lastPlayedKey = "";
        pullLatestTts(true);
      });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButtons);
  } else {
    wireButtons();
  }
  setTimeout(wireButtons, 400);

  global.__mgPhoneSpeak = {
    ver: VER,
    unlock: unlock,
    stop: stopAll,
    setSpeak: setSpeak,
    speakOn: function () {
      return speakOn;
    },
    isUnlocked: function () {
      return unlocked;
    },
    speakMessage: speakMessage,
    speakText: function (t) {
      return speakText(t, playGen);
    },
    playUrl: function (u) {
      return playUrl(u, playGen);
    },
    onMessages: onMessages,
    pullLatest: pullLatestTts,
    fleetRegister: fleetRegister,
    setBase: function (b) {
      BASE = b || BASE;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
