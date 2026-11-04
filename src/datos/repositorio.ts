import { bd } from "./bd";
import { COLORES_LISTA, LISTA_BANDEJA, type Carpeta, type Etiqueta, type Lista, type Prioridad, type Subtarea, type Tarea } from "../modelos/tipos";
import { claveEtiqueta, nuevoId } from "../logica/texto";
import { ordenEntre } from "../logica/vistas";

const ahoraIso = () => new Date().toISOString();

export interface DatosNuevaTarea {
  titulo: string;
  listaId?: string;
  descripcion?: string;
  prioridad?: Prioridad;
  vence?: string | null;
  todoElDia?: boolean;
  etiquetas?: string[];
}

export async function cargarTodo() {
  const [tareas, listas, carpetas, etiquetas] = await Promise.all([
    bd.tareas.toArray(),
    bd.listas.orderBy("orden").toArray(),
    bd.carpetas.orderBy("orden").toArray(),
    bd.etiquetas.orderBy("orden").toArray(),
  ]);
  return { tareas, listas, carpetas, etiquetas };
}

/** Devuelve las etiquetas pedidas, creando las que no existan. */
export async function asegurarEtiquetas(nombres: string[]): Promise<Etiqueta[]> {
  const creadas: Etiqueta[] = [];
  for (const nombre of nombres) {
    const clave = claveEtiqueta(nombre);
    if (!clave) continue;
    if (await bd.etiquetas.get(clave)) continue;
    const total = await bd.etiquetas.count();
    const etiqueta: Etiqueta = {
      nombre: clave,
      nombreVisible: nombre.trim(),
      color: COLORES_LISTA[total % COLORES_LISTA.length],
      orden: total,
    };
    await bd.etiquetas.put(etiqueta);
    creadas.push(etiqueta);
  }
  return creadas;
}

export async function crearTarea(datos: DatosNuevaTarea): Promise<{ tarea: Tarea; etiquetasNuevas: Etiqueta[] }> {
  const etiquetasNuevas = await asegurarEtiquetas(datos.etiquetas ?? []);
  const primera = await bd.tareas.orderBy("orden").first();
  const momento = ahoraIso();
  const tarea: Tarea = {
    id: nuevoId(),
    listaId: datos.listaId ?? LISTA_BANDEJA,
    titulo: datos.titulo.trim(),
    descripcion: datos.descripcion ?? "",
    estado: "pendiente",
    prioridad: datos.prioridad ?? "ninguna",
    vence: datos.vence ?? null,
    todoElDia: datos.todoElDia ?? false,
    zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
    etiquetas: [...new Set((datos.etiquetas ?? []).map(claveEtiqueta).filter(Boolean))],
    subtareas: [],
    // Cada tarea nueva queda arriba.
    orden: primera ? primera.orden - 1024 : 0,
    completadaEn: null,
    eliminadaEn: null,
    creadaEn: momento,
    modificadaEn: momento,
  };
  await bd.tareas.put(tarea);
  return { tarea, etiquetasNuevas };
}

export async function actualizarTarea(id: string, cambios: Partial<Omit<Tarea, "id" | "creadaEn">>): Promise<Tarea> {
  // En una transacción para que dos cambios seguidos no se pisen.
  return bd.transaction("rw", bd.tareas, async () => {
    const actual = await bd.tareas.get(id);
    if (!actual) throw new Error(`No existe la tarea ${id}`);
    const tarea: Tarea = { ...actual, ...cambios, modificadaEn: ahoraIso() };
    await bd.tareas.put(tarea);
    return tarea;
  });
}

export function completarTarea(id: string, completada: boolean): Promise<Tarea> {
  return actualizarTarea(id, {
    estado: completada ? "completada" : "pendiente",
    completadaEn: completada ? ahoraIso() : null,
  });
}

export function enviarAPapelera(id: string): Promise<Tarea> {
  return actualizarTarea(id, { eliminadaEn: ahoraIso() });
}

/** Si la lista de la tarea ya no existe, vuelve a la bandeja. */
export async function restaurarTarea(id: string): Promise<Tarea> {
  const tarea = await bd.tareas.get(id);
  if (!tarea) throw new Error(`No existe la tarea ${id}`);
  const listaExiste = tarea.listaId === LISTA_BANDEJA || Boolean(await bd.listas.get(tarea.listaId));
  return actualizarTarea(id, { eliminadaEn: null, listaId: listaExiste ? tarea.listaId : LISTA_BANDEJA });
}

export async function borrarDefinitivamente(id: string): Promise<void> {
  await bd.tareas.delete(id);
}

export async function vaciarPapelera(): Promise<string[]> {
  const enPapelera = (await bd.tareas.toArray()).filter((t) => t.eliminadaEn !== null).map((t) => t.id);
  await bd.tareas.bulkDelete(enPapelera);
  return enPapelera;
}

/**
 * Mueve una tarea dentro de una secuencia ya ordenada, entre dos vecinas.
 * Devuelve todas las tareas cuyo orden cambió.
 */
export async function reordenarTarea(idsEnOrdenNuevo: string[], idMovida: string): Promise<Tarea[]> {
  const posicion = idsEnOrdenNuevo.indexOf(idMovida);
  const tareas = (await bd.tareas.bulkGet(idsEnOrdenNuevo)) as Tarea[];
  const anterior = posicion > 0 ? tareas[posicion - 1].orden : null;
  const siguiente = posicion < tareas.length - 1 ? tareas[posicion + 1].orden : null;
  const orden = ordenEntre(anterior, siguiente);
  if (orden !== null) return [await actualizarTarea(idMovida, { orden })];
  // Sin hueco entre vecinas: se renumera la secuencia completa.
  const cambiadas = tareas.map((t, i) => ({ ...t, orden: i * 1024 }));
  await bd.tareas.bulkPut(cambiadas);
  return cambiadas;
}

export function agregarSubtarea(tarea: Tarea, titulo: string): Promise<Tarea> {
  const subtarea: Subtarea = { id: nuevoId(), titulo: titulo.trim(), estado: "pendiente", orden: tarea.subtareas.length };
  return actualizarTarea(tarea.id, { subtareas: [...tarea.subtareas, subtarea] });
}

export async function crearLista(datos: { nombre: string; color?: string | null; carpetaId?: string | null; incluirEnTodas?: boolean }): Promise<Lista> {
  const lista: Lista = {
    id: nuevoId(),
    nombre: datos.nombre.trim().slice(0, 64),
    color: datos.color ?? null,
    carpetaId: datos.carpetaId ?? null,
    incluirEnTodas: datos.incluirEnTodas ?? true,
    orden: await bd.listas.count(),
  };
  await bd.listas.put(lista);
  return lista;
}

export async function actualizarLista(id: string, cambios: Partial<Omit<Lista, "id">>): Promise<Lista> {
  const actual = await bd.listas.get(id);
  if (!actual) throw new Error(`No existe la lista ${id}`);
  const lista = { ...actual, ...cambios };
  await bd.listas.put(lista);
  return lista;
}

/** Borra la lista y envía sus tareas a la papelera, igual que las pendientes y las completadas. */
export async function borrarLista(id: string): Promise<void> {
  const momento = ahoraIso();
  await bd.transaction("rw", bd.listas, bd.tareas, async () => {
    await bd.tareas.where("listaId").equals(id).modify((t) => {
      if (t.eliminadaEn === null) {
        t.eliminadaEn = momento;
        t.modificadaEn = momento;
      }
    });
    await bd.listas.delete(id);
  });
}

export async function crearCarpeta(nombre: string): Promise<Carpeta> {
  const carpeta: Carpeta = { id: nuevoId(), nombre: nombre.trim(), orden: await bd.carpetas.count() };
  await bd.carpetas.put(carpeta);
  return carpeta;
}

export async function renombrarCarpeta(id: string, nombre: string): Promise<void> {
  await bd.carpetas.update(id, { nombre: nombre.trim() });
}

/** Al borrar una carpeta sus listas quedan sueltas: no se pierde ninguna tarea. */
export async function borrarCarpeta(id: string): Promise<void> {
  await bd.transaction("rw", bd.carpetas, bd.listas, async () => {
    await bd.listas.where("carpetaId").equals(id).modify({ carpetaId: null });
    await bd.carpetas.delete(id);
  });
}

/** Quita la etiqueta de todas las tareas y la elimina. */
export async function borrarEtiqueta(nombre: string): Promise<void> {
  await bd.transaction("rw", bd.etiquetas, bd.tareas, async () => {
    await bd.tareas.toCollection().modify((t) => {
      t.etiquetas = t.etiquetas.filter((e) => e !== nombre);
    });
    await bd.etiquetas.delete(nombre);
  });
}
