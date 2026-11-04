import { addMinutes, parseISO, set } from "date-fns";
import type { Recordatorio, Tarea } from "../modelos/tipos";

export const OPCIONES_RECORDATORIO: { minutos: number; nombre: string }[] = [
  { minutos: 0, nombre: "A la hora" },
  { minutos: 5, nombre: "5 minutos antes" },
  { minutos: 30, nombre: "30 minutos antes" },
  { minutos: 1440, nombre: "1 día antes" },
];

/** Sin hora, el aviso se calcula desde las 09:00 de ese día. */
export const HORA_AVISO_TODO_EL_DIA = 9;

/** Avisos más antiguos que esto no se muestran al volver a abrir la app. */
export const VENTANA_AVISOS_MINUTOS = 24 * 60;

export function describirRecordatorio(minutos: number, todoElDia: boolean): string {
  if (minutos === 0) return todoElDia ? "El mismo día, 09:00" : "A la hora";
  const sufijo = todoElDia ? " (09:00)" : "";
  if (minutos % 1440 === 0) {
    const d = minutos / 1440;
    return `${d} ${d === 1 ? "día" : "días"} antes${sufijo}`;
  }
  if (minutos % 60 === 0) {
    const h = minutos / 60;
    return `${h} ${h === 1 ? "hora" : "horas"} antes${sufijo}`;
  }
  return `${minutos} ${minutos === 1 ? "minuto" : "minutos"} antes${sufijo}`;
}

export function momentoDeAviso(tarea: Pick<Tarea, "vence" | "todoElDia">, recordatorio: Pick<Recordatorio, "minutosAntes">): Date | null {
  if (!tarea.vence) return null;
  const base = parseISO(tarea.vence);
  const referencia = tarea.todoElDia ? set(base, { hours: HORA_AVISO_TODO_EL_DIA, minutes: 0, seconds: 0, milliseconds: 0 }) : base;
  return addMinutes(referencia, -recordatorio.minutosAntes);
}

/** Identifica un aviso de una ocurrencia: si cambia la fecha, puede volver a avisar. */
export function claveAviso(tarea: Pick<Tarea, "vence">, recordatorio: Pick<Recordatorio, "id">): string {
  return `${recordatorio.id}|${tarea.vence}`;
}

export interface AvisoPendiente {
  tarea: Tarea;
  recordatorio: Recordatorio;
  clave: string;
  momento: Date;
}

export function avisosPendientes(tareas: Tarea[], ahora: Date): AvisoPendiente[] {
  const limite = addMinutes(ahora, -VENTANA_AVISOS_MINUTOS);
  const avisos: AvisoPendiente[] = [];
  for (const tarea of tareas) {
    if (tarea.eliminadaEn !== null || tarea.estado !== "pendiente" || !tarea.vence) continue;
    for (const recordatorio of tarea.recordatorios) {
      const momento = momentoDeAviso(tarea, recordatorio);
      const clave = claveAviso(tarea, recordatorio);
      if (momento && momento <= ahora && momento >= limite && !tarea.avisosEnviados.includes(clave)) {
        avisos.push({ tarea, recordatorio, clave, momento });
      }
    }
  }
  return avisos.sort((a, b) => a.momento.getTime() - b.momento.getTime());
}
