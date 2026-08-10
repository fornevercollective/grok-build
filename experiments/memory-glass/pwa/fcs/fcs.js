/* fcs.ugrad.ai · load skills + probe lang.ugrad.ai bridges */
(function () {
  "use strict";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function renderSkills(data) {
    var host = $("#skills-host");
    if (!host || !data || !data.groups) return;
    host.innerHTML = "";
    data.groups.forEach(function (g) {
      var section = el("section", "group");
      section.appendChild(el("h3", null, g.label || g.id));
      var grid = el("div", "grid");
      (g.skills || []).forEach(function (s) {
        var card = el("article", "skill");
        var top = el("div", "top-row");
        top.appendChild(el("b", null, s.title || s.id));
        var badge = el("span", "badge " + (s.status || "shipped"), s.status || "shipped");
        top.appendChild(badge);
        card.appendChild(top);
        card.appendChild(el("p", null, s.blurb || ""));
        if (s.slash) {
          card.appendChild(el("div", "slash", s.slash));
        }
        var cmd = el("div", "cmd", s.cmd || "");
        if (s.aliases && s.aliases.length) {
          cmd.textContent = (s.cmd || "") + "  ·  " + s.aliases.join(" · ");
        }
        card.appendChild(cmd);
        if (s.href) {
          var a = el("a", null, "open →");
          a.href = s.href;
          a.style.fontSize = "11px";
          a.style.marginTop = "6px";
          a.style.display = "inline-block";
          card.appendChild(a);
        }
        grid.appendChild(card);
      });
      section.appendChild(grid);
      host.appendChild(section);
    });
  }

  function setVer(v) {
    var pill = $("#ver-pill");
    if (pill && v && v.version) {
      pill.textContent = "v" + v.version;
    }
    var updated = $("#updated");
    if (updated && v && v.updated) updated.textContent = v.updated;
  }

  function probeLang() {
    var status = $("#probe-status");
    if (!status) return;
    status.textContent = "probing lang.ugrad.ai…";
    var urls = [
      "https://lang.ugrad.ai/version.json",
      "https://lang.ugrad.ai/sitemap.json",
    ];
    Promise.all(
      urls.map(function (u) {
        return fetch(u, { mode: "cors", cache: "no-store" })
          .then(function (r) {
            return r.ok
              ? r.json().then(function (j) {
                  return { ok: true, url: u, j: j };
                })
              : { ok: false, url: u, status: r.status };
          })
          .catch(function (e) {
            return { ok: false, url: u, err: String(e) };
          });
      })
    ).then(function (rows) {
      var ok = rows.filter(function (r) {
        return r.ok;
      }).length;
      var ver = rows[0] && rows[0].j && (rows[0].j.version || rows[0].j.ver);
      status.innerHTML =
        '<span class="' +
        (ok === rows.length ? "status-ok" : "status-lab") +
        '">lang bridge ' +
        ok +
        "/" +
        rows.length +
        "</span>" +
        (ver ? " · lang " + ver : "") +
        ' · <a href="https://lang.ugrad.ai/sitemap.html">sitemap</a> · ' +
        '<a href="https://lang.ugrad.ai/data/language/models-offline.html">offline models</a>';
    });
  }

  function boot() {
    var base = "/";
    try {
      // works from / and /download/
      if (location.pathname.indexOf("/download") === 0) base = "/";
    } catch (e) {}
    fetch(base + "version.json", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(setVer)
      .catch(function () {});
    fetch(base + "skills.json", { cache: "no-store" })
      .then(function (r) {
        return r.json();
      })
      .then(renderSkills)
      .catch(function (e) {
        var host = $("#skills-host");
        if (host) host.textContent = "skills.json load failed · " + e;
      });
    // optional quiet status only — no lang sitemap pop-out / modal
    try {
      if ($("#probe-status")) probeLang();
    } catch (e2) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
