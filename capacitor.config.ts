import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.andamia.app",
  appName: "Andamia",
  webDir: "dist",
  backgroundColor: "#faf8f4",
  android: {
    // Andamia no carga contenido http; solo https (Firebase).
    allowMixedContent: false,
  },
};

export default config;
