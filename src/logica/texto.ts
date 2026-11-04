/** Minúsculas y sin acentos, conservando la ñ para no confundir palabras. */
export function normalizar(texto: string): string {
  return texto
    .toLocaleLowerCase("es")
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ");
}

/** Igual que `normalizar`, pero la ñ equivale a n: "manana" encuentra "mañana". */
export function normalizarBusqueda(texto: string): string {
  return normalizar(texto).replace(/ñ/g, "n");
}

export function claveEtiqueta(nombre: string): string {
  return nombre.trim().toLocaleLowerCase("es");
}

export function nuevoId(): string {
  return crypto.randomUUID();
}
