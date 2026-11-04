import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { bd } from "../../src/datos/bd";
import * as repo from "../../src/datos/repositorio";
import { CONFIG_INICIAL, detener, estadisticasEnfoque, formatoMinutos, formatoTiempo, haTerminado, iniciar, leerTemporizador, minutosDeTarea, pausar, ponerAlDia, reanudar, restanteMs, saltar, temporizadorListo, transcurridoMs } from "../../src/logica/enfoque";
import { avisosDeHabitos, calcularRachas, describirFrecuencia, esEditable, esProgramado, estadoPorValor, indexarRegistros, pendienteHoy, siguienteEstado, tasaCumplimiento } from "../../src/logica/habitos";
import { cuadranteDePrioridad, CUADRANTES, prioridadDeCuadrante, repartirEnCuadrantes } from "../../src/logica/matriz";
import type { EstadoHabito, FrecuenciaHabito, Habito, Lista, RegistroHabito, SesionEnfoque, Tarea } from "../../src/modelos/tipos";

beforeEach(async () => {
  bd.close();
  await Dexie.delete("andamia");
  await bd.open();
});

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

describe("matriz de Eisenhower", () => {
  it("cada cuadrante corresponde a una prioridad, en ambos sentidos", () => {
    expect(CUADRANTES.map((c) => c.prioridad)).toEqual(["alta", "media", "baja", "ninguna"]);
    for (const c of CUADRANTES) {
      expect(cuadranteDePrioridad(prioridadDeCuadrante(c.id))).toBe(c.id);
    }
  });

  it("mover a otro cuadrante significa cambiar la prioridad", () => {
    expect(prioridadDeCuadrante("urgente-importante")).toBe("alta");
    expect(prioridadDeCuadrante("importante")).toBe("media");
    expect(prioridadDeCuadrante("urgente")).toBe("baja");
    expect(prioridadDeCuadrante("ninguno")).toBe("ninguna");
  });

  const filtros = { listaId: null, etiqueta: null };

  it("solo muestra pendientes", () => {
    const r = repartirEnCuadrantes([tarea({ titulo: "a", prioridad: "alta" }), tarea({ estado: "completada", prioridad: "alta" }), tarea({ eliminadaEn: "x", prioridad: "alta" })], [], filtros);
    expect(r["urgente-importante"].map((t) => t.titulo)).toEqual(["a"]);
  });

  it("ordena por fecha y deja al final las sin fecha", () => {
    const r = repartirEnCuadrantes([tarea({ titulo: "sin" }), tarea({ titulo: "luego", vence: "2026-12-01", todoElDia: true }), tarea({ titulo: "pronto", vence: "2026-11-05", todoElDia: true })], [], filtros);
    expect(r.ninguno.map((t) => t.titulo)).toEqual(["pronto", "luego", "sin"]);
  });

  it("filtra por lista y por etiqueta", () => {
    const a = tarea({ titulo: "a", listaId: "l1", etiquetas: ["x"] });
    const b = tarea({ titulo: "b", listaId: "l2" });
    expect(repartirEnCuadrantes([a, b], [], { listaId: "l1", etiqueta: null }).ninguno.map((t) => t.titulo)).toEqual(["a"]);
    expect(repartirEnCuadrantes([a, b], [], { listaId: null, etiqueta: "x" }).ninguno.map((t) => t.titulo)).toEqual(["a"]);
  });

  it("oculta listas excluidas, salvo que se elijan", () => {
    const lista: Lista = { id: "o", nombre: "O", color: null, carpetaId: null, incluirEnTodas: false, modo: "lista", orden: 0 };
    const t = tarea({ listaId: "o" });
    expect(repartirEnCuadrantes([t], [lista], filtros).ninguno).toEqual([]);
    expect(repartirEnCuadrantes([t], [lista], { listaId: "o", etiqueta: null }).ninguno).toHaveLength(1);
  });
});

describe("temporizador", () => {
  const C = CONFIG_INICIAL;
  const T0 = new Date(2026, 10, 4, 10, 0).getTime();
  const min = (m: number) => m * 60_000;
  const nuevo = () => iniciar(temporizadorListo(C), T0);

  it("empieza con la configuración por defecto", () => {
    expect(C).toEqual({ enfoqueMin: 25, descansoMin: 5, descansoLargoMin: 15, cadaN: 4 });
    expect(temporizadorListo(C).duracionMs).toBe(min(25));
  });

  it("calcula el tiempo solo con marcas de tiempo", () => {
    const t = nuevo();
    expect(restanteMs(t, T0 + min(10))).toBe(min(15));
    expect(transcurridoMs(t, T0 + min(10))).toBe(min(10));
  });

  it("sigue correcto tras recargar: lo guardado y releído da lo mismo", () => {
    const t = nuevo();
    const releido = leerTemporizador(JSON.parse(JSON.stringify(t)));
    expect(releido).not.toBeNull();
    expect(restanteMs(releido as typeof t, T0 + min(7))).toBe(min(18));
  });

  it("la pausa detiene el tiempo y reanudar lo continúa", () => {
    const p = pausar(nuevo(), T0 + min(10));
    expect(restanteMs(p, T0 + min(500))).toBe(min(15));
    const r = reanudar(p, T0 + min(500));
    expect(restanteMs(r, T0 + min(505))).toBe(min(10));
    expect(haTerminado(r, T0 + min(515))).toBe(true);
  });

  it("una pausa recargada sigue en pausa", () => {
    const releido = leerTemporizador(JSON.parse(JSON.stringify(pausar(nuevo(), T0 + min(3))))) as ReturnType<typeof nuevo>;
    expect(haTerminado(releido, T0 + min(600))).toBe(false);
    expect(restanteMs(releido, T0 + min(600))).toBe(min(22));
  });

  it("al terminar registra la sesión y empieza el descanso", () => {
    const a = ponerAlDia(nuevo(), C, T0 + min(25));
    expect(a.sesiones).toHaveLength(1);
    expect(a.sesiones[0]).toMatchObject({ tipo: "pomodoro", segundos: 1500 });
    expect(a.temporizador).toMatchObject({ fase: "descanso", estado: "corriendo", ciclos: 1, duracionMs: min(5) });
    expect(a.terminadas).toEqual(["enfoque"]);
  });

  it("no descuenta las pausas del registro, pero termina a su hora real", () => {
    const r = reanudar(pausar(nuevo(), T0 + min(10)), T0 + min(40));
    const a = ponerAlDia(r, C, T0 + min(55));
    expect(a.sesiones[0].segundos).toBe(1500);
    expect(new Date(a.sesiones[0].fin).getTime()).toBe(T0 + min(55));
  });

  it("con la app cerrada, cada fase termina a su hora prevista", () => {
    const a = ponerAlDia(nuevo(), C, T0 + min(180));
    expect(a.sesiones).toHaveLength(1);
    expect(new Date(a.sesiones[0].fin).getTime()).toBe(T0 + min(25));
    expect(a.terminadas).toEqual(["enfoque", "descanso"]);
    expect(a.temporizador).toMatchObject({ fase: "enfoque", estado: "listo", ciclos: 1 });
  });

  it("el descanso a medias continúa donde corresponde", () => {
    const a = ponerAlDia(nuevo(), C, T0 + min(27));
    expect(restanteMs(a.temporizador, T0 + min(27))).toBe(min(3));
  });

  it("cada cuatro pomodoros toca el descanso largo", () => {
    let t = nuevo();
    let ahora = T0;
    for (let i = 0; i < 3; i++) {
      ahora += min(25);
      t = ponerAlDia(t, C, ahora).temporizador;
      expect(t.fase).toBe("descanso");
      ahora += min(5);
      t = iniciar(ponerAlDia(t, C, ahora).temporizador, ahora);
    }
    ahora += min(25);
    t = ponerAlDia(t, C, ahora).temporizador;
    expect(t).toMatchObject({ fase: "descanso-largo", duracionMs: min(15), ciclos: 0 });
  });

  it("respeta la configuración", () => {
    const c = { enfoqueMin: 50, descansoMin: 10, descansoLargoMin: 30, cadaN: 2 };
    expect(temporizadorListo(c).duracionMs).toBe(min(50));
    const a = ponerAlDia(iniciar(temporizadorListo(c, "pomodoro", null, 1), T0), c, T0 + min(50));
    expect(a.temporizador).toMatchObject({ fase: "descanso-largo", duracionMs: min(30) });
  });

  it("saltar un enfoque registra lo trabajado, si llega a un minuto", () => {
    const largo = saltar(nuevo(), C, T0 + min(10));
    expect(largo.sesion?.segundos).toBe(600);
    expect(largo.temporizador.fase).toBe("descanso");
    expect(saltar(nuevo(), C, T0 + 30_000).sesion).toBeNull();
  });

  it("saltar un descanso deja listo el siguiente enfoque", () => {
    const enDescanso = ponerAlDia(nuevo(), C, T0 + min(25)).temporizador;
    const s = saltar(enDescanso, C, T0 + min(26));
    expect(s.sesion).toBeNull();
    expect(s.temporizador).toMatchObject({ fase: "enfoque", estado: "listo", ciclos: 1 });
  });

  it("el cronómetro no vence y registra al detener", () => {
    const t = iniciar(temporizadorListo(C, "cronometro"), T0);
    expect(haTerminado(t, T0 + min(600))).toBe(false);
    const d = detener(t, C, T0 + min(42));
    expect(d.sesion).toMatchObject({ tipo: "cronometro", segundos: 2520 });
    expect(d.temporizador.estado).toBe("listo");
    expect(detener(t, C, T0 + 5_000).sesion).toBeNull();
  });

  it("la misma sesión siempre tiene el mismo id, para no duplicarse entre pestañas", () => {
    expect(ponerAlDia(nuevo(), C, T0 + min(25)).sesiones[0].id).toBe(ponerAlDia(nuevo(), C, T0 + min(99)).sesiones[0].id);
  });

  it("descarta datos dañados", () => {
    for (const malo of [null, 3, {}, { modo: "x" }, { modo: "pomodoro", fase: "enfoque", estado: "corriendo", acumuladoMs: 0, duracionMs: 1, ciclos: 0, reanudadoEn: null }]) {
      expect(leerTemporizador(malo)).toBeNull();
    }
  });

  it("da formato al tiempo", () => {
    expect(formatoTiempo(min(25))).toBe("25:00");
    expect(formatoTiempo(1)).toBe("00:01");
    expect(formatoTiempo(min(61))).toBe("1:01:00");
    expect(formatoMinutos(45)).toBe("45 min");
    expect(formatoMinutos(120)).toBe("2 h");
    expect(formatoMinutos(135)).toBe("2 h 15 min");
  });
});

describe("estadísticas de enfoque", () => {
  const AHORA = new Date(2026, 10, 4, 14, 0); // miércoles
  const s = (dia: number, minutos: number, c: Partial<SesionEnfoque> = {}): SesionEnfoque => ({
    id: `s${dia}-${minutos}-${c.tareaId}`, tipo: "pomodoro", inicio: new Date(2026, 10, dia, 9, 0).toISOString(), fin: new Date(2026, 10, dia, 9, minutos).toISOString(), segundos: minutos * 60, tareaId: null, nota: "", manual: false, ...c,
  });

  it("separa hoy, semana y total", () => {
    const e = estadisticasEnfoque([s(4, 25), s(4, 25, { tipo: "cronometro", id: "c" }), s(2, 30), s(1, 10)], [], [], AHORA);
    expect(e.hoyMin).toBe(50);
    expect(e.hoyPomodoros).toBe(1);
    expect(e.semanaMin).toBe(80); // la semana empieza el lunes 2
    expect(e.totalMin).toBe(90);
  });

  it("cuenta la racha y hoy sin sesiones no la rompe", () => {
    expect(estadisticasEnfoque([s(4, 5), s(3, 5), s(2, 5)], [], [], AHORA).racha).toBe(3);
    expect(estadisticasEnfoque([s(3, 5), s(2, 5)], [], [], AHORA).racha).toBe(2);
    expect(estadisticasEnfoque([s(4, 5), s(2, 5)], [], [], AHORA).racha).toBe(1);
    expect(estadisticasEnfoque([s(1, 5)], [], [], AHORA).racha).toBe(0);
    expect(estadisticasEnfoque([], [], [], AHORA).racha).toBe(0);
  });

  it("entrega siete días terminando hoy", () => {
    const e = estadisticasEnfoque([s(4, 25), s(29, 5)], [], [], AHORA);
    expect(e.ultimos7).toHaveLength(7);
    expect(e.ultimos7[6]).toEqual({ dia: "2026-11-04", minutos: 25 });
    expect(e.ultimos7[0].dia).toBe("2026-10-29");
  });

  it("agrupa por tarea y por lista, de mayor a menor", () => {
    const lista: Lista = { id: "l", nombre: "Trabajo", color: null, carpetaId: null, incluirEnTodas: true, modo: "lista", orden: 0 };
    const a = tarea({ id: "a", titulo: "A", listaId: "l" });
    const b = tarea({ id: "b", titulo: "B" });
    const e = estadisticasEnfoque([s(4, 10, { tareaId: "a" }), s(3, 30, { tareaId: "b" }), s(2, 5, { tareaId: "a" }), s(1, 99, { tareaId: "nada" })], [a, b], [lista], AHORA);
    expect(e.porTarea).toEqual([{ id: "b", nombre: "B", minutos: 30 }, { id: "a", nombre: "A", minutos: 15 }]);
    expect(e.porLista.map((f) => f.nombre)).toEqual(["Bandeja de entrada", "Trabajo"]);
    expect(minutosDeTarea([s(4, 10, { tareaId: "a" }), s(3, 5, { tareaId: "a" })], "a")).toBe(15);
  });
});

function habito(frecuencia: FrecuenciaHabito = { tipo: "diaria" }, c: Partial<Habito> = {}): Habito {
  return { id: "h", nombre: "H", icono: "star", color: "#000", frecuencia, metaDiaria: 1, unidad: "", inicio: "2026-10-01", recordatorioHora: null, avisosEnviados: [], archivado: false, orden: 0, ...c };
}
const reg = (fecha: string, estado: EstadoHabito = "hecho"): RegistroHabito => ({ id: `h|${fecha}`, habitoId: "h", fecha, estado, valor: 1 });
const idx = (...r: RegistroHabito[]) => indexarRegistros(r, "h");
const HOY = new Date(2026, 10, 4, 14, 0); // miércoles 4 de noviembre

describe("frecuencia de hábitos", () => {
  it("días programados", () => {
    expect(esProgramado({ tipo: "diaria" }, HOY)).toBe(true);
    expect(esProgramado({ tipo: "dias", dias: [2] }, HOY)).toBe(true); // miércoles
    expect(esProgramado({ tipo: "dias", dias: [0, 4] }, HOY)).toBe(false);
    expect(esProgramado({ tipo: "semanal", veces: 3 }, HOY)).toBe(true);
  });

  it("describe la frecuencia", () => {
    expect(describirFrecuencia({ tipo: "diaria" })).toBe("Cada día");
    expect(describirFrecuencia({ tipo: "semanal", veces: 3 })).toBe("3 veces por semana");
    expect(describirFrecuencia({ tipo: "semanal", veces: 1 })).toBe("1 vez por semana");
    expect(describirFrecuencia({ tipo: "dias", dias: [4, 0] })).toBe("lun, vie");
    expect(describirFrecuencia({ tipo: "dias", dias: [0, 1, 2, 3, 4] })).toBe("Días laborables");
  });

  it("solo se edita desde el inicio hasta hoy, en días programados", () => {
    const h = habito({ tipo: "dias", dias: [2] }, { inicio: "2026-10-01" });
    expect(esEditable(h, HOY, HOY)).toBe(true);
    expect(esEditable(h, new Date(2026, 10, 11), HOY)).toBe(false);
    expect(esEditable(h, new Date(2026, 8, 30), HOY)).toBe(false);
    expect(esEditable(h, new Date(2026, 10, 3), HOY)).toBe(false);
  });

  it("calcula el estado por cantidad", () => {
    expect(estadoPorValor(8, 8)).toBe("hecho");
    expect(estadoPorValor(9, 8)).toBe("hecho");
    expect(estadoPorValor(3, 8)).toBe("parcial");
    expect(estadoPorValor(0, 8)).toBe("no-hecho");
  });

  it("el clic recorre los estados y vuelve al inicio", () => {
    expect(siguienteEstado(null)).toBe("hecho");
    expect(siguienteEstado("hecho")).toBe("parcial");
    expect(siguienteEstado("parcial")).toBe("no-hecho");
    expect(siguienteEstado("no-hecho")).toBeNull();
  });
});

describe("rachas de hábitos", () => {
  const h = habito({ tipo: "diaria" }, { inicio: "2026-11-01" });

  it("cuenta días seguidos hasta hoy", () => {
    expect(calcularRachas(h, idx(reg("2026-11-02"), reg("2026-11-03"), reg("2026-11-04")), HOY)).toMatchObject({ actual: 3, unidad: "días" });
  });

  it("hoy sin marcar no rompe la racha", () => {
    expect(calcularRachas(h, idx(reg("2026-11-02"), reg("2026-11-03")), HOY).actual).toBe(2);
  });

  it("marcar hoy como no hecho sí la rompe", () => {
    expect(calcularRachas(h, idx(reg("2026-11-03"), reg("2026-11-04", "no-hecho")), HOY).actual).toBe(0);
  });

  it("un día sin registro la rompe y la máxima se conserva", () => {
    const r = calcularRachas(h, idx(reg("2026-11-01"), reg("2026-11-02"), reg("2026-11-04")), HOY);
    expect(r.actual).toBe(1);
    expect(r.maxima).toBe(2);
  });

  it("un parcial no suma, pero tampoco la rompe", () => {
    const r = calcularRachas(h, idx(reg("2026-11-02"), reg("2026-11-03", "parcial"), reg("2026-11-04")), HOY);
    expect(r.actual).toBe(2);
  });

  it("los días no programados no la rompen", () => {
    // Lunes y miércoles: 26 oct., 28 oct., 2 nov., 4 nov.
    const d = habito({ tipo: "dias", dias: [0, 2] }, { inicio: "2026-10-26" });
    expect(calcularRachas(d, idx(reg("2026-10-26"), reg("2026-10-28"), reg("2026-11-02"), reg("2026-11-04")), HOY).actual).toBe(4);
    expect(calcularRachas(d, idx(reg("2026-10-26"), reg("2026-11-02"), reg("2026-11-04")), HOY).actual).toBe(2);
  });

  it("N veces por semana se cuenta en semanas", () => {
    const s = habito({ tipo: "semanal", veces: 2 }, { inicio: "2026-10-19" });
    const r = idx(reg("2026-10-19"), reg("2026-10-20"), reg("2026-10-27"), reg("2026-10-30"), reg("2026-11-03"));
    // Semanas del 19 y del 26 cumplidas; la actual, en curso, no la rompe.
    expect(calcularRachas(s, r, HOY)).toMatchObject({ actual: 2, maxima: 2, unidad: "semanas" });
  });

  it("una semana incumplida rompe la racha semanal", () => {
    const s = habito({ tipo: "semanal", veces: 2 }, { inicio: "2026-10-19" });
    expect(calcularRachas(s, idx(reg("2026-10-19"), reg("2026-10-20"), reg("2026-10-27")), HOY).actual).toBe(0);
  });

  it("cumplir en la semana actual ya suma", () => {
    const s = habito({ tipo: "semanal", veces: 1 }, { inicio: "2026-11-02" });
    expect(calcularRachas(s, idx(reg("2026-11-03")), HOY).actual).toBe(1);
  });

  it("una primera semana demasiado corta no rompe la racha", () => {
    // Empieza un sábado y pide 3: esa semana no alcanza.
    const s = habito({ tipo: "semanal", veces: 3 }, { inicio: "2026-10-24" });
    const r = idx(reg("2026-10-26"), reg("2026-10-27"), reg("2026-10-28"));
    expect(calcularRachas(s, r, HOY).actual).toBe(1);
  });

  it("un hábito que aún no empieza no tiene racha", () => {
    expect(calcularRachas(habito({ tipo: "diaria" }, { inicio: "2026-12-01" }), idx(), HOY)).toMatchObject({ actual: 0, maxima: 0 });
  });
});

describe("tasa de cumplimiento", () => {
  const h = habito({ tipo: "diaria" }, { inicio: "2026-11-01" });

  it("cuenta hechos sobre esperados, sin hoy si no está marcado", () => {
    // 1, 2 y 3 de noviembre esperados; hoy aún no.
    expect(tasaCumplimiento(h, idx(reg("2026-11-01"), reg("2026-11-02")), HOY)).toBe(67);
  });

  it("un parcial vale la mitad", () => {
    expect(tasaCumplimiento(h, idx(reg("2026-11-01"), reg("2026-11-02", "parcial"), reg("2026-11-03", "no-hecho"), reg("2026-11-04")), HOY)).toBe(63);
  });

  it("no hay tasa si aún no se esperaba nada", () => {
    expect(tasaCumplimiento(habito({ tipo: "diaria" }, { inicio: "2026-11-04" }), idx(), HOY)).toBeNull();
    expect(tasaCumplimiento(habito({ tipo: "diaria" }, { inicio: "2026-12-01" }), idx(), HOY)).toBeNull();
  });

  it("en N veces por semana no pasa de 100 ni exige lo que queda de la semana actual", () => {
    const s = habito({ tipo: "semanal", veces: 2 }, { inicio: "2026-10-26" });
    expect(tasaCumplimiento(s, idx(reg("2026-10-26"), reg("2026-10-27"), reg("2026-10-28")), HOY)).toBe(100);
    expect(tasaCumplimiento(s, idx(reg("2026-10-26")), HOY)).toBe(50);
  });
});

describe("recordatorios de hábitos", () => {
  const conAviso = (c: Partial<Habito> = {}) => habito({ tipo: "diaria" }, { recordatorioHora: "09:00", ...c });

  it("avisa cuando llega la hora si sigue pendiente", () => {
    expect(avisosDeHabitos([conAviso()], [], HOY)).toHaveLength(1);
    expect(avisosDeHabitos([conAviso({ recordatorioHora: "20:00" })], [], HOY)).toEqual([]);
  });

  it("no avisa si ya está hecho, archivado, sin hora o ya avisado", () => {
    expect(avisosDeHabitos([conAviso()], [reg("2026-11-04")], HOY)).toEqual([]);
    expect(avisosDeHabitos([conAviso({ archivado: true })], [], HOY)).toEqual([]);
    expect(avisosDeHabitos([conAviso({ recordatorioHora: null })], [], HOY)).toEqual([]);
    const clave = avisosDeHabitos([conAviso()], [], HOY)[0].clave;
    expect(avisosDeHabitos([conAviso({ avisosEnviados: [clave] })], [], HOY)).toEqual([]);
  });

  it("no avisa en un día no programado", () => {
    expect(avisosDeHabitos([habito({ tipo: "dias", dias: [0] }, { recordatorioHora: "09:00" })], [], HOY)).toEqual([]);
  });

  it("en N veces por semana deja de avisar al cumplir la meta", () => {
    const h = habito({ tipo: "semanal", veces: 1 });
    expect(pendienteHoy(h, idx(), HOY)).toBe(true);
    expect(pendienteHoy(h, idx(reg("2026-11-03")), HOY)).toBe(false);
  });
});

describe("repositorio de enfoque y hábitos", () => {
  it("guardar la misma sesión dos veces no la duplica", async () => {
    const s: SesionEnfoque = { id: "x", tipo: "pomodoro", inicio: "2026-11-04T10:00:00.000Z", fin: "2026-11-04T10:25:00.000Z", segundos: 1500, tareaId: null, nota: "", manual: false };
    await repo.guardarSesion(s);
    await repo.guardarSesion(s);
    expect(await bd.sesiones.count()).toBe(1);
    await repo.borrarSesion("x");
    expect(await bd.sesiones.count()).toBe(0);
  });

  const datos = { nombre: " Agua ", icono: "droplet", color: "#000", frecuencia: { tipo: "diaria" } as const, metaDiaria: 8, unidad: "vasos", inicio: "2026-11-01", recordatorioHora: null };

  it("crea, archiva y actualiza un hábito", async () => {
    const h = await repo.crearHabito(datos);
    expect(h.nombre).toBe("Agua");
    expect(h.archivado).toBe(false);
    expect((await repo.actualizarHabito(h.id, { archivado: true })).archivado).toBe(true);
    await expect(repo.actualizarHabito("nada", {})).rejects.toThrow();
  });

  it("registra un solo valor por día y permite quitarlo", async () => {
    const h = await repo.crearHabito(datos);
    await repo.registrarHabito(h.id, "2026-11-04", { estado: "parcial", valor: 3 });
    await repo.registrarHabito(h.id, "2026-11-04", { estado: "hecho", valor: 8 });
    expect(await bd.registrosHabito.count()).toBe(1);
    expect((await bd.registrosHabito.get(`${h.id}|2026-11-04`))?.estado).toBe("hecho");
    await repo.registrarHabito(h.id, "2026-11-04", null);
    expect(await bd.registrosHabito.count()).toBe(0);
  });

  it("borrar un hábito elimina su historial", async () => {
    const h = await repo.crearHabito(datos);
    const otro = await repo.crearHabito(datos);
    await repo.registrarHabito(h.id, "2026-11-04", { estado: "hecho", valor: 8 });
    await repo.registrarHabito(otro.id, "2026-11-04", { estado: "hecho", valor: 8 });
    await repo.borrarHabito(h.id);
    expect(await bd.registrosHabito.count()).toBe(1);
  });

  it("un aviso de hábito solo se marca una vez", async () => {
    const h = await repo.crearHabito(datos);
    expect(await repo.marcarAvisoHabito(h.id, "c")).not.toBeNull();
    expect(await repo.marcarAvisoHabito(h.id, "c")).toBeNull();
  });
});

describe("migración desde la fase 3", () => {
  it("conserva todo y agrega tablas vacías", async () => {
    bd.close();
    await Dexie.delete("andamia");
    const vieja = new Dexie("andamia");
    vieja.version(2).stores({
      tareas: "id, listaId, estado, eliminadaEn, vence, orden, columnaId",
      listas: "id, carpetaId, orden",
      carpetas: "id, orden",
      etiquetas: "nombre, orden",
      columnas: "id, listaId, orden",
    });
    await vieja.open();
    await vieja.table("listas").put({ id: "l", nombre: "L", color: null, carpetaId: null, incluirEnTodas: true, modo: "kanban", orden: 0 });
    await vieja.table("columnas").put({ id: "c", listaId: "l", nombre: "Col", orden: 0 });
    await vieja.table("tareas").put(tarea({ id: "t", listaId: "l", columnaId: "c", repeticion: "FREQ=DAILY;INTERVAL=1", vence: "2026-11-05", todoElDia: true, recordatorios: [{ id: "r", minutosAntes: 0 }] }));
    vieja.close();

    await bd.open();
    const d = await repo.cargarTodo();
    expect(d.tareas[0]).toMatchObject({ id: "t", columnaId: "c", repeticion: "FREQ=DAILY;INTERVAL=1" });
    expect(d.tareas[0].recordatorios).toHaveLength(1);
    expect(d.listas[0].modo).toBe("kanban");
    expect(d.columnas).toHaveLength(1);
    expect(d.sesiones).toEqual([]);
    expect(d.habitos).toEqual([]);
    expect(d.registros).toEqual([]);
  });
});
