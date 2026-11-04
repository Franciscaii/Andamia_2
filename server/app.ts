import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { abrirBase, enTransaccion, type Base } from "./bd.ts";
import { CLAVE_FICTICIA, cifrarClave, hashToken, nuevoToken, verificarClave } from "./claves.ts";
import { sincronizar, TABLAS_SINCRONIZADAS, type CambioEntrante } from "./sync.ts";

export interface Opciones {
  rutaBase: string;
  registroAbierto?: boolean;
  /** Activar cuando el sitio se sirva por HTTPS. */
  cookieSegura?: boolean;
  /** Orígenes extra permitidos, además del propio. */
  origenes?: string[];
  dirEstatico?: string;
  /** Activar solo detrás de un proxy propio. */
  confiarEnProxy?: boolean;
  ahora?: () => number;
}

const COOKIE = "andamia_sesion";
const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FALLOS = 8;
const VENTANA_FALLOS_MS = 15 * 60 * 1000;

const esquemaCredenciales = {
  type: "object",
  required: ["email", "clave"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254, pattern: "^[^@\\s]+@[^@\\s]+$" },
    clave: { type: "string", minLength: 8, maxLength: 200 },
  },
};

const esquemaSync = {
  type: "object",
  required: ["desde", "cambios"],
  additionalProperties: false,
  properties: {
    desde: { type: "integer", minimum: 0 },
    cambios: {
      type: "array",
      maxItems: 1000,
      items: {
        type: "object",
        required: ["tabla", "id", "datos", "modificadoEn"],
        additionalProperties: false,
        properties: {
          tabla: { type: "string", enum: [...TABLAS_SINCRONIZADAS] },
          id: { type: "string", minLength: 1, maxLength: 300 },
          datos: { type: ["object", "null"] },
          modificadoEn: { type: "integer", minimum: 0 },
        },
      },
    },
  },
};

interface Usuario {
  id: string;
  email: string;
  clave: string;
}

export function crearServidor(opciones: Opciones) {
  const ahora = opciones.ahora ?? (() => Date.now());
  const db: Base = abrirBase(opciones.rutaBase);
  const app = Fastify({ logger: false, bodyLimit: 25 * 1024 * 1024, trustProxy: opciones.confiarEnProxy ?? false });
  const registroAbierto = opciones.registroAbierto ?? true;
  const fallos = new Map<string, { veces: number; desde: number }>();

  void app.register(cookie);

  app.addHook("onSend", async (_req, reply, cuerpo) => {
    void reply.header("X-Content-Type-Options", "nosniff");
    void reply.header("X-Frame-Options", "DENY");
    void reply.header("Referrer-Policy", "no-referrer");
    void reply.header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    return cuerpo;
  });

  // La cookie ya es SameSite; revisar el origen protege también ante configuraciones que la relajen.
  app.addHook("onRequest", async (req, reply) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.url.startsWith("/api/")) return;
    const origen = req.headers.origin;
    if (!origen) return;
    let host: string | null = null;
    try {
      host = new URL(origen).host;
    } catch {
      // Un origen inválido se rechaza abajo.
    }
    if (host !== req.headers.host && !(opciones.origenes ?? []).includes(origen)) {
      await reply.code(403).send({ error: "Origen no permitido" });
    }
  });

  const fijarSesion = (reply: FastifyReply, usuarioId: string) => {
    const token = nuevoToken();
    const momento = ahora();
    db.prepare("DELETE FROM sesiones WHERE expira_en < ?").run(momento);
    db.prepare("INSERT INTO sesiones (token_hash, usuario_id, expira_en) VALUES (?, ?, ?)").run(hashToken(token), usuarioId, momento + DURACION_SESION_MS);
    void reply.setCookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: opciones.cookieSegura ?? false,
      path: "/api",
      maxAge: DURACION_SESION_MS / 1000,
    });
  };

  const usuarioDe = (req: FastifyRequest): Usuario | null => {
    const token = req.cookies[COOKIE];
    if (!token) return null;
    const fila = db
      .prepare("SELECT u.id, u.email, u.clave FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND s.expira_en > ?")
      .get(hashToken(token), ahora()) as Usuario | undefined;
    return fila ?? null;
  };

  const exigirUsuario = async (req: FastifyRequest, reply: FastifyReply): Promise<Usuario | null> => {
    const u = usuarioDe(req);
    if (!u) await reply.code(401).send({ error: "Debes iniciar sesión" });
    return u;
  };

  const claveLimite = (req: FastifyRequest, email: string) => `${req.ip}|${email}`;
  const bloqueado = (k: string) => {
    const f = fallos.get(k);
    if (!f) return false;
    if (ahora() - f.desde > VENTANA_FALLOS_MS) {
      fallos.delete(k);
      return false;
    }
    return f.veces >= MAX_FALLOS;
  };
  const anotarFallo = (k: string) => {
    const f = fallos.get(k) ?? { veces: 0, desde: ahora() };
    f.veces += 1;
    fallos.set(k, f);
    if (fallos.size > 10_000) fallos.clear();
  };

  const normalizarEmail = (email: string) => email.trim().toLocaleLowerCase();
  const publico = (u: { id: string; email: string }) => ({ id: u.id, email: u.email });

  app.get("/api/salud", async () => ({ ok: true }));

  app.get("/api/sesion", async (req) => {
    const u = usuarioDe(req);
    return { usuario: u ? publico(u) : null, registroAbierto };
  });

  app.post<{ Body: { email: string; clave: string } }>("/api/registro", { schema: { body: esquemaCredenciales } }, async (req, reply) => {
    if (!registroAbierto) return reply.code(403).send({ error: "El registro de cuentas nuevas está cerrado en este servidor." });
    const email = normalizarEmail(req.body.email);
    const clave = await cifrarClave(req.body.clave);
    const id = randomUUID();
    const r = db.prepare("INSERT INTO usuarios (id, email, clave, creado_en) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING").run(id, email, clave, ahora());
    if (r.changes === 0) return reply.code(409).send({ error: "Ya existe una cuenta con ese correo." });
    fijarSesion(reply, id);
    return reply.code(201).send({ usuario: { id, email } });
  });

  app.post<{ Body: { email: string; clave: string } }>("/api/entrar", { schema: { body: esquemaCredenciales } }, async (req, reply) => {
    const email = normalizarEmail(req.body.email);
    const k = claveLimite(req, email);
    if (bloqueado(k)) return reply.code(429).send({ error: "Demasiados intentos. Espera unos minutos." });
    const u = db.prepare("SELECT id, email, clave FROM usuarios WHERE email = ?").get(email) as Usuario | undefined;
    const correcta = await verificarClave(req.body.clave, u?.clave ?? CLAVE_FICTICIA);
    if (!u || !correcta) {
      anotarFallo(k);
      return reply.code(401).send({ error: "Correo o contraseña incorrectos." });
    }
    fallos.delete(k);
    fijarSesion(reply, u.id);
    return { usuario: publico(u) };
  });

  app.post("/api/salir", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) db.prepare("DELETE FROM sesiones WHERE token_hash = ?").run(hashToken(token));
    void reply.clearCookie(COOKIE, { path: "/api" });
    return { ok: true };
  });

  app.post<{ Body: { actual: string; nueva: string } }>(
    "/api/cuenta/clave",
    {
      schema: {
        body: {
          type: "object",
          required: ["actual", "nueva"],
          additionalProperties: false,
          properties: { actual: { type: "string", maxLength: 200 }, nueva: { type: "string", minLength: 8, maxLength: 200 } },
        },
      },
    },
    async (req, reply) => {
      const u = await exigirUsuario(req, reply);
      if (!u) return;
      if (!(await verificarClave(req.body.actual, u.clave))) return reply.code(401).send({ error: "La contraseña actual no es correcta." });
      const nueva = await cifrarClave(req.body.nueva);
      // Cierra las demás sesiones: si alguien más entró, deja de tener acceso.
      enTransaccion(db, () => {
        db.prepare("UPDATE usuarios SET clave = ? WHERE id = ?").run(nueva, u.id);
        db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(u.id);
      });
      fijarSesion(reply, u.id);
      return { ok: true };
    },
  );

  app.delete<{ Body: { clave: string } }>(
    "/api/cuenta",
    { schema: { body: { type: "object", required: ["clave"], additionalProperties: false, properties: { clave: { type: "string", maxLength: 200 } } } } },
    async (req, reply) => {
      const u = await exigirUsuario(req, reply);
      if (!u) return;
      if (!(await verificarClave(req.body.clave, u.clave))) return reply.code(401).send({ error: "La contraseña no es correcta." });
      db.prepare("DELETE FROM usuarios WHERE id = ?").run(u.id);
      void reply.clearCookie(COOKIE, { path: "/api" });
      return { ok: true };
    },
  );

  app.post<{ Body: { desde: number; cambios: CambioEntrante[] } }>("/api/sync", { schema: { body: esquemaSync } }, async (req, reply) => {
    const u = await exigirUsuario(req, reply);
    if (!u) return;
    return sincronizar(db, u.id, req.body.desde, req.body.cambios, ahora());
  });

  app.setNotFoundHandler(async (req, reply) => {
    if (req.url.startsWith("/api/")) return reply.code(404).send({ error: "No encontrado" });
    return reply.code(404).type("text/plain").send("No encontrado");
  });

  if (opciones.dirEstatico && existsSync(opciones.dirEstatico)) {
    void app.register(fastifyStatic, {
      root: opciones.dirEstatico,
      setHeaders: (res, ruta) => {
        // El service worker siempre debe revisarse; los archivos con hash no cambian nunca.
        if (ruta.endsWith("sw.js") || ruta.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
        else if (ruta.replaceAll("\\", "/").includes("/assets/")) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      },
    });
  }

  app.addHook("onClose", async () => db.close());
  return app;
}
