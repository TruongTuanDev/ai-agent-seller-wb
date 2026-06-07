import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-manifest",
      closeBundle() {
        const manifestPath = resolve(__dirname, "manifest.json");
        const distPath = resolve(__dirname, "dist/manifest.json");
        mkdirSync(dirname(distPath), { recursive: true });
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifest.background.service_worker = "assets/background.js";
        manifest.content_scripts[0].js = ["assets/content.js"];
        writeFileSync(distPath, JSON.stringify(manifest, null, 2));
      }
    }
  ],
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        sidepanel: resolve(__dirname, "sidepanel.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts")
      },
      output: {
        entryFileNames: "assets/[name].js"
      }
    }
  }
});
