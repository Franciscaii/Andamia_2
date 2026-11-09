import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { addMonths, addWeeks, format, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { colisionPunteroOTeclado } from "../componentes/colision";
import { datosDesdeEntrada } from "../componentes/EntradaRapida";
import { COLOR_NIVEL, COLOR_PRIORIDAD } from "../componentes/FilaTarea";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { claveDia, diasDeMes, diasDeSemana, entradasDelDia, entradasEnRango, venceEnDia, venceEnHora, type EntradaCalendario } from "../logica/calendario";
import { interpretarEntrada } from "../logica/entradaRapida";
import { hashDe, irA, type ModoCalendario } from "../logica/ruta";
import type { FiltroSemana } from "../logica/semana";
import { DialogoHabito } from "./VistaHabitos";
import { DialogoNuevo, FILTROS, MenuNuevo, verDiaEnSemana, type TipoNuevo } from "./VistaSemana";
import type { Tarea } from "../modelos/tipos";

const NOMBRES_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HORAS = Array.from({ length: 24 }, (_, i) => i);
/** Medidas de una celda del mes, en px: número del día con sus márgenes, cada entrada y el "n más". */
const ALTO_CABECERA_CELDA = 32;
const ALTO_ENTRADA = 21;
const ALTO_MAS = 16;

/** Cuántas entradas caben en una celda de `alto` px; si no caben todas, se reserva lugar para "n más". */
function entradasQueCaben(alto: number, total: number): number {
  const libre = alto - ALTO_CABECERA_CELDA;
  if (total * ALTO_ENTRADA <= libre) return total;
  return Math.max(1, Math.floor((libre - ALTO_MAS) / ALTO_ENTRADA));
}
const ALTO_HORA = 48;
const PREFIJO_TAREA = "tarea:";

interface PropsChip {
  tarea: Tarea;
  fecha: Date | null;
  esOcurrencia?: boolean;
  idArrastre?: string;
  alAbrir: () => void;
}

function contenidoChip(tarea: Tarea, fecha: Date | null, esOcurrencia: boolean) {
  return (
    <>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR_PRIORIDAD[tarea.prioridad] }} />
      {fecha && !tarea.todoElDia && <span className="shrink-0 text-tenue">{format(fecha, "HH:mm")}</span>}
      <span className={`truncate ${tarea.estado === "completada" ? "line-through" : ""}`}>{tarea.titulo || "Sin título"}</span>
      {(tarea.repeticion || esOcurrencia) && <Repeat size={11} className="ml-auto hidden shrink-0 text-tenue sm:block" />}
    </>
  );
}

/** En el mes: el evento en un recuadro morado y la tarea con su casilla, como en la Semana. */
function ChipMes({ tarea, fecha, esOcurrencia = false, idArrastre, alAbrir }: PropsChip) {
  const completarTarea = useTienda((s) => s.completarTarea);
  const movible = !esOcurrencia && tarea.estado === "pendiente";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre ?? PREFIJO_TAREA + tarea.id, disabled: !movible });
  const hecha = tarea.estado === "completada";
  const evento = tarea.esEvento === true;
  const color = COLOR_NIVEL[tarea.prioridad];
  return (
    <div
      ref={setNodeRef}
      data-testid="chip-tarea"
      data-entrada
      role="button"
      tabIndex={0}
      title={tarea.titulo}
      onClick={(e) => {
        e.stopPropagation();
        alAbrir();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") alAbrir();
      }}
      className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded px-0.5 py-0.5 text-left text-[11px] leading-tight sm:text-xs ${
        evento ? "border-l-[3px] font-medium" : "hover:bg-suave"
      } ${movible ? "cursor-grab touch-none" : "cursor-pointer"} ${esOcurrencia ? "opacity-55" : ""} ${isDragging ? "opacity-30" : ""}`}
      style={evento ? { borderColor: "var(--evento)", background: "var(--evento-suave)" } : undefined}
      {...(movible ? { ...attributes, ...listeners } : {})}
    >
      {!evento && (
        <button
          type="button"
          role="checkbox"
          aria-checked={hecha}
          aria-label={hecha ? `Marcar como pendiente: ${tarea.titulo}` : `Completar: ${tarea.titulo}`}
          disabled={esOcurrencia}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void completarTarea(tarea.id, !hecha);
          }}
          style={{ borderColor: color, background: hecha ? color : undefined }}
          className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border-[1.5px]"
        />
      )}
      {fecha && !tarea.todoElDia && <span className="hidden shrink-0 text-tenue sm:inline">{format(fecha, "HH:mm")}</span>}
      <span className={`truncate ${hecha ? "text-tenue line-through" : ""}`}>{tarea.titulo || "Sin título"}</span>
    </div>
  );
}

function Chip({ tarea, fecha, esOcurrencia = false, idArrastre, alAbrir }: PropsChip) {
  const movible = !esOcurrencia && tarea.estado === "pendiente";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: idArrastre ?? PREFIJO_TAREA + tarea.id, disabled: !movible });
  return (
    <button
      type="button"
      ref={setNodeRef}
      data-testid="chip-tarea"
      data-entrada
      title={tarea.titulo}
      onClick={(e) => {
        e.stopPropagation();
        alAbrir();
      }}
      className={`flex w-full min-w-0 items-center gap-1 overflow-hidden rounded border border-borde bg-panel px-1.5 py-0.5 text-left text-xs shadow-sm hover:border-acento ${movible ? "cursor-grab touch-none" : ""} ${esOcurrencia || tarea.estado === "completada" ? "opacity-55" : ""} ${isDragging ? "opacity-30" : ""}`}
      {...(movible ? { ...attributes, ...listeners } : {})}
    >
      {contenidoChip(tarea, fecha, esOcurrencia)}
    </button>
  );
}

function Zona({ id, clase, alCrear, children, etiqueta }: { id: string; clase: string; alCrear?: () => void; children: ReactNode; etiqueta?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const alPulsar = (e: MouseEvent) => {
    // Un clic sobre una tarea abre la tarea; solo el espacio libre crea una nueva.
    if (alCrear && !(e.target as HTMLElement).closest("[data-entrada]")) alCrear();
  };
  return (
    <div ref={setNodeRef} data-zona={id} aria-label={etiqueta} onClick={alPulsar} className={`${clase} ${isOver ? "bg-acento-suave" : ""} ${alCrear ? "cursor-pointer" : ""}`}>
      {children}
    </div>
  );
}

interface Creacion {
  vence: string;
  todoElDia: boolean;
  etiqueta: string;
  esEvento?: boolean;
}

function DialogoNuevaTarea({ creacion, alCerrar }: { creacion: Creacion; alCerrar: () => void }) {
  const crearTarea = useTienda((s) => s.crearTarea);
  const listas = useTienda((s) => s.listas);
  const [texto, setTexto] = useState("");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const lectura = interpretarEntrada(texto, new Date(), listas);
    if (!lectura.titulo) return;
    await crearTarea(datosDesdeEntrada(lectura, { vence: creacion.vence, todoElDia: creacion.todoElDia, esEvento: creacion.esEvento }));
    alCerrar();
  };

  return (
    <Modal titulo={`${creacion.esEvento ? "Nuevo evento" : "Nueva tarea"}: ${creacion.etiqueta}`} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <input autoFocus aria-label="Título de la nueva tarea" className={claseCampo} placeholder="¿Qué hay que hacer?" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!texto.trim()}>
            {creacion.esEvento ? "Crear evento" : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function VistaCalendario({ modo, tareaAbierta }: { modo: ModoCalendario; tareaAbierta: string | null }) {
  const tareas = useTienda((s) => s.tareas);
  const listas = useTienda((s) => s.listas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [fecha, setFecha] = useState(() => new Date());
  const [creacion, setCreacion] = useState<Creacion | null>(null);
  const [activa, setActiva] = useState<Tarea | null>(null);
  const [filtro, setFiltro] = useState<FiltroSemana>("todos");
  const [nuevo, setNuevo] = useState<TipoNuevo | "habito" | null>(null);
  const rejilla = useRef<HTMLDivElement>(null);
  // Alto real de una celda del mes, para mostrar tantas entradas como quepan.
  const rejillaMes = useRef<HTMLDivElement>(null);
  const [altoCelda, setAltoCelda] = useState(96);
  useEffect(() => {
    const nodo = rejillaMes.current;
    if (!nodo) return;
    const medir = () => {
      const celda = nodo.firstElementChild as HTMLElement | null;
      if (celda) setAltoCelda(celda.getBoundingClientRect().height);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [modo, fecha]);
  const hoy = new Date();

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const seccion = { tipo: "calendario", modo } as const;
  const abrir = (id: string) => irA(seccion, id);

  const visibles = useMemo(() => {
    const excluidas = new Set(listas.filter((l) => !l.incluirEnTodas).map((l) => l.id));
    return tareas.filter((t) => !excluidas.has(t.listaId));
  }, [tareas, listas]);

  const dias = useMemo(() => (modo === "mes" ? diasDeMes(fecha) : diasDeSemana(fecha)), [modo, fecha]);
  const entradas = useMemo(() => {
    const filtradas = visibles.filter((t) => (filtro === "todos" ? true : filtro === "eventos" ? t.esEvento === true : t.esEvento !== true));
    return entradasEnRango(filtradas, dias[0], dias[dias.length - 1]);
  }, [visibles, dias, filtro]);

  // La semana arranca mostrando la mañana, no la madrugada.
  useEffect(() => {
    if (modo === "semana" && rejilla.current) rejilla.current.scrollTop = ALTO_HORA * 7;
  }, [modo]);

  const alSoltar = ({ active, over }: DragEndEvent) => {
    setActiva(null);
    if (!over) return;
    const id = String(active.id).slice(PREFIJO_TAREA.length);
    const tarea = tareas.find((t) => t.id === id);
    if (!tarea) return;
    const zona = String(over.id);
    // Toda tarea tiene fecha: ya no hay panel "Sin fecha" al que soltarla.
    if (zona.startsWith("dia:")) {
      actualizarTarea(id, venceEnDia(tarea, parseISO(zona.slice(4))));
    } else if (zona.startsWith("todo-el-dia:")) {
      actualizarTarea(id, { vence: zona.slice(12), todoElDia: true });
    } else if (zona.startsWith("hora:")) {
      const [, dia, hora] = zona.split("|");
      actualizarTarea(id, venceEnHora(parseISO(dia), Number(hora)));
    }
  };

  const mover = (paso: number) => setFecha((f) => (modo === "mes" ? addMonths(f, paso) : addWeeks(f, paso)));
  const titulo = modo === "mes"
    ? format(fecha, "MMMM yyyy", { locale: es })
    : `${format(dias[0], "d MMM", { locale: es })} – ${format(dias[6], "d MMM yyyy", { locale: es })}`;
  const crearEnDia = (dia: Date) => setCreacion({ vence: claveDia(dia), todoElDia: true, etiqueta: format(dia, "EEEE d 'de' MMMM", { locale: es }), esEvento: filtro === "eventos" });
  const mesCorto = format(fecha, "MMM", { locale: es }).replace(".", "");
  const tituloMes = mesCorto.charAt(0).toUpperCase() + mesCorto.slice(1) + (fecha.getFullYear() !== hoy.getFullYear() ? ` ${fecha.getFullYear()}` : "");
  // El + crea para hoy si se ve este mes; si no, para el primer día del mes visible.
  const diaParaNuevo = isSameMonth(fecha, hoy) ? hoy : startOfMonth(fecha);
  const claseModo = (activo: boolean) => `rounded px-2.5 py-1 text-xs ${activo ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`;

  const chipsDe = (lista: EntradaCalendario[]) => lista.map((e) => <Chip key={e.clave} tarea={e.tarea} fecha={e.fecha} esOcurrencia={e.esOcurrencia} idArrastre={e.esOcurrencia ? `ocurrencia:${e.clave}` : undefined} alAbrir={() => abrir(e.tarea.id)} />);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {modo === "mes" ? (
        <header className="flex items-center gap-2 px-4 pt-4 pb-2 sm:px-5">
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Periodo anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => mover(-1)}>
              <ChevronLeft size={18} />
            </button>
            <h1 data-testid="titulo-calendario" title={format(fecha, "MMMM yyyy", { locale: es })} className="px-0.5 text-lg font-semibold">
              {tituloMes}
            </h1>
            <button type="button" aria-label="Periodo siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => mover(1)}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div role="group" aria-label="Mostrar" className="ml-auto flex min-w-0 gap-0.5 rounded-md bg-suave p-0.5">
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
          <MenuNuevo alElegir={setNuevo} />
        </header>
      ) : (
        <header className="flex flex-wrap items-center gap-2 px-5 pt-5 pb-3">
        <h1 data-testid="titulo-calendario" className="text-xl font-semibold first-letter:uppercase">{titulo}</h1>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="Periodo anterior" className="rounded p-1.5 hover:bg-suave" onClick={() => mover(-1)}>
              <ChevronLeft size={17} />
            </button>
            <button type="button" className={claseBoton} onClick={() => setFecha(new Date())}>
              Hoy
            </button>
            <button type="button" aria-label="Periodo siguiente" className="rounded p-1.5 hover:bg-suave" onClick={() => mover(1)}>
              <ChevronRight size={17} />
            </button>
          </div>
          <div role="group" aria-label="Modo del calendario" className="flex gap-0.5 rounded-md bg-suave p-0.5">
            <a href={hashDe({ tipo: "calendario", modo: "mes" })} className={claseModo(false)}>
              Mes
            </a>
            <a href={hashDe({ tipo: "calendario", modo: "semana" })} aria-current="true" className={claseModo(true)}>
              Semana
            </a>
          </div>
        </div>
      </header>
      )}

      <DndContext
        sensors={sensores}
        collisionDetection={colisionPunteroOTeclado}
        onDragStart={({ active }) => setActiva(tareas.find((t) => PREFIJO_TAREA + t.id === active.id) ?? null)}
        onDragEnd={alSoltar}
        onDragCancel={() => setActiva(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "Arrastra la tarea a otro día para cambiar su fecha." },
          announcements: { onDragStart: () => "Tarea tomada.", onDragOver: () => "", onDragEnd: () => "Tarea soltada.", onDragCancel: () => "Movimiento cancelado." },
        }}
      >
        <div className={`flex min-h-0 flex-1 gap-3 pb-5 ${modo === "mes" ? "px-4 sm:px-5" : "px-5"}`}>
          {modo === "mes" ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-borde bg-panel">
              <div className="grid grid-cols-7 border-b border-borde">
                {NOMBRES_SEMANA.map((n) => (
                  <div key={n} className="px-1 py-1.5 text-center text-xs font-medium text-tenue">
                    {n}
                  </div>
                ))}
              </div>
              <div ref={rejillaMes} className="grid min-h-0 flex-1 grid-cols-7 auto-rows-fr overflow-y-auto">
                {dias.map((dia, i) => {
                  const delMes = isSameMonth(dia, fecha);
                  const delDia = delMes ? entradasDelDia(entradas, dia) : [];
                  // Eventos primero, como en la Semana.
                  delDia.sort((a, b) => Number(b.tarea.esEvento === true) - Number(a.tarea.esEvento === true));
                  // Tantas como quepan en el recuadro; si sobran, "n más" al final, sin salirse del día.
                  const visibles = entradasQueCaben(altoCelda, delDia.length);
                  const resto = delDia.length - visibles;
                  const ultimaFila = i >= dias.length - 7;
                  return (
                    <Zona
                      key={claveDia(dia)}
                      id={`dia:${claveDia(dia)}`}
                      etiqueta={format(dia, "d 'de' MMMM", { locale: es })}
                      clase={`flex min-h-24 min-w-0 flex-col overflow-hidden px-0.5 pt-1 pb-1.5 ${ultimaFila ? "" : "border-b border-borde"}`}
                      alCrear={delMes ? () => crearEnDia(dia) : undefined}
                    >
                      {delMes && (
                        <>
                          <span className={`mx-auto mb-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${isSameDay(dia, hoy) ? "border-2 border-acento font-semibold text-acento" : ""}`}>{format(dia, "d")}</span>
                          <div className="min-h-0 space-y-0.5 overflow-hidden">
                            {delDia.slice(0, visibles).map((e) => (
                              <ChipMes key={e.clave} tarea={e.tarea} fecha={e.fecha} esOcurrencia={e.esOcurrencia} idArrastre={e.esOcurrencia ? `ocurrencia:${e.clave}` : undefined} alAbrir={() => abrir(e.tarea.id)} />
                            ))}
                            {resto > 0 && (
                              <a
                                data-entrada
                                href={hashDe({ tipo: "vista", vista: "semana" })}
                                onClick={(ev) => {
                                  // Lleva a la Semana, en "Hoy", con este día elegido.
                                  ev.preventDefault();
                                  verDiaEnSemana(dia);
                                }}
                                className="block truncate px-1 text-[11px] leading-4 text-tenue hover:text-texto">
                                {resto} más
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </Zona>
                  );
                })}
              </div>
            </div>
          ) : (
            <div ref={rejilla} className="min-w-0 flex-1 overflow-auto rounded-lg border border-borde bg-panel">
              <div className="sticky top-0 z-10 grid grid-cols-[3rem_repeat(7,minmax(5.5rem,1fr))] border-b border-borde bg-panel">
                <div className="px-1 py-1 text-[10px] text-tenue">Todo el día</div>
                {dias.map((dia, i) => (
                  <Zona key={claveDia(dia)} id={`todo-el-dia:${claveDia(dia)}`} clase="min-h-14 min-w-0 border-l border-borde p-1" alCrear={() => crearEnDia(dia)}>
                    <div className={`mb-1 text-xs ${isSameDay(dia, hoy) ? "font-semibold text-acento" : "text-tenue"}`}>
                      {NOMBRES_SEMANA[i]} {format(dia, "d")}
                    </div>
                    <div className="space-y-0.5">{chipsDe(entradasDelDia(entradas, dia).filter((e) => e.tarea.todoElDia))}</div>
                  </Zona>
                ))}
              </div>
              {HORAS.map((hora) => (
                <div key={hora} className="grid grid-cols-[3rem_repeat(7,minmax(5.5rem,1fr))]" style={{ minHeight: ALTO_HORA }}>
                  <div className="border-b border-borde px-1 text-[11px] text-tenue">{String(hora).padStart(2, "0")}:00</div>
                  {dias.map((dia) => (
                    <Zona
                      key={claveDia(dia)}
                      id={`hora:|${claveDia(dia)}|${hora}`}
                      clase="min-w-0 space-y-0.5 border-b border-l border-borde p-0.5"
                      alCrear={() => setCreacion({ ...venceEnHora(startOfDay(dia), hora), etiqueta: `${format(dia, "EEEE d 'de' MMMM", { locale: es })}, ${String(hora).padStart(2, "0")}:00` })}
                    >
                      {chipsDe(entradasDelDia(entradas, dia).filter((e) => !e.tarea.todoElDia && e.fecha.getHours() === hora))}
                    </Zona>
                  ))}
                </div>
              ))}
            </div>
          )}

        </div>

        <DragOverlay dropAnimation={null}>
          {activa && <div className="flex w-44 items-center gap-1 rounded border border-acento bg-panel px-1.5 py-0.5 text-xs shadow-lg">{contenidoChip(activa, activa.vence ? parseISO(activa.vence) : null, false)}</div>}
        </DragOverlay>
      </DndContext>

      {creacion && <DialogoNuevaTarea creacion={creacion} alCerrar={() => setCreacion(null)} />}
      {(nuevo === "tarea" || nuevo === "evento") && <DialogoNuevo tipo={nuevo} dia={diaParaNuevo} alCerrar={() => setNuevo(null)} />}
      {nuevo === "habito" && <DialogoHabito habito={null} alCerrar={() => setNuevo(null)} />}
      {tareaAbierta && <span className="sr-only">Tarea abierta en el panel de detalle</span>}
    </div>
  );
}
