import { describe, expect, test } from "bun:test";
import { editPageUrl, recordedPages } from "./pageUrls";

describe("page urls", () => {
  test("lists each address once with the times it was opened", () => {
    expect(recordedPages([
      { t: 0, url: "https://a.test/", favIconUrl: null },
      { t: 0.4, url: "https://a.test/", favIconUrl: "https://a.test/icon.png" },
      { t: 2, url: "https://b.test/", favIconUrl: null },
      { t: 5, url: "https://a.test/", favIconUrl: null },
    ])).toEqual([
      { url: "https://a.test/", times: [0, 5] },
      { url: "https://b.test/", times: [2] },
    ]);
  });

  test("stores an edit and drops it when the recorded address comes back", () => {
    const edited = editPageUrl({}, "https://a.test/?token=1", "https://a.test/");
    expect(edited).toEqual({ "https://a.test/?token=1": "https://a.test/" });
    expect(editPageUrl(edited, "https://a.test/?token=1", "https://a.test/?token=1")).toEqual({});
  });
});
