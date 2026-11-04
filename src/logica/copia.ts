import type { NombreTabla } from "../datos/bd";

export const VERSION_COPIA = 1;
export const TAMANO_MAXIMO_COPIA = 100 * 1024 * 1024;

export type DatosCopia = Record<NombreTabla, unknown[]>;

export interface Copia {
  app: "andamia";
  version: number;
  exportadaEn: string;
  datos: DatosCopia;
}

export const NOMBRES_TABLA: Record<NombreTabla, string> = {
  tareas: "tareas",
  listas: "listas",
  carpetas: "carpetas",
  etiquetas: "etiquetas",
  columnas: "columnas",
  sesiones: "sesiones de enfoque",
  habitos: "hábitos",
  registrosHabito: "registros de hábitos",
};

type Campo = "texto" | "numero" | "booleano" | "lista" | "texto?" | "color";

const COLOR = /^#[0-9a-f]{3,8}$/i;

const ESQUEMAS: Record<NombreTabla, { clave: string; campos: Record<string, Campo>; opciones?: Record<string, string[]> }> = {
  tareas: {
    clave: "id",
    campos: { id: "texto", listaId: "texto", titulo: "texto", descripcion: "texto", estado: "texto", prioridad: "texto", vence: "texto?", todoElDia: "booleano", etiquetas: "lista", subtareas: "lista", recordatorios: "lista", avisosEnviados: "lista", orden: "numero" },
    opciones: { estado: ["pendiente", "completada"], prioridad: ["ninguna", "baja", "media", "alta"] },
  },
  listas: { clave: "id", campos: { id: "texto", nombre: "texto", incluirEnTodas: "booleano", orden: "numero" } },
  carpetas: { clave: "id", campos: { id: "texto", nombre: "texto", orden: "numero" } },
  etiquetas: { clave: "nombre", campos: { nombre: "texto", nombreVisible: "texto", color: "color", orden: "numero" } },
  columnas: { clave: "id", campos: { id: "texto", listaId: "texto", nombre: "texto", orden: "numero" } },
  sesiones: { clave: "id", campos: { id: "texto", tipo: "texto", inicio: "texto", fin: "texto", segundos: "numero" }, opciones: { tipo: ["pomodoro", "cronometro"] } },
  habitos: { clave: "id", campos: { id: "texto", nombre: "texto", icono: "texto", color: "color", metaDiaria: "numero", inicio: "texto", archivado: "booleano", orden: "numero" } },
  registrosHabito: { clave: "id", campos: { id: "texto", habitoId: "texto", fecha: "texto", estado: "texto", valor: "numero" }, opciones: { estado: ["hecho", "parcial", "no-hecho"] } },
};

export const TABLAS_COPIA = Object.keys(ESQUEMAS) as NombreTabla[];

export function crearCopia(datos: DatosCopia, ahora: Date = new Date()): Copia {
  return { app: "andamia", version: VERSION_COPIA, exportadaEn: ahora.toISOString(), datos };
}

function cumple(valor: unknown, campo: Campo): boolean {
  switch (campo) {
    case "texto":
      return typeof valor === "string";
    case "texto?":
      return valor === null || typeof valor === "string";
    case "numero":
      return typeof valor === "number" && Number.isFinite(valor);
    case "booleano":
      return typeof valor === "boolean";
    case "lista":
      return Array.isArray(valor);
    case "color":
      return typeof valor === "string" && COLOR.test(valor);
  }
}

export type ResultadoCopia = { ok: true; copia: Copia; conteos: Record<NombreTabla, number>; total: number } | { ok: false; errores: string[] };

const MAX_ERRORES = 10;

/** Revisa todo antes de tocar nada: una copia dañada no debe reemplazar los datos buenos. */
export function validarCopia(texto: string): ResultadoCopia {
  if (texto.length > TAMANO_MAXIMO_COPIA) return { ok: false, errores: ["El archivo es demasiado grande."] };
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return { ok: false, errores: ["El archivo no es un JSON válido."] };
  }
  const c = crudo as Partial<Copia> | null;
  if (!c || typeof c !== "object" || c.app !== "andamia") return { ok: false, errores: ["El archivo no es una copia de Andamia."] };
  if (typeof c.version !== "number" || c.version > VERSION_COPIA) return { ok: false, errores: ["Esta copia se creó con una versión más nueva de Andamia."] };
  if (!c.datos || typeof c.datos !== "object") return { ok: false, errores: ["A la copia le faltan los datos."] };

  const errores: string[] = [];
  const anotar = (e: string) => {
    if (errores.length < MAX_ERRORES) errores.push(e);
  };
  const conteos = {} as Record<NombreTabla, number>;
  for (const tabla of TABLAS_COPIA) {
    const filas = (c.datos as Record<string, unknown>)[tabla];
    if (!Array.isArray(filas)) {
      anotar(`Falta la sección "${NOMBRES_TABLA[tabla]}".`);
      continue;
    }
    conteos[tabla] = filas.length;
    const { clave, campos, opciones } = ESQUEMAS[tabla];
    const vistas = new Set<unknown>();
    filas.forEach((fila, i) => {
      const donde = `${NOMBRES_TABLA[tabla]} n.º ${i + 1}`;
      if (!fila || typeof fila !== "object" || Array.isArray(fila)) {
        anotar(`${donde}: no es un registro válido.`);
        return;
      }
      const f = fila as Record<string, unknown>;
      for (const [campo, tipo] of Object.entries(campos)) {
        if (!cumple(f[campo], tipo)) anotar(`${donde}: el campo "${campo}" no es válido.`);
      }
      for (const [campo, valores] of Object.entries(opciones ?? {})) {
        if (!valores.includes(f[campo] as string)) anotar(`${donde}: el valor de "${campo}" no es válido.`);
      }
      if (vistas.has(f[clave])) anotar(`${donde}: está repetido.`);
      vistas.add(f[clave]);
    });
  }
  if (errores.length) return { ok: false, errores };
  const total = Object.values(conteos).reduce((a, b) => a + b, 0);
  return { ok: true, copia: c as Copia, conteos, total };
}

export function nombreArchivoCopia(ahora: Date = new Date()): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `andamia-copia-${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}.json`;
}
