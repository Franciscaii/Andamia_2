export type Prioridad = "ninguna" | "baja" | "media" | "alta";
export type EstadoTarea = "pendiente" | "completada";

export const LISTA_BANDEJA = "bandeja";

export const PRIORIDADES: { valor: Prioridad; nombre: string }[] = [
  { valor: "alta", nombre: "Alta" },
  { valor: "media", nombre: "Media" },
  { valor: "baja", nombre: "Baja" },
  { valor: "ninguna", nombre: "Ninguna" },
];

export interface Subtarea {
  id: string;
  titulo: string;
  estado: EstadoTarea;
  orden: number;
}

export type RepetirDesde = "vencimiento" | "completado";
export type ModoLista = "lista" | "kanban";

export interface Recordatorio {
  id: string;
  minutosAntes: number;
}

export interface Columna {
  id: string;
  listaId: string;
  nombre: string;
  orden: number;
}

export interface Tarea {
  id: string;
  listaId: string;
  titulo: string;
  descripcion: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  /** "AAAA-MM-DD" si es de todo el día; fecha-hora ISO si lleva hora; null sin fecha. */
  vence: string | null;
  todoElDia: boolean;
  zonaHoraria: string;
  /** Claves de etiqueta, en minúsculas. */
  etiquetas: string[];
  subtareas: Subtarea[];
  /** Regla RRULE sin fecha de inicio, por ejemplo "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO". */
  repeticion: string | null;
  repetirDesde: RepetirDesde;
  /** En la copia completada de una tarea repetida: id de la tarea original. */
  repetidaDe: string | null;
  recordatorios: Recordatorio[];
  /** Avisos ya mostrados, para no repetirlos. */
  avisosEnviados: string[];
  columnaId: string | null;
  orden: number;
  completadaEn: string | null;
  /** Fecha de envío a la papelera; null si no está borrada. */
  eliminadaEn: string | null;
  creadaEn: string;
  modificadaEn: string;
}

export interface Lista {
  id: string;
  nombre: string;
  color: string | null;
  carpetaId: string | null;
  incluirEnTodas: boolean;
  modo: ModoLista;
  orden: number;
}

export interface Carpeta {
  id: string;
  nombre: string;
  orden: number;
}

export interface Etiqueta {
  /** Clave en minúsculas. */
  nombre: string;
  nombreVisible: string;
  color: string;
  orden: number;
}

export type TipoSesion = "pomodoro" | "cronometro";

export interface SesionEnfoque {
  id: string;
  tipo: TipoSesion;
  inicio: string;
  fin: string;
  /** Tiempo real de enfoque, sin contar las pausas. */
  segundos: number;
  tareaId: string | null;
  nota: string;
  manual: boolean;
}

export type FrecuenciaHabito =
  | { tipo: "diaria" }
  /** 0 = lunes … 6 = domingo. */
  | { tipo: "dias"; dias: number[] }
  | { tipo: "semanal"; veces: number };

export interface Habito {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  frecuencia: FrecuenciaHabito;
  /** Cantidad por día; 1 significa simplemente hecho o no hecho. */
  metaDiaria: number;
  unidad: string;
  /** "AAAA-MM-DD". */
  inicio: string;
  /** "HH:mm" o null si no tiene recordatorio. */
  recordatorioHora: string | null;
  avisosEnviados: string[];
  archivado: boolean;
  orden: number;
}

export type EstadoHabito = "hecho" | "parcial" | "no-hecho";

export interface RegistroHabito {
  /** `${habitoId}|${fecha}`: un registro por hábito y día. */
  id: string;
  habitoId: string;
  fecha: string;
  estado: EstadoHabito;
  valor: number;
}

export const COLORES_LISTA = ["#c2553d", "#d48a2c", "#b7a42e", "#4f8a4c", "#2f8f83", "#3f74b5", "#7a5fb0", "#b65583"];
