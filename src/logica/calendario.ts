import { addDays, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek, format, isSameDay, parseISO, set, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import type { Tarea } from "../modelos/tipos";
import { ocurrenciasEnRango } from "./repeticion";

const SEMANA = { weekStartsOn: 1 as const };

export function diasDeMes(fecha: Date): Date[] {
  return eachDayOfInterval({ start: startOfWeek(startOfMonth(fecha), SEMANA), end: endOfWeek(endOfMonth(fecha), SEMANA) });
}

export function diasDeSemana(fecha: Date): Date[] {
  const inicio = startOfWeek(fecha, SEMANA);
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

export const claveDia = (dia: Date) => format(dia, "yyyy-MM-dd");

export interface EntradaCalendario {
  tarea: Tarea;
  fecha: Date;
  /** Fecha futura calculada de una tarea repetida: se muestra, pero no se mueve. */
  esOcurrencia: boolean;
  clave: string;
}

export function entradasEnRango(tareas: Tarea[], desde: Date, hasta: Date): EntradaCalendario[] {
  const inicio = startOfDay(desde);
  const fin = endOfDay(hasta);
  const entradas: EntradaCalendario[] = [];
  for (const tarea of tareas) {
    if (tarea.eliminadaEn !== null || !tarea.vence) continue;
    const fecha = parseISO(tarea.vence);
    if (fecha >= inicio && fecha <= fin) entradas.push({ tarea, fecha, esOcurrencia: false, clave: tarea.id });
    if (tarea.repeticion && tarea.estado === "pendiente") {
      for (const o of ocurrenciasEnRango(tarea.repeticion, fecha, inicio, fin)) {
        entradas.push({ tarea, fecha: o, esOcurrencia: true, clave: `${tarea.id}@${o.toISOString()}` });
      }
    }
  }
  return entradas.sort((a, b) => Number(a.tarea.todoElDia) === Number(b.tarea.todoElDia) ? a.fecha.getTime() - b.fecha.getTime() || a.tarea.orden - b.tarea.orden : Number(b.tarea.todoElDia) - Number(a.tarea.todoElDia));
}

export const entradasDelDia = (entradas: EntradaCalendario[], dia: Date) => entradas.filter((e) => isSameDay(e.fecha, dia));

/** Cambia el día conservando la hora, si la tarea tiene. */
export function venceEnDia(tarea: Pick<Tarea, "vence" | "todoElDia">, dia: Date): { vence: string; todoElDia: boolean } {
  if (!tarea.vence || tarea.todoElDia) return { vence: format(dia, "yyyy-MM-dd"), todoElDia: true };
  const actual = parseISO(tarea.vence);
  return { vence: set(dia, { hours: actual.getHours(), minutes: actual.getMinutes(), seconds: 0, milliseconds: 0 }).toISOString(), todoElDia: false };
}

/** Coloca la tarea en una hora exacta de un día. */
export function venceEnHora(dia: Date, hora: number): { vence: string; todoElDia: boolean } {
  return { vence: set(dia, { hours: hora, minutes: 0, seconds: 0, milliseconds: 0 }).toISOString(), todoElDia: false };
}
