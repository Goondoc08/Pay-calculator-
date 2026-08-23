/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/Pay-calculator-/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "48/96 Pay Calculator",
        short_name: "48/96",
        description: "Fire department shift pay calculator",
        // The manifest can only carry one value, so it takes Deep Alpine —
        // the brand colour, readable as a splash/task-switcher tint in
        // either system theme. The in-page <meta name="theme-color"> tags
        // do respond to light/dark.
        theme_color: "#1b3b36",
        background_color: "#1b3b36",
        display: "standalone",
        start_url: "/Pay-calculator-/",
        scope: "/Pay-calculator-/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
