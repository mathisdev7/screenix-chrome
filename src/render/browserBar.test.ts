import { describe, expect, test } from "bun:test";
import { BrowserPages, displayUrl } from "./browserBar";

describe("browser bar", () => {
  test("shows the host without www and the rest of the address", () => {
    expect(displayUrl("https://www.example.com/docs/start?tab=2#install")).toEqual({ host: "example.com", path: "/docs/start?tab=2#install" });
    expect(displayUrl("http://localhost:3000/")).toEqual({ host: "localhost:3000", path: "" });
    expect(displayUrl("about:blank")).toEqual({ host: "about:blank", path: "" });
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
});
