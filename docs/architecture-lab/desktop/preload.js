/**
 * Preload — desktop bridge for floating TUI-style shell.
 * No Node APIs exposed beyond controlled IPC.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LabDesktop", {
  isDesktop: true,
  platform: process.platform,
  getMode: () => ipcRenderer.invoke("lab:get-mode"),
  setMode: (mode) => ipcRenderer.invoke("lab:set-mode", mode),
  minimize: () => ipcRenderer.invoke("lab:minimize"),
  close: () => ipcRenderer.invoke("lab:close"),
  toggleAlwaysOnTop: () => ipcRenderer.invoke("lab:toggle-aot"),
});
