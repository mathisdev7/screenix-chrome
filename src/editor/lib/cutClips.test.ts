import { describe, expect, test } from "bun:test";
import { addCutClip } from "./cutClips";

const bounds = { start: 0, end: 10 };

describe("cut clips", () => {
  test("adds a 2 second cut at the playhead, shortened by the next cut or the trim", () => {
    const first = addCutClip([], 1, bounds, "a");
    expect(first).toEqual([{ id: "a", start: 1, end: 3 }]);
    expect(addCutClip(first!, 0, bounds, "b")?.[0]).toEqual({ id: "b", start: 0, end: 1 });
    expect(addCutClip(first!, 2, bounds, "c")).toBeNull();
    expect(addCutClip([], 9, bounds, "d")).toEqual([{ id: "d", start: 9, end: 10 }]);
  });
});
