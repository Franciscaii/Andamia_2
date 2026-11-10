import { Fragment, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as EventoTeclado, type PointerEvent as EventoPuntero, type FormEvent, type HTMLAttributes, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CampoNotas, claseTituloCampo, EditorSubtareas, estiloEvento, ICONO_DIFICULTAD, SelectorColorEvento, SelectorIndole, SelectorNivel } from "../componentes/CamposTarea";
import { addDays, format, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Check, CheckSquare, ChevronLeft, ChevronRight, Flame, GripVertical, Plus } from "lucide-react";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { DialogoHabito } from "./VistaHabitos";
import { COLOR_HECHA, COLOR_NIVEL } from "../componentes/FilaTarea";
import { colisionTareasEnZonas } from "../componentes/colision";
import { venceEnDia } from "../logica/calendario";
import { ordenEntre } from "../logica/vistas";
import { useTienda } from "../datos/tienda";
import { fechaDeTarea } from "../logica/fechas";
import { irA, type Seccion } from "../logica/ruta";
import { contenidoDelDia, dificultadDe, diasDeSemana, hayAlgoElDia, nombreCortoDia, tituloDelDia, type FiltroSemana } from "../logica/semana";
import { guardarAnchos, leerAnchos, moverBorde, MINIMO_MANUAL, pesosAutomaticos } from "../logica/anchosSemana";
import { WIDGET_ACTUAL } from "../logica/widgetEscritorio";
import type { Prioridad, Subtarea, Tarea } from "../modelos/tipos";

const SECCION: Seccion = { tipo: "vista", vista: "semana" };
const PREFIJO_EVENTO = "evento:";

const NOMBRE_NIVEL: Record<Prioridad, string> = { alta: "Alta", media: "Media", baja: "Baja", ninguna: "" };

export const FILTROS: { id: FiltroSemana; nombre: string }[] = [
  { id: "tareas", nombre: "Tareas" },
  { id: "eventos", nombre: "Eventos" },
  { id: "todos", nombre: "Todos" },
];

function hora(t: Tarea): string {
  const fecha = fechaDeTarea(t);
  return fecha && !t.todoElDia ? format(fecha, "HH:mm") : "";
}

export function FilaEvento({ evento, abierta, arrastre }: { evento: Tarea; abierta: boolean; arrastre?: { ref: (n: HTMLElement | null) => void; alPresionar?: (e: EventoPuntero) => void; arrastrando: boolean } }) {
  return (
    <li ref={arrastre?.ref} className={arrastre?.arrastrando ? "opacity-30" : ""}>
      <button
        type="button"
        data-testid="fila-evento"
        title={arrastre ? "Toca para abrir; arrastra para llevarlo a otro día" : undefined}
        onClick={() => irA(SECCION, evento.id)}
        onPointerDown={arrastre?.alPresionar}
        className={`flex w-full items-center gap-2 rounded-md border-l-4 px-3 py-1.5 text-left text-sm ${arrastre ? "cursor-grab touch-none" : ""} ${abierta ? "ring-2 ring-acento" : ""}`}
        style={estiloEvento(evento.colorEvento)}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{evento.titulo || "Sin título"}</span>
        {hora(evento) && <span className="shrink-0 text-xs text-tenue tabular-nums">{hora(evento)}</span>}
      </button>
    </li>
  );
}

/** Evento de la Semana que se arrastra entero a otro día; un toque sin mover lo abre. */
function EventoArrastrable({ evento, abierta, dia }: { evento: Tarea; abierta: boolean; dia: string }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: PREFIJO_EVENTO + evento.id, data: { dia, evento: true } });
  return <FilaEvento evento={evento} abierta={abierta} arrastre={{ ref: setNodeRef, alPresionar: listeners?.onPointerDown as ((e: EventoPuntero) => void) | undefined, arrastrando: isDragging }} />;
}

interface Arrastre {
  ref: (n: HTMLElement | null) => void;
  estilo: CSSProperties;
  asa: HTMLAttributes<HTMLButtonElement>;
  arrastrando: boolean;
}

function FilaTareaSemana({ tarea, abierta, hoy, arrastre, estrecha = false }: { tarea: Tarea; abierta: boolean; hoy: Date; arrastre?: Arrastre; estrecha?: boolean }) {
  const completarTarea = useTienda((s) => s.completarTarea);
  const etiquetas = useTienda((s) => s.etiquetas);
  const hecha = tarea.estado === "completada";
  // Casilla: color de la importancia. Insignia de abajo: dificultad.
  const dificultad = dificultadDe(tarea);
  const colorCasilla = hecha ? COLOR_HECHA : COLOR_NIVEL[tarea.prioridad];
  const fecha = fechaDeTarea(tarea);
  const atrasada = !hecha && fecha !== null && fecha < hoy && !isSameDay(fecha, hoy);
  const etiqueta = tarea.etiquetas[0] ? etiquetas.find((e) => e.nombre === tarea.etiquetas[0]) : undefined;
  const pildora = etiqueta && (
    <span
      className={`truncate rounded-full border px-2 py-0.5 text-xs font-medium ${estrecha ? "max-w-full leading-4" : "max-w-[40%] shrink-0"}`}
      style={{ color: etiqueta.color, borderColor: etiqueta.color, background: `color-mix(in srgb, ${etiqueta.color} 14%, transparent)` }}
    >
      {etiqueta.nombreVisible}
    </span>
  );

  return (
    <li
      ref={arrastre?.ref}
      style={arrastre?.estilo}
      data-testid="fila-tarea"
      className={`flex items-start gap-2.5 rounded-lg py-2 ${arrastre ? "pr-2 pl-0.5" : "px-2"} ${abierta ? "bg-acento-suave" : "hover:bg-suave"} ${arrastre?.arrastrando ? "relative z-10 bg-panel shadow-lg" : ""}`}
    >
      {arrastre && (
        <button type="button" aria-label={`Mover ${tarea.titulo}`} title="Arrastra para subir o bajar" className="-mr-1.5 shrink-0 cursor-grab touch-none rounded p-0.5 leading-none text-tenue opacity-60 hover:opacity-100" {...arrastre.asa}>
          <GripVertical size={16} />
        </button>
      )}
      <button
        type="button"
        role="checkbox"
        aria-checked={hecha}
        aria-label={hecha ? `Marcar como pendiente: ${tarea.titulo}` : `Completar: ${tarea.titulo}`}
        title={tarea.prioridad !== "ninguna" ? `Importancia ${NOMBRE_NIVEL[tarea.prioridad].toLowerCase()}` : "Sin importancia"}
        onClick={() => void completarTarea(tarea.id, !hecha)}
        style={{ borderColor: colorCasilla, background: hecha ? colorCasilla : undefined }}
        // Alineada con la primera línea del título (text-sm: 20 px de alto).
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
      >
        {hecha && <Check size={13} strokeWidth={3} className="text-white" />}
      </button>
      <button type="button" onClick={() => irA(SECCION, tarea.id)} className="min-w-0 flex-1 text-left">
        <span className={`block text-sm break-words ${hecha ? "text-tenue line-through" : ""}`}>{tarea.titulo || "Sin título"}</span>
        {(dificultad !== "ninguna" || hora(tarea) || atrasada || (estrecha && pildora)) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            {dificultad !== "ninguna" && (
              <span
                data-testid="dificultad"
                title={`Dificultad ${NOMBRE_NIVEL[dificultad].toLowerCase()}`}
                className="inline-flex items-center gap-0.5 rounded-sm border-l-[3px] px-1.5 leading-4 font-medium"
                style={{ borderColor: COLOR_NIVEL[dificultad], background: `color-mix(in srgb, ${COLOR_NIVEL[dificultad]} 22%, transparent)` }}
              >
                <ICONO_DIFICULTAD size={11} aria-hidden style={{ color: COLOR_NIVEL[dificultad] }} />
                {NOMBRE_NIVEL[dificultad]}
              </span>
            )}
            {hora(tarea) && <span className="text-tenue tabular-nums">{hora(tarea)}</span>}
            {atrasada && <span className="font-medium text-peligro">Atrasada</span>}
            {estrecha && pildora}
          </span>
        )}
      </button>
      {!estrecha && pildora}
    </li>
  );
}

const claveDia = (d: Date) => format(d, "yyyy-MM-dd");
const ZONA_DIA = "dia:";
const esZonaDia = (id: string) => id.startsWith(ZONA_DIA);

function FilaOrdenableSemana({ tarea, abierta, hoy, estrecha, dia }: { tarea: Tarea; abierta: boolean; hoy: Date; estrecha: boolean; dia: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarea.id, data: { dia } });
  return (
    <FilaTareaSemana
      tarea={tarea}
      abierta={abierta}
      hoy={hoy}
      estrecha={estrecha}
      arrastre={{ ref: setNodeRef, estilo: { transform: CSS.Translate.toString(transform), transition }, asa: { ...attributes, ...listeners }, arrastrando: isDragging }}
    />
  );
}

/** Pendientes del día: se suben o bajan arrastrando el asa (o con Espacio y las flechas), o se llevan a otro día. */
function PendientesOrdenables({ tareas, tareaAbierta, hoy, dia, estrecha = false }: { tareas: Tarea[]; tareaAbierta: string | null; hoy: Date; dia: string; estrecha?: boolean }) {
  return (
    <SortableContext id={`lista:${dia}`} items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <ul aria-label="Tareas" className="mt-2">
        {tareas.map((t) => (
          <FilaOrdenableSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={hoy} estrecha={estrecha} dia={dia} />
        ))}
      </ul>
    </SortableContext>
  );
}

/** Un día al que se puede soltar una tarea: la columna (7 días) o el botón del día (Hoy). */
function useZonaDia(dia: Date) {
  return useDroppable({ id: ZONA_DIA + claveDia(dia) });
}

/** Arrastrar dentro de la Semana: subir o bajar en el mismo día, o llevar la tarea a otro día. */
function ArrastreSemana({ ahora, children }: { ahora: Date; children: ReactNode }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const reordenar = useTienda((s) => s.reordenar);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [activa, setActiva] = useState<Tarea | null>(null);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const pendientesDe = (dia: string) => contenidoDelDia(tareas, listas, parseISO(dia), ahora).tareas.filter((t) => t.estado === "pendiente");

  const alSoltar = ({ active, over }: DragEndEvent) => {
    setActiva(null);
    if (!over || active.id === over.id) return;
    if (active.data.current?.evento) {
      // Un evento cambia de día y conserva su hora.
      const evento = tareas.find((t) => PREFIJO_EVENTO + t.id === active.id);
      const sobre = String(over.id);
      const destino = esZonaDia(sobre) ? sobre.slice(ZONA_DIA.length) : (over.data.current?.dia as string | undefined);
      if (evento && destino && destino !== active.data.current.dia) actualizarTarea(evento.id, venceEnDia(evento, parseISO(destino)));
      return;
    }
    const tarea = tareas.find((t) => t.id === active.id);
    const origen = active.data.current?.dia as string | undefined;
    if (!tarea || !origen) return;
    const sobreId = String(over.id);
    const destino = esZonaDia(sobreId) ? sobreId.slice(ZONA_DIA.length) : (over.data.current?.dia as string | undefined);
    if (!destino) return;
    const lista = pendientesDe(destino);
    if (destino === origen) {
      if (esZonaDia(sobreId)) return;
      const ids = lista.map((t) => t.id);
      void reordenar(arrayMove(ids, ids.indexOf(tarea.id), ids.indexOf(sobreId)), tarea.id);
      return;
    }
    // A otro día: queda justo antes de la tarea sobre la que cayó, o al final si cayó sobre el día.
    const indice = esZonaDia(sobreId) ? lista.length : Math.max(0, lista.findIndex((t) => t.id === sobreId));
    const orden = ordenEntre(indice > 0 ? lista[indice - 1].orden : null, indice < lista.length ? lista[indice].orden : null);
    actualizarTarea(tarea.id, { ...venceEnDia(tarea, parseISO(destino)), ...(orden !== null ? { orden } : {}) });
  };

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={colisionTareasEnZonas(esZonaDia)}
      onDragStart={({ active }) => setActiva(tareas.find((t) => t.id === active.id || PREFIJO_EVENTO + t.id === active.id) ?? null)}
      onDragEnd={alSoltar}
      onDragCancel={() => setActiva(null)}
      accessibility={{
        screenReaderInstructions: { draggable: "Pulsa Espacio para tomar la tarea, usa las flechas para subirla, bajarla o llevarla a otro día y Espacio para soltarla. Esc cancela." },
        announcements: { onDragStart: () => "Tarea tomada.", onDragOver: () => "Tarea movida.", onDragEnd: () => "Tarea soltada.", onDragCancel: () => "Movimiento cancelado." },
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {activa &&
          (activa.esEvento ? (
            <ul className="w-56 rounded-md bg-panel shadow-lg">
              <FilaEvento evento={activa} abierta={false} />
            </ul>
          ) : (
            <ul className="w-64 rounded-lg border border-acento bg-panel shadow-lg">
              <FilaTareaSemana tarea={activa} abierta={false} hoy={ahora} estrecha />
            </ul>
          ))}
      </DragOverlay>
    </DndContext>
  );
}

/** Barra de avance del día: "1/4 (25%)". */
function BarraProgreso({ hechas, total, porcentaje }: { hechas: number; total: number; porcentaje: number }) {
  return (
    <div data-testid="progreso-dia" className="mt-2 flex items-center gap-3">
      <div role="progressbar" aria-label="Avance de tareas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcentaje} className="h-2.5 flex-1 overflow-hidden rounded-full bg-suave">
        <div className="h-full rounded-full bg-acento transition-[width]" style={{ width: `${porcentaje}%` }} />
      </div>
      <span className="shrink-0 text-xs text-tenue tabular-nums">
        {hechas}/{total} ({porcentaje}%)
      </span>
    </div>
  );
}

export type TipoNuevo = "tarea" | "evento";

/**
 * Ventana para crear una tarea o un evento con todos sus datos, como la de hábitos:
 * título, fecha, (importancia y dificultad), índole, notas y subtareas.
 */
export function DialogoNuevo({ tipo, dia, alCerrar }: { tipo: TipoNuevo; dia: Date; alCerrar: () => void }) {
  const crearTarea = useTienda((s) => s.crearTarea);
  const esEvento = tipo === "evento";
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState(format(dia, "yyyy-MM-dd"));
  const [prioridad, setPrioridad] = useState<Prioridad>("ninguna");
  const [dificultad, setDificultad] = useState<Prioridad>("ninguna");
  const [indole, setIndole] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [subtareas, setSubtareas] = useState<Subtarea[]>([]);
  const [colorEvento, setColorEvento] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !fecha) return;
    await crearTarea({
      titulo,
      esEvento,
      colorEvento: esEvento ? colorEvento : null,
      vence: fecha,
      todoElDia: true,
      prioridad: esEvento ? "ninguna" : prioridad,
      dificultad: esEvento ? "ninguna" : dificultad,
      etiquetas: indole ? [indole] : [],
      descripcion: notas,
      subtareas,
    });
    alCerrar();
  };

  return (
    <Modal titulo={esEvento ? "Nuevo evento" : "Nueva tarea"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-xs text-tenue">
          <span className={`${claseTituloCampo} block`}>{esEvento ? "Evento" : "Tarea"}</span>
          <input
            id="entrada-rapida"
            autoFocus
            autoComplete="off"
            aria-label={esEvento ? "Añadir evento" : "Añadir tarea"}
            className={claseCampo}
            placeholder={esEvento ? "Entrevista de trabajo" : "Leer paper"}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>
        <label className="block text-xs text-tenue">
          <span className={`${claseTituloCampo} block`}>Fecha</span>
          <input type="date" required aria-label="Fecha" className={claseCampo} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        {esEvento && <SelectorColorEvento valor={colorEvento} alElegir={setColorEvento} />}
        {!esEvento && (
          <>
            <SelectorNivel titulo="Importancia" ayuda="Urgencia y valor" valor={prioridad} alElegir={setPrioridad} />
            <SelectorNivel titulo="Dificultad" ayuda="Tiempo y esfuerzo intelectual" icono={ICONO_DIFICULTAD} valor={dificultad} alElegir={setDificultad} />
          </>
        )}
        <SelectorIndole valor={indole} alElegir={setIndole} />
        <CampoNotas valor={notas} alCambiar={setNotas} />
        <EditorSubtareas subtareas={subtareas} alCambiar={setSubtareas} />
        <div className="flex justify-end gap-2">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!titulo.trim() || !fecha}>
            {esEvento ? "Crear evento" : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** El + de la semana: tarea, evento o hábito. */
export function MenuNuevo({ alElegir, etiqueta = "Añadir", atajo = true, pequeno = false, abrirHacia = "izquierda" }: { alElegir: (tipo: TipoNuevo | "habito") => void; etiqueta?: string; atajo?: boolean; pequeno?: boolean; abrirHacia?: "izquierda" | "derecha" }) {
  const [abierto, setAbierto] = useState(false);
  const opciones: { tipo: TipoNuevo | "habito"; nombre: string; icono: ReactNode }[] = [
    { tipo: "tarea", nombre: "Tarea", icono: <CheckSquare size={16} /> },
    { tipo: "evento", nombre: "Evento", icono: <CalendarClock size={16} /> },
    { tipo: "habito", nombre: "Hábito", icono: <Flame size={16} /> },
  ];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        data-nueva-tarea={atajo ? "" : undefined}
        aria-label={etiqueta}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Añadir tarea, evento o hábito"
        className={`flex items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90 ${pequeno ? "h-6 w-6" : "h-8 w-8"}`}
        onClick={() => setAbierto((a) => !a)}
      >
        <Plus size={pequeno ? 15 : 18} />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div role="menu" aria-label={etiqueta} className={`absolute ${abrirHacia === "derecha" ? "left-0" : "right-0"} z-20 mt-1 w-40 rounded-lg border border-borde bg-panel p-1 shadow-lg`}>
            {opciones.map((o) => (
              <button
                key={o.tipo}
                type="button"
                role="menuitem"
                data-crear={o.tipo}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-suave"
                onClick={() => {
                  setAbierto(false);
                  alElegir(o.tipo);
                }}
              >
                <span className="text-tenue">{o.icono}</span>
                {o.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export type Alcance = "dia" | "semana";
const EN_WIDGET = WIDGET_ACTUAL?.id === "semana";
// El widget recuerda "Hoy" o "7 días" aparte de la ventana grande, y parte en 7 días.
const CLAVE_ALCANCE = EN_WIDGET ? "andamia-semana-alcance-widget" : "andamia-semana-alcance";

/** La vista de 7 días es solo para pantallas de computador (1024 px o más). */
const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

function useEsEscritorio(): boolean {
  // El widget Semana del escritorio siempre ofrece los 7 días, aunque la ventana sea angosta.
  const [es, setEs] = useState(() => EN_WIDGET || (typeof window !== "undefined" && window.matchMedia(CONSULTA_ESCRITORIO).matches));
  useEffect(() => {
    const m = window.matchMedia(CONSULTA_ESCRITORIO);
    const alCambiar = () => setEs(EN_WIDGET || m.matches);
    m.addEventListener("change", alCambiar);
    return () => m.removeEventListener("change", alCambiar);
  }, []);
  return es;
}

function leerAlcance(): Alcance {
  try {
    const guardado = localStorage.getItem(CLAVE_ALCANCE);
    return guardado === "semana" || (EN_WIDGET && guardado === null) ? "semana" : "dia";
  } catch {
    return "dia";
  }
}

/** Eventos y la tarjeta de tareas (pendientes ordenables y completadas) de un día. */
function ContenidoDia({ dia, ahora, verEventos, verTareas, tareaAbierta, compacto }: { dia: Date; ahora: Date; verEventos: boolean; verTareas: boolean; tareaAbierta: string | null; compacto: boolean }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const contenido = contenidoDelDia(tareas, listas, dia, ahora);
  const pendientes = contenido.tareas.filter((t) => t.estado === "pendiente");
  const hechas = contenido.tareas.filter((t) => t.estado === "completada");
  const esHoy = isSameDay(dia, ahora);

  if (compacto && (!verEventos || contenido.eventos.length === 0) && (!verTareas || contenido.tareas.length === 0)) {
    return <p className="px-1 py-1 text-sm text-tenue">Nada este día.</p>;
  }

  return (
    <>
      {verEventos && contenido.eventos.length > 0 && (
        <ul aria-label="Eventos" className="mb-3 space-y-1">
          {contenido.eventos.map((e) => (
            <EventoArrastrable key={e.id} evento={e} abierta={e.id === tareaAbierta} dia={claveDia(dia)} />
          ))}
        </ul>
      )}
      {!compacto && !verTareas && contenido.eventos.length === 0 && <p className="mt-8 text-center text-sm text-tenue">No hay eventos este día. Toca + para añadir.</p>}

      {verTareas && (!compacto || contenido.tareas.length > 0) && (
        <div data-testid="tarjeta-tareas" className="overflow-hidden rounded-xl border border-borde bg-panel">
          <section aria-label="Tareas del día" className="px-2 pt-3 pb-2">
            <div className="px-2">
              <h2 className="text-sm font-semibold">{esHoy ? "Tareas hoy" : "Tareas del día"}</h2>
              <BarraProgreso {...contenido.progreso} />
            </div>
            {pendientes.length > 0 ? (
              <PendientesOrdenables tareas={pendientes} tareaAbierta={tareaAbierta} hoy={ahora} dia={claveDia(dia)} estrecha={compacto} />
            ) : (
              <p className="px-2 py-4 text-sm text-tenue">{hechas.length ? "¡Todo listo por hoy!" : "No hay tareas este día. Toca + para añadir."}</p>
            )}
          </section>
          {(!compacto || hechas.length > 0) && (
            <section aria-label="Completadas" data-testid="tarjeta-completada" className="border-t border-borde px-2 pt-3 pb-2">
              <h2 className="px-2 text-sm font-semibold text-tenue">Completadas</h2>
              {hechas.length > 0 ? (
                <ul className="mt-1">
                  {hechas.map((t) => (
                    <FilaTareaSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={ahora} estrecha={compacto} />
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-3 text-sm text-tenue">Aún no completas tareas este día.</p>
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}

/** Día que otra vista pidió mostrar (el "n más" del mes). Se usa una vez al abrir la Semana. */
let diaPedido: Date | null = null;

/** Abre la Semana en la vista "Hoy" con ese día elegido. */
export function verDiaEnSemana(dia: Date) {
  diaPedido = dia;
  try {
    localStorage.setItem(CLAVE_ALCANCE, "dia");
  } catch {
    // Sin almacenamiento igual abre en "Hoy": diaPedido manda.
  }
  irA({ tipo: "vista", vista: "semana" });
}

/** Botón de un día en la tira de arriba; también recibe tareas soltadas. */
function BotonDia({ dia, activo, ahora, alElegir }: { dia: Date; activo: boolean; ahora: Date; alElegir: () => void }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const { setNodeRef, isOver } = useZonaDia(dia);
  const esHoy = isSameDay(dia, ahora);
  const conAlgo = hayAlgoElDia(tareas, listas, dia, ahora);
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={activo}
      aria-label={format(dia, "EEEE d 'de' MMMM", { locale: es })}
      onClick={alElegir}
      data-testid="boton-dia"
      className={`flex flex-col items-center gap-0.5 rounded-lg py-1 hover:bg-suave ${isOver ? "bg-acento-suave ring-2 ring-acento" : ""}`}
    >
      <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(dia)}</span>
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums ${activo ? "bg-acento font-semibold text-sobre-acento" : esHoy ? "border-2 border-acento font-semibold" : ""}`}>
        {format(dia, "d")}
      </span>
      <span data-testid={conAlgo ? "punto-dia" : undefined} className={`h-1.5 w-1.5 rounded-full ${conAlgo ? "bg-acento" : "bg-transparent"}`} />
    </button>
  );
}

/** Columna de un día en la vista de 7 días; también recibe tareas soltadas. */
function ColumnaDia({ dia, esHoy, ahora, estilo, refColumna, angosta = false, children }: { dia: Date; esHoy: boolean; ahora: Date; estilo: CSSProperties; refColumna: (el: HTMLElement | null) => void; angosta?: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useZonaDia(dia);
  return (
    <section
      ref={(el) => {
        setNodeRef(el);
        refColumna(el);
      }}
      style={estilo}
      aria-label={tituloDelDia(dia, ahora)}
      data-testid="dia-semana"
      data-angosta={angosta ? "" : undefined}
      className={`min-w-0 rounded-xl ${angosta ? "p-1.5" : "p-2"} ${isOver ? "ring-2 ring-acento" : ""} ${esHoy ? "bg-acento-suave" : "bg-suave/60"}`}
    >
      {children}
    </section>
  );
}

/** Borde entre dos columnas: se arrastra para cambiar el ancho; doble clic vuelve a automático. */
function BordeColumna({ etiqueta, alMover, alSoltar, alRestablecer }: { etiqueta: string; alMover: (dx: number, inicio: boolean) => void; alSoltar: () => void; alRestablecer: () => void }) {
  const inicio = useRef<number | null>(null);
  const tecla = (e: EventoTeclado) => {
    const paso = e.key === "ArrowLeft" ? -24 : e.key === "ArrowRight" ? 24 : 0;
    if (!paso) return;
    e.preventDefault();
    alMover(paso, true);
    alSoltar();
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={etiqueta}
      title="Arrastra para cambiar el ancho. Doble clic: ancho automático."
      tabIndex={0}
      data-testid="borde-columna"
      className="group flex w-3 shrink-0 cursor-col-resize touch-none justify-center outline-none"
      onPointerDown={(e: EventoPuntero) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        inicio.current = e.clientX;
        alMover(0, true);
      }}
      onPointerMove={(e: EventoPuntero) => {
        if (inicio.current !== null) alMover(e.clientX - inicio.current, false);
      }}
      onPointerUp={() => {
        if (inicio.current === null) return;
        inicio.current = null;
        alSoltar();
      }}
      onLostPointerCapture={() => {
        if (inicio.current === null) return;
        inicio.current = null;
        alSoltar();
      }}
      onDoubleClick={alRestablecer}
      onKeyDown={tecla}
    >
      <span className="my-2 w-0.5 rounded-full bg-transparent transition-colors group-hover:bg-acento/60 group-focus-visible:bg-acento" />
    </div>
  );
}

/** Ancho de un día sin tareas por hacer en la vista de 7 días: una tira angosta con el día y un resumen. */
const ANCHO_DIA_LIBRE = "65px";

/** Contenido de un día angosto: sus eventos (cortos) y, si tiene tareas, un "✓ hechas/total" que abre el día. */
function ResumenDiaAngosto({ dia, ahora, verEventos, verTareas, tareaAbierta, alAbrir }: { dia: Date; ahora: Date; verEventos: boolean; verTareas: boolean; tareaAbierta: string | null; alAbrir: () => void }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const contenido = contenidoDelDia(tareas, listas, dia, ahora);
  const { hechas, total } = contenido.progreso;
  return (
    <div data-testid="resumen-angosto" className="space-y-1.5">
      {verEventos && contenido.eventos.length > 0 && (
        <ul aria-label="Eventos" className="space-y-1">
          {contenido.eventos.map((e) => (
            <EventoArrastrable key={e.id} evento={e} abierta={e.id === tareaAbierta} dia={claveDia(dia)} />
          ))}
        </ul>
      )}
      {verTareas && total > 0 && (
        <button
          type="button"
          onClick={alAbrir}
          title={`${hechas} de ${total} tareas hechas. Toca para ver el día.`}
          className="flex w-full items-center justify-center gap-1 rounded-lg bg-panel px-1 py-1.5 text-xs font-medium text-tenue tabular-nums hover:text-texto"
        >
          <Check size={13} strokeWidth={3} className="shrink-0 text-acento" />
          {hechas}/{total}
        </button>
      )}
    </div>
  );
}

/** Anchos de las 7 columnas: automáticos (los días vacíos se achican) o ajustados a mano. */
function useAnchosSemana(lunes: string, vacios: boolean[]) {
  const [manual, setManual] = useState<number[] | null>(() => leerAnchos(lunes));
  const [semana, setSemana] = useState(lunes);
  if (semana !== lunes) {
    setSemana(lunes);
    setManual(leerAnchos(lunes));
  }
  const columnas = useRef<(HTMLElement | null)[]>([]);
  const base = useRef<number[]>([]);
  const actual = useRef<number[] | null>(manual);
  actual.current = manual;

  const pesos = manual ?? pesosAutomaticos(vacios);
  // Automático: los días sin tareas por hacer quedan con un ancho fijo mínimo y el resto se reparte.
  const estilo = (i: number): CSSProperties =>
    manual ? { flex: `${pesos[i]} 1 0px`, minWidth: MINIMO_MANUAL } : vacios[i] ? { flex: `0 0 ${ANCHO_DIA_LIBRE}` } : { flex: "1 1 0px", minWidth: "10rem" };
  const mover = (i: number) => (dx: number, inicio: boolean) => {
    if (inicio || !base.current.length) base.current = columnas.current.map((c) => c?.getBoundingClientRect().width ?? MINIMO_MANUAL);
    if (dx === 0) return;
    const nuevos = moverBorde(base.current, i, dx);
    actual.current = nuevos;
    setManual(nuevos);
  };
  const soltar = () => {
    base.current = [];
    if (actual.current) guardarAnchos(lunes, actual.current);
  };
  const restablecer = () => {
    actual.current = null;
    base.current = [];
    setManual(null);
    guardarAnchos(lunes, null);
  };
  const refColumna = (i: number) => (el: HTMLElement | null) => {
    columnas.current[i] = el;
  };
  const angosta = (i: number) => vacios[i];
  return { estilo, angosta, mover, soltar, restablecer, refColumna };
}

/**
 * Widget Semana del PC: la ventana toma el alto justo de su contenido, para que no quede espacio
 * vacío abajo. Mide cabecera + contenido y se lo pide a la app de PC (escritorio/precarga-widget.cjs).
 */
function useAltoAjustadoWidget(cabecera: { current: HTMLElement | null }, contenido: { current: HTMLElement | null }, deps: unknown[]) {
  useEffect(() => {
    const puente = (window as unknown as { andamiaWidget?: { ajustarAlto?: (alto: number) => void } }).andamiaWidget;
    if (!EN_WIDGET || !puente?.ajustarAlto) return;
    let reloj = 0;
    const medir = () => {
      window.clearTimeout(reloj);
      reloj = window.setTimeout(() => {
        const c = cabecera.current;
        const d = contenido.current;
        const caja = d?.parentElement;
        if (!c || !d || !caja || !caja.offsetHeight) return;
        // Con el zoom del widget, el tamaño en pantalla es el tamaño CSS por el zoom.
        const zoom = caja.getBoundingClientRect().height / caja.offsetHeight || 1;
        const s = getComputedStyle(caja);
        const natural = d.offsetHeight + parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
        puente.ajustarAlto!(Math.ceil(c.getBoundingClientRect().height + natural * zoom) + 2);
      }, 120);
    };
    medir();
    const obs = new ResizeObserver(medir);
    if (cabecera.current) obs.observe(cabecera.current);
    if (contenido.current) obs.observe(contenido.current);
    return () => {
      obs.disconnect();
      window.clearTimeout(reloj);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function VistaSemana({ tareaAbierta }: { tareaAbierta: string | null }) {
  const ahora = new Date();
  const [elegido, setElegido] = useState(() => diaPedido ?? new Date());
  const [filtro, setFiltro] = useState<FiltroSemana>("todos");
  const [alcanceGuardado, setAlcanceEstado] = useState<Alcance>(() => (diaPedido ? "dia" : leerAlcance()));
  useEffect(() => {
    diaPedido = null;
  }, []);
  const esEscritorio = useEsEscritorio();
  const alcance: Alcance = esEscritorio ? alcanceGuardado : "dia";
  const [creando, setCreando] = useState<TipoNuevo | "habito" | null>(null);
  // Día para el que se crea: el elegido, o el de la columna donde se tocó el +.
  const [diaNuevo, setDiaNuevo] = useState(() => new Date());
  const nuevoEn = (tipo: TipoNuevo | "habito", dia: Date) => {
    setDiaNuevo(dia);
    setCreando(tipo);
  };

  const setAlcance = (a: Alcance) => {
    setAlcanceEstado(a);
    try {
      localStorage.setItem(CLAVE_ALCANCE, a);
    } catch {
      // Sin almacenamiento: se recuerda solo mientras la página siga abierta.
    }
  };

  const dias = diasDeSemana(elegido);
  const verEventos = filtro !== "tareas";
  const verTareas = filtro !== "eventos";
  const mesCorto = format(elegido, "MMM", { locale: es }).replace(".", "");
  const mes = (mesCorto.charAt(0).toUpperCase() + mesCorto.slice(1)) + (elegido.getFullYear() !== ahora.getFullYear() ? ` ${elegido.getFullYear()}` : "");

  const tareasTodas = useTienda((s) => s.tareas);
  const listasTodas = useTienda((s) => s.listas);
  // Solo los días con tareas por hacer se llevan el ancho; los que no tienen nada o ya están
  // completos quedan lo más angostos posible. Con el filtro "Eventos", cuentan los eventos.
  const vacios = dias.map((d) => {
    const c = contenidoDelDia(tareasTodas, listasTodas, d, ahora);
    return verTareas ? !c.tareas.some((t) => t.estado === "pendiente") : !verEventos || c.eventos.length === 0;
  });
  const anchos = useAnchosSemana(claveDia(dias[0]), vacios);

  const moverSemana = (semanas: number) => setElegido((d) => addDays(d, semanas * 7));
  const elegirDia = (d: Date) => setElegido(d);
  const refCabecera = useRef<HTMLElement>(null);
  const refContenido = useRef<HTMLDivElement>(null);
  useAltoAjustadoWidget(refCabecera, refContenido, [alcance, filtro, elegido.toDateString(), tareasTodas]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ArrastreSemana ahora={ahora}>
      <header ref={refCabecera} className={`px-4 sm:px-6 ${EN_WIDGET ? "pt-1 pb-1 pr-16 sm:pr-16" : "pt-4 pb-2"}`}>
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Semana anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h1 className="px-0.5 text-center text-lg font-semibold" title={format(elegido, "MMMM yyyy", { locale: es })}>
              {mes}
            </h1>
            <button type="button" aria-label="Semana siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => moverSemana(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          {esEscritorio && (
            <div role="group" aria-label="Ver" className="ml-auto flex gap-0.5 rounded-md bg-suave p-0.5">
              {(
                [
                  { id: "dia", nombre: "Día" },
                  { id: "semana", nombre: "7 Días" },
                ] as const
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={alcance === o.id}
                  onClick={() => setAlcance(o.id)}
                  className={`rounded px-2.5 py-1 text-xs ${alcance === o.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
                >
                  {o.nombre}
                </button>
              ))}
            </div>
          )}
          <div role="group" aria-label="Mostrar" className={`${esEscritorio ? "" : "ml-auto "}flex min-w-0 gap-0.5 rounded-md bg-suave p-0.5`}>
            {FILTROS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
                className={`rounded px-2 py-1 text-xs sm:px-2.5 ${filtro === f.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
          {alcance === "dia" && <MenuNuevo alElegir={(tipo) => nuevoEn(tipo, elegido)} />}
        </div>


        {alcance === "dia" && (
        <div className="mt-2 grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
          {dias.map((d) => (
            <BotonDia key={d.toISOString()} dia={d} activo={isSameDay(d, elegido)} ahora={ahora} alElegir={() => elegirDia(d)} />
          ))}
        </div>
        )}
      </header>

      {alcance === "dia" ? (
        <div className={`min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 ${EN_WIDGET ? "pb-3" : "pb-8"}`}>
          <div ref={refContenido}>
            <ContenidoDia dia={elegido} ahora={ahora} verEventos={verEventos} verTareas={verTareas} tareaAbierta={tareaAbierta} compacto={false} />
          </div>
        </div>
      ) : (
        // En el computador: los 7 días uno al lado del otro, cada uno en su columna.
        <div className={`min-h-0 flex-1 overflow-auto px-4 sm:px-6 ${EN_WIDGET ? "pt-1 pb-3" : "pt-2 pb-6"}`}>
          {/* En el widget las columnas terminan donde termina el día más largo (sin espacio vacío abajo). */}
          <div ref={refContenido} className={`flex ${EN_WIDGET ? "" : "min-h-full"}`}>
            {dias.map((d, i) => {
              const esHoy = isSameDay(d, ahora);
              const angosta = anchos.angosta(i);
              const etiquetaNuevo = `Añadir el ${format(d, "EEEE d", { locale: es })}`;
              const atajo = dias.some((x) => isSameDay(x, ahora)) ? esHoy : i === 0;
              if (angosta) {
                return (
                  <Fragment key={d.toISOString()}>
                  {i > 0 && (
                    <BordeColumna
                      etiqueta={`Ancho entre ${nombreCortoDia(dias[i - 1])} y ${nombreCortoDia(d)}`}
                      alMover={anchos.mover(i - 1)}
                      alSoltar={anchos.soltar}
                      alRestablecer={anchos.restablecer}
                    />
                  )}
                  <ColumnaDia dia={d} esHoy={esHoy} ahora={ahora} estilo={anchos.estilo(i)} refColumna={anchos.refColumna(i)} angosta>
                    <div className="mb-2 flex flex-col items-center gap-1">
                      <h2 className="flex flex-col items-center leading-tight">
                        <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(d)}</span>
                        <span className={`text-lg font-semibold tabular-nums ${esHoy ? "text-acento" : ""}`}>{format(d, "d")}</span>
                      </h2>
                      <MenuNuevo pequeno etiqueta={etiquetaNuevo} atajo={atajo} abrirHacia={i < 4 ? "derecha" : "izquierda"} alElegir={(tipo) => nuevoEn(tipo, d)} />
                    </div>
                    <ResumenDiaAngosto
                      dia={d}
                      ahora={ahora}
                      verEventos={verEventos}
                      verTareas={verTareas}
                      tareaAbierta={tareaAbierta}
                      alAbrir={() => {
                        setElegido(d);
                        setAlcance("dia");
                      }}
                    />
                  </ColumnaDia>
                  </Fragment>
                );
              }
              return (
                <Fragment key={d.toISOString()}>
                {i > 0 && (
                  <BordeColumna
                    etiqueta={`Ancho entre ${nombreCortoDia(dias[i - 1])} y ${nombreCortoDia(d)}`}
                    alMover={anchos.mover(i - 1)}
                    alSoltar={anchos.soltar}
                    alRestablecer={anchos.restablecer}
                  />
                )}
                <ColumnaDia dia={d} esHoy={esHoy} ahora={ahora} estilo={anchos.estilo(i)} refColumna={anchos.refColumna(i)}>
                  <div className="mb-2 flex items-center gap-1 px-1">
                    <h2 className="flex min-w-0 flex-1 items-baseline gap-1.5">
                      <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(d)}</span>
                      <span className={`text-lg font-semibold tabular-nums ${esHoy ? "text-acento" : ""}`}>{format(d, "d")}</span>
                      {esHoy && <span className="text-xs font-medium text-acento">Hoy</span>}
                    </h2>
                    {/* El atajo N abre el + de hoy, o el del lunes si hoy no está en la semana. */}
                    <MenuNuevo
                      pequeno
                      etiqueta={`Añadir el ${format(d, "EEEE d", { locale: es })}`}
                      atajo={dias.some((x) => isSameDay(x, ahora)) ? esHoy : i === 0}
                      alElegir={(tipo) => nuevoEn(tipo, d)}
                    />
                  </div>
                  <ContenidoDia dia={d} ahora={ahora} verEventos={verEventos} verTareas={verTareas} tareaAbierta={tareaAbierta} compacto />
                </ColumnaDia>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      </ArrastreSemana>

      {(creando === "tarea" || creando === "evento") && <DialogoNuevo tipo={creando} dia={diaNuevo} alCerrar={() => setCreando(null)} />}
      {creando === "habito" && <DialogoHabito habito={null} alCerrar={() => setCreando(null)} />}
    </div>
  );
}
