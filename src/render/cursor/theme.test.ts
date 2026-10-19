import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { CURSOR_SHAPES } from "@/shared/cursorShapes";
import { CURSOR_THEMES, normalizeCursorTheme } from "@/shared/cursorThemes";
import { cursorAssetUrl } from "./theme";
import HOTSPOTS from "./themeHotspots.json";

describe("cursor themes", () => {
  test("every theme has artwork and a hotspot for every shape", () => {
    for (const { id } of CURSOR_THEMES) {
      for (const shape of CURSOR_SHAPES) {
        expect(existsSync(`public${cursorAssetUrl(id, shape)}`)).toBe(true);
        const [x, y] = HOTSPOTS[id][shape];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1);
      }
    }
  });

  test("unknown themes fall back to macOS Tahoe", () => {
    expect(normalizeCursorTheme("mint")).toBe("mint");
    expect(normalizeCursorTheme("missing")).toBe("macos_tahoe");
    expect(normalizeCursorTheme(undefined)).toBe("macos_tahoe");
  });
});
