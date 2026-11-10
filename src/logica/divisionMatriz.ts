/** Dónde se dividen las columnas y las filas de la Matriz (0,5 = mitad). Se guarda en este dispositivo. */
export interface DivisionMatriz {
  columna: number;
  fila: number;
}

export const DIVISION_INICIAL: DivisionMatriz = { columna: 0.5, fila: 0.5 };
const CLAVE = "andamia-matriz-division";

/** Ningún cuadrante queda con menos del 20 % del espacio. */
export const acotar = (x: number) => Math.min(0.8, Math.max(0.2, Number.isFinite(x) ? x : 0.5));

export function leerDivision(): DivisionMatriz {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (g && typeof g.columna === "number" && typeof g.fila === "number") return { columna: acotar(g.columna), fila: acotar(g.fila) };
  } catch {
    // Valor dañado o sin almacenamiento: mitad y mitad.
  }
  return DIVISION_INICIAL;
}

export function guardarDivision(d: DivisionMatriz) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(d));
  } catch {
    // Sin almacenamiento: dura mientras la página siga abierta.
  }
}
