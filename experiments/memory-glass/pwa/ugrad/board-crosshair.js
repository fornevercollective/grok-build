/* Board precision crosshair — go-ugrad / games hub style
 * Full H+V dashed lines through hover point + center ring.
 * Use on WebGrid canvas, Go SVG, Chess board, Glyph canvas.
 * API: BoardCrosshair.attach(el, opts) · .detach()
 */
(function (global) {
  "use strict";
  var VER = "board-crosshair-v1";

  function ensureCss() {
    if (document.getElementById("board-crosshair-css")) return;
    var st = document.createElement("style");
    st.id = "board-crosshair-css";
    st.textContent = [
      ".bcx-host{position:relative!important}",
      ".bcx-host.bcx-hide-cursor,.bcx-host.bcx-hide-cursor *{cursor:none!important}",
      ".bcx-overlay{",
      "  position:absolute;inset:0;pointer-events:none;z-index:20;",
      "  overflow:hidden;border-radius:inherit;opacity:0;transition:opacity .08s}",
      ".bcx-overlay.on{opacity:1}",
      ".bcx-overlay svg{width:100%;height:100%;display:block}",
      ".bcx-hl,.bcx-vl{stroke:rgba(130,190,255,.72);stroke-width:1;",
      "  stroke-dasharray:6 4;vector-effect:non-scaling-stroke}",
      ".bcx-hl-faint,.bcx-vl-faint{stroke:rgba(250,250,252,.2);stroke-width:1;",
      "  vector-effect:non-scaling-stroke}",
      ".bcx-ring{fill:none;stroke:rgba(88,166,255,.9);stroke-width:1.5;",
      "  vector-effect:non-scaling-stroke}",
      ".bcx-dot{fill:rgba(125,211,252,.85)}",
      ".bcx-cell{fill:rgba(56,139,253,.18);stroke:rgba(88,166,255,.55);stroke-width:1;",
      "  vector-effect:non-scaling-stroke}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  /**
   * @param {HTMLElement} el board host (canvas parent, #ch-board, #go-svg parent, etc.)
   * @param {object} opts
   *   grid: number — snap to N×N cells (webgrid/go/chess)
   *   snap: bool — snap cross to cell center
   *   showCell: bool — highlight cell under cursor
   *   color: stroke color
   *   hideCursor: bool (default true)
   */
  function attach(el, opts) {
    if (!el) return null;
    ensureCss();
    opts = opts || {};
    var grid = opts.grid | 0;
    var snap = opts.snap !== false && grid > 0;
    var showCell = opts.showCell !== false && grid > 0;
    var hideCursor = opts.hideCursor !== false;

    el.classList.add("bcx-host");
    if (hideCursor) el.classList.add("bcx-hide-cursor");

    var ov = el.querySelector(":scope > .bcx-overlay");
    if (!ov) {
      ov = document.createElement("div");
      ov.className = "bcx-overlay";
      ov.innerHTML =
        '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
        '<line class="bcx-vl-faint" x1="50" y1="0" x2="50" y2="100"/>' +
        '<line class="bcx-hl-faint" x1="0" y1="50" x2="100" y2="50"/>' +
        '<line class="bcx-vl" x1="50" y1="0" x2="50" y2="100"/>' +
        '<line class="bcx-hl" x1="0" y1="50" x2="100" y2="50"/>' +
        '<rect class="bcx-cell" x="0" y="0" width="0" height="0" style="display:none"/>' +
        '<circle class="bcx-ring" cx="50" cy="50" r="2.2"/>' +
        '<circle class="bcx-dot" cx="50" cy="50" r="0.55"/>' +
        "</svg>";
      /* ensure host can position overlay */
      var cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
      el.appendChild(ov);
    }

    var svg = ov.querySelector("svg");
    var vl = ov.querySelector(".bcx-vl");
    var hl = ov.querySelector(".bcx-hl");
    var vlf = ov.querySelector(".bcx-vl-faint");
    var hlf = ov.querySelector(".bcx-hl-faint");
    var ring = ov.querySelector(".bcx-ring");
    var dot = ov.querySelector(".bcx-dot");
    var cell = ov.querySelector(".bcx-cell");

    function setPos(nx, ny, cellI, cellJ) {
      /* nx,ny in 0..100 viewBox */
      vl.setAttribute("x1", nx);
      vl.setAttribute("x2", nx);
      vlf.setAttribute("x1", nx);
      vlf.setAttribute("x2", nx);
      hl.setAttribute("y1", ny);
      hl.setAttribute("y2", ny);
      hlf.setAttribute("y1", ny);
      hlf.setAttribute("y2", ny);
      ring.setAttribute("cx", nx);
      ring.setAttribute("cy", ny);
      dot.setAttribute("cx", nx);
      dot.setAttribute("cy", ny);
      if (showCell && cellI != null && cellJ != null && grid > 0) {
        var cw = 100 / grid;
        cell.style.display = "";
        cell.setAttribute("x", cellI * cw);
        cell.setAttribute("y", cellJ * cw);
        cell.setAttribute("width", cw);
        cell.setAttribute("height", cw);
      } else if (cell) {
        cell.style.display = "none";
      }
      ov.classList.add("on");
    }

    function onMove(ev) {
      var rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) return;
      var clientX = ev.clientX;
      var clientY = ev.clientY;
      if (ev.touches && ev.touches[0]) {
        clientX = ev.touches[0].clientX;
        clientY = ev.touches[0].clientY;
      }
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        ov.classList.remove("on");
        return;
      }
      var nx = (x / rect.width) * 100;
      var ny = (y / rect.height) * 100;
      var ci = null,
        cj = null;
      if (grid > 0) {
        ci = Math.min(grid - 1, Math.max(0, Math.floor((x / rect.width) * grid)));
        cj = Math.min(grid - 1, Math.max(0, Math.floor((y / rect.height) * grid)));
        if (snap) {
          nx = ((ci + 0.5) / grid) * 100;
          ny = ((cj + 0.5) / grid) * 100;
        }
      }
      setPos(nx, ny, ci, cj);
    }

    function onLeave() {
      ov.classList.remove("on");
    }

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("mouseenter", onMove, { passive: true });
    el.addEventListener("mouseleave", onLeave, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onLeave, { passive: true });

    return {
      ver: VER,
      el: el,
      overlay: ov,
      setGrid: function (n) {
        grid = n | 0;
        snap = opts.snap !== false && grid > 0;
        showCell = opts.showCell !== false && grid > 0;
      },
      destroy: function () {
        el.removeEventListener("mousemove", onMove);
        el.removeEventListener("mouseenter", onMove);
        el.removeEventListener("mouseleave", onLeave);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onLeave);
        if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        el.classList.remove("bcx-host", "bcx-hide-cursor");
      },
    };
  }

  /** Wrap a canvas so overlay can sit on top */
  function wrapCanvas(canvas) {
    if (!canvas || !canvas.parentNode) return canvas;
    if (canvas.parentNode.classList && canvas.parentNode.classList.contains("bcx-wrap")) {
      return canvas.parentNode;
    }
    var wrap = document.createElement("div");
    wrap.className = "bcx-wrap bcx-host";
    wrap.style.cssText =
      "position:relative;display:block;width:100%;max-width:" +
      (canvas.style.maxWidth || "min(92vw,480px)") +
      ";margin:0 auto;aspect-ratio:1;border-radius:inherit";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "none";
    canvas.parentNode.insertBefore(wrap, canvas);
    wrap.appendChild(canvas);
    return wrap;
  }

  global.BoardCrosshair = {
    ver: VER,
    attach: attach,
    wrapCanvas: wrapCanvas,
  };
})(typeof window !== "undefined" ? window : this);
