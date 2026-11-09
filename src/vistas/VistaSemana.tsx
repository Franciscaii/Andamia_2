import { useEffect, useState, type CSSProperties, type FormEvent, type HTMLAttributes, type ReactNode } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CampoNotas, claseTituloCampo, EditorSubtareas, ICONO_DIFICULTAD, SelectorIndole, SelectorNivel } from "../componentes/CamposTarea";
import { addDays, format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarClock, Check, CheckSquare, ChevronLeft, ChevronRight, Flame, GripVertical, Plus } from "lucide-react";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { DialogoHabito } from "./VistaHabitos";
import { COLOR_NIVEL } from "../componentes/FilaTarea";
import { useTienda } from "../datos/tienda";
import { fechaDeTarea } from "../logica/fechas";
import { irA, type Seccion } from "../logica/ruta";
import { contenidoDelDia, dificultadDe, diasDeSemana, hayAlgoElDia, nombreCortoDia, tituloDelDia, type FiltroSemana } from "../logica/semana";
import type { Prioridad, Subtarea, Tarea } from "../modelos/tipos";

const SECCION: Seccion = { tipo: "vista", vista: "semana" };

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

export function FilaEvento({ evento, abierta }: { evento: Tarea; abierta: boolean }) {
  return (
    <li>
      <button
        type="button"
        data-testid="fila-evento"
        onClick={() => irA(SECCION, evento.id)}
        className={`flex w-full items-center gap-2 rounded-md border-l-4 px-3 py-1.5 text-left text-sm ${abierta ? "ring-2 ring-acento" : ""}`}
        style={{ borderColor: "var(--evento)", background: "var(--evento-suave)" }}
      >
        <span className="min-w-0 flex-1 truncate font-medium">{evento.titulo || "Sin título"}</span>
        {hora(evento) && <span className="shrink-0 text-xs text-tenue tabular-nums">{hora(evento)}</span>}
      </button>
    </li>
  );
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
  const colorCasilla = COLOR_NIVEL[tarea.prioridad];
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
      className={`flex items-center gap-2.5 rounded-lg py-2 ${arrastre ? "pr-2 pl-0.5" : "px-2"} ${abierta ? "bg-acento-suave" : "hover:bg-suave"} ${arrastre?.arrastrando ? "relative z-10 bg-panel shadow-lg" : ""}`}
    >
      {arrastre && (
        <button type="button" aria-label={`Mover ${tarea.titulo}`} title="Arrastra para subir o bajar" className="-mr-1.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-tenue opacity-60 hover:opacity-100" {...arrastre.asa}>
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

function FilaOrdenableSemana({ tarea, abierta, hoy, estrecha }: { tarea: Tarea; abierta: boolean; hoy: Date; estrecha: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tarea.id });
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

/** Pendientes del día: se suben o bajan arrastrando el asa (o con Espacio y las flechas). */
function PendientesOrdenables({ tareas, tareaAbierta, hoy, estrecha = false }: { tareas: Tarea[]; tareaAbierta: string | null; hoy: Date; estrecha?: boolean }) {
  const reordenar = useTienda((s) => s.reordenar);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const ids = tareas.map((t) => t.id);
    void reordenar(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))), String(active.id));
  };
  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      onDragEnd={alSoltar}
      accessibility={{
        screenReaderInstructions: { draggable: "Pulsa Espacio para tomar la tarea, usa las flechas para subirla o bajarla y Espacio para soltarla. Esc cancela." },
        announcements: { onDragStart: () => "Tarea tomada.", onDragOver: () => "Tarea movida.", onDragEnd: () => "Tarea soltada.", onDragCancel: () => "Movimiento cancelado." },
      }}
    >
      <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label="Tareas" className="mt-2">
          {tareas.map((t) => (
            <FilaOrdenableSemana key={t.id} tarea={t} abierta={t.id === tareaAbierta} hoy={hoy} estrecha={estrecha} />
          ))}
        </ul>
      </SortableContext>
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

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;
    await crearTarea({
      titulo,
      esEvento,
      vence: fecha || null,
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
          <input type="date" aria-label="Fecha" className={claseCampo} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
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
          <button type="submit" className={claseBotonPrincipal} disabled={!titulo.trim()}>
            {esEvento ? "Crear evento" : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** El + de la semana: tarea, evento o hábito. */
export function MenuNuevo({ alElegir }: { alElegir: (tipo: TipoNuevo | "habito") => void }) {
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
        data-nueva-tarea
        aria-label="Añadir"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Añadir tarea, evento o hábito"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90"
        onClick={() => setAbierto((a) => !a)}
      >
        <Plus size={18} />
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} />
          <div role="menu" aria-label="Añadir" className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-borde bg-panel p-1 shadow-lg">
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
const CLAVE_ALCANCE = "andamia-semana-alcance";

/** La vista de 7 días es solo para pantallas de computador (1024 px o más). */
const CONSULTA_ESCRITORIO = "(min-width: 1024px)";

function useEsEscritorio(): boolean {
  const [es, setEs] = useState(() => typeof window !== "undefined" && window.matchMedia(CONSULTA_ESCRITORIO).matches);
  useEffect(() => {
    const m = window.matchMedia(CONSULTA_ESCRITORIO);
    const alCambiar = () => setEs(m.matches);
    m.addEventListener("change", alCambiar);
    return () => m.removeEventListener("change", alCambiar);
  }, []);
  return es;
}

function leerAlcance(): Alcance {
  try {
    return localStorage.getItem(CLAVE_ALCANCE) === "semana" ? "semana" : "dia";
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
            <FilaEvento key={e.id} evento={e} abierta={e.id === tareaAbierta} />
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
              <PendientesOrdenables tareas={pendientes} tareaAbierta={tareaAbierta} hoy={ahora} estrecha={compacto} />
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

export function VistaSemana({ tareaAbierta }: { tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const ahora = new Date();
  const [elegido, setElegido] = useState(() => new Date());
  const [filtro, setFiltro] = useState<FiltroSemana>("todos");
  const [alcanceGuardado, setAlcanceEstado] = useState<Alcance>(leerAlcance);
  const esEscritorio = useEsEscritorio();
  const alcance: Alcance = esEscritorio ? alcanceGuardado : "dia";
  const [creando, setCreando] = useState<TipoNuevo | "habito" | null>(null);

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

  const moverSemana = (semanas: number) => setElegido((d) => addDays(d, semanas * 7));
  const elegirDia = (d: Date) => setElegido(d);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-4 pb-2 sm:px-6">
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
                  { id: "semana", nombre: "7 días" },
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
          <MenuNuevo alElegir={setCreando} />
        </div>


        {alcance === "dia" && (
        <div className="mt-2 grid grid-cols-7 gap-1" role="group" aria-label="Días de la semana">
          {dias.map((d) => {
            const activo = isSameDay(d, elegido);
            const esHoy = isSameDay(d, ahora);
            const conAlgo = hayAlgoElDia(tareas, listas, d, ahora);
            return (
              <button
                key={d.toISOString()}
                type="button"
                aria-pressed={alcance === "dia" && activo}
                aria-label={format(d, "EEEE d 'de' MMMM", { locale: es })}
                onClick={() => elegirDia(d)}
                className="flex flex-col items-center gap-0.5 rounded-lg py-1 hover:bg-suave"
              >
                <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(d)}</span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm tabular-nums ${alcance === "dia" && activo ? "bg-acento font-semibold text-sobre-acento" : esHoy ? "border-2 border-acento font-semibold" : ""}`}>
                  {format(d, "d")}
                </span>
                <span data-testid={conAlgo ? "punto-dia" : undefined} className={`h-1.5 w-1.5 rounded-full ${conAlgo ? "bg-acento" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
        )}
      </header>

      {alcance === "dia" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
          <ContenidoDia dia={elegido} ahora={ahora} verEventos={verEventos} verTareas={verTareas} tareaAbierta={tareaAbierta} compacto={false} />
        </div>
      ) : (
        // En el computador: los 7 días uno al lado del otro, cada uno en su columna.
        <div className="min-h-0 flex-1 overflow-auto px-4 pt-2 pb-6 sm:px-6">
          <div className="grid min-h-full grid-cols-[repeat(7,minmax(10rem,1fr))] gap-3">
            {dias.map((d) => {
              const esHoy = isSameDay(d, ahora);
              return (
                <section key={d.toISOString()} aria-label={tituloDelDia(d, ahora)} data-testid="dia-semana" className={`min-w-0 rounded-xl p-2 ${esHoy ? "bg-acento-suave" : "bg-suave/60"}`}>
                  <h2 className="mb-2 flex items-baseline gap-1.5 px-1">
                    <span className={`text-xs ${esHoy ? "font-semibold text-acento" : "text-tenue"}`}>{nombreCortoDia(d)}</span>
                    <span className={`text-lg font-semibold tabular-nums ${esHoy ? "text-acento" : ""}`}>{format(d, "d")}</span>
                    {esHoy && <span className="text-xs font-medium text-acento">Hoy</span>}
                  </h2>
                  <ContenidoDia dia={d} ahora={ahora} verEventos={verEventos} verTareas={verTareas} tareaAbierta={tareaAbierta} compacto />
                </section>
              );
            })}
          </div>
        </div>
      )}

      {(creando === "tarea" || creando === "evento") && <DialogoNuevo tipo={creando} dia={elegido} alCerrar={() => setCreando(null)} />}
      {creando === "habito" && <DialogoHabito habito={null} alCerrar={() => setCreando(null)} />}
    </div>
  );
}
