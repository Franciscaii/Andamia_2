import { addDays, differenceInCalendarDays, format, isSameYear, parseISO, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import type { Tarea } from "../modelos/tipos";

/** Fecha local de la tarea. Las de todo el día se leen como medianoche local, sin desfase. */
export function fechaDeTarea(tarea: Pick<Tarea, "vence">): Date | null {
  return tarea.vence ? parseISO(tarea.vence) : null;
}

export function diasHasta(tarea: Pick<Tarea, "vence">, ahora: Date): number | null {
  const fecha = fechaDeTarea(tarea);
  return fecha ? differenceInCalendarDays(fecha, ahora) : null;
}

export function etiquetaFecha(tarea: Pick<Tarea, "vence" | "todoElDia">, ahora: Date = new Date()): string {
  const fecha = fechaDeTarea(tarea);
  if (!fecha) return "";
  const dias = differenceInCalendarDays(fecha, ahora);
  let dia: string;
  if (dias === 0) dia = "Hoy";
  else if (dias === 1) dia = "Mañana";
  else if (dias === -1) dia = "Ayer";
  else if (dias > 1 && dias < 7) dia = format(fecha, "EEEE", { locale: es });
  else dia = format(fecha, isSameYear(fecha, ahora) ? "d MMM" : "d MMM yyyy", { locale: es });
  dia = dia.charAt(0).toUpperCase() + dia.slice(1);
  return tarea.todoElDia ? dia : `${dia} ${format(fecha, "HH:mm")}`;
}

export function aFechaInput(tarea: Pick<Tarea, "vence">): string {
  const fecha = fechaDeTarea(tarea);
  return fecha ? format(fecha, "yyyy-MM-dd") : "";
}

export function aHoraInput(tarea: Pick<Tarea, "vence" | "todoElDia">): string {
  const fecha = fechaDeTarea(tarea);
  return fecha && !tarea.todoElDia ? format(fecha, "HH:mm") : "";
}

/** Combina los valores de los campos de fecha y hora en el formato guardado. */
export function componerVence(fecha: string, hora: string): { vence: string | null; todoElDia: boolean } {
  if (!fecha) return { vence: null, todoElDia: false };
  if (!hora) return { vence: fecha, todoElDia: true };
  return { vence: parseISO(`${fecha}T${hora}:00`).toISOString(), todoElDia: false };
}

export function diaRelativo(dias: number, ahora: Date = new Date()): string {
  return format(addDays(startOfDay(ahora), dias), "yyyy-MM-dd");
}
