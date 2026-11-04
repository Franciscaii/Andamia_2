import { defineConfig } from "vitest/config";

// Requiere el emulador de Firestore: se ejecuta con `npm run test:reglas`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/reglas/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
