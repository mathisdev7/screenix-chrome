import { describe, expect, test } from "bun:test";
import { BrowserPages, displayUrl } from "./browserBar";

describe("browser bar", () => {
  test("shows the host without www and the path", () => {
    expect(displayUrl("https://www.example.com/docs/start?token=secret#access_token=secret", false)).toEqual({ host: "example.com", path: "/docs/start" });
    expect(displayUrl("https://example.com/?token=secret", false)).toEqual({ host: "example.com", path: "" });
    expect(displayUrl("http://localhost:3000/", false)).toEqual({ host: "localhost:3000", path: "" });
    expect(displayUrl("about:blank", false)).toEqual({ host: "about:blank", path: "" });
  });

  test("shows only a short label for addresses without a host", () => {
    expect(displayUrl("file:///home/me/clients/acme/contract%20final.pdf?x=1#page=2", true)).toEqual({ host: "contract final.pdf", path: "" });
    expect(displayUrl("file:///home/me/", false)).toEqual({ host: "file", path: "" });
    expect(displayUrl("data:text/html,<h1>secret</h1>", true)).toEqual({ host: "data", path: "" });
    expect(displayUrl("blob:https://example.com/0b6f0c2e", true)).toEqual({ host: "blob", path: "" });
    expect(displayUrl("about:blank?x=1", true)).toEqual({ host: "about:blank", path: "" });
    expect(displayUrl("", true)).toEqual({ host: "", path: "" });
  });

  test("shows the query and hash only when asked", () => {
    expect(displayUrl("https://www.example.com/docs/start?tab=2#install", true)).toEqual({ host: "example.com", path: "/docs/start?tab=2#install" });
  });

  test("shows the page that was open at each moment", () => {
    const pages = new BrowserPages([
      { t: 0.2, url: "https://a.test/", favicon: null },
      { t: 3, url: "https://b.test/", favicon: null },
    ]);
    expect(pages.at(0)?.url).toBe("https://a.test/");
    expect(pages.at(2.9)?.url).toBe("https://a.test/");
    expect(pages.at(3)?.url).toBe("https://b.test/");
    expect(BrowserPages.empty.at(1)).toBeNull();
  });

  test("shows edited addresses and keeps the favicon only on the same host", () => {
    const favicon = {} as ImageBitmap;
    const pages = new BrowserPages([
      { t: 0, url: "https://a.test/reset?token=1", favicon },
      { t: 3, url: "https://b.test/", favicon },
    ]).withUrls({ "https://a.test/reset?token=1": "https://a.test/reset", "https://b.test/": "https://c.test/" });
    expect(pages.at(0)).toEqual({ t: 0, url: "https://a.test/reset", favicon });
    expect(pages.at(3)).toEqual({ t: 3, url: "https://c.test/", favicon: null });
  });
});
