import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { format, parseISO } from "date-fns";
import { bd } from "../../src/datos/bd";
import * as repo from "../../src/datos/repositorio";
import { diasDeMes, diasDeSemana, entradasEnRango, venceEnDia, venceEnHora } from "../../src/logica/calendario";
import { repartirEnColumnas } from "../../src/logica/columnas";
import { interpretarEntrada } from "../../src/logica/entradaRapida";
import { avisosPendientes, describirRecordatorio, momentoDeAviso } from "../../src/logica/recordatorios";
import { construirRegla, describirRegla, leerRegla, ocurrenciasEnRango, primeraOcurrencia, siguienteOcurrencia, venceParaRegla } from "../../src/logica/repeticion";
import type { Columna, Tarea } from "../../src/modelos/tipos";

// Miércoles 4 de noviembre de 2026, 14:00.
const AHORA = new Date(2026, 10, 4, 14, 0);
const dia = (d: Date | null) => (d ? format(d, "yyyy-MM-dd HH:mm") : null);
const local = (v: string | null) => (v ? format(parseISO(v), "yyyy-MM-dd HH:mm") : null);

let n = 0;
function tarea(c: Partial<Tarea> = {}): Tarea {
  n += 1;
  return {
    id: `t${n}`, listaId: "bandeja", titulo: `T${n}`, descripcion: "", estado: "pendiente", prioridad: "ninguna", vence: null, todoElDia: false,
    zonaHoraria: "America/Santiago", etiquetas: [], subtareas: [], repeticion: null, repetirDesde: "vencimiento", repetidaDe: null, recordatorios: [],
    avisosEnviados: [], columnaId: null, orden: n, completadaEn: null, eliminadaEn: null, creadaEn: "2026-11-01T00:00:00.000Z", modificadaEn: "2026-11-01T00:00:00.000Z",
    ...c,
  };
}

beforeEach(async () => {
  bd.close();
  await Dexie.delete("andamia");
  await bd.open();
});

describe("reglas de repetición", () => {
  it("construye y lee una regla", () => {
    const regla = construirRegla({ frecuencia: "semanal", intervalo: 2, diasSemana: [3, 0] });
    expect(regla).toBe("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH");
    expect(leerRegla(regla)).toEqual({ frecuencia: "semanal", intervalo: 2, diasSemana: [0, 3] });
  });

  it("los días solo aplican a la frecuencia semanal", () => {
    expect(construirRegla({ frecuencia: "mensual", intervalo: 1, diasSemana: [0] })).toBe("FREQ=MONTHLY;INTERVAL=1");
  });

  it("corrige un intervalo inválido", () => {
    expect(construirRegla({ frecuencia: "diaria", intervalo: 0, diasSemana: [] })).toBe("FREQ=DAILY;INTERVAL=1");
  });

  it.each([
    ["FREQ=DAILY;INTERVAL=1", "Cada día"],
    ["FREQ=DAILY;INTERVAL=3", "Cada 3 días"],
    ["FREQ=WEEKLY;INTERVAL=1", "Cada semana"],
    ["FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "Cada lunes"],
    ["FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH", "Cada lunes y jueves"],
    ["FREQ=WEEKLY;INTERVAL=2;BYDAY=FR", "Cada 2 semanas: viernes"],
    ["FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR", "Días laborables"],
    ["FREQ=MONTHLY;INTERVAL=1", "Cada mes"],
    ["FREQ=YEARLY;INTERVAL=2", "Cada 2 años"],
  ])("describe %s", (regla, texto) => {
    expect(describirRegla(regla)).toBe(texto);
  });
});

describe("siguiente ocurrencia", () => {
  const sig = (regla: string, base: Date, desde: "vencimiento" | "completado" = "vencimiento") => dia(siguienteOcurrencia(regla, base, desde, AHORA));
  const HOY = new Date(2026, 10, 4);

  it("avanza por frecuencia", () => {
    expect(sig("FREQ=DAILY;INTERVAL=1", HOY)).toBe("2026-11-05 00:00");
    expect(sig("FREQ=WEEKLY;INTERVAL=1", HOY)).toBe("2026-11-11 00:00");
    expect(sig("FREQ=WEEKLY;INTERVAL=2", HOY)).toBe("2026-11-18 00:00");
    expect(sig("FREQ=MONTHLY;INTERVAL=1", HOY)).toBe("2026-12-04 00:00");
    expect(sig("FREQ=YEARLY;INTERVAL=1", HOY)).toBe("2027-11-04 00:00");
  });

  it("recorre los días elegidos dentro de la semana", () => {
    expect(sig("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH", new Date(2026, 10, 2))).toBe("2026-11-05 00:00");
    expect(sig("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH", new Date(2026, 10, 5))).toBe("2026-11-09 00:00");
  });

  it("conserva la hora", () => {
    expect(sig("FREQ=DAILY;INTERVAL=1", new Date(2026, 10, 4, 9, 30))).toBe("2026-11-05 09:30");
  });

  it("una tarea atrasada no vuelve a quedar en el pasado", () => {
    expect(sig("FREQ=DAILY;INTERVAL=1", new Date(2026, 9, 20))).toBe("2026-11-04 00:00");
    expect(sig("FREQ=WEEKLY;INTERVAL=1", new Date(2026, 9, 7))).toBe("2026-11-04 00:00");
  });

  it("mantiene el ritmo del intervalo al saltar lo atrasado", () => {
    // Cada 2 semanas desde el 7 de oct.: 21 oct., 4 nov., 18 nov.
    expect(sig("FREQ=WEEKLY;INTERVAL=2", new Date(2026, 9, 7))).toBe("2026-11-04 00:00");
    expect(sig("FREQ=WEEKLY;INTERVAL=2", new Date(2026, 9, 14))).toBe("2026-11-11 00:00");
  });

  it("desde la finalización cuenta desde hoy", () => {
    expect(sig("FREQ=DAILY;INTERVAL=3", new Date(2026, 9, 1, 8, 0), "completado")).toBe("2026-11-07 08:00");
  });

  it("un mensual del día 31 salta los meses sin ese día", () => {
    expect(dia(siguienteOcurrencia("FREQ=MONTHLY;INTERVAL=1", new Date(2026, 9, 31), "vencimiento", new Date(2026, 9, 31)))).toBe("2026-12-31 00:00");
  });

  it("no se desplaza con el cambio de horario", () => {
    // En Chile el horario cambia en abril y septiembre.
    expect(dia(siguienteOcurrencia("FREQ=WEEKLY;INTERVAL=1", new Date(2026, 8, 1, 9, 0), "vencimiento", new Date(2026, 8, 1, 10, 0)))).toBe("2026-09-08 09:00");
    expect(dia(siguienteOcurrencia("FREQ=WEEKLY;INTERVAL=1", new Date(2027, 3, 1, 9, 0), "vencimiento", new Date(2027, 3, 1, 10, 0)))).toBe("2027-04-08 09:00");
  });

  it("incluye el día inicial en la primera ocurrencia", () => {
    expect(dia(primeraOcurrencia("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE", HOY))).toBe("2026-11-04 00:00");
    expect(dia(primeraOcurrencia("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", HOY))).toBe("2026-11-09 00:00");
  });

  it("asignar una regla ajusta el vencimiento", () => {
    expect(venceParaRegla("FREQ=DAILY;INTERVAL=1", { vence: null, todoElDia: false }, AHORA)).toEqual({ vence: "2026-11-04", todoElDia: true });
    expect(venceParaRegla("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", { vence: "2026-11-04", todoElDia: true }, AHORA)).toEqual({ vence: "2026-11-09", todoElDia: true });
  });

  it("calcula ocurrencias futuras en un rango sin repetir la actual", () => {
    const r = ocurrenciasEnRango("FREQ=WEEKLY;INTERVAL=1", HOY, new Date(2026, 10, 1), new Date(2026, 10, 30)).map(dia);
    expect(r).toEqual(["2026-11-11 00:00", "2026-11-18 00:00", "2026-11-25 00:00"]);
  });
});

describe("entrada rápida con repetición", () => {
  const leer = (t: string) => interpretarEntrada(t, AHORA, []);

  it.each([
    ["Regar cada día", "Regar", "FREQ=DAILY;INTERVAL=1", "2026-11-04"],
    ["Regar todos los días", "Regar", "FREQ=DAILY;INTERVAL=1", "2026-11-04"],
    ["Clase cada lunes", "Clase", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "2026-11-09"],
    ["Clase todos los lunes", "Clase", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", "2026-11-09"],
    ["Clase cada miércoles", "Clase", "FREQ=WEEKLY;INTERVAL=1;BYDAY=WE", "2026-11-04"],
    ["Clase cada sabado", "Clase", "FREQ=WEEKLY;INTERVAL=1;BYDAY=SA", "2026-11-07"],
    ["Yoga cada lunes y jueves", "Yoga", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH", "2026-11-05"],
    ["Yoga cada lunes, miércoles y viernes", "Yoga", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR", "2026-11-04"],
    ["Informe cada semana", "Informe", "FREQ=WEEKLY;INTERVAL=1", "2026-11-04"],
    ["Informe cada 2 semanas", "Informe", "FREQ=WEEKLY;INTERVAL=2", "2026-11-04"],
    ["Informe cada dos semanas", "Informe", "FREQ=WEEKLY;INTERVAL=2", "2026-11-04"],
    ["Pagar cada mes", "Pagar", "FREQ=MONTHLY;INTERVAL=1", "2026-11-04"],
    ["Pagar cada 3 meses", "Pagar", "FREQ=MONTHLY;INTERVAL=3", "2026-11-04"],
    ["Revisión cada año", "Revisión", "FREQ=YEARLY;INTERVAL=1", "2026-11-04"],
    ["Correr de lunes a viernes", "Correr", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR", "2026-11-04"],
  ])("%s", (texto, titulo, regla, vence) => {
    const r = leer(texto);
    expect(r.titulo).toBe(titulo);
    expect(r.repeticion).toBe(regla);
    expect(r.vence).toBe(vence);
  });

  it("combina repetición, hora, prioridad y etiqueta", () => {
    const r = leer("Reunión cada lunes 9am !alta #trabajo");
    expect(r.titulo).toBe("Reunión");
    expect(r.repeticion).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    expect(local(r.vence)).toBe("2026-11-09 09:00");
    expect(r.todoElDia).toBe(false);
    expect(r.prioridad).toBe("alta");
  });

  it("respeta una fecha inicial", () => {
    const r = leer("Pagar el viernes cada mes");
    expect(r.repeticion).toBe("FREQ=MONTHLY;INTERVAL=1");
    expect(r.vence).toBe("2026-11-06");
  });

  it.each(["Informe mensual", "Reporte semanal", "Cada uno trae algo", "Una mesa cada", "Cada mesa"])("no confunde: %s", (t) => {
    const r = leer(t);
    expect(r.repeticion).toBeNull();
    expect(r.titulo).toBe(t);
  });

  it("un texto que solo es una repetición se conserva como título", () => {
    const r = leer("cada lunes");
    expect(r.titulo).toBe("cada lunes");
    expect(r.repeticion).toBeNull();
    expect(r.vence).toBeNull();
  });
});

describe("completar una tarea repetida", () => {
  it("deja una copia completada y avanza la original con subtareas sin marcar", async () => {
    const { tarea: t } = await repo.crearTarea({ titulo: "Clase", vence: "2026-11-09", todoElDia: true, repeticion: "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO", minutosRecordatorios: [0] });
    await repo.actualizarTarea(t.id, {
      subtareas: [
        { id: "a", titulo: "Hecha", estado: "completada", orden: 0 },
        { id: "b", titulo: "Pendiente", estado: "pendiente", orden: 1 },
      ],
      avisosEnviados: ["x|2026-11-09"],
    });
    const [avanzada, copia] = await repo.completarTarea(t.id, true, new Date(2026, 10, 9, 10));
    expect(avanzada.id).toBe(t.id);
    expect(avanzada.estado).toBe("pendiente");
    expect(avanzada.vence).toBe("2026-11-16");
    expect(avanzada.repeticion).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    expect(avanzada.subtareas.map((s) => s.estado)).toEqual(["pendiente", "pendiente"]);
    expect(avanzada.recordatorios).toHaveLength(1);
    expect(avanzada.avisosEnviados).toEqual([]);

    expect(copia.id).not.toBe(t.id);
    expect(copia).toMatchObject({ estado: "completada", vence: "2026-11-09", repeticion: null, repetidaDe: t.id, recordatorios: [] });
    expect(copia.subtareas.map((s) => s.estado)).toEqual(["completada", "pendiente"]);
    expect(await bd.tareas.count()).toBe(2);
  });

  it("una tarea sin regla se completa normalmente", async () => {
    const { tarea: t } = await repo.crearTarea({ titulo: "Una vez" });
    expect(await repo.completarTarea(t.id, true)).toHaveLength(1);
    expect(await bd.tareas.count()).toBe(1);
  });
});

describe("recordatorios", () => {
  const conHora = (minutos: number[], avisos: string[] = []) =>
    tarea({ vence: new Date(2026, 10, 4, 15, 0).toISOString(), recordatorios: minutos.map((m, i) => ({ id: `r${i}`, minutosAntes: m })), avisosEnviados: avisos });

  it("calcula el momento del aviso", () => {
    const t = conHora([30]);
    expect(dia(momentoDeAviso(t, t.recordatorios[0]))).toBe("2026-11-04 14:30");
  });

  it("sin hora calcula desde las 09:00", () => {
    const t = tarea({ vence: "2026-11-05", todoElDia: true });
    expect(dia(momentoDeAviso(t, { minutosAntes: 0 }))).toBe("2026-11-05 09:00");
    expect(dia(momentoDeAviso(t, { minutosAntes: 1440 }))).toBe("2026-11-04 09:00");
  });

  it("solo avisa cuando llega el momento", () => {
    const t = conHora([0, 30, 90]);
    expect(avisosPendientes([t], AHORA).map((a) => a.recordatorio.minutosAntes)).toEqual([90]);
    expect(avisosPendientes([t], new Date(2026, 10, 4, 14, 30))).toHaveLength(2);
  });

  it("no repite un aviso ya enviado", () => {
    const t = conHora([90]);
    const clave = avisosPendientes([t], AHORA)[0].clave;
    expect(avisosPendientes([{ ...t, avisosEnviados: [clave] }], AHORA)).toEqual([]);
  });

  it("vuelve a avisar si cambia la fecha", () => {
    const t = conHora([90]);
    const clave = avisosPendientes([t], AHORA)[0].clave;
    const movida = { ...t, avisosEnviados: [clave], vence: new Date(2026, 10, 4, 14, 30).toISOString() };
    expect(avisosPendientes([movida], AHORA)).toHaveLength(1);
  });

  it("ignora completadas, borradas, sin fecha y avisos de hace más de un día", () => {
    const r = [{ id: "r", minutosAntes: 0 }];
    const vence = new Date(2026, 10, 4, 13, 0).toISOString();
    expect(avisosPendientes([tarea({ vence, recordatorios: r, estado: "completada" })], AHORA)).toEqual([]);
    expect(avisosPendientes([tarea({ vence, recordatorios: r, eliminadaEn: "x" })], AHORA)).toEqual([]);
    expect(avisosPendientes([tarea({ recordatorios: r })], AHORA)).toEqual([]);
    expect(avisosPendientes([tarea({ vence: new Date(2026, 10, 2).toISOString(), recordatorios: r })], AHORA)).toEqual([]);
  });

  it("marcar un aviso solo funciona una vez", async () => {
    const { tarea: t } = await repo.crearTarea({ titulo: "T" });
    expect(await repo.marcarAviso(t.id, "c")).not.toBeNull();
    expect(await repo.marcarAviso(t.id, "c")).toBeNull();
  });

  it("describe las opciones", () => {
    expect(describirRecordatorio(0, false)).toBe("A la hora");
    expect(describirRecordatorio(30, false)).toBe("30 minutos antes");
    expect(describirRecordatorio(120, false)).toBe("2 horas antes");
    expect(describirRecordatorio(1440, false)).toBe("1 día antes");
    expect(describirRecordatorio(1440, true)).toBe("1 día antes (09:00)");
    expect(describirRecordatorio(0, true)).toBe("El mismo día, 09:00");
  });
});

describe("columnas", () => {
  it("crea una columna inicial una sola vez", async () => {
    const lista = await repo.crearLista({ nombre: "L" });
    const a = await repo.asegurarColumnas(lista.id);
    const b = await repo.asegurarColumnas(lista.id);
    expect(a).toHaveLength(1);
    expect(b[0].id).toBe(a[0].id);
  });

  it("reparte y envía a la primera las tareas sin columna válida", () => {
    const columnas: Columna[] = [
      { id: "c2", listaId: "l", nombre: "B", orden: 1 },
      { id: "c1", listaId: "l", nombre: "A", orden: 0 },
    ];
    const r = repartirEnColumnas([tarea({ titulo: "sin", columnaId: null }), tarea({ titulo: "vieja", columnaId: "borrada" }), tarea({ titulo: "b", columnaId: "c2" })], columnas);
    expect(r.get("c1")?.map((t) => t.titulo)).toEqual(["sin", "vieja"]);
    expect(r.get("c2")?.map((t) => t.titulo)).toEqual(["b"]);
  });

  it("crea, renombra y reordena", async () => {
    const lista = await repo.crearLista({ nombre: "L" });
    const a = await repo.crearColumna(lista.id, " Por hacer ");
    const b = await repo.crearColumna(lista.id, "Hecho");
    expect(a.nombre).toBe("Por hacer");
    expect(b.orden).toBeGreaterThan(a.orden);
    await repo.renombrarColumna(a.id, "Pendiente");
    await repo.reordenarColumnas([b.id, a.id]);
    const r = await bd.columnas.where("listaId").equals(lista.id).sortBy("orden");
    expect(r.map((c) => c.nombre)).toEqual(["Hecho", "Pendiente"]);
  });

  it("borrar una columna mueve sus tareas a la elegida", async () => {
    const lista = await repo.crearLista({ nombre: "L" });
    const a = await repo.crearColumna(lista.id, "A");
    const b = await repo.crearColumna(lista.id, "B");
    const { tarea: conColumna } = await repo.crearTarea({ titulo: "X", listaId: lista.id, columnaId: a.id });
    const { tarea: sinColumna } = await repo.crearTarea({ titulo: "Y", listaId: lista.id });
    await repo.borrarColumna(a.id, b.id);
    expect((await bd.tareas.get(conColumna.id))?.columnaId).toBe(b.id);
    expect((await bd.tareas.get(sinColumna.id))?.columnaId).toBe(b.id);
    expect(await bd.columnas.get(a.id)).toBeUndefined();
  });

  it("rechaza un destino inválido sin perder nada", async () => {
    const l1 = await repo.crearLista({ nombre: "1" });
    const l2 = await repo.crearLista({ nombre: "2" });
    const a = await repo.crearColumna(l1.id, "A");
    const otra = await repo.crearColumna(l2.id, "B");
    await expect(repo.borrarColumna(a.id, otra.id)).rejects.toThrow();
    await expect(repo.borrarColumna(a.id, a.id)).rejects.toThrow();
    expect(await bd.columnas.get(a.id)).toBeDefined();
  });

  it("mueve una tarea entre columnas y la ubica", async () => {
    const lista = await repo.crearLista({ nombre: "L" });
    const a = await repo.crearColumna(lista.id, "A");
    const b = await repo.crearColumna(lista.id, "B");
    const { tarea: x } = await repo.crearTarea({ titulo: "X", listaId: lista.id, columnaId: a.id });
    const { tarea: y } = await repo.crearTarea({ titulo: "Y", listaId: lista.id, columnaId: b.id });
    const { tarea: z } = await repo.crearTarea({ titulo: "Z", listaId: lista.id, columnaId: b.id });
    await repo.moverTareaAColumna([z.id, x.id, y.id], x.id, b.id);
    const todas = await repo.cargarTodo();
    const reparto = repartirEnColumnas(todas.tareas, todas.columnas);
    expect(reparto.get(a.id)).toEqual([]);
    expect(reparto.get(b.id)?.map((t) => t.titulo)).toEqual(["Z", "X", "Y"]);
  });

  it("borrar una lista elimina sus columnas", async () => {
    const lista = await repo.crearLista({ nombre: "L" });
    await repo.crearColumna(lista.id, "A");
    await repo.borrarLista(lista.id);
    expect(await bd.columnas.count()).toBe(0);
  });
});

describe("calendario", () => {
  it("el mes empieza en lunes y cubre semanas completas", () => {
    const dias = diasDeMes(new Date(2026, 10, 15));
    expect(dia(dias[0])).toBe("2026-10-26 00:00");
    expect(dias[0].getDay()).toBe(1);
    expect(dias[dias.length - 1].getDay()).toBe(0);
    expect(dias.length % 7).toBe(0);
  });

  it("la semana tiene siete días desde el lunes", () => {
    const dias = diasDeSemana(AHORA);
    expect(dias).toHaveLength(7);
    expect(dia(dias[0])).toBe("2026-11-02 00:00");
  });

  it("incluye tareas del rango y marca las ocurrencias", () => {
    const fija = tarea({ titulo: "fija", vence: "2026-11-10", todoElDia: true });
    const fuera = tarea({ titulo: "fuera", vence: "2026-12-10", todoElDia: true });
    const borrada = tarea({ titulo: "borrada", vence: "2026-11-10", todoElDia: true, eliminadaEn: "x" });
    const repetida = tarea({ titulo: "rep", vence: "2026-11-04", todoElDia: true, repeticion: "FREQ=WEEKLY;INTERVAL=1" });
    const r = entradasEnRango([fija, fuera, borrada, repetida], new Date(2026, 10, 1), new Date(2026, 10, 15));
    expect(r.map((e) => [e.tarea.titulo, format(e.fecha, "MM-dd"), e.esOcurrencia])).toEqual([
      ["rep", "11-04", false],
      ["fija", "11-10", false],
      ["rep", "11-11", true],
    ]);
  });

  it("cambiar de día conserva la hora", () => {
    const destino = new Date(2026, 10, 20);
    expect(venceEnDia({ vence: "2026-11-04", todoElDia: true }, destino)).toEqual({ vence: "2026-11-20", todoElDia: true });
    expect(venceEnDia({ vence: null, todoElDia: false }, destino)).toEqual({ vence: "2026-11-20", todoElDia: true });
    const conHora = venceEnDia({ vence: new Date(2026, 10, 4, 9, 30).toISOString(), todoElDia: false }, destino);
    expect(local(conHora.vence)).toBe("2026-11-20 09:30");
    expect(conHora.todoElDia).toBe(false);
  });

  it("colocar en una hora", () => {
    expect(local(venceEnHora(new Date(2026, 10, 20), 15).vence)).toBe("2026-11-20 15:00");
  });
});

describe("migración desde la fase 2", () => {
  it("conserva los datos y agrega los campos nuevos", async () => {
    bd.close();
    await Dexie.delete("andamia");
    const vieja = new Dexie("andamia");
    vieja.version(1).stores({
      tareas: "id, listaId, estado, eliminadaEn, vence, orden",
      listas: "id, carpetaId, orden",
      carpetas: "id, orden",
      etiquetas: "nombre, orden",
    });
    await vieja.open();
    await vieja.table("listas").put({ id: "l1", nombre: "Antigua", color: null, carpetaId: null, incluirEnTodas: true, orden: 0 });
    await vieja.table("etiquetas").put({ nombre: "e", nombreVisible: "E", color: "#000", orden: 0 });
    await vieja.table("carpetas").put({ id: "c1", nombre: "Carpeta", orden: 0 });
    await vieja.table("tareas").put({
      id: "t1", listaId: "l1", titulo: "Vieja", descripcion: "Notas", estado: "pendiente", prioridad: "alta", vence: "2026-11-05", todoElDia: true, zonaHoraria: "America/Santiago",
      etiquetas: ["e"], subtareas: [{ id: "s", titulo: "Paso", estado: "completada", orden: 0 }], orden: 5, completadaEn: null, eliminadaEn: null, creadaEn: "2026-11-01", modificadaEn: "2026-11-01",
    });
    vieja.close();

    await bd.open();
    const d = await repo.cargarTodo();
    expect(d.tareas).toHaveLength(1);
    expect(d.tareas[0]).toMatchObject({
      titulo: "Vieja", descripcion: "Notas", prioridad: "alta", vence: "2026-11-05", etiquetas: ["e"], orden: 5,
      repeticion: null, repetirDesde: "vencimiento", repetidaDe: null, recordatorios: [], avisosEnviados: [], columnaId: null,
    });
    expect(d.tareas[0].subtareas[0].estado).toBe("completada");
    expect(d.listas[0]).toMatchObject({ nombre: "Antigua", modo: "lista" });
    expect(d.carpetas).toHaveLength(1);
    expect(d.etiquetas).toHaveLength(1);
    expect(d.columnas).toEqual([]);
  });
});
