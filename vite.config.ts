import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // El registro lo hace src/logica/pwa.ts, solo en la versión final.
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        name: "Andamia",
        short_name: "Andamia",
        description: "Gestor de tareas, hábitos y enfoque.",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#2f6fb0",
        background_color: "#faf8f4",
        icons: [
          { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
          { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
          { src: "/iconos/icono-adaptable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
