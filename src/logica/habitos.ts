import { addDays, addWeeks, eachDayOfInterval, format, getDay, parseISO, set, startOfWeek } from "date-fns";
import type { EstadoHabito, FrecuenciaHabito, Habito, RegistroHabito } from "../modelos/tipos";
import { NOMBRES_DIA } from "./repeticion";

const SEMANA = { weekStartsOn: 1 as const };
const clave = (d: Date) => format(d, "yyyy-MM-dd");
const diaSemana = (d: Date) => (getDay(d) + 6) % 7;

export type IndiceRegistros = Map<string, RegistroHabito>;

export function indexarRegistros(registros: RegistroHabito[], habitoId: string): IndiceRegistros {
  return new Map(registros.filter((r) => r.habitoId === habitoId).map((r) => [r.fecha, r]));
}

/** Si el día cuenta para el hábito. "N veces por semana" admite cualquier día. */
export function esProgramado(f: FrecuenciaHabito, dia: Date): boolean {
  return f.tipo !== "dias" || f.dias.includes(diaSemana(dia));
}

export function describirFrecuencia(f: FrecuenciaHabito): string {
  if (f.tipo === "diaria") return "Cada día";
  if (f.tipo === "semanal") return f.veces === 1 ? "1 vez por semana" : `${f.veces} veces por semana`;
  const orden = [...f.dias].sort((a, b) => a - b);
  if (orden.length === 7) return "Cada día";
  if (orden.join() === "0,1,2,3,4") return "Días laborables";
  return orden.map((d) => NOMBRES_DIA[d].slice(0, 3)).join(", ");
}

/** Se puede registrar desde el inicio hasta hoy; el futuro no. */
export function esEditable(h: Pick<Habito, "inicio" | "frecuencia">, dia: Date, hoy: Date): boolean {
  const c = clave(dia);
  return c >= h.inicio && c <= clave(hoy) && esProgramado(h.frecuencia, dia);
}

export function estadoPorValor(valor: number, meta: number): EstadoHabito {
  if (valor >= meta) return "hecho";
  return valor > 0 ? "parcial" : "no-hecho";
}

/** Clic sobre un día de un hábito sin cantidad: sin marcar → hecho → parcial → no hecho → sin marcar. */
export function siguienteEstado(actual: EstadoHabito | null): EstadoHabito | null {
  if (actual === null) return "hecho";
  if (actual === "hecho") return "parcial";
  if (actual === "parcial") return "no-hecho";
  return null;
}

export interface Rachas {
  actual: number;
  maxima: number;
  unidad: "días" | "semanas";
}

function rachasDiarias(h: Habito, registros: IndiceRegistros, hoy: Date): Rachas {
  let actual = 0;
  let maxima = 0;
  const fin = clave(hoy);
  if (h.inicio > fin) return { actual: 0, maxima: 0, unidad: "días" };
  for (const dia of eachDayOfInterval({ start: parseISO(h.inicio), end: hoy })) {
    if (!esProgramado(h.frecuencia, dia)) continue;
    const estado = registros.get(clave(dia))?.estado;
    if (estado === "hecho") {
      actual += 1;
      maxima = Math.max(maxima, actual);
    } else if (estado === "parcial") {
      // Parcial: no suma, pero tampoco rompe la racha.
    } else if (!(estado === undefined && clave(dia) === fin)) {
      // Hoy sin marcar todavía no rompe la racha.
      actual = 0;
    }
  }
  return { actual, maxima, unidad: "días" };
}

function rachasSemanales(h: Habito, veces: number, registros: IndiceRegistros, hoy: Date): Rachas {
  let actual = 0;
  let maxima = 0;
  if (h.inicio > clave(hoy)) return { actual: 0, maxima: 0, unidad: "semanas" };
  const inicio = parseISO(h.inicio);
  const estaSemana = clave(startOfWeek(hoy, SEMANA));
  for (let lunes = startOfWeek(inicio, SEMANA); clave(lunes) <= estaSemana; lunes = addWeeks(lunes, 1)) {
    let hechos = 0;
    let disponibles = 0;
    for (let i = 0; i < 7; i++) {
      const dia = addDays(lunes, i);
      if (clave(dia) >= h.inicio) disponibles += 1;
      if (registros.get(clave(dia))?.estado === "hecho") hechos += 1;
    }
    if (hechos >= veces) {
      actual += 1;
      maxima = Math.max(maxima, actual);
    } else if (clave(lunes) !== estaSemana && disponibles >= veces) {
      // La semana en curso y una primera semana demasiado corta no la rompen.
      actual = 0;
    }
  }
  return { actual, maxima, unidad: "semanas" };
}

export function calcularRachas(h: Habito, registros: IndiceRegistros, hoy: Date): Rachas {
  return h.frecuencia.tipo === "semanal" ? rachasSemanales(h, h.frecuencia.veces, registros, hoy) : rachasDiarias(h, registros, hoy);
}

/** Porcentaje de cumplimiento (0 a 100), o null si aún no se esperaba nada. Un parcial cuenta como medio. */
export function tasaCumplimiento(h: Habito, registros: IndiceRegistros, hoy: Date): number | null {
  if (h.inicio > clave(hoy)) return null;
  const peso = (e?: EstadoHabito) => (e === "hecho" ? 1 : e === "parcial" ? 0.5 : 0);
  const fin = clave(hoy);
  let logrado = 0;
  let esperado = 0;

  if (h.frecuencia.tipo === "semanal") {
    const veces = h.frecuencia.veces;
    const estaSemana = clave(startOfWeek(hoy, SEMANA));
    for (let lunes = startOfWeek(parseISO(h.inicio), SEMANA); clave(lunes) <= estaSemana; lunes = addWeeks(lunes, 1)) {
      let hechos = 0;
      let disponibles = 0;
      for (let i = 0; i < 7; i++) {
        const dia = clave(addDays(lunes, i));
        if (dia >= h.inicio) disponibles += 1;
        hechos += peso(registros.get(dia)?.estado);
      }
      // La semana en curso solo exige lo que ya se hizo: aún queda tiempo.
      const exigible = clave(lunes) === estaSemana ? Math.min(veces, hechos) : Math.min(veces, disponibles);
      esperado += exigible;
      logrado += Math.min(hechos, exigible);
    }
  } else {
    for (const dia of eachDayOfInterval({ start: parseISO(h.inicio), end: hoy })) {
      if (!esProgramado(h.frecuencia, dia)) continue;
      const r = registros.get(clave(dia));
      // Hoy sin marcar aún no cuenta en contra.
      if (clave(dia) === fin && !r) continue;
      esperado += 1;
      logrado += peso(r?.estado);
    }
  }
  return esperado === 0 ? null : Math.round((logrado / esperado) * 100);
}

/** Si el hábito todavía pide algo hoy. */
export function pendienteHoy(h: Habito, registros: IndiceRegistros, hoy: Date): boolean {
  if (h.archivado || clave(hoy) < h.inicio) return false;
  const estado = registros.get(clave(hoy))?.estado;
  if (estado === "hecho" || estado === "no-hecho") return false;
  if (h.frecuencia.tipo === "semanal") {
    const lunes = startOfWeek(hoy, SEMANA);
    let hechos = 0;
    for (let i = 0; i < 7; i++) if (registros.get(clave(addDays(lunes, i)))?.estado === "hecho") hechos += 1;
    return hechos < h.frecuencia.veces;
  }
  return esProgramado(h.frecuencia, hoy);
}

export interface AvisoHabito {
  habito: Habito;
  clave: string;
}

/** Recordatorios de hoy cuya hora ya llegó y que aún no se han mostrado. */
export function avisosDeHabitos(habitos: Habito[], registros: RegistroHabito[], ahora: Date): AvisoHabito[] {
  const avisos: AvisoHabito[] = [];
  for (const h of habitos) {
    if (!h.recordatorioHora) continue;
    const [horas, minutos] = h.recordatorioHora.split(":").map(Number);
    if (set(ahora, { hours: horas, minutes: minutos, seconds: 0, milliseconds: 0 }) > ahora) continue;
    const c = `habito|${clave(ahora)}|${h.recordatorioHora}`;
    if (h.avisosEnviados.includes(c)) continue;
    if (pendienteHoy(h, indexarRegistros(registros, h.id), ahora)) avisos.push({ habito: h, clave: c });
  }
  return avisos;
}

/** Un hábito en un día de la Semana: si ya está hecho y si se puede marcar (hoy o antes). */
export interface HabitoDelDia {
  habito: Habito;
  estado: EstadoHabito | null;
  marcable: boolean;
}

/**
 * Los hábitos activos que tocan un día (ya empezados y programados ese día), en su orden.
 * Los de días futuros se muestran, pero todavía no se pueden marcar.
 */
export function habitosDelDia(habitos: Habito[], registros: RegistroHabito[], dia: Date, hoy: Date): HabitoDelDia[] {
  const fecha = clave(dia);
  const estados = new Map(registros.filter((r) => r.fecha === fecha).map((r) => [r.habitoId, r.estado]));
  return habitos
    .filter((h) => !h.archivado && h.inicio <= fecha && esProgramado(h.frecuencia, dia))
    .sort((a, b) => a.orden - b.orden)
    .map((h) => ({ habito: h, estado: estados.get(h.id) ?? null, marcable: fecha <= clave(hoy) }));
}
