/* Memory Glass · Still fleet link (Mini hub · phone · laptop)
 * Laptop upstairs: point at Mini LAN still-server; see live + chat; register peer.
 * VER: mg-still-fleet-v1
 */
(function () {
  "use strict";
  var VER = "mg-still-fleet-v1";
  var HP = (window.__mgHotPipe = window.__mgHotPipe || {});
  if (HP._stillFleetVer === VER) return;
  HP._stillFleetVer = VER;

  try {
    if (document.getElementById("pip-wrap")) return;
  } catch (e0) {}

  var hub = null;
  try {
    hub = localStorage.getItem("mg.still.hub") || "";
  } catch (e) {}
  if (!hub) hub = "http://127.0.0.1:9877";

  function log(m) {
    try {
      if (window.__mgDevLog) window.__mgDevLog("ok", String(m || ""), "fleet");
    } catch (e) {}
  }

  function setHub(url) {
    hub = String(url || "").replace(/\/$/, "");
    try {
      localStorage.setItem("mg.still.hub", hub);
    } catch (e) {}
    log("hub " + hub);
    return hub;
  }

  function nav(url) {
    try {
      if (window.ipc)
        window.ipc.postMessage(JSON.stringify({ op: "navigate", url: url }));
      else location.href = url;
    } catch (e) {
      try {
        location.href = url;
      } catch (e2) {}
    }
  }

  function openFleet() {
    var u = hub + "/fleet.html";
    nav(u);
    return u;
  }

  function openPhone() {
    /* Prefer HTTPS phone shell when possible */
    var host = hub.replace(/^https?:\/\//, "").split(":")[0];
    nav("https://" + host + ":9878/phone.html");
  }

  function register(role) {
    role = role || "laptop";
    var id =
      localStorage.getItem("mg.fleet.id") ||
      role + "-" + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem("mg.fleet.id", id);
    } catch (e) {}
    return fetch(hub + "/fleet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: id,
        role: role,
        name: role === "laptop" ? "Laptop MG" : role,
        caps: ["mg", "fleet", "chat"],
        ua: (navigator.userAgent || "").slice(0, 100),
      }),
      cache: "no-store",
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        log("registered " + role + " n=" + (j && j.n));
        return j;
      })
      .catch(function (e) {
        log("register fail " + e);
        return null;
      });
  }

  function status() {
    return fetch(hub + "/health?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return { ok: false };
      });
  }

  function say(text) {
    return fetch(hub + "/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: String(text || ""),
        src: "mg-laptop",
        tts: true,
        speak: true,
      }),
    }).then(function (r) {
      return r.json();
    });
  }

  function hear(text) {
    return fetch(hub + "/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: String(text || ""), src: "mg-laptop" }),
    }).then(function (r) {
      return r.json();
    });
  }

  window.__mgStillFleet = {
    ver: VER,
    hub: function () {
      return hub;
    },
    setHub: setHub,
    openFleet: openFleet,
    openPhone: openPhone,
    register: register,
    status: status,
    say: say,
    hear: hear,
    report: function () {
      return VER + " hub=" + hub;
    },
  };

  log(VER + " · " + hub);
})();
