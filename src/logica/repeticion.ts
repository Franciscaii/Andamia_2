import { RRule, type Options } from "rrule";
import { addDays, format, parseISO, set, startOfDay } from "date-fns";
import type { RepetirDesde, Tarea } from "../modelos/tipos";

export type Frecuencia = "diaria" | "semanal" | "mensual" | "anual";

export interface OpcionesRepeticion {
  frecuencia: Frecuencia;
  intervalo: number;
  /** 0 = lunes … 6 = domingo. Solo tiene efecto en la frecuencia semanal. */
  diasSemana: number[];
}

const A_RRULE: Record<Frecuencia, number> = {
  diaria: RRule.DAILY,
  semanal: RRule.WEEKLY,
  mensual: RRule.MONTHLY,
  anual: RRule.YEARLY,
};

const DE_RRULE: Record<number, Frecuencia> = {
  [RRule.DAILY]: "diaria",
  [RRule.WEEKLY]: "semanal",
  [RRule.MONTHLY]: "mensual",
  [RRule.YEARLY]: "anual",
};

const CODIGOS_DIA = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
export const NOMBRES_DIA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const INICIALES_DIA = ["L", "M", "X", "J", "V", "S", "D"];

export function construirRegla({ frecuencia, intervalo, diasSemana }: OpcionesRepeticion): string {
  const partes = [`FREQ=${RRule.FREQUENCIES[A_RRULE[frecuencia]]}`, `INTERVAL=${Math.max(1, Math.floor(intervalo) || 1)}`];
  if (frecuencia === "semanal" && diasSemana.length) {
    partes.push(`BYDAY=${[...new Set(diasSemana)].sort((a, b) => a - b).map((d) => CODIGOS_DIA[d]).join(",")}`);
  }
  return partes.join(";");
}

function dias(opciones: Partial<Options>): number[] {
  const crudo = opciones.byweekday;
  if (crudo === null || crudo === undefined) return [];
  const lista = Array.isArray(crudo) ? crudo : [crudo];
  return lista.map((d) => (typeof d === "number" ? d : typeof d === "string" ? CODIGOS_DIA.indexOf(d) : d.weekday));
}

export function leerRegla(regla: string): OpcionesRepeticion {
  const o = RRule.parseString(regla);
  return {
    frecuencia: DE_RRULE[o.freq ?? RRule.DAILY] ?? "diaria",
    intervalo: o.interval ?? 1,
    diasSemana: dias(o),
  };
}

function unir(nombres: string[]): string {
  if (nombres.length < 2) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export function describirRegla(regla: string): string {
  const { frecuencia, intervalo, diasSemana } = leerRegla(regla);
  const n = intervalo;
  if (frecuencia === "semanal" && diasSemana.length) {
    const orden = [...diasSemana].sort((a, b) => a - b);
    if (orden.join() === "0,1,2,3,4" && n === 1) return "Días laborables";
    const nombres = unir(orden.map((d) => NOMBRES_DIA[d]));
    return n === 1 ? `Cada ${nombres}` : `Cada ${n} semanas: ${nombres}`;
  }
  const textos: Record<Frecuencia, [string, string]> = {
    diaria: ["Cada día", `Cada ${n} días`],
    semanal: ["Cada semana", `Cada ${n} semanas`],
    mensual: ["Cada mes", `Cada ${n} meses`],
    anual: ["Cada año", `Cada ${n} años`],
  };
  return textos[frecuencia][n === 1 ? 0 : 1];
}

// rrule calcula en UTC. Para que el cambio de horario no mueva la hora local,
// se traduce la hora de reloj local a una fecha UTC con los mismos números.
function aFlotante(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()));
}

function deFlotante(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

function crear(regla: string, inicio: Date): RRule {
  return new RRule({ ...RRule.parseString(regla), dtstart: aFlotante(inicio) });
}

/** La primera fecha de la regla desde `desde`, incluida. */
export function primeraOcurrencia(regla: string, desde: Date): Date {
  const r = crear(regla, desde).after(aFlotante(desde), true);
  return r ? deFlotante(r) : desde;
}

/**
 * La fecha siguiente al completar.
 * - Desde el vencimiento: conserva el ritmo original y salta lo ya vencido,
 *   para que una tarea atrasada no quede otra vez en el pasado.
 * - Desde la finalización: cuenta desde hoy, conservando la hora.
 */
export function siguienteOcurrencia(regla: string, base: Date, repetirDesde: RepetirDesde, ahora: Date): Date | null {
  const hoy = startOfDay(ahora);
  if (repetirDesde === "completado") {
    const inicio = set(hoy, { hours: base.getHours(), minutes: base.getMinutes(), seconds: 0, milliseconds: 0 });
    const r = crear(regla, inicio).after(aFlotante(inicio), false);
    return r ? deFlotante(r) : null;
  }
  const finDeAyer = new Date(hoy.getTime() - 1000);
  const limite = base > finDeAyer ? base : finDeAyer;
  const r = crear(regla, base).after(aFlotante(limite), false);
  return r ? deFlotante(r) : null;
}

export function venceDesde(fecha: Date, todoElDia: boolean): string {
  return todoElDia ? format(fecha, "yyyy-MM-dd") : fecha.toISOString();
}

/** Vencimiento coherente al asignar una regla: sin fecha toma hoy; si no calza, la siguiente válida. */
export function venceParaRegla(regla: string, tarea: Pick<Tarea, "vence" | "todoElDia">, ahora: Date): { vence: string; todoElDia: boolean } {
  if (!tarea.vence) {
    return { vence: venceDesde(primeraOcurrencia(regla, startOfDay(ahora)), true), todoElDia: true };
  }
  return { vence: venceDesde(primeraOcurrencia(regla, parseISO(tarea.vence)), tarea.todoElDia), todoElDia: tarea.todoElDia };
}

/** Fechas futuras de una tarea repetida dentro de un rango, sin incluir su vencimiento actual. */
export function ocurrenciasEnRango(regla: string, base: Date, desde: Date, hasta: Date): Date[] {
  const inicio = desde > base ? addDays(desde, -1) : base;
  return crear(regla, base)
    .between(aFlotante(inicio), aFlotante(hasta), true)
    .map(deFlotante)
    .filter((d) => d > base && d >= desde && d <= hasta);
}
