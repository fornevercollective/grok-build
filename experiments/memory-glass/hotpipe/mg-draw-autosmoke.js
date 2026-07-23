(function(){
  try {
    if (window.__mgRecChip && window.__mgRecChip.draw) {
      window.__mgRecChip.draw();
    }
    var r = {
      t: Date.now(),
      afterDraw: true,
      mini: !!(window.__mgMiniDraw && window.__mgMiniDraw.isActive && window.__mgMiniDraw.isActive()),
      annotate: !!(window.__mgSiteAnnotate || window.screenAnnotate),
      drawOn: !!(document.getElementById('mg-rec-draw') && document.getElementById('mg-rec-draw').classList.contains('on')),
      canvas: !!(document.getElementById('mg-mini-draw-cv') && document.getElementById('mg-mini-draw-cv').classList.contains('on')),
      rec: window.__mgRecChip && window.__mgRecChip.report ? window.__mgRecChip.report() : null
    };
    window.__mgDrawSmoke = r;
    if (window.ipc) window.ipc.postMessage(JSON.stringify({op:'smoke_probe', json: JSON.stringify(r)}));
    if (window.__mgDevLog) window.__mgDevLog('ok', 'draw-smoke '+JSON.stringify(r), 'smoke');
  } catch(e) {
    if (window.ipc) window.ipc.postMessage(JSON.stringify({op:'smoke_probe', json: JSON.stringify({err:String(e)})}));
  }
})();
