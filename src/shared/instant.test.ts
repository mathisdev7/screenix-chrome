import { describe, expect, test } from "bun:test";
import { DEFAULT_INSTANT_STYLE, instantSettings, normalizeInstantStyle } from "./instant";
import { createDefaultSettings } from "./settings";

describe("instantSettings", () => {
  test("keeps the studio defaults for the default style", () => {
    const defaults = createDefaultSettings();
    expect(instantSettings("framed", DEFAULT_INSTANT_STYLE)).toEqual(defaults);
    expect(instantSettings("full", DEFAULT_INSTANT_STYLE).background).toEqual({ ...defaults.background, enabled: false });
  });

  test("applies the chosen style", () => {
    const settings = instantSettings("full", {
      cursorTheme: "neon",
      cursorSize: 3.2,
      clickEffect: "ripple",
      hideCursorWhenIdle: true,
      wallpaper: "builtin:Sonoma",
      browserFrame: "dark",
      cameraSize: 0.32,
      cameraMirror: false,
    });
    expect(settings.cursor).toMatchObject({ theme: "neon", size: 3.2, clickEffect: "ripple", hideWhenIdle: true });
    expect(settings.background).toMatchObject({ enabled: false, wallpaper: "builtin:Sonoma", browserFrame: "dark" });
    expect(settings.camera).toMatchObject({ size: 0.32, mirror: false });
  });
});

describe("normalizeInstantStyle", () => {
  test("fills missing fields and drops unknown cursor themes", () => {
    expect(normalizeInstantStyle(undefined)).toEqual(DEFAULT_INSTANT_STYLE);
    expect(normalizeInstantStyle({ cursorSize: 4, cursorTheme: "gone" as never })).toEqual({ ...DEFAULT_INSTANT_STYLE, cursorSize: 4 });
  });
});
