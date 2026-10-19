import { SCREENIX_ORIGIN } from "./shared/screenixOrigin";

function licensePagePattern(): string {
  const { protocol, hostname } = new URL(SCREENIX_ORIGIN);
  return `${protocol}//${hostname}/purchase/success*`;
}

export function createManifest(): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: "Screenix for Chrome",
    short_name: "Screenix",
    version: "0.1.0",
    description: "Screen record Chrome tabs with a buttery-smooth cursor, webcam and mic. Edit, export in 4K, or share a link.",
    minimum_chrome_version: "118",
    icons: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
    action: {
      default_title: "Screenix",
      default_popup: "popup.html",
      default_icon: { 16: "icons/icon-16.png", 32: "icons/icon-32.png" },
    },
    background: { service_worker: "background.js", type: "module" },
    permissions: ["alarms", "debugger", "downloads", "offscreen", "scripting", "storage", "tabCapture", "tabs", "unlimitedStorage"],
    host_permissions: ["<all_urls>"],
    commands: {
      "toggle-recording": {
        suggested_key: { default: "Alt+Shift+R" },
        description: "Start or stop recording",
      },
    },
    content_scripts: [
      { matches: [licensePagePattern()], js: ["license-bridge.js"], run_at: "document_start" },
    ],
  };
}
