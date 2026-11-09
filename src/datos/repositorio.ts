import { parseISO } from "date-fns";
import { bd, TABLAS } from "./bd";
import type { DatosCopia } from "../logica/copia";
import { COLORES_LISTA, ETIQUETAS_INICIALES, LISTA_BANDEJA, type Carpeta, type Columna, type EstadoHabito, type Etiqueta, type Habito, type Lista, type Prioridad, type RegistroHabito, type RepetirDesde, type SesionEnfoque, type Subtarea, type Tarea } from "../modelos/tipos";
import { NOMBRE_COLUMNA_INICIAL } from "../logica/columnas";
import { siguienteOcurrencia, venceDesde } from "../logica/repeticion";
import { claveEtiqueta, nuevoId } from "../logica/texto";
import { ordenEntre } from "../logica/vistas";

const ahoraIso = () => new Date().toISOString();

export interface DatosNuevaTarea {
  titulo: string;
  listaId?: string;
  descripcion?: string;
  prioridad?: Prioridad;
  dificultad?: Prioridad;
  esEvento?: boolean;
  vence?: string | null;
  todoElDia?: boolean;
  etiquetas?: string[];
  repeticion?: string | null;
  repetirDesde?: RepetirDesde;
  /** Minutos antes del vencimiento de cada recordatorio inicial. */
  minutosRecordatorios?: number[];
  columnaId?: string | null;
}

export async function cargarTodo() {
  const [tareas, listas, carpetas, etiquetas, columnas, sesiones, habitos, registros] = await Promise.all([
    bd.tareas.toArray(),
    bd.listas.orderBy("orden").toArray(),
    bd.carpetas.orderBy("orden").toArray(),
    bd.etiquetas.orderBy("orden").toArray(),
    bd.columnas.orderBy("orden").toArray(),
    bd.sesiones.orderBy("inicio").toArray(),
    bd.habitos.orderBy("orden").toArray(),
    bd.registrosHabito.toArray(),
  ]);
  return { tareas, listas, carpetas, etiquetas, columnas, sesiones, habitos, registros };
}

export async function exportarTodo(): Promise<DatosCopia> {
  const entradas = await Promise.all(TABLAS.map(async (t) => [t, await bd.table(t).toArray()] as const));
  return Object.fromEntries(entradas) as DatosCopia;
}

/**
 * Reemplaza todo en una sola transacción: si algo falla, no cambia nada.
 * Borra uno por uno en vez de vaciar para que, con una cuenta, los cambios se propaguen.
 */
export async function reemplazarTodo(datos: DatosCopia): Promise<void> {
  await bd.transaction("rw", TABLAS.map((t) => bd.table(t)), async () => {
    for (const t of TABLAS) {
      const tabla = bd.table(t);
      await tabla.bulkDelete(await tabla.toCollection().primaryKeys());
      await tabla.bulkPut(datos[t]);
    }
  });
}

/** Guarda una sesión. Con el mismo id no se duplica, aunque dos pestañas la terminen a la vez. */
export async function guardarSesion(sesion: SesionEnfoque): Promise<SesionEnfoque> {
  await bd.sesiones.put(sesion);
  return sesion;
}

export async function borrarSesion(id: string): Promise<void> {
  await bd.sesiones.delete(id);
}

export type DatosHabito = Omit<Habito, "id" | "orden" | "avisosEnviados" | "archivado">;

export async function crearHabito(datos: DatosHabito): Promise<Habito> {
  const existentes = await bd.habitos.toArray();
  const habito: Habito = {
    ...datos,
    nombre: datos.nombre.trim(),
    id: nuevoId(),
    avisosEnviados: [],
    archivado: false,
    orden: existentes.reduce((m, h) => Math.max(m, h.orden + 1), 0),
  };
  await bd.habitos.put(habito);
  return habito;
}

export async function actualizarHabito(id: string, cambios: Partial<Omit<Habito, "id">>): Promise<Habito> {
  return bd.transaction("rw", bd.habitos, async () => {
    const actual = await bd.habitos.get(id);
    if (!actual) throw new Error(`No existe el hábito ${id}`);
    const habito = { ...actual, ...cambios };
    await bd.habitos.put(habito);
    return habito;
  });
}

/** Elimina el hábito y su historial. Para conservarlo se debe archivar. */
export async function borrarHabito(id: string): Promise<void> {
  await bd.transaction("rw", bd.habitos, bd.registrosHabito, async () => {
    await bd.registrosHabito.where("habitoId").equals(id).delete();
    await bd.habitos.delete(id);
  });
}

/** Con null borra el registro de ese día. */
export async function registrarHabito(habitoId: string, fecha: string, datos: { estado: EstadoHabito; valor: number } | null): Promise<RegistroHabito | null> {
  const id = `${habitoId}|${fecha}`;
  if (!datos) {
    await bd.registrosHabito.delete(id);
    return null;
  }
  const registro: RegistroHabito = { id, habitoId, fecha, ...datos };
  await bd.registrosHabito.put(registro);
  return registro;
}

/** Marca un aviso de hábito. Devuelve null si otra pestaña ya lo había enviado. */
export async function marcarAvisoHabito(id: string, clave: string): Promise<Habito | null> {
  return bd.transaction("rw", bd.habitos, async () => {
    const habito = await bd.habitos.get(id);
    if (!habito || habito.avisosEnviados.includes(clave)) return null;
    // Solo importa el aviso del día: la lista no crece sin límite.
    const cambiado = { ...habito, avisosEnviados: [clave] };
    await bd.habitos.put(cambiado);
    return cambiado;
  });
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

/** Agrega las etiquetas iniciales que falten. No toca las que ya existen. */
export async function sembrarEtiquetasIniciales(): Promise<Etiqueta[]> {
  return bd.transaction("rw", bd.etiquetas, async () => {
    const creadas: Etiqueta[] = [];
    let orden = await bd.etiquetas.count();
    for (const { nombreVisible, color } of ETIQUETAS_INICIALES) {
      const clave = claveEtiqueta(nombreVisible);
      if (await bd.etiquetas.get(clave)) continue;
      const etiqueta: Etiqueta = { nombre: clave, nombreVisible, color, orden: orden++ };
      await bd.etiquetas.put(etiqueta);
      creadas.push(etiqueta);
    }
    return creadas;
  });
}

export class EtiquetaRepetida extends Error {
  constructor(nombre: string) {
    super(`Ya existe la etiqueta "${nombre}".`);
  }
}

/**
 * Crea una etiqueta (anterior = null) o la edita. Si cambia el nombre, las tareas
 * que la tenían pasan a tener la nueva.
 */
export async function guardarEtiqueta(anterior: string | null, datos: { nombreVisible: string; color: string }): Promise<Etiqueta> {
  const nombreVisible = datos.nombreVisible.trim();
  const clave = claveEtiqueta(nombreVisible);
  return bd.transaction("rw", bd.etiquetas, bd.tareas, async () => {
    const vieja = anterior ? await bd.etiquetas.get(anterior) : undefined;
    if (clave !== anterior && (await bd.etiquetas.get(clave))) throw new EtiquetaRepetida(nombreVisible);
    const etiqueta: Etiqueta = { nombre: clave, nombreVisible, color: datos.color, orden: vieja?.orden ?? (await bd.etiquetas.count()) };
    if (anterior && clave !== anterior) {
      await bd.tareas.filter((t) => t.etiquetas.includes(anterior)).modify((t) => {
        t.etiquetas = [...new Set(t.etiquetas.map((e) => (e === anterior ? clave : e)))];
        t.modificadaEn = ahoraIso();
      });
      await bd.etiquetas.delete(anterior);
    }
    await bd.etiquetas.put(etiqueta);
    return etiqueta;
  });
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
    dificultad: datos.dificultad ?? "ninguna",
    esEvento: datos.esEvento ?? false,
    vence: datos.vence ?? null,
    todoElDia: datos.todoElDia ?? false,
    zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
    etiquetas: [...new Set((datos.etiquetas ?? []).map(claveEtiqueta).filter(Boolean))],
    subtareas: [],
    repeticion: datos.repeticion ?? null,
    repetirDesde: datos.repetirDesde ?? "vencimiento",
    repetidaDe: null,
    recordatorios: (datos.minutosRecordatorios ?? []).map((minutosAntes) => ({ id: nuevoId(), minutosAntes })),
    avisosEnviados: [],
    columnaId: datos.columnaId ?? null,
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

/**
 * Completa o reabre una tarea y devuelve todas las tareas afectadas.
 * Una tarea repetida deja una copia completada con el historial y avanza a la
 * fecha siguiente con las subtareas sin marcar.
 */
export async function completarTarea(id: string, completada: boolean, ahora: Date = new Date()): Promise<Tarea[]> {
  return bd.transaction("rw", bd.tareas, async () => {
    const tarea = await bd.tareas.get(id);
    if (!tarea) throw new Error(`No existe la tarea ${id}`);
    const momento = ahora.toISOString();

    const siguiente = completada && tarea.repeticion && tarea.vence ? siguienteOcurrencia(tarea.repeticion, parseISO(tarea.vence), tarea.repetirDesde, ahora) : null;
    if (!siguiente) {
      const cambiada: Tarea = { ...tarea, estado: completada ? "completada" : "pendiente", completadaEn: completada ? momento : null, modificadaEn: momento };
      await bd.tareas.put(cambiada);
      return [cambiada];
    }

    const copia: Tarea = {
      ...tarea,
      id: nuevoId(),
      estado: "completada",
      completadaEn: momento,
      repeticion: null,
      repetidaDe: tarea.id,
      recordatorios: [],
      avisosEnviados: [],
      modificadaEn: momento,
    };
    const avanzada: Tarea = {
      ...tarea,
      vence: venceDesde(siguiente, tarea.todoElDia),
      subtareas: tarea.subtareas.map((s) => ({ ...s, estado: "pendiente" })),
      avisosEnviados: [],
      modificadaEn: momento,
    };
    await bd.tareas.bulkPut([avanzada, copia]);
    return [avanzada, copia];
  });
}

/** Marca un aviso. Devuelve false si otra pestaña ya lo había enviado. */
export async function marcarAviso(id: string, clave: string): Promise<Tarea | null> {
  return bd.transaction("rw", bd.tareas, async () => {
    const tarea = await bd.tareas.get(id);
    if (!tarea || tarea.avisosEnviados.includes(clave)) return null;
    const cambiada = { ...tarea, avisosEnviados: [...tarea.avisosEnviados, clave] };
    await bd.tareas.put(cambiada);
    return cambiada;
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
    modo: "lista",
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
  await bd.transaction("rw", bd.listas, bd.tareas, bd.columnas, async () => {
    await bd.tareas.where("listaId").equals(id).modify((t) => {
      if (t.eliminadaEn === null) {
        t.eliminadaEn = momento;
        t.modificadaEn = momento;
      }
      t.columnaId = null;
    });
    await bd.columnas.where("listaId").equals(id).delete();
    await bd.listas.delete(id);
  });
}

/** Una lista en Kanban siempre tiene al menos una columna. */
export async function asegurarColumnas(listaId: string): Promise<Columna[]> {
  return bd.transaction("rw", bd.columnas, async () => {
    const existentes = await bd.columnas.where("listaId").equals(listaId).sortBy("orden");
    if (existentes.length) return existentes;
    const inicial: Columna = { id: nuevoId(), listaId, nombre: NOMBRE_COLUMNA_INICIAL, orden: 0 };
    await bd.columnas.put(inicial);
    return [inicial];
  });
}

export async function crearColumna(listaId: string, nombre: string): Promise<Columna> {
  const existentes = await bd.columnas.where("listaId").equals(listaId).toArray();
  const columna: Columna = {
    id: nuevoId(),
    listaId,
    nombre: nombre.trim(),
    orden: existentes.reduce((m, c) => Math.max(m, c.orden + 1), 0),
  };
  await bd.columnas.put(columna);
  return columna;
}

export async function renombrarColumna(id: string, nombre: string): Promise<void> {
  await bd.columnas.update(id, { nombre: nombre.trim() });
}

export async function reordenarColumnas(idsEnOrden: string[]): Promise<void> {
  await bd.transaction("rw", bd.columnas, async () => {
    await Promise.all(idsEnOrden.map((id, orden) => bd.columnas.update(id, { orden })));
  });
}

/** Borra una columna moviendo sus tareas a otra de la misma lista. */
export async function borrarColumna(id: string, destinoId: string): Promise<void> {
  await bd.transaction("rw", bd.columnas, bd.tareas, async () => {
    const [columna, destino] = await Promise.all([bd.columnas.get(id), bd.columnas.get(destinoId)]);
    if (!columna || !destino || columna.listaId !== destino.listaId || id === destinoId) {
      throw new Error("La columna de destino no es válida");
    }
    const hermanas = await bd.columnas.where("listaId").equals(columna.listaId).sortBy("orden");
    const primera = hermanas[0]?.id;
    const momento = ahoraIso();
    await bd.tareas.where("listaId").equals(columna.listaId).modify((t) => {
      // Las tareas sin columna asignada se ven en la primera.
      if (t.columnaId === id || (t.columnaId === null && primera === id)) {
        t.columnaId = destinoId;
        t.modificadaEn = momento;
      }
    });
    await bd.columnas.delete(id);
  });
}

/** Lleva una tarea a una columna y la ubica según la secuencia final de esa columna. */
export async function moverTareaAColumna(idsEnOrdenNuevo: string[], idMovida: string, columnaId: string): Promise<Tarea[]> {
  const movida = await actualizarTarea(idMovida, { columnaId });
  const cambiadas = idsEnOrdenNuevo.length > 1 ? await reordenarTarea(idsEnOrdenNuevo, idMovida) : [movida];
  return cambiadas.some((t) => t.id === idMovida) ? cambiadas : [movida, ...cambiadas];
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
