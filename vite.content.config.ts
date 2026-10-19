import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;

const CONTENT_SCRIPTS: Record<string, string> = {
  "pointer-tracker": "src/content/pointerTracker.ts",
  "license-bridge": "src/content/licenseBridge.ts",
};

export default defineConfig(({ mode }) => {
  const entry = CONTENT_SCRIPTS[mode];
  if (!entry) throw new Error(`Unknown content script "${mode}". Use --mode ${Object.keys(CONTENT_SCRIPTS).join(" or --mode ")}.`);
  return {
    resolve: { alias: { "@": resolve(root, "src") } },
    build: {
      outDir: "dist",
      emptyOutDir: false,
      target: "chrome118",
      lib: {
        entry: resolve(root, entry),
        formats: ["iife"],
        name: "ScreenixContentScript",
        fileName: () => `${mode}.js`,
      },
    },
  };
});
