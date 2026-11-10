import { useMemo, useState, type FormEvent } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { colisionTareasEnZonas } from "../componentes/colision";
import { datosDesdeEntrada } from "../componentes/EntradaRapida";
import { COLOR_PRIORIDAD, FilaTarea } from "../componentes/FilaTarea";
import { claseCampo } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { interpretarEntrada } from "../logica/entradaRapida";
import { ordenEntre } from "../logica/vistas";
import { CUADRANTES, prioridadDeCuadrante, repartirEnCuadrantes, type Cuadrante, type IdCuadrante } from "../logica/matriz";
import { irA } from "../logica/ruta";
import { LISTA_BANDEJA, type Tarea } from "../modelos/tipos";

const SECCION = { tipo: "matriz" } as const;

const esCuadrante = (id: string) => CUADRANTES.some((c) => c.id === id);
const colision = colisionTareasEnZonas(esCuadrante);

function TarjetaMatriz({ tarea, abierta, cuadrante }: { tarea: Tarea; abierta: boolean; cuadrante: IdCuadrante }) {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id: tarea.id, data: { cuadrante } });
  return (
    <FilaTarea
      tarea={tarea}
      abierta={abierta}
      alAbrir={() => irA(SECCION, tarea.id)}
      mostrarLista
      refFila={setNodeRef}
      estilo={{ opacity: isDragging ? 0.35 : 1, transform: CSS.Translate.toString(transform), transition }}
      asaProps={{ ...attributes, ...listeners }}
    />
  );
}

function ZonaCuadrante({ numero, cuadrante, tareas, tareaAbierta, listaId, etiqueta }: { numero: number; cuadrante: Cuadrante; tareas: Tarea[]; tareaAbierta: string | null; listaId: string | null; etiqueta: string | null }) {
  const crearTarea = useTienda((s) => s.crearTarea);
  const listas = useTienda((s) => s.listas);
  const { setNodeRef, isOver } = useDroppable({ id: cuadrante.id });
  const [texto, setTexto] = useState("");

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    const lectura = interpretarEntrada(texto, new Date(), listas);
    if (!lectura.titulo) return;
    setTexto("");
    // La nueva tarea hereda el cuadrante y los filtros activos, para que se vea al crearla.
    await crearTarea(datosDesdeEntrada(lectura, { prioridad: cuadrante.prioridad, listaId: listaId ?? LISTA_BANDEJA, etiqueta: etiqueta ?? undefined }));
  };

  return (
    <section ref={setNodeRef} aria-label={cuadrante.nombre} data-testid="cuadrante" className={`flex min-h-64 min-w-0 flex-col rounded-xl border bg-panel p-3 lg:min-h-0 ${isOver ? "border-acento bg-acento-suave" : "border-borde"}`}>
      <header className="mb-2 flex items-start gap-2">
        <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold" style={{ borderColor: COLOR_PRIORIDAD[cuadrante.prioridad], color: COLOR_PRIORIDAD[cuadrante.prioridad] }}>
          {numero}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {cuadrante.nombre} <span className="font-normal text-tenue">{tareas.length}</span>
          </h2>
          <p className="text-xs text-tenue">{cuadrante.ayuda}</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tareas.length > 0 ? (
          <SortableContext id={cuadrante.id} items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {tareas.map((t) => (
                <TarjetaMatriz key={t.id} tarea={t} abierta={t.id === tareaAbierta} cuadrante={cuadrante.id} />
              ))}
            </ul>
          </SortableContext>
        ) : (
          <p className="py-6 text-center text-xs text-tenue">Sin tareas</p>
        )}
      </div>
      <form onSubmit={crear} className="mt-2 flex items-center gap-1.5">
        <Plus size={15} className="shrink-0 text-tenue" />
        <input aria-label={`Añadir tarea en ${cuadrante.nombre}`} autoComplete="off" className={claseCampo} placeholder="Añadir tarea" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </form>
    </section>
  );
}

export function VistaMatriz({ tareaAbierta }: { tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const reordenar = useTienda((s) => s.reordenar);
  const listaId: string | null = null;
  const [etiqueta, setEtiqueta] = useState<string | null>(null);
  const [activa, setActiva] = useState<Tarea | null>(null);

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reparto = useMemo(() => repartirEnCuadrantes(tareas, listas, { listaId, etiqueta }), [tareas, listas, listaId, etiqueta]);

  // Soltar sobre otra tarea del mismo cuadrante la sube o la baja; en otro cuadrante, le cambia la importancia
  // y la deja justo antes de la tarea sobre la que cayó.
  const alSoltar = ({ active, over }: DragEndEvent) => {
    setActiva(null);
    if (!over || active.id === over.id) return;
    const tarea = tareas.find((t) => t.id === active.id);
    if (!tarea) return;
    const sobreId = String(over.id);
    const destino = (esCuadrante(sobreId) ? sobreId : over.data.current?.cuadrante) as IdCuadrante | undefined;
    if (!destino) return;
    const lista = reparto[destino];
    if (lista.some((t) => t.id === tarea.id)) {
      if (esCuadrante(sobreId)) return;
      const ids = lista.map((t) => t.id);
      void reordenar(arrayMove(ids, ids.indexOf(tarea.id), ids.indexOf(sobreId)), tarea.id);
      return;
    }
    const indice = esCuadrante(sobreId) ? lista.length : lista.findIndex((t) => t.id === sobreId);
    const orden = ordenEntre(indice > 0 ? lista[indice - 1].orden : null, indice < lista.length ? lista[indice].orden : null);
    actualizarTarea(tarea.id, { prioridad: prioridadDeCuadrante(destino), ...(orden !== null ? { orden } : {}) });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3">
        <h1 className="text-xl font-semibold">Matriz de Eisenhower</h1>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <select aria-label="Filtrar por etiqueta" className={`${claseCampo} !w-auto`} value={etiqueta ?? ""} onChange={(e) => setEtiqueta(e.target.value || null)}>
            <option value="">Todas las etiquetas</option>
            {etiquetas.map((e) => (
              <option key={e.nombre} value={e.nombre}>
                {e.nombreVisible}
              </option>
            ))}
          </select>
        </div>
      </header>
      <DndContext
        sensors={sensores}
        collisionDetection={colision}
        onDragStart={({ active }) => setActiva(tareas.find((t) => t.id === active.id) ?? null)}
        onDragEnd={alSoltar}
        onDragCancel={() => setActiva(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "Pulsa Espacio para tomar la tarea, usa las flechas para subirla, bajarla o llevarla a otro cuadrante y Espacio para soltarla. Esc cancela." },
          announcements: { onDragStart: () => "Tarea tomada.", onDragOver: () => "", onDragEnd: () => "Tarea soltada.", onDragCancel: () => "Movimiento cancelado." },
        }}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pb-5 lg:grid-cols-2 lg:grid-rows-2">
          {CUADRANTES.map((c, i) => (
            <ZonaCuadrante key={c.id} numero={i + 1} cuadrante={c} tareas={reparto[c.id]} tareaAbierta={tareaAbierta} listaId={listaId} etiqueta={etiqueta} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activa && (
            <ul>
              <FilaTarea tarea={activa} abierta={false} alAbrir={() => undefined} clase="w-72 border border-acento bg-panel shadow-lg" />
            </ul>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
