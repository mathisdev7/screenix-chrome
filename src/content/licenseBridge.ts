import { sendBackgroundRequest } from "@/shared/messages";

const PAGE_SOURCE = "screenix-web";
const EXTENSION_SOURCE = "screenix-extension";

type PageMessage =
  | { source: typeof PAGE_SOURCE; type: "ping" }
  | { source: typeof PAGE_SOURCE; type: "activate-key"; licenseKey: string };

type ExtensionMessage =
  | { source: typeof EXTENSION_SOURCE; type: "ready" }
  | { source: typeof EXTENSION_SOURCE; type: "activation-result"; ok: boolean; error?: string; code?: string; licenseId?: string };

function postToPage(message: ExtensionMessage) {
  window.postMessage(message, window.location.origin);
}

function isPageMessage(event: MessageEvent): event is MessageEvent<PageMessage> {
  return event.source === window && event.origin === window.location.origin && event.data?.source === PAGE_SOURCE;
}

async function activate(licenseKey: string) {
  const response = await sendBackgroundRequest({ type: "license/activate-key", licenseKey });
  postToPage(response.ok
    ? { source: EXTENSION_SOURCE, type: "activation-result", ok: true }
    : { source: EXTENSION_SOURCE, type: "activation-result", ok: false, error: response.error, code: response.code, licenseId: response.licenseId });
}

window.addEventListener("message", (event) => {
  if (!isPageMessage(event)) return;
  if (event.data.type === "ping") postToPage({ source: EXTENSION_SOURCE, type: "ready" });
  if (event.data.type === "activate-key" && typeof event.data.licenseKey === "string") void activate(event.data.licenseKey);
});

postToPage({ source: EXTENSION_SOURCE, type: "ready" });
