import { describe, expect, test } from "bun:test";
import { uncapturableReason } from "./tabCapture";

const OWN = "chrome-extension://daodleelbenbcdllpfecilgeldnncemp/";

describe("uncapturable tabs", () => {
  test("allows websites, blank pages and our own pages", () => {
    expect(uncapturableReason("https://example.com/", OWN, false)).toBeNull();
    expect(uncapturableReason("http://localhost:3000/chrome", OWN, false)).toBeNull();
    expect(uncapturableReason("about:blank", OWN, false)).toBeNull();
    expect(uncapturableReason(`${OWN}editor.html?project=1`, OWN, false)).toBeNull();
    expect(uncapturableReason("https://chrome.google.com/", OWN, false)).toBeNull();
  });

  test("flags the Web Store and Chrome pages", () => {
    expect(uncapturableReason("https://chromewebstore.google.com/detail/x/abc", OWN, false)).toContain("Web Store");
    expect(uncapturableReason("https://chrome.google.com/webstore/category/extensions", OWN, false)).toContain("Web Store");
    expect(uncapturableReason("chrome://newtab/", OWN, false)).toContain("its own pages");
    expect(uncapturableReason("chrome://extensions/", OWN, false)).toContain("its own pages");
    expect(uncapturableReason("devtools://devtools/bundled/inspector.html", OWN, false)).toContain("its own pages");
    expect(uncapturableReason("", OWN, false)).toContain("its own pages");
  });

  test("flags other extensions and local files without file access", () => {
    expect(uncapturableReason("chrome-extension://abcdefghijklmnopabcdefghijklmnop/page.html", OWN, false)).toContain("other extensions");
    expect(uncapturableReason("file:///home/me/demo.html", OWN, false)).toContain("file URLs");
    expect(uncapturableReason("file:///home/me/demo.html", OWN, true)).toBeNull();
  });
});
