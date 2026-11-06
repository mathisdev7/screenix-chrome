import { describe, expect, test } from "bun:test";
import { EXPORTS_BEFORE_RATING, ratingPromptDue } from "./rating";

describe("ratingPromptDue", () => {
  test("waits for the third export", () => {
    expect(ratingPromptDue({ exports: EXPORTS_BEFORE_RATING - 1, asked: false })).toBe(false);
    expect(ratingPromptDue({ exports: EXPORTS_BEFORE_RATING, asked: false })).toBe(true);
    expect(ratingPromptDue({ exports: EXPORTS_BEFORE_RATING + 4, asked: false })).toBe(true);
  });

  test("asks only once", () => {
    expect(ratingPromptDue({ exports: EXPORTS_BEFORE_RATING + 1, asked: true })).toBe(false);
  });
});
