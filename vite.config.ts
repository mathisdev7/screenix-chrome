import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { createManifest } from "./src/manifest";

const root = import.meta.dirname;

function manifest(): Plugin {
  return {
    name: "screenix-manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify(createManifest(), null, 2) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), manifest()],
  resolve: { alias: { "@": resolve(root, "src") } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome118",
    rollupOptions: {
      input: {
        editor: resolve(root, "editor.html"),
        popup: resolve(root, "popup.html"),
        permissions: resolve(root, "permissions.html"),
        recorder: resolve(root, "recorder.html"),
        camera: resolve(root, "camera.html"),
        cameraSetup: resolve(root, "camera-setup.html"),
        background: resolve(root, "src/background/index.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
