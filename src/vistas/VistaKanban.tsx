import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { datosDesdeEntrada, EntradaRapida } from "../componentes/EntradaRapida";
import { FilaTarea } from "../componentes/FilaTarea";
import { claseBoton, claseCampo, Modal } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { repartirEnColumnas } from "../logica/columnas";
import { interpretarEntrada } from "../logica/entradaRapida";
import { estaActiva } from "../logica/vistas";
import type { Columna, Tarea } from "../modelos/tipos";

const PREFIJO_COLUMNA = "col:";
const PREFIJO_ZONA = "zona:";
const claseTarjeta = "rounded-lg border border-borde bg-panel shadow-sm hover:bg-panel mb-2";

type Reparto = Record<string, string[]>;

function TarjetaOrdenable({ tarea, abierta, alAbrir }: { tarea: Tarea; abierta: boolean; alAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarea.id });
  return (
    <FilaTarea
      tarea={tarea}
      abierta={abierta}
      alAbrir={alAbrir}
      refFila={setNodeRef}
      estilo={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      asaProps={{ ...attributes, ...listeners }}
      clase={claseTarjeta}
    />
  );
}

interface PropsColumna {
  columna: Columna;
  ids: string[];
  tareas: Map<string, Tarea>;
  completadas: Tarea[];
  tareaAbierta: string | null;
  alAbrir: (id: string) => void;
  puedeBorrar: boolean;
  alBorrar: () => void;
}

function ColumnaKanban({ columna, ids, tareas, completadas, tareaAbierta, alAbrir, puedeBorrar, alBorrar }: PropsColumna) {
  const crearTarea = useTienda((s) => s.crearTarea);
  const renombrarColumna = useTienda((s) => s.renombrarColumna);
  const listas = useTienda((s) => s.listas);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: PREFIJO_COLUMNA + columna.id });
  const zona = useDroppable({ id: PREFIJO_ZONA + columna.id });
  const [añadiendo, setAñadiendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [renombrando, setRenombrando] = useState(false);
  const [nombre, setNombre] = useState(columna.nombre);
  const [verHechas, setVerHechas] = useState(false);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const lectura = interpretarEntrada(texto, new Date(), listas);
    if (!lectura.titulo) return;
    setTexto("");
    await crearTarea(datosDesdeEntrada(lectura, { listaId: columna.listaId, columnaId: columna.id }));
  };

  const guardarNombre = (e?: FormEvent) => {
    e?.preventDefault();
    if (nombre.trim()) void renombrarColumna(columna.id, nombre);
    else setNombre(columna.nombre);
    setRenombrando(false);
  };

  return (
    <section ref={setNodeRef} aria-label={`Columna ${columna.nombre}`} data-testid="columna" style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }} className="flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-suave/60 p-2">
      <header className="group mb-2 flex items-center gap-1 px-1">
        <button type="button" aria-label={`Mover columna ${columna.nombre}`} className="cursor-grab touch-none text-tenue" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </button>
        {renombrando ? (
          <form onSubmit={guardarNombre} className="min-w-0 flex-1">
            <input autoFocus aria-label="Nombre de la columna" maxLength={64} className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => guardarNombre()} />
          </form>
        ) : (
          <h2 className="min-w-0 truncate text-sm font-semibold">{columna.nombre}</h2>
        )}
        {!renombrando && <span className="text-xs text-tenue">{ids.length}</span>}
        <span className="ml-auto flex shrink-0 items-center">
          <button type="button" aria-label={`Añadir tarea en ${columna.nombre}`} title="Añadir tarea" className="rounded p-1 text-tenue hover:bg-borde hover:text-texto" onClick={() => setAñadiendo(!añadiendo)}>
            <Plus size={15} />
          </button>
          <button type="button" aria-label={`Renombrar ${columna.nombre}`} title="Renombrar" className="rounded p-1 text-tenue hover:bg-borde hover:text-texto" onClick={() => { setNombre(columna.nombre); setRenombrando(true); }}>
            <Pencil size={14} />
          </button>
          {puedeBorrar && (
            <button type="button" aria-label={`Borrar columna ${columna.nombre}`} title="Borrar columna" className="rounded p-1 text-tenue hover:bg-borde hover:text-peligro" onClick={alBorrar}>
              <Trash2 size={14} />
            </button>
          )}
        </span>
      </header>

      {añadiendo && (
        <form onSubmit={crear} className="mb-2">
          <input autoFocus aria-label={`Nueva tarea en ${columna.nombre}`} className={claseCampo} placeholder="Escribe y pulsa Enter" value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setAñadiendo(false))} />
        </form>
      )}

      <div ref={zona.setNodeRef} className="min-h-16 flex-1 overflow-y-auto">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul>
            {ids.map((id) => {
              const t = tareas.get(id);
              return t ? <TarjetaOrdenable key={id} tarea={t} abierta={id === tareaAbierta} alAbrir={() => alAbrir(id)} /> : null;
            })}
          </ul>
        </SortableContext>
        {completadas.length > 0 && (
          <div className="mt-1">
            <button type="button" aria-expanded={verHechas} className="flex items-center gap-1 px-1 text-xs text-tenue hover:text-texto" onClick={() => setVerHechas(!verHechas)}>
              {verHechas ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Completadas {completadas.length}
            </button>
            {verHechas && (
              <ul className="mt-1">
                {completadas.map((t) => (
                  <FilaTarea key={t.id} tarea={t} abierta={t.id === tareaAbierta} alAbrir={() => alAbrir(t.id)} clase={claseTarjeta} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function VistaKanban({ listaId, tareaAbierta, alAbrir }: { listaId: string; tareaAbierta: string | null; alAbrir: (id: string) => void }) {
  const todasColumnas = useTienda((s) => s.columnas);
  const todasTareas = useTienda((s) => s.tareas);
  const asegurarColumnas = useTienda((s) => s.asegurarColumnas);
  const crearColumna = useTienda((s) => s.crearColumna);
  const reordenarColumnas = useTienda((s) => s.reordenarColumnas);
  const borrarColumna = useTienda((s) => s.borrarColumna);
  const moverTareaAColumna = useTienda((s) => s.moverTareaAColumna);

  const [temporal, setTemporal] = useState<Reparto | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [borrando, setBorrando] = useState<Columna | null>(null);
  const [destino, setDestino] = useState("");

  const columnas = useMemo(() => todasColumnas.filter((c) => c.listaId === listaId).sort((a, b) => a.orden - b.orden), [todasColumnas, listaId]);
  const deLista = useMemo(() => todasTareas.filter((t) => t.listaId === listaId && estaActiva(t)), [todasTareas, listaId]);
  const pendientes = useMemo(() => deLista.filter((t) => t.estado === "pendiente"), [deLista]);
  const tareas = useMemo(() => new Map(deLista.map((t) => [t.id, t])), [deLista]);

  useEffect(() => {
    if (!columnas.length) void asegurarColumnas(listaId);
  }, [columnas.length, asegurarColumnas, listaId]);

  const base = useMemo(() => {
    const r: Reparto = {};
    for (const [id, ts] of repartirEnColumnas(pendientes, columnas)) r[id] = ts.map((t) => t.id);
    return r;
  }, [pendientes, columnas]);
  const hechas = useMemo(() => repartirEnColumnas(deLista.filter((t) => t.estado === "completada"), columnas), [deLista, columnas]);
  const reparto = temporal ?? base;

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const colDe = (id: string, r: Reparto) => {
    if (id.startsWith(PREFIJO_ZONA)) return id.slice(PREFIJO_ZONA.length);
    return Object.keys(r).find((c) => r[c].includes(id)) ?? null;
  };

  // Las columnas solo chocan con columnas; las tareas, con tareas y zonas, prefiriendo la tarea.
  const colision: CollisionDetection = (args) => {
    const esColumna = String(args.active.id).startsWith(PREFIJO_COLUMNA);
    const contenedores = args.droppableContainers.filter((c) => String(c.id).startsWith(PREFIJO_COLUMNA) === esColumna);
    if (esColumna) return closestCenter({ ...args, droppableContainers: contenedores });
    const bajo = pointerWithin({ ...args, droppableContainers: contenedores });
    if (bajo.length) {
      const tarea = bajo.find((c) => !String(c.id).startsWith(PREFIJO_ZONA));
      return tarea ? [tarea] : bajo;
    }
    return closestCorners({ ...args, droppableContainers: contenedores });
  };

  const alIniciar = ({ active }: DragStartEvent) => {
    setActivo(String(active.id));
    if (!String(active.id).startsWith(PREFIJO_COLUMNA)) setTemporal(base);
  };

  const alPasar = ({ active, over }: DragOverEvent) => {
    if (!over || String(active.id).startsWith(PREFIJO_COLUMNA)) return;
    const id = String(active.id);
    const sobre = String(over.id);
    setTemporal((actual) => {
      const r = actual ?? base;
      const origen = colDe(id, r);
      const destinoCol = colDe(sobre, r);
      if (!origen || !destinoCol || origen === destinoCol) return actual;
      const lista = r[destinoCol];
      const indice = sobre.startsWith(PREFIJO_ZONA) ? lista.length : Math.max(0, lista.indexOf(sobre));
      return {
        ...r,
        [origen]: r[origen].filter((x) => x !== id),
        [destinoCol]: [...lista.slice(0, indice), id, ...lista.slice(indice)],
      };
    });
  };

  const alSoltar = async ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActivo(null);
    if (id.startsWith(PREFIJO_COLUMNA)) {
      if (over && over.id !== active.id) {
        const ids = columnas.map((c) => PREFIJO_COLUMNA + c.id);
        const nuevos = arrayMove(ids, ids.indexOf(id), ids.indexOf(String(over.id)));
        await reordenarColumnas(nuevos.map((x) => x.slice(PREFIJO_COLUMNA.length)));
      }
      return;
    }
    const r = temporal ?? base;
    const col = colDe(id, r);
    if (!over || !col) {
      setTemporal(null);
      return;
    }
    let ids = r[col];
    const sobre = String(over.id);
    if (sobre.startsWith(PREFIJO_ZONA)) {
      // Soltar en el hueco de la columna la lleva al final.
      ids = [...ids.filter((x) => x !== id), id];
    } else if (ids.includes(sobre) && sobre !== id) {
      ids = arrayMove(ids, ids.indexOf(id), ids.indexOf(sobre));
    }
    const origen = colDe(id, base);
    if (origen !== col || ids.join() !== base[col].join()) await moverTareaAColumna(ids, id, col);
    setTemporal(null);
  };

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    await crearColumna(listaId, nueva);
    setNueva("");
  };

  const tareaActiva = activo && !activo.startsWith(PREFIJO_COLUMNA) ? tareas.get(activo) : null;
  const columnaActiva = activo?.startsWith(PREFIJO_COLUMNA) ? columnas.find((c) => PREFIJO_COLUMNA + c.id === activo) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-5">
        <EntradaRapida seccion={{ tipo: "lista", id: listaId }} />
      </div>
      <div className="min-h-0 flex-1 overflow-x-auto px-5 pb-5">
        <DndContext
          sensors={sensores}
          collisionDetection={colision}
          onDragStart={alIniciar}
          onDragOver={alPasar}
          onDragEnd={(e) => void alSoltar(e)}
          onDragCancel={() => {
            setActivo(null);
            setTemporal(null);
          }}
          accessibility={{
            screenReaderInstructions: { draggable: "Pulsa Espacio para tomar, usa las flechas para mover y Espacio para soltar. Esc cancela." },
            announcements: { onDragStart: () => "Elemento tomado.", onDragOver: () => "Elemento movido.", onDragEnd: () => "Elemento soltado.", onDragCancel: () => "Movimiento cancelado." },
          }}
        >
          <div className="flex h-full items-start gap-3">
            <SortableContext items={columnas.map((c) => PREFIJO_COLUMNA + c.id)} strategy={horizontalListSortingStrategy}>
              {columnas.map((c) => (
                <ColumnaKanban
                  key={c.id}
                  columna={c}
                  ids={reparto[c.id] ?? []}
                  tareas={tareas}
                  completadas={hechas.get(c.id) ?? []}
                  tareaAbierta={tareaAbierta}
                  alAbrir={alAbrir}
                  puedeBorrar={columnas.length > 1}
                  alBorrar={() => {
                    setBorrando(c);
                    setDestino(columnas.find((x) => x.id !== c.id)?.id ?? "");
                  }}
                />
              ))}
            </SortableContext>
            <form onSubmit={crear} className="w-60 shrink-0">
              <div className="flex items-center gap-1">
                <input aria-label="Nueva columna" className={claseCampo} placeholder="Nueva columna" maxLength={64} value={nueva} onChange={(e) => setNueva(e.target.value)} />
                <button type="submit" aria-label="Crear columna" title="Crear columna" className="rounded-md border border-borde p-1.5 text-tenue hover:bg-suave disabled:opacity-40" disabled={!nueva.trim()}>
                  <Plus size={15} />
                </button>
              </div>
            </form>
          </div>
          <DragOverlay>
            {tareaActiva && (
              <ul>
                <FilaTarea tarea={tareaActiva} abierta={false} alAbrir={() => undefined} clase={`${claseTarjeta} shadow-lg`} />
              </ul>
            )}
            {columnaActiva && <div className="w-72 rounded-xl bg-suave p-3 text-sm font-semibold shadow-lg">{columnaActiva.nombre}</div>}
          </DragOverlay>
        </DndContext>
      </div>

      {borrando && (
        <Modal titulo={`¿Borrar la columna "${borrando.nombre}"?`} alCerrar={() => setBorrando(null)}>
          <p className="mb-3 text-sm text-tenue">Sus tareas no se borran: pasarán a la columna que elijas.</p>
          <label className="mb-5 block text-sm">
            <span className="mb-1 block text-tenue">Mover las tareas a</span>
            <select className={claseCampo} value={destino} onChange={(e) => setDestino(e.target.value)}>
              {columnas.filter((c) => c.id !== borrando.id).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={claseBoton} onClick={() => setBorrando(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="rounded-md bg-peligro px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 dark:text-black"
              onClick={() => {
                void borrarColumna(borrando.id, destino);
                setBorrando(null);
              }}
            >
              Borrar columna
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
