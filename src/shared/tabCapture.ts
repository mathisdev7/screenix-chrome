const WEB_STORE_PAGES = [/^https:\/\/chromewebstore\.google\.com\//, /^https:\/\/chrome\.google\.com\/webstore/];
const BROWSER_SCHEMES = new Set(["chrome:", "chrome-untrusted:", "chrome-search:", "devtools:", "view-source:"]);

export function uncapturableReason(url: string, extensionOrigin: string, fileAccess: boolean): string | null {
  if (WEB_STORE_PAGES.some((page) => page.test(url))) return "Chrome doesn't let extensions record the Chrome Web Store.";
  const protocol = URL.parse(url)?.protocol;
  if (!protocol || BROWSER_SCHEMES.has(protocol)) return "Chrome doesn't let extensions record its own pages, like the new tab page or settings.";
  if (protocol === "chrome-extension:" && !url.startsWith(extensionOrigin)) return "Chrome doesn't let extensions record other extensions' pages.";
  if (protocol === "file:" && !fileAccess) return "To record local files, turn on \"Allow access to file URLs\" for Screenix in chrome://extensions.";
  return null;
}
