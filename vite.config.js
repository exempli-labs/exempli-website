import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        work: resolve(import.meta.dirname, "work.html"),
        process: resolve(import.meta.dirname, "process.html"),
        about: resolve(import.meta.dirname, "about.html"),
        security: resolve(import.meta.dirname, "security.html"),
      },
    },
  },
});
