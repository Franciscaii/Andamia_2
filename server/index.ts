import { join } from "node:path";
import { crearServidor } from "./app.ts";

const raiz = join(import.meta.dirname, "..");
const puerto = Number(process.env.ANDAMIA_PUERTO ?? 8787);
// Solo este equipo puede conectarse, salvo que se indique otra cosa.
const host = process.env.ANDAMIA_HOST ?? "127.0.0.1";

const app = crearServidor({
  rutaBase: process.env.ANDAMIA_BASE ?? join(raiz, "datos-servidor", "andamia.sqlite"),
  registroAbierto: process.env.ANDAMIA_REGISTRO !== "cerrado",
  cookieSegura: process.env.ANDAMIA_COOKIE_SEGURA === "si",
  confiarEnProxy: process.env.ANDAMIA_PROXY === "si",
  origenes: process.env.ANDAMIA_ORIGENES?.split(",").filter(Boolean),
  dirEstatico: join(raiz, "dist"),
});

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => void app.close().then(() => process.exit(0)));
}

await app.listen({ port: puerto, host });
console.log(`Andamia disponible en http://${host}:${puerto}`);
