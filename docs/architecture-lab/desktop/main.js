/**
 * Grok Build Lab — floating native-style shell (Electron fallback)
 *
 * Not a browser tab / not “open localhost”:
 *  - frameless floating window (TUI / Rust-tool aesthetic)
 *  - custom protocol lab://app/* for UI assets
 *  - silent local API process for /api/* (never shown as a URL bar)
 *  - walkie-first float mode + full lab mode
 */
const {
  app,
  BrowserWindow,
  shell,
  session,
  Menu,
  Tray,
  nativeImage,
  ipcMain,
  protocol,
  net,
  screen,
} = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const { pathToFileURL } = require("url");

const LAB_ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.LAB_PORT || 8765);
const HOST = "127.0.0.1";
const API_ORIGIN = `http://${HOST}:${PORT}`;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let serverProc = null;
let tray = null;
/** float | lab */
let windowMode = process.env.LAB_WINDOW_MODE || "float";

// Must register scheme before app ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "lab",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      bypassCSP: false,
    },
  },
]);

function iconPath() {
  for (const p of [
    path.join(LAB_ROOT, "assets/brand/grok-logomark-dark.png"),
    path.join(__dirname, "icon.png"),
  ]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function isServerUp() {
  return new Promise((resolve) => {
    const req = http.get(
      { host: HOST, port: PORT, path: "/api/health", timeout: 500 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startLabServer() {
  const serve = path.join(LAB_ROOT, "serve.sh");
  if (!fs.existsSync(serve)) return null;
  // Quiet background API — not a user-facing browser target
  const child = spawn("bash", [serve, String(PORT)], {
    cwd: LAB_ROOT,
    env: { ...process.env, HOST, LAB_DESKTOP: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  child.stdout?.on("data", (d) => {
    if (process.env.LAB_DEBUG) process.stdout.write(d);
  });
  child.stderr?.on("data", (d) => {
    if (process.env.LAB_DEBUG) process.stderr.write(d);
  });
  child.on("exit", () => {
    serverProc = null;
  });
  return child;
}

async function ensureServer() {
  if (await isServerUp()) return true;
  serverProc = startLabServer();
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isServerUp()) return true;
  }
  return false;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".webmanifest": "application/manifest+json",
    ".woff2": "font/woff2",
    ".map": "application/json",
  };
  return map[ext] || "application/octet-stream";
}

/**
 * lab://app/...  → files under LAB_ROOT
 * lab://app/api/... → reverse-proxy to silent local API (no UI URL exposure)
 */
function registerLabProtocol() {
  protocol.handle("lab", async (request) => {
    try {
      const u = new URL(request.url);
      // host is "app" for lab://app/...
      let rel = decodeURIComponent(u.pathname || "/");
      if (rel.startsWith("/")) rel = rel.slice(1);
      if (!rel || rel.endsWith("/")) rel += "index.html";

      // API proxy
      if (rel.startsWith("api/") || rel === "api") {
        const target = `${API_ORIGIN}/${rel}${u.search || ""}`;
        const init = {
          method: request.method,
          headers: request.headers,
          duplex: "half",
        };
        if (request.method !== "GET" && request.method !== "HEAD") {
          init.body = request.body;
        }
        try {
          return await net.fetch(target, init);
        } catch (e) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "api offline",
              message: String(e && e.message),
            }),
            {
              status: 502,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Block path escape
      const abs = path.normalize(path.join(LAB_ROOT, rel));
      if (!abs.startsWith(LAB_ROOT)) {
        return new Response("forbidden", { status: 403 });
      }
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
        // SPA fallback
        const index = path.join(LAB_ROOT, "index.html");
        if (fs.existsSync(index)) {
          return net.fetch(pathToFileURL(index).href);
        }
        return new Response("not found", { status: 404 });
      }
      return net.fetch(pathToFileURL(abs).href);
    } catch (err) {
      return new Response(String(err), { status: 500 });
    }
  });
}

function windowOptsForMode(mode) {
  const icon = iconPath();
  const display = screen.getPrimaryDisplay().workAreaSize;
  const base = {
    show: false,
    backgroundColor: "#0b0c0f",
    icon: icon || undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // allow lab:// media
      webSecurity: true,
    },
  };

  if (mode === "float") {
    // Compact floating pod — TUI/Rust tool vibe (frameless, always-on-top, center)
    const w = Math.min(520, Math.floor(display.width * 0.38));
    const h = Math.min(640, Math.floor(display.height * 0.72));
    return {
      ...base,
      width: w,
      height: h,
      minWidth: 360,
      minHeight: 420,
      frame: false,
      transparent: false,
      hasShadow: true,
      roundedCorners: true,
      alwaysOnTop: true,
      resizable: true,
      fullscreenable: false,
      skipTaskbar: false,
      title: "Grok Build Lab · float",
      vibrancy: process.platform === "darwin" ? "under-window" : undefined,
      visualEffectState: process.platform === "darwin" ? "active" : undefined,
    };
  }

  // Full lab workspace
  return {
    ...base,
    width: Math.min(1320, display.width - 40),
    height: Math.min(900, display.height - 40),
    minWidth: 800,
    minHeight: 560,
    frame: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 14, y: 12 },
    alwaysOnTop: false,
    title: "Grok Build Lab",
  };
}

function injectDesktopChrome() {
  // Frameless drag region + float chrome (runs after load)
  return `
    (function () {
      document.documentElement.classList.add('lab-desktop');
      document.documentElement.classList.add('lab-desktop-${windowMode}');
      document.body.classList.add('lab-desktop');
      document.body.classList.add('lab-desktop-${windowMode}');
      if (!document.getElementById('lab-desktop-titlebar')) {
        var bar = document.createElement('div');
        bar.id = 'lab-desktop-titlebar';
        bar.innerHTML = '<span class="lab-dt-dot"></span><span class="lab-dt-title">architecture-lab</span><span class="lab-dt-spacer"></span><button type="button" id="lab-dt-float" title="Float mode">⧉</button><button type="button" id="lab-dt-lab" title="Full lab">▣</button><button type="button" id="lab-dt-pin" title="Always on top">Pin</button><button type="button" id="lab-dt-min" title="Minimize">–</button><button type="button" id="lab-dt-close" title="Close">×</button>';
        document.body.prepend(bar);
        var s = document.createElement('style');
        s.textContent = \`
          html.lab-desktop, body.lab-desktop { background:#0b0c0f !important; }
          #lab-desktop-titlebar {
            position: fixed; top:0; left:0; right:0; z-index: 200;
            height: 32px; display:flex; align-items:center; gap:0.4rem;
            padding: 0 0.55rem 0 0.75rem;
            background: linear-gradient(180deg, #12141c 0%, #0c0e14 100%);
            border-bottom: 1px solid rgba(110,203,255,0.12);
            -webkit-app-region: drag; app-region: drag;
            font-family: ui-monospace, "IBM Plex Mono", Menlo, monospace;
            font-size: 11px; color: #8b93a7;
            user-select: none;
          }
          #lab-desktop-titlebar button {
            -webkit-app-region: no-drag; app-region: no-drag;
            appearance:none; border:1px solid #2a2f3a; background:#101218;
            color:#9aa3b5; border-radius:6px; width:26px; height:22px;
            font-size:11px; cursor:pointer; line-height:1;
          }
          #lab-desktop-titlebar button:hover { color:#6ecbff; border-color:rgba(110,203,255,0.4); }
          .lab-dt-title { letter-spacing:0.04em; color:#6ecbff; opacity:0.9; }
          .lab-dt-spacer { flex:1; }
          .lab-dt-dot {
            width:8px; height:8px; border-radius:50%;
            background: #4ade80; box-shadow:0 0 8px rgba(74,222,128,0.6);
          }
          body.lab-desktop { padding-top: 32px !important; }
          body.lab-desktop-float .term-footer { max-height: 120px; }
          body.lab-desktop-float .sidebar { max-width: 100%; }
          body.lab-desktop-float .app-tabs { flex-wrap: wrap; }
          body.lab-desktop-float #siri-burst {
            /* walkie is the product in float mode — keep centered */
          }
        \`;
        document.head.appendChild(s);
        document.getElementById('lab-dt-close').onclick = function(){ window.LabDesktop && LabDesktop.close(); };
        document.getElementById('lab-dt-min').onclick = function(){ window.LabDesktop && LabDesktop.minimize(); };
        document.getElementById('lab-dt-pin').onclick = function(){ window.LabDesktop && LabDesktop.toggleAlwaysOnTop(); };
        document.getElementById('lab-dt-float').onclick = function(){ window.LabDesktop && LabDesktop.setMode('float'); };
        document.getElementById('lab-dt-lab').onclick = function(){ window.LabDesktop && LabDesktop.setMode('lab'); };
      }
      if (window.LabWalkie && LabWalkie.centerSiri) {
        try { LabWalkie.showSiri && LabWalkie.showSiri(); LabWalkie.centerSiri(); } catch(e){}
      }
    })();
  `;
}

function createWindow(mode) {
  windowMode = mode || windowMode || "float";
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
    mainWindow = null;
  }

  const opts = windowOptsForMode(windowMode);
  mainWindow = new BrowserWindow(opts);

  // Center on screen
  mainWindow.center();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // External only — never spawn browser for lab itself
    if (url.startsWith("http://") || url.startsWith("https://")) {
      if (url.includes("127.0.0.1") || url.includes("localhost")) {
        return { action: "deny" };
      }
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents
      .executeJavaScript(injectDesktopChrome())
      .catch(() => {});
  });

  // UI via custom protocol — not http://localhost
  const entry =
    windowMode === "float"
      ? "lab://app/index.html#/00-overview"
      : "lab://app/index.html";
  mainWindow.loadURL(entry);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function wireIpc() {
  ipcMain.handle("lab:get-mode", () => windowMode);
  ipcMain.handle("lab:set-mode", (_e, mode) => {
    if (mode !== "float" && mode !== "lab") return windowMode;
    createWindow(mode);
    return mode;
  });
  ipcMain.handle("lab:minimize", () => {
    mainWindow?.minimize();
  });
  ipcMain.handle("lab:close", () => {
    mainWindow?.close();
  });
  ipcMain.handle("lab:toggle-aot", () => {
    if (!mainWindow) return false;
    const next = !mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(next, "floating");
    return next;
  });
  ipcMain.handle("lab:is-desktop", () => true);
  ipcMain.handle("lab:platform", () => process.platform);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "Window",
      submenu: [
        {
          label: "Float mode (walkie pod)",
          accelerator: "CmdOrCtrl+1",
          click: () => createWindow("float"),
        },
        {
          label: "Full lab mode",
          accelerator: "CmdOrCtrl+2",
          click: () => createWindow("lab"),
        },
        { type: "separator" },
        {
          label: "Always on top",
          type: "checkbox",
          checked: true,
          click: (item) => mainWindow?.setAlwaysOnTop(item.checked, "floating"),
        },
        {
          label: "Center walkie",
          click: () =>
            mainWindow?.webContents.executeJavaScript(
              "window.LabWalkie&&LabWalkie.showSiri&&LabWalkie.showSiri();LabWalkie.centerSiri&&LabWalkie.centerSiri()"
            ),
        },
        { type: "separator" },
        { role: "minimize" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Walkie",
      submenu: [
        {
          label: "Toggle Listen",
          accelerator: "CmdOrCtrl+L",
          click: () =>
            mainWindow?.webContents.executeJavaScript(
              "window.LabGrokListen&&LabGrokListen.toggle&&LabGrokListen.toggle()"
            ),
        },
        {
          label: "Camera",
          click: () =>
            mainWindow?.webContents.executeJavaScript(
              "window.LabWalkie&&LabWalkie.enableCam&&LabWalkie.enableCam()"
            ),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupTray() {
  const ip = iconPath();
  if (!ip) return;
  let img = nativeImage.createFromPath(ip);
  if (process.platform === "darwin") img = img.resize({ width: 18, height: 18 });
  tray = new Tray(img);
  tray.setToolTip("Grok Build Lab");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show float", click: () => createWindow("float") },
      { label: "Show full lab", click: () => createWindow("lab") },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
  tray.on("click", () => {
    if (mainWindow) mainWindow.show();
    else createWindow(windowMode);
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else createWindow(windowMode);
  });

  app.whenReady().then(async () => {
    app.setName("Grok Build Lab");
    registerLabProtocol();
    wireIpc();
    buildMenu();

    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(["media", "mediaKeySystem", "notifications"].includes(permission));
    });

    // API only — never open a browser to it
    await ensureServer();
    createWindow(windowMode);
    setupTray();

    app.on("activate", () => {
      if (!mainWindow) createWindow(windowMode);
      else mainWindow.show();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill("SIGTERM");
    } catch (_) {}
  }
});
