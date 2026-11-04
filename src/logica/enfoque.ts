import { addDays, differenceInCalendarDays, format, parseISO, startOfDay, startOfWeek } from "date-fns";
import { LISTA_BANDEJA, type Lista, type SesionEnfoque, type Tarea, type TipoSesion } from "../modelos/tipos";

export interface ConfigEnfoque {
  enfoqueMin: number;
  descansoMin: number;
  descansoLargoMin: number;
  /** Cada cuántos pomodoros toca el descanso largo. */
  cadaN: number;
}

export const CONFIG_INICIAL: ConfigEnfoque = { enfoqueMin: 25, descansoMin: 5, descansoLargoMin: 15, cadaN: 4 };

/** Las sesiones de menos de un minuto no se registran. */
export const SEGUNDOS_MINIMOS = 60;

export type Fase = "enfoque" | "descanso" | "descanso-largo";
export type EstadoTemporizador = "listo" | "corriendo" | "pausado";

/**
 * Todo se calcula con marcas de tiempo, nunca contando ticks. Así el tiempo sigue
 * correcto al recargar, con la pestaña en segundo plano o con el equipo suspendido.
 */
export interface Temporizador {
  modo: TipoSesion;
  fase: Fase;
  estado: EstadoTemporizador;
  /** Cuándo empezó la fase. */
  inicioEn: number | null;
  /** Cuándo empezó el tramo actual, tras iniciar o reanudar. */
  reanudadoEn: number | null;
  /** Tiempo corrido en tramos anteriores. */
  acumuladoMs: number;
  duracionMs: number;
  tareaId: string | null;
  /** Pomodoros completados desde el último descanso largo. */
  ciclos: number;
}

export type SesionNueva = Omit<SesionEnfoque, "nota" | "manual">;

const aMs = (minutos: number) => Math.max(1, minutos) * 60_000;

export function temporizadorListo(config: ConfigEnfoque, modo: TipoSesion = "pomodoro", tareaId: string | null = null, ciclos = 0): Temporizador {
  return { modo, fase: "enfoque", estado: "listo", inicioEn: null, reanudadoEn: null, acumuladoMs: 0, duracionMs: modo === "pomodoro" ? aMs(config.enfoqueMin) : 0, tareaId, ciclos };
}

export function transcurridoMs(t: Temporizador, ahora: number): number {
  const tramo = t.estado === "corriendo" && t.reanudadoEn !== null ? Math.max(0, ahora - t.reanudadoEn) : 0;
  return t.acumuladoMs + tramo;
}

export function restanteMs(t: Temporizador, ahora: number): number {
  return Math.max(0, t.duracionMs - transcurridoMs(t, ahora));
}

export function haTerminado(t: Temporizador, ahora: number): boolean {
  return t.modo === "pomodoro" && t.estado === "corriendo" && restanteMs(t, ahora) === 0;
}

export function iniciar(t: Temporizador, ahora: number): Temporizador {
  return { ...t, estado: "corriendo", inicioEn: ahora, reanudadoEn: ahora, acumuladoMs: 0 };
}

export function pausar(t: Temporizador, ahora: number): Temporizador {
  if (t.estado !== "corriendo") return t;
  return { ...t, estado: "pausado", acumuladoMs: transcurridoMs(t, ahora), reanudadoEn: null };
}

export function reanudar(t: Temporizador, ahora: number): Temporizador {
  if (t.estado !== "pausado") return t;
  return { ...t, estado: "corriendo", reanudadoEn: ahora };
}

function sesionDe(t: Temporizador, finMs: number, segundos: number): SesionNueva {
  const inicioMs = t.inicioEn ?? finMs;
  return {
    // Derivado del inicio: dos pestañas que terminan la misma sesión no la duplican.
    id: `sesion-${inicioMs}`,
    tipo: t.modo,
    inicio: new Date(inicioMs).toISOString(),
    fin: new Date(finMs).toISOString(),
    segundos,
    tareaId: t.tareaId,
  };
}

function trasEnfoque(t: Temporizador, config: ConfigEnfoque, inicioDescanso: number): Temporizador {
  const ciclos = t.ciclos + 1;
  const largo = ciclos >= Math.max(1, config.cadaN);
  return {
    ...t,
    fase: largo ? "descanso-largo" : "descanso",
    estado: "corriendo",
    inicioEn: inicioDescanso,
    reanudadoEn: inicioDescanso,
    acumuladoMs: 0,
    duracionMs: aMs(largo ? config.descansoLargoMin : config.descansoMin),
    ciclos: largo ? 0 : ciclos,
  };
}

export interface Avance {
  temporizador: Temporizador;
  sesiones: SesionNueva[];
  /** Fases terminadas por sí solas, en orden. */
  terminadas: Fase[];
}

/**
 * Lleva el temporizador al momento actual. Cada fase vencida termina a su hora
 * prevista, aunque la app estuviera cerrada o el equipo suspendido.
 */
export function ponerAlDia(t: Temporizador, config: ConfigEnfoque, ahora: number): Avance {
  let actual = t;
  const sesiones: SesionNueva[] = [];
  const terminadas: Fase[] = [];
  while (haTerminado(actual, ahora)) {
    const finPrevisto = (actual.reanudadoEn as number) + (actual.duracionMs - actual.acumuladoMs);
    terminadas.push(actual.fase);
    if (actual.fase === "enfoque") {
      sesiones.push(sesionDe(actual, finPrevisto, Math.round(actual.duracionMs / 1000)));
      actual = trasEnfoque(actual, config, finPrevisto);
    } else {
      actual = temporizadorListo(config, "pomodoro", actual.tareaId, actual.ciclos);
    }
  }
  return { temporizador: actual, sesiones, terminadas };
}

/** Termina antes de tiempo. Un enfoque de al menos un minuto se registra con lo trabajado. */
export function saltar(t: Temporizador, config: ConfigEnfoque, ahora: number): { temporizador: Temporizador; sesion: SesionNueva | null } {
  if (t.estado === "listo") return { temporizador: t, sesion: null };
  if (t.fase !== "enfoque") return { temporizador: temporizadorListo(config, "pomodoro", t.tareaId, t.ciclos), sesion: null };
  const segundos = Math.round(transcurridoMs(t, ahora) / 1000);
  return {
    temporizador: trasEnfoque(t, config, ahora),
    sesion: segundos >= SEGUNDOS_MINIMOS ? sesionDe(t, ahora, segundos) : null,
  };
}

/** Detiene el cronómetro. */
export function detener(t: Temporizador, config: ConfigEnfoque, ahora: number): { temporizador: Temporizador; sesion: SesionNueva | null } {
  const segundos = Math.round(transcurridoMs(t, ahora) / 1000);
  return {
    temporizador: temporizadorListo(config, t.modo, t.tareaId, t.ciclos),
    sesion: t.estado !== "listo" && segundos >= SEGUNDOS_MINIMOS ? sesionDe(t, ahora, segundos) : null,
  };
}

/** Valida lo guardado: datos dañados no deben romper la app. */
export function leerTemporizador(crudo: unknown): Temporizador | null {
  if (!crudo || typeof crudo !== "object") return null;
  const t = crudo as Temporizador;
  const valido = ["pomodoro", "cronometro"].includes(t.modo) && ["enfoque", "descanso", "descanso-largo"].includes(t.fase) && ["listo", "corriendo", "pausado"].includes(t.estado) && typeof t.acumuladoMs === "number" && typeof t.duracionMs === "number" && typeof t.ciclos === "number" && (t.estado !== "corriendo" || typeof t.reanudadoEn === "number");
  return valido ? t : null;
}

export function formatoTiempo(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

export function formatoMinutos(minutos: number): string {
  const redondo = Math.round(minutos);
  if (redondo < 60) return `${redondo} min`;
  const h = Math.floor(redondo / 60);
  const m = redondo % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export interface Fila {
  id: string;
  nombre: string;
  minutos: number;
}

export interface EstadisticasEnfoque {
  hoyMin: number;
  hoyPomodoros: number;
  semanaMin: number;
  semanaPomodoros: number;
  totalMin: number;
  racha: number;
  ultimos7: { dia: string; minutos: number }[];
  porTarea: Fila[];
  porLista: Fila[];
}

export function estadisticasEnfoque(sesiones: SesionEnfoque[], tareas: Tarea[], listas: Lista[], ahora: Date): EstadisticasEnfoque {
  const hoy = startOfDay(ahora);
  const lunes = startOfWeek(ahora, { weekStartsOn: 1 });
  const minutosDe = (s: SesionEnfoque) => s.segundos / 60;
  const delDia = (s: SesionEnfoque) => parseISO(s.inicio);
  const esPomodoro = (s: SesionEnfoque) => s.tipo === "pomodoro";

  const deHoy = sesiones.filter((s) => differenceInCalendarDays(delDia(s), hoy) === 0);
  const deSemana = sesiones.filter((s) => delDia(s) >= lunes);
  const suma = (lista: SesionEnfoque[]) => lista.reduce((t, s) => t + minutosDe(s), 0);

  // Días seguidos con enfoque. Hoy sin sesiones aún no rompe la racha.
  const conSesion = new Set(sesiones.map((s) => format(delDia(s), "yyyy-MM-dd")));
  let cursor = conSesion.has(format(hoy, "yyyy-MM-dd")) ? hoy : addDays(hoy, -1);
  let racha = 0;
  while (conSesion.has(format(cursor, "yyyy-MM-dd"))) {
    racha += 1;
    cursor = addDays(cursor, -1);
  }

  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const dia = addDays(hoy, i - 6);
    const clave = format(dia, "yyyy-MM-dd");
    return { dia: clave, minutos: suma(sesiones.filter((s) => format(delDia(s), "yyyy-MM-dd") === clave)) };
  });

  const acumular = (clave: (s: SesionEnfoque) => { id: string; nombre: string } | null): Fila[] => {
    const m = new Map<string, Fila>();
    for (const s of sesiones) {
      const c = clave(s);
      if (!c) continue;
      const f = m.get(c.id) ?? { ...c, minutos: 0 };
      f.minutos += minutosDe(s);
      m.set(c.id, f);
    }
    return [...m.values()].sort((a, b) => b.minutos - a.minutos);
  };
  const tareaDe = (s: SesionEnfoque) => tareas.find((t) => t.id === s.tareaId);

  return {
    hoyMin: suma(deHoy),
    hoyPomodoros: deHoy.filter(esPomodoro).length,
    semanaMin: suma(deSemana),
    semanaPomodoros: deSemana.filter(esPomodoro).length,
    totalMin: suma(sesiones),
    racha,
    ultimos7,
    porTarea: acumular((s) => {
      const t = tareaDe(s);
      return t ? { id: t.id, nombre: t.titulo || "Sin título" } : null;
    }),
    porLista: acumular((s) => {
      const t = tareaDe(s);
      if (!t) return null;
      if (t.listaId === LISTA_BANDEJA) return { id: LISTA_BANDEJA, nombre: "Bandeja de entrada" };
      return { id: t.listaId, nombre: listas.find((l) => l.id === t.listaId)?.nombre ?? "Lista borrada" };
    }),
  };
}

export function minutosDeTarea(sesiones: SesionEnfoque[], tareaId: string): number {
  return sesiones.filter((s) => s.tareaId === tareaId).reduce((t, s) => t + s.segundos / 60, 0);
}
