import type { EstadoTarea, Prioridad, Tarea } from "../modelos/tipos";
import { diasHasta } from "./fechas";
import { normalizarBusqueda } from "./texto";

export type FiltroFecha = "cualquiera" | "hoy" | "semana" | "con-fecha" | "sin-fecha" | "atrasadas";

export interface Filtros {
  consulta: string;
  listaId: string | null;
  etiqueta: string | null;
  prioridad: Prioridad | null;
  estado: EstadoTarea | null;
  fecha: FiltroFecha;
}

export const FILTROS_VACIOS: Filtros = {
  consulta: "",
  listaId: null,
  etiqueta: null,
  prioridad: null,
  estado: null,
  fecha: "cualquiera",
};

export function hayFiltros(f: Filtros): boolean {
  return Boolean(f.consulta.trim() || f.listaId || f.etiqueta || f.prioridad || f.estado || f.fecha !== "cualquiera");
}

function cumpleFecha(t: Tarea, filtro: FiltroFecha, ahora: Date): boolean {
  const d = diasHasta(t, ahora);
  switch (filtro) {
    case "cualquiera":
      return true;
    case "hoy":
      return d === 0;
    case "semana":
      return d !== null && d >= 0 && d <= 6;
    case "con-fecha":
      return d !== null;
    case "sin-fecha":
      return d === null;
    case "atrasadas":
      return d !== null && d < 0;
  }
}

/** Todas las palabras deben aparecer en el título, las notas o las subtareas. La papelera se excluye. */
export function buscarTareas(tareas: Tarea[], filtros: Filtros, ahora: Date = new Date()): Tarea[] {
  const palabras = normalizarBusqueda(filtros.consulta).split(/\s+/).filter(Boolean);
  return tareas
    .filter((t) => {
      if (t.eliminadaEn !== null) return false;
      if (filtros.listaId && t.listaId !== filtros.listaId) return false;
      if (filtros.etiqueta && !t.etiquetas.includes(filtros.etiqueta)) return false;
      if (filtros.prioridad && t.prioridad !== filtros.prioridad) return false;
      if (filtros.estado && t.estado !== filtros.estado) return false;
      if (!cumpleFecha(t, filtros.fecha, ahora)) return false;
      if (!palabras.length) return true;
      const texto = normalizarBusqueda([t.titulo, t.descripcion, ...t.subtareas.map((s) => s.titulo)].join(" "));
      return palabras.every((p) => texto.includes(p));
    })
    .sort((a, b) => Number(a.estado === "completada") - Number(b.estado === "completada") || a.orden - b.orden);
}

export interface Fragmento {
  texto: string;
  coincide: boolean;
}

/** Divide un texto en partes para resaltar las coincidencias, ignorando mayúsculas y acentos. */
export function resaltar(texto: string, consulta: string): Fragmento[] {
  const palabras = normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return [{ texto, coincide: false }];
  // La normalización conserva la longitud carácter a carácter en textos precompuestos.
  const base = [...texto].map((c) => {
    const n = normalizarBusqueda(c);
    return n.length === 1 ? n : c.toLowerCase();
  }).join("");
  const marcas = new Array<boolean>(texto.length).fill(false);
  for (const p of palabras) {
    let i = base.indexOf(p);
    while (i >= 0) {
      marcas.fill(true, i, i + p.length);
      i = base.indexOf(p, i + p.length);
    }
  }
  const partes: Fragmento[] = [];
  let inicio = 0;
  for (let i = 1; i <= texto.length; i++) {
    if (i === texto.length || marcas[i] !== marcas[inicio]) {
      partes.push({ texto: texto.slice(inicio, i), coincide: marcas[inicio] });
      inicio = i;
    }
  }
  return partes;
}
