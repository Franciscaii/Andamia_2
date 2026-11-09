import { create } from "zustand";
import type { Carpeta, Columna, EstadoHabito, Etiqueta, Habito, Lista, ModoLista, RegistroHabito, SesionEnfoque, Tarea } from "../modelos/tipos";
import * as repo from "./repositorio";

export type Tema = "claro" | "oscuro";

interface Estado {
  cargando: boolean;
  error: string | null;
  tareas: Tarea[];
  listas: Lista[];
  carpetas: Carpeta[];
  etiquetas: Etiqueta[];
  columnas: Columna[];
  sesiones: SesionEnfoque[];
  habitos: Habito[];
  registros: RegistroHabito[];
  tema: Tema;
  cargar: () => Promise<void>;
  cerrarError: () => void;
  alternarTema: () => void;
  fijarTema: (tema: Tema) => void;
  crearTarea: (datos: repo.DatosNuevaTarea) => Promise<Tarea | null>;
  actualizarTarea: (id: string, cambios: Partial<Omit<Tarea, "id" | "creadaEn">>) => void;
  agregarEtiquetaATarea: (tarea: Tarea, nombre: string) => Promise<void>;
  completarTarea: (id: string, completada: boolean) => Promise<void>;
  enviarAPapelera: (id: string) => Promise<void>;
  restaurarTarea: (id: string) => Promise<void>;
  borrarDefinitivamente: (id: string) => Promise<void>;
  vaciarPapelera: () => Promise<void>;
  reordenar: (idsEnOrdenNuevo: string[], idMovida: string) => Promise<void>;
  guardarLista: (id: string | null, datos: { nombre: string; color: string | null; carpetaId: string | null; incluirEnTodas: boolean }) => Promise<Lista | null>;
  borrarLista: (id: string) => Promise<void>;
  crearCarpeta: (nombre: string) => Promise<void>;
  renombrarCarpeta: (id: string, nombre: string) => Promise<void>;
  borrarCarpeta: (id: string) => Promise<void>;
  borrarEtiqueta: (nombre: string) => Promise<void>;
  /** Devuelve un mensaje si no se pudo (por ejemplo, nombre repetido). */
  guardarEtiqueta: (anterior: string | null, datos: { nombreVisible: string; color: string }) => Promise<string | null>;
  sembrarEtiquetas: () => Promise<void>;
  marcarAviso: (id: string, clave: string) => Promise<boolean>;
  cambiarModoLista: (id: string, modo: ModoLista) => Promise<void>;
  asegurarColumnas: (listaId: string) => Promise<void>;
  crearColumna: (listaId: string, nombre: string) => Promise<void>;
  renombrarColumna: (id: string, nombre: string) => Promise<void>;
  reordenarColumnas: (ids: string[]) => Promise<void>;
  borrarColumna: (id: string, destinoId: string) => Promise<void>;
  moverTareaAColumna: (ids: string[], idMovida: string, columnaId: string) => Promise<void>;
  guardarSesion: (sesion: SesionEnfoque) => Promise<void>;
  borrarSesion: (id: string) => Promise<void>;
  crearHabito: (datos: repo.DatosHabito) => Promise<void>;
  actualizarHabito: (id: string, cambios: Partial<Omit<Habito, "id">>) => Promise<void>;
  borrarHabito: (id: string) => Promise<void>;
  registrarHabito: (habitoId: string, fecha: string, datos: { estado: EstadoHabito; valor: number } | null) => Promise<void>;
  marcarAvisoHabito: (id: string, clave: string) => Promise<boolean>;
}

function temaInicial(): Tema {
  return document.documentElement.classList.contains("dark") ? "oscuro" : "claro";
}

function reemplazar(tareas: Tarea[], cambiadas: Tarea[]): Tarea[] {
  const porId = new Map(cambiadas.map((t) => [t.id, t]));
  const nuevas = cambiadas.filter((c) => !tareas.some((t) => t.id === c.id));
  return [...tareas.map((t) => porId.get(t.id) ?? t), ...nuevas];
}

export const useTienda = create<Estado>((set, get) => {
  /** Ejecuta una escritura; si falla, avisa y vuelve a leer lo guardado. */
  async function guardar<T>(accion: () => Promise<T>): Promise<T | null> {
    try {
      return await accion();
    } catch (e) {
      console.error(e);
      set({ error: "No se pudo guardar el cambio. Se recargaron los datos guardados." });
      await get().cargar();
      return null;
    }
  }

  const recargar = async () => set(await repo.cargarTodo());

  return {
    cargando: true,
    error: null,
    tareas: [],
    listas: [],
    carpetas: [],
    etiquetas: [],
    columnas: [],
    sesiones: [],
    habitos: [],
    registros: [],
    tema: typeof document === "undefined" ? "claro" : temaInicial(),

    cargar: async () => {
      try {
        set({ ...(await repo.cargarTodo()), cargando: false });
      } catch (e) {
        console.error(e);
        set({ cargando: false, error: "No se pudo abrir la base de datos del navegador." });
      }
    },

    cerrarError: () => set({ error: null }),

    alternarTema: () => get().fijarTema(get().tema === "oscuro" ? "claro" : "oscuro"),

    fijarTema: (tema) => {
      document.documentElement.classList.toggle("dark", tema === "oscuro");
      localStorage.setItem("andamia-tema", tema);
      set({ tema });
    },

    crearTarea: async (datos) => {
      const r = await guardar(() => repo.crearTarea(datos));
      if (!r) return null;
      set((s) => ({ tareas: [...s.tareas, r.tarea], etiquetas: [...s.etiquetas, ...r.etiquetasNuevas] }));
      return r.tarea;
    },

    actualizarTarea: (id, cambios) => {
      // Se aplica de inmediato para que escribir en el detalle no tenga retraso.
      set((s) => ({ tareas: s.tareas.map((t) => (t.id === id ? { ...t, ...cambios } : t)) }));
      void guardar(() => repo.actualizarTarea(id, cambios));
    },

    agregarEtiquetaATarea: async (tarea, nombre) => {
      const r = await guardar(async () => {
        const nuevas = await repo.asegurarEtiquetas([nombre]);
        return { nuevas, clave: nombre.trim().toLocaleLowerCase("es") };
      });
      if (!r || !r.clave || tarea.etiquetas.includes(r.clave)) {
        if (r?.nuevas.length) set((s) => ({ etiquetas: [...s.etiquetas, ...r.nuevas] }));
        return;
      }
      set((s) => ({ etiquetas: [...s.etiquetas, ...r.nuevas] }));
      get().actualizarTarea(tarea.id, { etiquetas: [...tarea.etiquetas, r.clave] });
    },

    completarTarea: async (id, completada) => {
      const cambiadas = await guardar(() => repo.completarTarea(id, completada));
      if (cambiadas) set((s) => ({ tareas: reemplazar(s.tareas, cambiadas) }));
    },

    enviarAPapelera: async (id) => {
      const t = await guardar(() => repo.enviarAPapelera(id));
      if (t) set((s) => ({ tareas: reemplazar(s.tareas, [t]) }));
    },

    restaurarTarea: async (id) => {
      const t = await guardar(() => repo.restaurarTarea(id));
      if (t) set((s) => ({ tareas: reemplazar(s.tareas, [t]) }));
    },

    borrarDefinitivamente: async (id) => {
      await guardar(() => repo.borrarDefinitivamente(id));
      set((s) => ({ tareas: s.tareas.filter((t) => t.id !== id) }));
    },

    vaciarPapelera: async () => {
      const ids = await guardar(() => repo.vaciarPapelera());
      if (ids) set((s) => ({ tareas: s.tareas.filter((t) => !ids.includes(t.id)) }));
    },

    reordenar: async (ids, idMovida) => {
      const cambiadas = await guardar(() => repo.reordenarTarea(ids, idMovida));
      if (cambiadas) set((s) => ({ tareas: reemplazar(s.tareas, cambiadas) }));
    },

    guardarLista: async (id, datos) => {
      const lista = await guardar(() => (id ? repo.actualizarLista(id, datos) : repo.crearLista(datos)));
      if (lista) {
        set((s) => ({
          listas: id ? s.listas.map((l) => (l.id === id ? lista : l)) : [...s.listas, lista],
        }));
      }
      return lista;
    },

    borrarLista: async (id) => {
      await guardar(() => repo.borrarLista(id));
      await recargar();
    },

    crearCarpeta: async (nombre) => {
      const carpeta = await guardar(() => repo.crearCarpeta(nombre));
      if (carpeta) set((s) => ({ carpetas: [...s.carpetas, carpeta] }));
    },

    renombrarCarpeta: async (id, nombre) => {
      await guardar(() => repo.renombrarCarpeta(id, nombre));
      await recargar();
    },

    borrarCarpeta: async (id) => {
      await guardar(() => repo.borrarCarpeta(id));
      await recargar();
    },

    guardarEtiqueta: async (anterior, datos) => {
      try {
        await repo.guardarEtiqueta(anterior, datos);
      } catch (e) {
        if (e instanceof repo.EtiquetaRepetida) return e.message;
        console.error(e);
        return "No se pudo guardar la etiqueta.";
      }
      await recargar();
      return null;
    },

    sembrarEtiquetas: async () => {
      const creadas = await guardar(() => repo.sembrarEtiquetasIniciales());
      if (creadas?.length) await recargar();
    },

    borrarEtiqueta: async (nombre) => {
      await guardar(() => repo.borrarEtiqueta(nombre));
      await recargar();
    },

    marcarAviso: async (id, clave) => {
      const t = await guardar(() => repo.marcarAviso(id, clave));
      if (!t) return false;
      set((s) => ({ tareas: reemplazar(s.tareas, [t]) }));
      return true;
    },

    cambiarModoLista: async (id, modo) => {
      await guardar(async () => {
        if (modo === "kanban") await repo.asegurarColumnas(id);
        await repo.actualizarLista(id, { modo });
      });
      await recargar();
    },

    asegurarColumnas: async (listaId) => {
      await guardar(() => repo.asegurarColumnas(listaId));
      await recargar();
    },

    crearColumna: async (listaId, nombre) => {
      const c = await guardar(() => repo.crearColumna(listaId, nombre));
      if (c) set((s) => ({ columnas: [...s.columnas, c] }));
    },

    renombrarColumna: async (id, nombre) => {
      await guardar(() => repo.renombrarColumna(id, nombre));
      set((s) => ({ columnas: s.columnas.map((c) => (c.id === id ? { ...c, nombre: nombre.trim() } : c)) }));
    },

    reordenarColumnas: async (ids) => {
      set((s) => ({ columnas: s.columnas.map((c) => (ids.includes(c.id) ? { ...c, orden: ids.indexOf(c.id) } : c)) }));
      await guardar(() => repo.reordenarColumnas(ids));
    },

    borrarColumna: async (id, destinoId) => {
      await guardar(() => repo.borrarColumna(id, destinoId));
      await recargar();
    },

    moverTareaAColumna: async (ids, idMovida, columnaId) => {
      const cambiadas = await guardar(() => repo.moverTareaAColumna(ids, idMovida, columnaId));
      if (cambiadas) set((s) => ({ tareas: reemplazar(s.tareas, cambiadas) }));
    },

    guardarSesion: async (sesion) => {
      const guardada = await guardar(() => repo.guardarSesion(sesion));
      if (guardada) set((s) => ({ sesiones: [...s.sesiones.filter((x) => x.id !== guardada.id), guardada] }));
    },

    borrarSesion: async (id) => {
      await guardar(() => repo.borrarSesion(id));
      set((s) => ({ sesiones: s.sesiones.filter((x) => x.id !== id) }));
    },

    crearHabito: async (datos) => {
      const h = await guardar(() => repo.crearHabito(datos));
      if (h) set((s) => ({ habitos: [...s.habitos, h] }));
    },

    actualizarHabito: async (id, cambios) => {
      const h = await guardar(() => repo.actualizarHabito(id, cambios));
      if (h) set((s) => ({ habitos: s.habitos.map((x) => (x.id === id ? h : x)) }));
    },

    borrarHabito: async (id) => {
      await guardar(() => repo.borrarHabito(id));
      set((s) => ({ habitos: s.habitos.filter((x) => x.id !== id), registros: s.registros.filter((r) => r.habitoId !== id) }));
    },

    registrarHabito: async (habitoId, fecha, datos) => {
      const id = `${habitoId}|${fecha}`;
      // Se aplica de inmediato: marcar días seguidos no debe sentirse lento.
      set((s) => ({ registros: [...s.registros.filter((r) => r.id !== id), ...(datos ? [{ id, habitoId, fecha, ...datos }] : [])] }));
      await guardar(() => repo.registrarHabito(habitoId, fecha, datos));
    },

    marcarAvisoHabito: async (id, clave) => {
      const h = await guardar(() => repo.marcarAvisoHabito(id, clave));
      if (!h) return false;
      set((s) => ({ habitos: s.habitos.map((x) => (x.id === id ? h : x)) }));
      return true;
    },
  };
});
