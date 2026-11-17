import { useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as EventoTeclado, type PointerEvent as EventoPuntero } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, Plus, Tag } from "lucide-react";
import { colisionTareasEnZonas } from "../componentes/colision";
import { datosDesdeEntrada } from "../componentes/EntradaRapida";
import { COLOR_PRIORIDAD, FilaTarea } from "../componentes/FilaTarea";
import { claseCampo } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { interpretarEntrada } from "../logica/entradaRapida";
import { ordenEntre } from "../logica/vistas";
import { CUADRANTES, prioridadDeCuadrante, repartirEnCuadrantes, type Cuadrante, type IdCuadrante } from "../logica/matriz";
import { irA } from "../logica/ruta";
import { acotar, guardarDivision, leerDivision, type DivisionMatriz } from "../logica/divisionMatriz";
import { LISTA_BANDEJA, type Etiqueta, type Tarea } from "../modelos/tipos";
import { esAppNativa } from "../logica/plataforma";
import { WIDGET_ACTUAL } from "../logica/widgetEscritorio";

/** Widget Matriz del PC: siempre los 4 cuadrantes a la vista (2×2), cada uno con su propio desplazamiento. */
const EN_WIDGET = WIDGET_ACTUAL?.id === "matriz";

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

/** Selector de etiqueta del celular: en vez de la ventana del sistema, una lista propia debajo del botón. */
function SelectorEtiqueta({ etiquetas, valor, alElegir }: { etiquetas: Etiqueta[]; valor: string | null; alElegir: (nombre: string | null) => void }) {
  const [abierto, setAbierto] = useState(false);
  const actual = etiquetas.find((e) => e.nombre === valor);
  const opcion = (nombre: string | null, texto: string) => (
    <button
      key={nombre ?? "todas"}
      type="button"
      role="option"
      aria-selected={nombre === valor}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${nombre === valor ? "bg-acento-suave font-semibold" : "hover:bg-suave"}`}
      onClick={() => {
        alElegir(nombre);
        setAbierto(false);
      }}
    >
      <Tag size={16} className="shrink-0 text-tenue" />
      <span className="min-w-0 flex-1 truncate">{texto}</span>
      {nombre === valor && <Check size={16} className="shrink-0 text-acento" />}
    </button>
  );
  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Filtrar por etiqueta"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-2 rounded-xl border border-borde bg-panel px-3 py-2 text-sm font-medium shadow-sm"
      >
        <Tag size={16} className="text-tenue" />
        <span className="max-w-40 truncate">{actual ? actual.nombreVisible : "Todas las etiquetas"}</span>
        <ChevronDown size={16} className={`text-tenue transition-transform ${abierto ? "rotate-180" : ""}`} />
      </button>
      {abierto && (
        <>
          <button type="button" aria-label="Cerrar lista de etiquetas" tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onClick={() => setAbierto(false)} />
          <div role="listbox" aria-label="Etiquetas" className="absolute right-0 z-40 mt-2 max-h-72 w-64 max-w-[80vw] overflow-y-auto rounded-2xl border border-borde bg-panel p-1.5 shadow-xl">
            {opcion(null, "Todas las etiquetas")}
            {etiquetas.map((e) => opcion(e.nombre, e.nombreVisible))}
          </div>
        </>
      )}
    </div>
  );
}

function ZonaCuadrante({ numero, cuadrante, tareas, tareaAbierta, listaId, etiqueta, clase = "" }: { clase?: string; numero: number; cuadrante: Cuadrante; tareas: Tarea[]; tareaAbierta: string | null; listaId: string | null; etiqueta: string | null }) {
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
    <section ref={setNodeRef} aria-label={cuadrante.nombre} data-testid="cuadrante" className={`flex min-w-0 flex-col rounded-xl border bg-panel ${EN_WIDGET ? "min-h-0 p-2" : "min-h-64 p-3 lg:min-h-0"} ${clase} ${isOver ? "border-acento bg-acento-suave" : "border-borde"}`}>
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

/** Lugar de cada cuadrante en la grilla del computador (columnas y filas 1 y 3; la 2 es el borde). */
const LUGAR = EN_WIDGET
  ? ["col-start-1 row-start-1", "col-start-3 row-start-1", "col-start-1 row-start-3", "col-start-3 row-start-3"]
  : ["lg:col-start-1 lg:row-start-1", "lg:col-start-3 lg:row-start-1", "lg:col-start-1 lg:row-start-3", "lg:col-start-3 lg:row-start-3"];

/** Borde entre cuadrantes: se arrastra para cambiar el tamaño; doble clic vuelve a mitad y mitad. */
function BordeMatriz({ eje, valor, alCambiar, alSoltar }: { eje: "columna" | "fila"; valor: number; alCambiar: (x: number) => void; alSoltar: () => void }) {
  const tomado = useRef(false);
  const vertical = eje === "columna";
  const posicion = (e: EventoPuntero) => {
    const grilla = (e.currentTarget as HTMLElement).parentElement!;
    const r = grilla.getBoundingClientRect();
    const st = getComputedStyle(grilla);
    if (vertical) {
      const ini = r.left + parseFloat(st.paddingLeft);
      return (e.clientX - ini) / (r.width - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight));
    }
    const ini = r.top + parseFloat(st.paddingTop);
    return (e.clientY - ini) / (r.height - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom));
  };
  const tecla = (e: EventoTeclado) => {
    const menos = vertical ? "ArrowLeft" : "ArrowUp";
    const mas = vertical ? "ArrowRight" : "ArrowDown";
    if (e.key !== menos && e.key !== mas) return;
    e.preventDefault();
    alCambiar(acotar(valor + (e.key === mas ? 0.05 : -0.05)));
    alSoltar();
  };
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={vertical ? "Ancho de las columnas" : "Alto de las filas"}
      aria-valuenow={Math.round(valor * 100)}
      aria-valuemin={20}
      aria-valuemax={80}
      title="Arrastra para cambiar el tamaño. Doble clic: mitad y mitad."
      tabIndex={0}
      data-testid={vertical ? "borde-columnas" : "borde-filas"}
      className={`group touch-none outline-none ${EN_WIDGET ? "flex" : "hidden lg:flex"} ${vertical ? "col-start-2 row-span-3 row-start-1 cursor-col-resize justify-center" : "col-span-3 col-start-1 row-start-2 cursor-row-resize items-center"}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        tomado.current = true;
      }}
      onPointerMove={(e) => {
        if (tomado.current) alCambiar(acotar(posicion(e)));
      }}
      onPointerUp={() => {
        if (!tomado.current) return;
        tomado.current = false;
        alSoltar();
      }}
      onLostPointerCapture={() => {
        if (!tomado.current) return;
        tomado.current = false;
        alSoltar();
      }}
      onDoubleClick={() => {
        alCambiar(0.5);
        alSoltar();
      }}
      onKeyDown={tecla}
    >
      <span className={`rounded-full bg-transparent transition-colors group-hover:bg-acento/60 group-focus-visible:bg-acento ${vertical ? "my-3 w-0.5" : "mx-3 h-0.5 w-full"}`} />
    </div>
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
  const [division, setDivision] = useState<DivisionMatriz>(leerDivision);
  const actual = useRef(division);
  actual.current = division;
  const cambiar = (eje: keyof DivisionMatriz) => (x: number) => {
    actual.current = { ...actual.current, [eje]: x };
    setDivision(actual.current);
  };
  const soltar = () => guardarDivision(actual.current);
  const tamanos = {
    "--mc1": `${division.columna}fr`,
    "--mc2": `${1 - division.columna}fr`,
    "--mf1": `${division.fila}fr`,
    "--mf2": `${1 - division.fila}fr`,
  } as CSSProperties;

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
      {/* En el widget: compacto y con la esquina derecha libre para el botón del widget. */}
      <header className={EN_WIDGET ? "flex items-center gap-2 pt-1 pr-12 pb-1.5 pl-3" : "flex flex-wrap items-center gap-2 px-5 pt-5 pb-3"}>
        <h1 className={EN_WIDGET ? "truncate text-base font-semibold" : "text-xl font-semibold"}>Matriz de Eisenhower</h1>
        <div className={EN_WIDGET ? "ml-auto flex shrink-0" : "flex flex-wrap gap-2 sm:ml-auto"}>
          {esAppNativa() ? (
            <SelectorEtiqueta etiquetas={etiquetas} valor={etiqueta} alElegir={setEtiqueta} />
          ) : (
            <select aria-label="Filtrar por etiqueta" className={`${claseCampo} !w-auto`} value={etiqueta ?? ""} onChange={(e) => setEtiqueta(e.target.value || null)}>
              <option value="">Todas las etiquetas</option>
              {etiquetas.map((e) => (
                <option key={e.nombre} value={e.nombre}>
                  {e.nombreVisible}
                </option>
              ))}
            </select>
          )}
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
        <div
          style={tamanos}
          className={
            EN_WIDGET
              ? "grid min-h-0 flex-1 grid-cols-[minmax(0,var(--mc1))_8px_minmax(0,var(--mc2))] grid-rows-[minmax(0,var(--mf1))_8px_minmax(0,var(--mf2))] overflow-hidden px-2 pb-2"
              : "grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto px-5 pb-5 lg:grid-cols-[minmax(0,var(--mc1))_12px_minmax(0,var(--mc2))] lg:grid-rows-[minmax(0,var(--mf1))_12px_minmax(0,var(--mf2))] lg:gap-0"
          }
        >
          {CUADRANTES.map((c, i) => (
            <ZonaCuadrante key={c.id} clase={LUGAR[i]} numero={i + 1} cuadrante={c} tareas={reparto[c.id]} tareaAbierta={tareaAbierta} listaId={listaId} etiqueta={etiqueta} />
          ))}
          <BordeMatriz eje="columna" valor={division.columna} alCambiar={cambiar("columna")} alSoltar={soltar} />
          <BordeMatriz eje="fila" valor={division.fila} alCambiar={cambiar("fila")} alSoltar={soltar} />
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
