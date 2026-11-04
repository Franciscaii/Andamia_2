import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/unit/preparacion.ts"],
    env: { TZ: "America/Santiago" },
    // rrule se publica como CommonJS para Node; así usa la misma entrada que en el navegador.
    server: { deps: { inline: ["rrule"] } },
  },
});
