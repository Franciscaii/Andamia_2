/**
 * Anchos de las columnas en la vista de 7 días.
 * Automático: los días sin nada se achican y los que tienen tareas o eventos se reparten el resto.
 * Manual: arrastrando el borde entre dos columnas; se recuerda por semana en este dispositivo.
 */
export const PESO_VACIO = 0.35;
export const MINIMO_MANUAL = 96;
const CLAVE = "andamia-semana-anchos";
const SEMANAS_GUARDADAS = 12;

/** Peso de cada columna en modo automático. */
export function pesosAutomaticos(vacios: boolean[]): number[] {
  return vacios.map((v) => (v ? PESO_VACIO : 1));
}

/**
 * Mueve el borde entre la columna i y la i+1 en dx píxeles.
 * Las demás columnas no cambian y ninguna de las dos queda más angosta que el mínimo.
 */
export function moverBorde(anchos: number[], i: number, dx: number, minimo = MINIMO_MANUAL): number[] {
  const par = anchos[i] + anchos[i + 1];
  const izquierda = Math.min(Math.max(anchos[i] + dx, minimo), Math.max(minimo, par - minimo));
  const nuevos = anchos.slice();
  nuevos[i] = izquierda;
  nuevos[i + 1] = par - izquierda;
  return nuevos;
}

type Guardados = Record<string, number[]>;

function leerTodo(): Guardados {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "{}");
    return g && typeof g === "object" ? g : {};
  } catch {
    return {};
  }
}

/** Anchos manuales de la semana que empieza en `lunes` (yyyy-MM-dd), o null si es automática. */
export function leerAnchos(lunes: string): number[] | null {
  const a = leerTodo()[lunes];
  return Array.isArray(a) && a.length === 7 && a.every((n) => typeof n === "number" && n > 0) ? a : null;
}

/** Guarda (o borra, con null) los anchos manuales de una semana. Solo quedan las últimas semanas. */
export function guardarAnchos(lunes: string, anchos: number[] | null) {
  const todo = leerTodo();
  if (anchos) todo[lunes] = anchos.map((n) => Math.round(n));
  else delete todo[lunes];
  const claves = Object.keys(todo).sort().slice(-SEMANAS_GUARDADAS);
  try {
    localStorage.setItem(CLAVE, JSON.stringify(Object.fromEntries(claves.map((k) => [k, todo[k]]))));
  } catch {
    // Sin almacenamiento: los anchos duran mientras la página siga abierta.
  }
}
