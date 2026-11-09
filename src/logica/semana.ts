import { addDays, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import type { Lista, Prioridad, Tarea } from "../modelos/tipos";
import { fechaDeTarea } from "./fechas";
import { estaActiva } from "./vistas";

export type FiltroSemana = "tareas" | "eventos" | "todos";

export const esEvento = (t: Tarea) => t.esEvento === true;
export const dificultadDe = (t: Tarea): Prioridad => t.dificultad ?? "ninguna";

/** Los siete días, de lunes a domingo, de la semana que contiene `dia`. */
export function diasDeSemana(dia: Date): Date[] {
  const lunes = startOfWeek(dia, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(lunes, i));
}

/** "Lun", "Mar"… */
export function nombreCortoDia(dia: Date): string {
  const texto = format(dia, "EEE", { locale: es }).replace(".", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Hoy, lun 9 de noviembre" o "mié 11 de noviembre". */
export function tituloDelDia(dia: Date, ahora: Date = new Date()): string {
  const texto = format(dia, "EEE d 'de' MMMM", { locale: es }).replace(".", "");
  return isSameDay(dia, ahora) ? `Hoy, ${texto}` : texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface Progreso {
  hechas: number;
  total: number;
  /** 0 a 100, redondeado. */
  porcentaje: number;
}

export function progresoDe(tareas: Tarea[]): Progreso {
  const total = tareas.length;
  const hechas = tareas.filter((t) => t.estado === "completada").length;
  return { hechas, total, porcentaje: total ? Math.round((hechas / total) * 100) : 0 };
}

export interface DiaSemana {
  eventos: Tarea[];
  /** Pendientes y completadas del día. Hoy incluye además lo atrasado sin terminar. */
  tareas: Tarea[];
  progreso: Progreso;
}

/** Con hora primero y por hora; después el orden manual. */
function porHoraYOrden(a: Tarea, b: Tarea): number {
  const ha = !a.todoElDia && a.vence ? fechaDeTarea(a)!.getTime() : Infinity;
  const hb = !b.todoElDia && b.vence ? fechaDeTarea(b)!.getTime() : Infinity;
  if (ha !== hb) return ha - hb;
  return a.orden - b.orden;
}

export function contenidoDelDia(tareas: Tarea[], listas: Lista[], dia: Date, ahora: Date = new Date()): DiaSemana {
  const excluidas = new Set(listas.filter((l) => !l.incluirEnTodas).map((l) => l.id));
  const inicioDia = startOfDay(dia);
  const esHoy = isSameDay(dia, ahora);
  const delDia: Tarea[] = [];
  for (const t of tareas) {
    if (!estaActiva(t) || excluidas.has(t.listaId)) continue;
    const fecha = fechaDeTarea(t);
    if (!fecha) continue;
    if (isSameDay(fecha, dia)) delDia.push(t);
    // Lo atrasado sigue apareciendo hoy hasta resolverse.
    else if (esHoy && !esEvento(t) && t.estado === "pendiente" && fecha < inicioDia) delDia.push(t);
  }
  const eventos = delDia.filter(esEvento).sort(porHoraYOrden);
  const deTareas = delDia.filter((t) => !esEvento(t)).sort(porHoraYOrden);
  return { eventos, tareas: deTareas, progreso: progresoDe(deTareas) };
}

/** Cuántas cosas pendientes tiene cada día, para marcarlo en la tira de la semana. */
export function hayAlgoElDia(tareas: Tarea[], listas: Lista[], dia: Date, ahora: Date = new Date()): boolean {
  const { eventos, tareas: deTareas } = contenidoDelDia(tareas, listas, dia, ahora);
  return eventos.length > 0 || deTareas.some((t) => t.estado === "pendiente");
}
