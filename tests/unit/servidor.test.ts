import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearServidor } from "../../server/app";
import { cifrarClave, hashToken, verificarClave } from "../../server/claves";

type App = ReturnType<typeof crearServidor>;
let app: App;
let reloj = 1_800_000_000_000;

beforeEach(() => {
  reloj = 1_800_000_000_000;
  app = crearServidor({ rutaBase: ":memory:", ahora: () => reloj });
});
afterEach(() => app.close());

const CRED = { email: "ana@ejemplo.cl", clave: "una clave larga" };

function cookieDe(r: { cookies: { name: string; value: string }[] }) {
  const c = r.cookies.find((x) => x.name === "andamia_sesion");
  return c ? { andamia_sesion: c.value } : {};
}

async function registrar(cred = CRED) {
  const r = await app.inject({ method: "POST", url: "/api/registro", payload: cred });
  expect(r.statusCode).toBe(201);
  return cookieDe(r);
}

const sync = (cookies: Record<string, string>, desde: number, cambios: unknown[] = []) => app.inject({ method: "POST", url: "/api/sync", cookies, payload: { desde, cambios } });
const tarea = (id: string, titulo: string, modificadoEn: number) => ({ tabla: "tareas", id, datos: { id, titulo }, modificadoEn });

describe("contraseñas", () => {
  it("nunca guarda el texto y verifica", async () => {
    const c = await cifrarClave("mi clave secreta");
    expect(c).not.toContain("mi clave");
    expect(await verificarClave("mi clave secreta", c)).toBe(true);
    expect(await verificarClave("otra clave", c)).toBe(false);
  });

  it("dos cifrados de la misma clave son distintos", async () => {
    expect(await cifrarClave("igual igual")).not.toBe(await cifrarClave("igual igual"));
  });
});

describe("cuentas", () => {
  it("registra, recuerda la sesión y cierra", async () => {
    const r = await app.inject({ method: "POST", url: "/api/registro", payload: { ...CRED, email: " ANA@Ejemplo.cl ".trim() } });
    expect(r.json().usuario.email).toBe("ana@ejemplo.cl");
    const c = r.cookies.find((x) => x.name === "andamia_sesion");
    expect(c).toMatchObject({ httpOnly: true, sameSite: "Strict", path: "/api" });
    const cookies = cookieDe(r);
    expect((await app.inject({ url: "/api/sesion", cookies })).json().usuario.email).toBe("ana@ejemplo.cl");
    await app.inject({ method: "POST", url: "/api/salir", cookies });
    expect((await app.inject({ url: "/api/sesion", cookies })).json().usuario).toBeNull();
  });

  it("la respuesta nunca incluye la contraseña", async () => {
    const r = await app.inject({ method: "POST", url: "/api/registro", payload: CRED });
    expect(r.body).not.toContain("clave");
    expect((await app.inject({ method: "POST", url: "/api/entrar", payload: CRED })).body).not.toContain("clave");
  });

  it("no permite dos cuentas con el mismo correo", async () => {
    await registrar();
    const r = await app.inject({ method: "POST", url: "/api/registro", payload: { ...CRED, email: "ANA@ejemplo.cl" } });
    expect(r.statusCode).toBe(409);
  });

  it.each([
    [{ email: "no-es-correo", clave: "una clave larga" }],
    [{ email: "a@b.cl", clave: "corta" }],
    [{ email: "a@b.cl" }],
    [{ email: "a@b.cl", clave: "una clave larga", admin: true }],
  ])("rechaza datos inválidos %#", async (payload) => {
    const r = await app.inject({ method: "POST", url: "/api/registro", payload });
    expect(r.statusCode).toBe(400);
  });

  it("entra con la contraseña correcta y da el mismo error si falla", async () => {
    await registrar();
    expect((await app.inject({ method: "POST", url: "/api/entrar", payload: CRED })).statusCode).toBe(200);
    const mala = await app.inject({ method: "POST", url: "/api/entrar", payload: { ...CRED, clave: "clave incorrecta" } });
    const inexistente = await app.inject({ method: "POST", url: "/api/entrar", payload: { email: "nadie@ejemplo.cl", clave: "clave incorrecta" } });
    expect(mala.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(mala.json()).toEqual(inexistente.json());
  });

  it("frena los intentos repetidos, y se libera con el tiempo", async () => {
    await registrar();
    const intento = (clave: string) => app.inject({ method: "POST", url: "/api/entrar", payload: { ...CRED, clave } });
    for (let i = 0; i < 8; i++) expect((await intento("clave incorrecta")).statusCode).toBe(401);
    expect((await intento("clave incorrecta")).statusCode).toBe(429);
    expect((await intento(CRED.clave)).statusCode).toBe(429);
    reloj += 16 * 60 * 1000;
    expect((await intento(CRED.clave)).statusCode).toBe(200);
  });

  it("la sesión caduca", async () => {
    const cookies = await registrar();
    reloj += 31 * 24 * 60 * 60 * 1000;
    expect((await app.inject({ url: "/api/sesion", cookies })).json().usuario).toBeNull();
    expect((await sync(cookies, 0)).statusCode).toBe(401);
  });

  it("cambiar la contraseña cierra las demás sesiones", async () => {
    const vieja = await registrar();
    const r = await app.inject({ method: "POST", url: "/api/entrar", payload: CRED });
    const otra = cookieDe(r);
    const mala = await app.inject({ method: "POST", url: "/api/cuenta/clave", cookies: vieja, payload: { actual: "incorrecta", nueva: "clave nueva larga" } });
    expect(mala.statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/api/cuenta/clave", cookies: vieja, payload: { actual: CRED.clave, nueva: "clave nueva larga" } });
    expect(ok.statusCode).toBe(200);
    expect((await app.inject({ url: "/api/sesion", cookies: otra })).json().usuario).toBeNull();
    expect((await app.inject({ url: "/api/sesion", cookies: vieja })).json().usuario).toBeNull();
    expect((await app.inject({ url: "/api/sesion", cookies: cookieDe(ok) })).json().usuario).not.toBeNull();
    expect((await app.inject({ method: "POST", url: "/api/entrar", payload: { ...CRED, clave: "clave nueva larga" } })).statusCode).toBe(200);
  });

  it("borrar la cuenta exige la contraseña y elimina sus datos", async () => {
    const cookies = await registrar();
    await sync(cookies, 0, [tarea("t", "T", reloj)]);
    expect((await app.inject({ method: "DELETE", url: "/api/cuenta", cookies, payload: { clave: "incorrecta" } })).statusCode).toBe(401);
    expect((await app.inject({ method: "DELETE", url: "/api/cuenta", cookies, payload: { clave: CRED.clave } })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/entrar", payload: CRED })).statusCode).toBe(401);
    const otra = await registrar();
    expect((await sync(otra, 0)).json().cambios).toEqual([]);
  });

  it("el registro se puede cerrar", async () => {
    const cerrado = crearServidor({ rutaBase: ":memory:", registroAbierto: false });
    expect((await cerrado.inject({ method: "POST", url: "/api/registro", payload: CRED })).statusCode).toBe(403);
    expect((await cerrado.inject({ url: "/api/sesion" })).json().registroAbierto).toBe(false);
    await cerrado.close();
  });

  it("guarda solo el hash del token", () => {
    expect(hashToken("abc")).toHaveLength(64);
    expect(hashToken("abc")).not.toContain("abc");
  });
});

describe("protecciones", () => {
  it("rechaza escrituras desde otro origen", async () => {
    const cookies = await registrar();
    const r = await app.inject({ method: "POST", url: "/api/sync", cookies, headers: { origin: "https://malo.example", host: "localhost:8787" }, payload: { desde: 0, cambios: [] } });
    expect(r.statusCode).toBe(403);
    const propio = await app.inject({ method: "POST", url: "/api/sync", cookies, headers: { origin: "http://localhost:8787", host: "localhost:8787" }, payload: { desde: 0, cambios: [] } });
    expect(propio.statusCode).toBe(200);
  });

  it("agrega cabeceras de seguridad", async () => {
    const r = await app.inject({ url: "/api/salud" });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(r.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("no sincroniza sin sesión ni acepta tablas desconocidas", async () => {
    expect((await sync({}, 0)).statusCode).toBe(401);
    const cookies = await registrar();
    expect((await sync(cookies, 0, [{ tabla: "usuarios", id: "x", datos: {}, modificadoEn: 1 }])).statusCode).toBe(400);
    expect((await sync(cookies, 0, [{ tabla: "tareas", id: "", datos: {}, modificadoEn: 1 }])).statusCode).toBe(400);
  });

  it("cada usuario solo ve sus datos, aunque coincidan los ids", async () => {
    const ana = await registrar();
    const luis = await registrar({ email: "luis@ejemplo.cl", clave: "otra clave larga" });
    await sync(ana, 0, [tarea("mismo", "De Ana", reloj)]);
    await sync(luis, 0, [tarea("mismo", "De Luis", reloj)]);
    expect((await sync(ana, 0)).json().cambios).toHaveLength(0 + 1);
    expect((await sync(ana, 0)).json().cambios[0].datos.titulo).toBe("De Ana");
    expect((await sync(luis, 0)).json().cambios[0].datos.titulo).toBe("De Luis");
  });
});

describe("sincronización", () => {
  it("guarda, avanza la revisión y entrega a otro dispositivo", async () => {
    const cookies = await registrar();
    const a = (await sync(cookies, 0, [tarea("t1", "Uno", reloj), tarea("t2", "Dos", reloj)])).json();
    expect(a.revision).toBe(2);
    expect(a.cambios).toEqual([]); // No devuelve lo que acaba de enviar.
    const b = (await sync(cookies, 0)).json();
    expect(b.cambios.map((c: { id: string }) => c.id)).toEqual(["t1", "t2"]);
    expect(b.revision).toBe(2);
    expect((await sync(cookies, 2)).json().cambios).toEqual([]);
  });

  it("gana la última modificación, y el perdedor recibe la vigente", async () => {
    const cookies = await registrar();
    await sync(cookies, 0, [tarea("t", "Nueva", reloj)]);
    const vieja = (await sync(cookies, 1, [tarea("t", "Vieja", reloj - 5000)])).json();
    expect(vieja.revision).toBe(1);
    expect(vieja.cambios).toHaveLength(1);
    expect(vieja.cambios[0].datos.titulo).toBe("Nueva");
    const nueva = (await sync(cookies, 1, [tarea("t", "Más nueva", reloj + 0)])).json();
    expect(nueva.cambios[0].datos.titulo).toBe("Nueva"); // Empate: se queda la del servidor.
    reloj += 1000;
    expect((await sync(cookies, 1, [tarea("t", "Más nueva", reloj)])).json().cambios).toEqual([]);
    expect((await sync(cookies, 0)).json().cambios[0].datos.titulo).toBe("Más nueva");
  });

  it("reenviar lo mismo tras perder la respuesta no daña nada", async () => {
    const cookies = await registrar();
    const c = tarea("t", "Uno", reloj);
    await sync(cookies, 0, [c]);
    const r = (await sync(cookies, 0, [c])).json();
    expect(r.revision).toBe(1);
    expect(r.cambios[0].datos.titulo).toBe("Uno");
  });

  it("un reloj adelantado no gana para siempre", async () => {
    const cookies = await registrar();
    await sync(cookies, 0, [tarea("t", "Futuro", reloj + 999_999_999)]);
    reloj += 1000;
    await sync(cookies, 1, [tarea("t", "Ahora", reloj)]);
    expect((await sync(cookies, 0)).json().cambios[0].datos.titulo).toBe("Ahora");
  });

  it("los borrados se propagan y una edición más nueva los revierte", async () => {
    const cookies = await registrar();
    await sync(cookies, 0, [tarea("t", "Uno", reloj)]);
    reloj += 1000;
    await sync(cookies, 1, [{ tabla: "tareas", id: "t", datos: null, modificadoEn: reloj }]);
    const b = (await sync(cookies, 1)).json();
    expect(b.cambios[0]).toMatchObject({ id: "t", datos: null });
    reloj += 1000;
    await sync(cookies, 2, [tarea("t", "Revive", reloj)]);
    expect((await sync(cookies, 0)).json().cambios[0].datos.titulo).toBe("Revive");
  });

  it("los ids iguales en tablas distintas no se mezclan", async () => {
    const cookies = await registrar();
    await sync(cookies, 0, [tarea("x", "Tarea", reloj), { tabla: "listas", id: "x", datos: { nombre: "Lista" }, modificadoEn: reloj }]);
    expect((await sync(cookies, 0)).json().cambios).toHaveLength(2);
  });

  it("entrega por páginas cuando hay muchos cambios", async () => {
    const cookies = await registrar();
    for (let lote = 0; lote < 2; lote++) {
      const cambios = Array.from({ length: 700 }, (_, i) => tarea(`t${lote}-${i}`, "T", reloj));
      expect((await sync(cookies, lote * 700, cambios)).statusCode).toBe(200);
    }
    const p1 = (await sync(cookies, 0)).json();
    expect(p1.mas).toBe(true);
    expect(p1.cambios).toHaveLength(1000);
    expect(p1.revision).toBe(1000);
    const p2 = (await sync(cookies, p1.revision)).json();
    expect(p2.mas).toBe(false);
    expect(p2.cambios).toHaveLength(400);
    expect(p2.revision).toBe(1400);
  });
});
