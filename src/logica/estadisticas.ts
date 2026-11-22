import { addDays, addMonths, addWeeks, addYears, endOfDay, endOfMonth, endOfWeek, endOfYear, format, isSameYear, parseISO, startOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { es } from "./idioma";
import type { Etiqueta, Habito, RegistroHabito, Tarea } from "../modelos/tipos";

export type Periodo = "dia" | "semana" | "mes" | "anio";

export const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: "dia", nombre: "Día" },
  { id: "semana", nombre: "Semana" },
  { id: "mes", nombre: "Mes" },
  { id: "anio", nombre: "Año" },
];

export interface Rango {
  inicio: Date;
  fin: Date;
}

export function rangoDe(periodo: Periodo, referencia: Date): Rango {
  switch (periodo) {
    case "dia":
      return { inicio: startOfDay(referencia), fin: endOfDay(referencia) };
    case "semana":
      return { inicio: startOfWeek(referencia, { weekStartsOn: 1 }), fin: endOfWeek(referencia, { weekStartsOn: 1 }) };
    case "mes":
      return { inicio: startOfMonth(referencia), fin: endOfMonth(referencia) };
    case "anio":
      return { inicio: startOfYear(referencia), fin: endOfYear(referencia) };
  }
}

export function moverPeriodo(periodo: Periodo, referencia: Date, pasos: number): Date {
  switch (periodo) {
    case "dia":
      return addDays(referencia, pasos);
    case "semana":
      return addWeeks(referencia, pasos);
    case "mes":
      return addMonths(referencia, pasos);
    case "anio":
      return addYears(referencia, pasos);
  }
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function tituloPeriodo(periodo: Periodo, referencia: Date, ahora: Date = new Date()): string {
  const { inicio, fin } = rangoDe(periodo, referencia);
  switch (periodo) {
    case "dia":
      return capital(format(inicio, isSameYear(inicio, ahora) ? "EEEE d 'de' MMMM" : "d MMM yyyy", { locale: es }));
    case "semana":
      return `${format(inicio, "d MMM", { locale: es })} – ${format(fin, isSameYear(fin, ahora) ? "d MMM" : "d MMM yyyy", { locale: es })}`;
    case "mes":
      return capital(format(inicio, "MMMM yyyy", { locale: es }));
    case "anio":
      return format(inicio, "yyyy");
  }
}

/** Tramos del eje del tiempo: horas del día, días de la semana o del mes, o meses del año. */
export function tramosDe(periodo: Periodo, rango: Rango): { inicio: Date; etiqueta: string }[] {
  const tramos: { inicio: Date; etiqueta: string }[] = [];
  if (periodo === "dia") {
    for (let h = 0; h < 24; h += 2) {
      const d = new Date(rango.inicio);
      d.setHours(h);
      tramos.push({ inicio: d, etiqueta: format(d, "HH:mm") });
    }
  } else if (periodo === "anio") {
    for (let m = 0; m < 12; m++) {
      const d = addMonths(rango.inicio, m);
      tramos.push({ inicio: d, etiqueta: capital(format(d, "MMM", { locale: es }).replace(".", "")) });
    }
  } else {
    for (let d = rango.inicio; d <= rango.fin; d = addDays(d, 1)) {
      tramos.push({ inicio: d, etiqueta: periodo === "semana" ? capital(format(d, "EEE", { locale: es }).replace(".", "")) : format(d, "d") });
    }
  }
  return tramos;
}

/** Algo que se agrupa: una etiqueta (tareas) o un hábito. */
export interface Grupo {
  clave: string;
  nombre: string;
  color: string;
}

/** Un hecho con su fecha y el grupo al que pertenece. */
export interface Hecho {
  id: string;
  titulo: string;
  momento: Date;
  grupo: string;
}

export interface FilaResumen extends Grupo {
  cantidad: number;
  /** 0 a 100, redondeado. */
  porcentaje: number;
}

export interface Resumen {
  total: number;
  filas: FilaResumen[];
  /** Por tramo de tiempo: cuántos de cada grupo. */
  serie: { etiqueta: string; valores: Record<string, number> }[];
  hechos: Hecho[];
}

export const SIN_ETIQUETA: Grupo = { clave: "", nombre: "Sin etiqueta", color: "#9aa09c" };

export function resumir(hechos: Hecho[], grupos: Grupo[], periodo: Periodo, referencia: Date): Resumen {
  const rango = rangoDe(periodo, referencia);
  const dentro = hechos.filter((h) => h.momento >= rango.inicio && h.momento <= rango.fin).sort((a, b) => b.momento.getTime() - a.momento.getTime());
  const porGrupo = new Map<string, number>();
  for (const h of dentro) porGrupo.set(h.grupo, (porGrupo.get(h.grupo) ?? 0) + 1);
  const total = dentro.length;
  const conocidos = new Map(grupos.map((g) => [g.clave, g]));
  // "Sin etiqueta" y lo desconocido van al final en los empates.
  const posicion = (clave: string) => {
    const i = grupos.findIndex((g) => g.clave === clave);
    return i < 0 ? Infinity : i;
  };
  const filas: FilaResumen[] = [...porGrupo.entries()]
    .map(([clave, cantidad]) => {
      const g = conocidos.get(clave) ?? (clave === "" ? SIN_ETIQUETA : { clave, nombre: clave, color: SIN_ETIQUETA.color });
      return { ...g, cantidad, porcentaje: total ? Math.round((cantidad / total) * 100) : 0 };
    })
    // Más hechos primero; empate por el orden de los grupos.
    .sort((a, b) => b.cantidad - a.cantidad || posicion(a.clave) - posicion(b.clave));

  const tramos = tramosDe(periodo, rango);
  const serie = tramos.map((t, i) => {
    const hasta = i + 1 < tramos.length ? tramos[i + 1].inicio : new Date(rango.fin.getTime() + 1);
    const valores: Record<string, number> = {};
    for (const f of filas) valores[f.clave] = 0;
    for (const h of dentro) if (h.momento >= t.inicio && h.momento < hasta) valores[h.grupo] = (valores[h.grupo] ?? 0) + 1;
    return { etiqueta: t.etiqueta, valores };
  });
  return { total, filas, serie, hechos: dentro };
}

/** Tareas completadas (no eventos ni borradas), agrupadas por su primera etiqueta: el ámbito. */
export function hechosDeTareas(tareas: Tarea[]): Hecho[] {
  return tareas
    .filter((t) => t.estado === "completada" && t.completadaEn && t.eliminadaEn === null && !t.esEvento)
    .map((t) => ({ id: t.id, titulo: t.titulo, momento: parseISO(t.completadaEn!), grupo: t.etiquetas[0] ?? "" }));
}

export function gruposDeEtiquetas(etiquetas: Etiqueta[]): Grupo[] {
  return etiquetas.map((e) => ({ clave: e.nombre, nombre: e.nombreVisible, color: e.color }));
}

/** Días cumplidos de cada hábito (registro "hecho"). */
export function hechosDeHabitos(habitos: Habito[], registros: RegistroHabito[]): Hecho[] {
  const nombres = new Map(habitos.map((h) => [h.id, h.nombre]));
  return registros
    .filter((r) => r.estado === "hecho" && nombres.has(r.habitoId))
    .map((r) => ({ id: r.id, titulo: nombres.get(r.habitoId)!, momento: parseISO(r.fecha), grupo: r.habitoId }));
}

export function gruposDeHabitos(habitos: Habito[]): Grupo[] {
  return habitos.map((h) => ({ clave: h.id, nombre: h.nombre, color: h.color }));
}
