/**
 * fc-device-kit-v1 — browser + DevTools device support for GrokCast
 *
 * Covers Chrome / Safari / Firefox real engines and DevTools / RDM emulation.
 * Usage:
 *   <script src="/device-kit.js"></script>
 *   const d = FCDevice.detect();
 *   FCDevice.applyEmulation('iphone-14-pro'); // optional ?device=
 *   FCDevice.paintBadge(el);
 */
(function (global) {
  'use strict';

  const SCHEMA = 'fc-device-kit-v1';

  function ua() {
    return (global.navigator && navigator.userAgent) || '';
  }

  function detectEngine(userAgent) {
    const s = userAgent || ua();
    // Order matters: Chromium-based first (Edge, Chrome, CriOS)
    if (/Edg\//.test(s) || /Chrome\//.test(s) || /CriOS\//.test(s) || /Chromium/.test(s)) {
      return 'chromium';
    }
    if (/Firefox\//.test(s) || /FxiOS\//.test(s)) return 'gecko';
    if (/Safari\//.test(s) && !/Chrome\//.test(s) && !/CriOS\//.test(s)) return 'webkit';
    return 'unknown';
  }

  function detectRole(search) {
    const u = new URL(global.location && location.href || 'http://local/');
    const q = search || u.searchParams;
    if (q.get('tv') === '1' || q.get('cast') === '1' || q.get('role') === 'tv') return 'tv';
    if (q.get('emulate') === '1' || q.get('device')) return 'emulate';
    if (q.get('control') === '1' || q.get('pwa') === '1') return 'control';
    return 'control';
  }

  function featureProbe() {
    const nav = global.navigator || {};
    const secure = global.isSecureContext === true;
    const touch =
      ('ontouchstart' in global) ||
      (nav.maxTouchPoints && nav.maxTouchPoints > 0) ||
      false;
    const standalone =
      (nav.standalone === true) ||
      (global.matchMedia && matchMedia('(display-mode: standalone)').matches) ||
      false;
    const orient =
      typeof global.DeviceOrientationEvent !== 'undefined';
    const orientPerm =
      orient &&
      typeof DeviceOrientationEvent.requestPermission === 'function';
    const geo = !!(nav.geolocation && nav.geolocation.watchPosition);
    const gum = !!(nav.mediaDevices && nav.mediaDevices.getUserMedia);
    const sw = !!(nav.serviceWorker);
    const dpr = global.devicePixelRatio || 1;
    const vv = !!(global.visualViewport);
    const engine = detectEngine();
    return {
      engine: engine,
      secure_context: secure,
      touch: touch,
      standalone_pwa: standalone,
      deviceorientation: orient,
      deviceorientation_permission: orientPerm,
      geolocation: geo,
      getusermedia: gum && secure,
      getusermedia_raw: gum,
      serviceworker: sw,
      visual_viewport: vv,
      dpr: dpr,
      max_touch_points: nav.maxTouchPoints || 0,
      platform: nav.platform || '',
      language: nav.language || '',
      // Engine-specific guidance
      gyro_needs_gesture: engine === 'webkit' || orientPerm,
      media_needs_https: engine === 'webkit' || !secure,
    };
  }

  function detect(opts) {
    opts = opts || {};
    const u = new URL(global.location && location.href || 'http://local/');
    const role = detectRole(u.searchParams);
    const feats = featureProbe();
    const w = global.innerWidth || 0;
    const h = global.innerHeight || 0;
    const deviceParam = u.searchParams.get('device') || opts.device || null;
    return {
      schema: SCHEMA,
      role: role,
      engine: feats.engine,
      browser_label:
        feats.engine === 'chromium' ? 'Chrome/Chromium' :
        feats.engine === 'webkit' ? 'Safari' :
        feats.engine === 'gecko' ? 'Firefox' : 'Unknown',
      viewport: { w: w, h: h, dpr: feats.dpr },
      features: feats,
      device_param: deviceParam,
      emulate: u.searchParams.get('emulate') === '1' || !!deviceParam,
      ua: ua().slice(0, 180),
      t: Date.now() / 1000,
    };
  }

  let _presets = null;
  let _matrix = null;

  async function loadPresets() {
    if (_presets) return _presets;
    try {
      const r = await fetch('/api/devices/presets?_=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        _presets = await r.json();
        return _presets;
      }
    } catch (_) {}
    _presets = { schema: 'fc-devtools-presets-v1', presets: [] };
    return _presets;
  }

  async function loadMatrix() {
    if (_matrix) return _matrix;
    try {
      const r = await fetch('/api/devices/matrix?_=' + Date.now(), { cache: 'no-store' });
      if (r.ok) {
        _matrix = await r.json();
        return _matrix;
      }
    } catch (_) {}
    _matrix = { schema: 'fc-browser-matrix-v1', engines: {} };
    return _matrix;
  }

  function findPreset(id, pack) {
    const list = (pack && pack.presets) || [];
    return list.find((p) => p.id === id) || null;
  }

  /**
   * Soft viewport emulation for surfaces (CSS + meta). Does not replace real DevTools
   * sensors, but lets desk preview phone chrome without thrashing cams.
   */
  function applyEmulation(presetOrId, pack) {
    const preset = typeof presetOrId === 'string'
      ? findPreset(presetOrId, pack || _presets)
      : presetOrId;
    if (!preset) return null;
    const root = document.documentElement;
    root.classList.add('fc-emulate');
    root.dataset.device = preset.id;
    root.dataset.deviceLabel = preset.label || preset.id;
    root.style.setProperty('--fc-device-w', preset.w + 'px');
    root.style.setProperty('--fc-device-h', preset.h + 'px');
    root.style.setProperty('--fc-device-dpr', String(preset.dpr || 1));
    if (preset.safe_area) {
      root.style.setProperty('--sat', (preset.safe_area.top || 0) + 'px');
      root.style.setProperty('--sab', (preset.safe_area.bottom || 0) + 'px');
    }
    // Frame stage if a host #fc-device-frame exists
    const frame = document.getElementById('fc-device-frame');
    if (frame) {
      frame.style.width = preset.w + 'px';
      frame.style.height = preset.h + 'px';
      frame.style.maxWidth = '100%';
      frame.style.maxHeight = '100%';
      frame.dataset.device = preset.id;
    }
    // Body class for mobile touch affordances
    document.body.classList.toggle('fc-touch', !!preset.touch);
    document.body.classList.toggle('fc-mobile', !!preset.mobile);
    if (preset.role_hint === 'tv') document.body.classList.add('tv');
    return preset;
  }

  function clearEmulation() {
    const root = document.documentElement;
    root.classList.remove('fc-emulate');
    delete root.dataset.device;
    delete root.dataset.deviceLabel;
    document.body.classList.remove('fc-touch', 'fc-mobile');
  }

  function paintBadge(el, info) {
    if (!el) return;
    info = info || detect();
    const v = info.viewport || {};
    el.textContent =
      (info.browser_label || info.engine) +
      ' · ' + (info.role || '?') +
      ' · ' + v.w + '×' + v.h +
      '@' + (v.dpr || 1).toFixed(2) +
      (info.emulate && info.device_param ? ' · emu ' + info.device_param : '') +
      (info.features && info.features.secure_context ? ' · https' : ' · insecure');
    el.title = info.ua || '';
    el.classList.add('fc-device-badge');
    if (info.features && !info.features.secure_context) el.classList.add('warn');
    else el.classList.add('ok');
  }

  /** Inject a small floating badge (control surfaces). */
  function mountBadge(opts) {
    opts = opts || {};
    if (document.getElementById('fc-device-badge')) return detect();
    const el = document.createElement('div');
    el.id = 'fc-device-badge';
    el.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:80;font:600 10px ui-monospace,monospace;' +
      'padding:3px 8px;border-radius:4px;background:rgba(0,0,0,.55);color:#8ec8ff;' +
      'pointer-events:none;max-width:min(92vw,28rem);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
    document.body.appendChild(el);
    const info = detect();
    paintBadge(el, info);
    if (opts.hideOnTv && info.role === 'tv') el.style.display = 'none';
    return info;
  }

  async function bootFromQuery() {
    const info = detect();
    const pack = await loadPresets();
    if (info.device_param) {
      applyEmulation(info.device_param, pack);
    }
    if (!info.role || info.role !== 'tv') {
      mountBadge({ hideOnTv: true });
    }
    // Report to hub (optional fleet)
    try {
      fetch('/api/devices/hello', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      }).catch(function () {});
    } catch (_) {}
    return info;
  }

  const api = {
    SCHEMA: SCHEMA,
    detect: detect,
    detectEngine: detectEngine,
    featureProbe: featureProbe,
    loadPresets: loadPresets,
    loadMatrix: loadMatrix,
    applyEmulation: applyEmulation,
    clearEmulation: clearEmulation,
    paintBadge: paintBadge,
    mountBadge: mountBadge,
    bootFromQuery: bootFromQuery,
  };

  global.FCDevice = api;
})(typeof window !== 'undefined' ? window : globalThis);
