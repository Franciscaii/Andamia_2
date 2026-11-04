import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { BaseAndamia, baseDeCuenta, BASE_LOCAL, bd, usarBase, type NombreTabla } from "../../src/datos/bd";
import { canonico, contarDatos, copiarDatos, iniciarEspejo, type AlmacenRemoto, type CambioLocal, type FotoRemota } from "../../src/datos/espejo";
import * as repo from "../../src/datos/repositorio";
import { crearCopia, nombreArchivoCopia, validarCopia, type DatosCopia } from "../../src/logica/copia";

const vacia = (): DatosCopia => ({ tareas: [], listas: [], carpetas: [], etiquetas: [], columnas: [], sesiones: [], habitos: [], registrosHabito: [] });

beforeEach(async () => {
  await usarBase(BASE_LOCAL);
  bd.close();
  await Dexie.delete(BASE_LOCAL);
  await bd.open();
});

describe("copia de seguridad", () => {
  it("exportar e importar conserva todo", async () => {
    const lista = await repo.crearLista({ nombre: "Trabajo", color: "#3f74b5" });
    await repo.crearTarea({ titulo: "Informe", listaId: lista.id, etiquetas: ["Urgente"], vence: "2026-11-05", todoElDia: true, repeticion: "FREQ=DAILY;INTERVAL=1", minutosRecordatorios: [0] });
    const h = await repo.crearHabito({ nombre: "Agua", icono: "agua", color: "#2f8f83", frecuencia: { tipo: "diaria" }, metaDiaria: 8, unidad: "vasos", inicio: "2026-11-01", recordatorioHora: null });
    await repo.registrarHabito(h.id, "2026-11-04", { estado: "parcial", valor: 3 });
    await repo.guardarSesion({ id: "s", tipo: "pomodoro", inicio: "2026-11-04T10:00:00.000Z", fin: "2026-11-04T10:25:00.000Z", segundos: 1500, tareaId: null, nota: "", manual: false });

    const antes = await repo.exportarTodo();
    const texto = JSON.stringify(crearCopia(antes));
    const r = validarCopia(texto);
    if (!r.ok) throw new Error(r.errores.join());
    expect(r.total).toBe(6);
    expect(r.conteos.tareas).toBe(1);

    await repo.crearTarea({ titulo: "Se debe ir" });
    await repo.reemplazarTodo(r.copia.datos);
    expect(canonico(await repo.exportarTodo())).toBe(canonico(antes));
  });

  it.each([
    ["no es JSON", "esto no es json", "no es un JSON"],
    ["otra app", JSON.stringify({ app: "otra", version: 1, datos: vacia() }), "no es una copia de Andamia"],
    ["sin datos", JSON.stringify({ app: "andamia", version: 1 }), "faltan los datos"],
    ["versión futura", JSON.stringify({ app: "andamia", version: 99, datos: vacia() }), "más nueva"],
    ["falta una sección", JSON.stringify({ app: "andamia", version: 1, datos: { ...vacia(), tareas: undefined } }), "tareas"],
  ])("rechaza: %s", (_n, texto, mensaje) => {
    const r = validarCopia(texto);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join()).toContain(mensaje);
  });

  it("detecta registros dañados, sin revisar solo la forma general", () => {
    const tareaBuena = { id: "a", listaId: "bandeja", titulo: "T", descripcion: "", estado: "pendiente", prioridad: "alta", vence: null, todoElDia: false, etiquetas: [], subtareas: [], recordatorios: [], avisosEnviados: [], orden: 1 };
    const conTareas = (tareas: unknown[]) => JSON.stringify(crearCopia({ ...vacia(), tareas }));
    expect(validarCopia(conTareas([tareaBuena])).ok).toBe(true);
    expect(validarCopia(conTareas([{ ...tareaBuena, titulo: 3 }])).ok).toBe(false);
    expect(validarCopia(conTareas([{ ...tareaBuena, estado: "rara" }])).ok).toBe(false);
    expect(validarCopia(conTareas([{ ...tareaBuena, orden: "1" }])).ok).toBe(false);
    expect(validarCopia(conTareas([tareaBuena, tareaBuena])).ok).toBe(false);
    expect(validarCopia(conTareas(["x"])).ok).toBe(false);
  });

  it("no acepta colores que no son colores", () => {
    const etiqueta = { nombre: "e", nombreVisible: "E", color: "red;background:url(x)", orden: 0 };
    expect(validarCopia(JSON.stringify(crearCopia({ ...vacia(), etiquetas: [etiqueta] }))).ok).toBe(false);
  });

  it("limita los errores que informa", () => {
    const r = validarCopia(JSON.stringify(crearCopia({ ...vacia(), carpetas: Array.from({ length: 50 }, () => ({})) })));
    expect(!r.ok && r.errores.length).toBe(10);
  });

  it("nombra el archivo con la fecha", () => {
    expect(nombreArchivoCopia(new Date(2026, 10, 4))).toBe("andamia-copia-2026-11-04.json");
  });
});

/** Doble de Firestore: guarda en memoria y permite simular el servidor. */
function nubeFalsa() {
  const datos = new Map<NombreTabla, Map<string, Record<string, unknown>>>();
  const oyentes = new Map<NombreTabla, ((f: FotoRemota) => void)[]>();
  const escrituras: CambioLocal[][] = [];
  const delDoc = (t: NombreTabla) => {
    if (!datos.has(t)) datos.set(t, new Map());
    return datos.get(t) as Map<string, Record<string, unknown>>;
  };
  const remoto: AlmacenRemoto = {
    async escribir(cambios) {
      escrituras.push(cambios);
      for (const c of cambios) {
        if (c.datos) delDoc(c.tabla).set(c.id, c.datos);
        else delDoc(c.tabla).delete(c.id);
      }
    },
    escuchar(tabla, alCambiar) {
      oyentes.set(tabla, [...(oyentes.get(tabla) ?? []), alCambiar]);
      return () => oyentes.set(tabla, (oyentes.get(tabla) ?? []).filter((x) => x !== alCambiar));
    },
  };
  return {
    remoto,
    escrituras,
    emitir: (tabla: NombreTabla, foto: Partial<FotoRemota>) => (oyentes.get(tabla) ?? []).forEach((o) => o({ cambios: [], completa: null, ...foto })),
    oyentes: () => [...oyentes.values()].flat().length,
  };
}

const reposo = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 15));
};

describe("espejo con la nube", () => {
  function conEspejo() {
    const nube = nubeFalsa();
    const estado = { aplicados: 0, fallos: [] as unknown[] };
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => (estado.aplicados += 1), alEscribir: () => undefined, alFallar: (e) => estado.fallos.push(e), retardoMs: 0 });
    return { nube, estado, detener };
  }
  const ids = (cambios: CambioLocal[]) => cambios.map((c) => `${c.tabla}:${c.datos ? "guardar" : "borrar"}`);

  it("envía crear, editar y borrar con la versión vigente", async () => {
    const { nube, detener } = conEspejo();
    const { tarea } = await repo.crearTarea({ titulo: "Uno" });
    await reposo();
    expect(nube.escrituras.flat().find((c) => c.id === tarea.id)?.datos).toMatchObject({ titulo: "Uno" });

    await repo.actualizarTarea(tarea.id, { titulo: "Dos" });
    await reposo();
    expect(nube.escrituras.at(-1)?.[0].datos).toMatchObject({ titulo: "Dos" });

    await repo.borrarDefinitivamente(tarea.id);
    await reposo();
    expect(nube.escrituras.at(-1)?.[0]).toMatchObject({ id: tarea.id, datos: null });
    detener();
  });

  it("cubre las operaciones masivas del repositorio", async () => {
    const { nube, detener } = conEspejo();
    const lista = await repo.crearLista({ nombre: "L" });
    await repo.crearColumna(lista.id, "C");
    await repo.crearTarea({ titulo: "T", listaId: lista.id });
    await reposo();
    nube.escrituras.length = 0;
    await repo.borrarLista(lista.id);
    await reposo();
    expect(ids(nube.escrituras.flat()).sort()).toEqual(["columnas:borrar", "listas:borrar", "tareas:guardar"]);
    detener();
  });

  it("una transacción sale en un solo lote", async () => {
    const { nube, detener } = conEspejo();
    const lista = await repo.crearLista({ nombre: "L" });
    await repo.crearTarea({ titulo: "A", listaId: lista.id });
    await repo.crearTarea({ titulo: "B", listaId: lista.id });
    await reposo();
    nube.escrituras.length = 0;
    await repo.borrarLista(lista.id);
    await reposo();
    expect(nube.escrituras).toHaveLength(1);
    detener();
  });

  it("aplica lo que llega de la nube, sin reenviarlo", async () => {
    const { nube, estado, detener } = conEspejo();
    const remota = { id: "r", nombre: "De otro equipo", color: null, carpetaId: null, incluirEnTodas: true, modo: "lista", orden: 0 };
    nube.emitir("listas", { cambios: [{ tipo: "guardado", datos: remota, pendiente: false }] });
    await reposo();
    expect(await bd.listas.get("r")).toMatchObject({ nombre: "De otro equipo" });
    expect(nube.escrituras).toEqual([]);
    expect(estado.aplicados).toBe(1);

    nube.emitir("listas", { cambios: [{ tipo: "borrado", datos: remota, pendiente: false }] });
    await reposo();
    expect(await bd.listas.get("r")).toBeUndefined();
    expect(nube.escrituras).toEqual([]);
    detener();
  });

  it("no redibuja si lo recibido es igual a lo que ya hay, aunque cambie el orden de los campos", async () => {
    const { nube, estado, detener } = conEspejo();
    const lista = await repo.crearLista({ nombre: "L" });
    await reposo();
    const desordenada = Object.fromEntries(Object.entries(lista).reverse());
    nube.emitir("listas", { cambios: [{ tipo: "guardado", datos: desordenada, pendiente: false }] });
    await reposo();
    expect(estado.aplicados).toBe(0);
    detener();
  });

  it("ignora sus propias escrituras sin confirmar, que pueden ser más viejas", async () => {
    const { nube, detener } = conEspejo();
    const { tarea } = await repo.crearTarea({ titulo: "Nueva" });
    await reposo();
    nube.emitir("tareas", { cambios: [{ tipo: "guardado", datos: { ...tarea, titulo: "Vieja" }, pendiente: true }] });
    await reposo();
    expect((await bd.tareas.get(tarea.id))?.titulo).toBe("Nueva");
    detener();
  });

  it("gana lo que confirma la nube: otro dispositivo sobrescribe el registro completo", async () => {
    const { nube, detener } = conEspejo();
    const { tarea } = await repo.crearTarea({ titulo: "Mía", descripcion: "notas mías" });
    await reposo();
    nube.emitir("tareas", { cambios: [{ tipo: "guardado", datos: { ...tarea, titulo: "De otro", descripcion: "" }, pendiente: false }] });
    await reposo();
    expect(await bd.tareas.get(tarea.id)).toMatchObject({ titulo: "De otro", descripcion: "" });
    detener();
  });

  it("con la foto completa quita lo que la nube ya no tiene", async () => {
    const { nube, detener } = conEspejo();
    const sobra = await repo.crearLista({ nombre: "Sobra" });
    const queda = await repo.crearLista({ nombre: "Queda" });
    await reposo();
    nube.escrituras.length = 0;
    nube.emitir("listas", { completa: [queda as unknown as Record<string, unknown>] });
    await reposo();
    expect(await bd.listas.get(sobra.id)).toBeUndefined();
    expect(await bd.listas.get(queda.id)).toBeDefined();
    expect(nube.escrituras).toEqual([]);
    detener();
  });

  it("maneja la clave de etiquetas, que no se llama id", async () => {
    const { nube, detener } = conEspejo();
    const { etiquetasNuevas } = await repo.crearTarea({ titulo: "T", etiquetas: ["Casa"] });
    await reposo();
    expect(nube.escrituras.flat().find((c) => c.tabla === "etiquetas")?.id).toBe("casa");
    nube.emitir("etiquetas", { cambios: [{ tipo: "borrado", datos: etiquetasNuevas[0] as unknown as Record<string, unknown>, pendiente: false }] });
    await reposo();
    expect(await bd.etiquetas.get("casa")).toBeUndefined();
    detener();
  });

  it("agrupa las ediciones seguidas en una sola escritura, con la última versión", async () => {
    const nube = nubeFalsa();
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 40 });
    const { tarea } = await repo.crearTarea({ titulo: "H" });
    for (const titulo of ["Ho", "Hol", "Hola"]) await repo.actualizarTarea(tarea.id, { titulo });
    expect(nube.escrituras).toEqual([]);
    await new Promise((r) => setTimeout(r, 120));
    expect(nube.escrituras).toHaveLength(1);
    expect(nube.escrituras[0][0].datos).toMatchObject({ titulo: "Hola" });
    detener();
  });

  it("al detenerse envía lo que estaba esperando", async () => {
    const nube = nubeFalsa();
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 60_000 });
    await repo.crearTarea({ titulo: "Antes de salir" });
    await reposo();
    expect(nube.escrituras).toEqual([]);
    detener();
    await reposo();
    expect(nube.escrituras.flat()[0].datos).toMatchObject({ titulo: "Antes de salir" });
  });

  it("lo que aún espera envío no se borra ni se pisa con lo que llega de la nube", async () => {
    const nube = nubeFalsa();
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 60_000 });
    const { tarea } = await repo.crearTarea({ titulo: "Recién creada" });
    await reposo();
    // La primera foto del servidor no la conoce todavía.
    nube.emitir("tareas", { completa: [] });
    await reposo();
    expect(await bd.tareas.get(tarea.id)).toBeDefined();
    nube.emitir("tareas", { cambios: [{ tipo: "guardado", datos: { ...tarea, titulo: "Versión vieja" }, pendiente: false }] });
    await reposo();
    expect((await bd.tareas.get(tarea.id))?.titulo).toBe("Recién creada");
    detener();
    await reposo();
    expect(nube.escrituras.flat()[0].datos).toMatchObject({ titulo: "Recién creada" });
  });

  it("si la pestaña se cierra antes de enviar, lo envía al volver", async () => {
    const guardado = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => guardado.set(k, v), removeItem: (k: string) => guardado.delete(k) };
    try {
      const antes = nubeFalsa();
      // Sin detener: así queda una pestaña que se cierra de golpe.
      iniciarEspejo(bd, antes.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 60_000 });
      const { tarea } = await repo.crearTarea({ titulo: "Antes de cerrar" });
      await reposo();
      expect(antes.escrituras).toEqual([]);
      expect(guardado.size).toBe(1);

      const despues = nubeFalsa();
      const detener = iniciarEspejo(bd, despues.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 0 });
      despues.emitir("tareas", { completa: [] });
      await reposo();
      expect(despues.escrituras.flat()[0]).toMatchObject({ id: tarea.id, datos: { titulo: "Antes de cerrar" } });
      expect(await bd.tareas.get(tarea.id)).toBeDefined();
      expect(guardado.size).toBe(0);
      detener();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it("al detenerse deja de enviar y de escuchar", async () => {
    const { nube, detener } = conEspejo();
    expect(nube.oyentes()).toBe(8);
    detener();
    expect(nube.oyentes()).toBe(0);
    await repo.crearTarea({ titulo: "Después" });
    await reposo();
    expect(nube.escrituras).toEqual([]);
  });

  it("si la nube rechaza una escritura lo informa y no pierde el dato local", async () => {
    const nube = nubeFalsa();
    const fallos: unknown[] = [];
    nube.remoto.escribir = async () => {
      throw new Error("permiso denegado");
    };
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: (e) => fallos.push(e), retardoMs: 0 });
    const { tarea } = await repo.crearTarea({ titulo: "Local" });
    await reposo();
    expect(fallos).toHaveLength(1);
    expect(await bd.tareas.get(tarea.id)).toBeDefined();
    detener();
  });
});

describe("bases por cuenta", () => {
  it("los datos de la cuenta y los locales no se mezclan, y cerrar sesión los oculta", async () => {
    await repo.crearTarea({ titulo: "Local" });
    await usarBase(baseDeCuenta("u1"));
    expect((await repo.cargarTodo()).tareas).toEqual([]);
    await repo.crearTarea({ titulo: "De la cuenta" });
    await usarBase(BASE_LOCAL);
    expect((await repo.cargarTodo()).tareas.map((t) => t.titulo)).toEqual(["Local"]);
    await usarBase(baseDeCuenta("u2"));
    expect((await repo.cargarTodo()).tareas).toEqual([]);
    await usarBase(baseDeCuenta("u1"));
    expect((await repo.cargarTodo()).tareas.map((t) => t.titulo)).toEqual(["De la cuenta"]);
    bd.close();
    await Dexie.delete(baseDeCuenta("u1"));
    await Dexie.delete(baseDeCuenta("u2"));
  });

  it("la migración pasa por el espejo, conserva lo de la cuenta y no duplica al repetirse", async () => {
    const { tarea } = await repo.crearTarea({ titulo: "Local" });
    await repo.crearLista({ nombre: "Lista local" });
    const local = new BaseAndamia(BASE_LOCAL);
    await local.open();
    expect(await contarDatos(local)).toMatchObject({ total: 2, porTabla: { tareas: 1, listas: 1 } });

    await usarBase(baseDeCuenta("u3"));
    await repo.crearTarea({ titulo: "Ya en la cuenta" });
    await bd.tareas.put({ ...tarea, titulo: "Versión de la cuenta" });
    const nube = nubeFalsa();
    const detener = iniciarEspejo(bd, nube.remoto, { alAplicar: () => undefined, alEscribir: () => undefined, alFallar: () => undefined, retardoMs: 0 });

    expect(await copiarDatos(local, bd)).toBe(1);
    await reposo();
    expect(nube.escrituras.flat().map((c) => c.tabla)).toEqual(["listas"]);
    expect((await bd.tareas.get(tarea.id))?.titulo).toBe("Versión de la cuenta");
    expect(await copiarDatos(local, bd)).toBe(0);

    detener();
    local.close();
    bd.close();
    await Dexie.delete(baseDeCuenta("u3"));
  });
});
