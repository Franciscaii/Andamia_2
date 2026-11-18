import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Flame, Minus, Plus, Trash2, X } from "lucide-react";
import { IconoHabito, ICONOS_HABITO } from "../componentes/IconoHabito";
import { claseBotonEliminar, clasePanelDetalle, FondoDetalle } from "../componentes/DetalleTarea";
import { PanelColor } from "../componentes/PanelColor";
import { recordatoriosActivos } from "../config";
import { claseBoton, claseBotonPrincipal, claseCampo, Confirmar, Modal } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { claveDia, diasDeMes } from "../logica/calendario";
import { calcularRachas, describirFrecuencia, esEditable, estadoPorValor, indexarRegistros, tasaCumplimiento } from "../logica/habitos";
import { INICIALES_DIA, NOMBRES_DIA } from "../logica/repeticion";
import { irA, type Seccion } from "../logica/ruta";
import { COLORES_LISTA, type EstadoHabito, type FrecuenciaHabito, type Habito, type RegistroHabito } from "../modelos/tipos";

const NOMBRES_ESTADO: Record<EstadoHabito | "vacio", string> = { hecho: "hecho", parcial: "parcial", "no-hecho": "no hecho", vacio: "sin marcar" };

/** Los colores de siempre y, al final, un círculo arcoíris que abre el selector de cualquier otro color. */
function SelectorColor({ color, alElegir, etiqueta = "Color" }: { color: string; alElegir: (c: string) => void; etiqueta?: string }) {
  const personalizado = !COLORES_LISTA.includes(color);
  const [abierto, setAbierto] = useState(false);
  return (
    <div role="group" aria-label={etiqueta}>
      <div className="flex flex-wrap items-center gap-1.5">
        {COLORES_LISTA.map((c) => (
          <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} style={{ background: c }} className={`flex h-7 w-7 items-center justify-center rounded-full ${color === c ? "ring-2 ring-acento ring-offset-1 ring-offset-panel" : ""}`} onClick={() => alElegir(c)}>
            {color === c && <Check size={14} className="text-white" />}
          </button>
        ))}
        {/* El color a elección ya elegido se ve como un círculo más; el multicolor queda siempre a la vista. */}
        {personalizado && (
          <span title="Color elegido" style={{ background: color }} className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-acento ring-offset-1 ring-offset-panel">
            <Check size={14} className="text-white" />
          </span>
        )}
        <button
          type="button"
          aria-label="Otro color"
          aria-expanded={abierto}
          aria-pressed={personalizado}
          title="Otro color"
          onClick={() => setAbierto((a) => !a)}
          className="h-7 w-7 rounded-full border border-borde"
          style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
        />
      </div>
      {abierto && <PanelColor valor={color} alCambiar={alElegir} />}
    </div>
  );
}

/** Los datos de un hábito que se está escribiendo (ventana, panel del costado o tarjeta abierta en Hábitos). */
function useBorradorHabito(habito: Habito | null, inicioSugerido: string | undefined, alCerrar: () => void, autoEnfocar: boolean, conNombre: boolean, entreFrecuenciaYObjetivo?: React.ReactNode) {
  const crearHabito = useTienda((s) => s.crearHabito);
  const actualizarHabito = useTienda((s) => s.actualizarHabito);
  const [nombre, setNombre] = useState(habito?.nombre ?? "");
  const [icono, setIcono] = useState(habito?.icono ?? "estrella");
  const [color, setColor] = useState(habito?.color ?? COLORES_LISTA[4]);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaHabito>(habito?.frecuencia ?? { tipo: "diaria" });
  const [meta, setMeta] = useState(habito?.metaDiaria ?? 1);
  // La unidad ya no se pide; se conserva la que tuviera el hábito.
  const unidad = habito?.unidad ?? "";
  const [inicio, setInicio] = useState(habito?.inicio ?? inicioSugerido ?? format(new Date(), "yyyy-MM-dd"));
  const [fin, setFin] = useState(habito?.fin ?? "");
  const [hora, setHora] = useState(habito?.recordatorioHora ?? "");
  const [confeti, setConfeti] = useState(habito?.confeti !== false);

  const diasVacios = frecuencia.tipo === "dias" && frecuencia.dias.length === 0;
  const finAntes = Boolean(fin) && fin < inicio;
  const valido = Boolean(nombre.trim()) && meta >= 1 && !diasVacios && Boolean(inicio) && !finAntes;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    // Con los recordatorios apagados se conserva lo que ya tuviera el hábito.
    const datos = { nombre: nombre.trim(), icono, color, frecuencia, metaDiaria: meta, unidad, inicio, fin: fin || null, confeti, recordatorioHora: recordatoriosActivos ? hora || null : (habito?.recordatorioHora ?? null) };
    if (habito) await actualizarHabito(habito.id, datos);
    else await crearHabito(datos);
    alCerrar();
  };

  const enTarjeta = !conNombre;
  // El interruptor de confeti: en la tarjeta del celular queda junto a Objetivo y en la del PC junto a Color.
  const interruptorConfeti = (clase: string) => (
    <div className={enTarjeta ? `text-sm ${clase}` : `flex items-center justify-between gap-3 text-sm ${clase}`}>
      <span id="etiqueta-confeti" className={enTarjeta ? "mb-1 block text-tenue" : "text-tenue"}>Confeti al completarlo</span>
      <button type="button" role="switch" aria-checked={confeti} aria-labelledby="etiqueta-confeti" onClick={() => setConfeti(!confeti)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${confeti ? "bg-acento" : "bg-gray-300"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${confeti ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
  const campos = (
    <>
        {conNombre && (
          <label className="block text-sm">
            <span className="mb-1 block text-tenue">Nombre</span>
            <input autoFocus={autoEnfocar} maxLength={64} aria-label="Nombre del hábito" className={claseCampo} placeholder="Tomar agua" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            <span className="mb-1 block text-tenue">Fecha de inicio</span>
            <input type="date" aria-label="Fecha de inicio" className={claseCampo} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-tenue">Fecha de fin (opcional)</span>
            <input type="date" aria-label="Fecha de fin" min={inicio} className={claseCampo} value={fin} onChange={(e) => setFin(e.target.value)} />
          </label>
          {finAntes && <p className="col-span-2 text-xs text-peligro">La fecha de fin no puede ser anterior a la de inicio.</p>}
        </div>
        <div className="text-sm">
          <span className="mb-1 block text-tenue">Icono</span>
          <div role="group" aria-label="Icono" className="flex flex-wrap gap-1">
            {Object.entries(ICONOS_HABITO).map(([clave, Icono]) => (
              <button key={clave} type="button" aria-label={`Icono ${clave}`} aria-pressed={icono === clave} className={`flex h-8 w-8 items-center justify-center rounded-md border ${icono === clave ? "border-acento bg-acento-suave" : "border-borde hover:bg-suave"}`} onClick={() => setIcono(clave)}>
                <Icono size={16} />
              </button>
            ))}
          </div>
        </div>
        <div className={enTarjeta ? "grid grid-cols-2 gap-x-4 gap-y-4" : "contents"}>
        <div className={`text-sm ${enTarjeta ? "col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-1" : ""}`}>
          <span className="mb-1 block text-tenue">Color</span>
          <SelectorColor color={color} alElegir={setColor} />
        </div>
        <div className={`text-sm ${enTarjeta ? "col-span-2 lg:col-span-1 lg:col-start-1 lg:row-start-2" : ""}`}>
          <span className="mb-1 block text-tenue">Frecuencia</span>
          <div role="group" aria-label="Frecuencia" className="flex flex-wrap gap-1.5">
            {TIPOS_FRECUENCIA.map((t) => (
              <button
                key={t.tipo}
                type="button"
                aria-pressed={frecuencia.tipo === t.tipo}
                className={`rounded-full border px-3 py-1 text-xs ${frecuencia.tipo === t.tipo ? "border-acento bg-acento text-sobre-acento" : "border-borde hover:bg-suave"}`}
                onClick={() => {
                  if (t.tipo === frecuencia.tipo) return;
                  setFrecuencia(t.tipo === "diaria" ? { tipo: "diaria" } : t.tipo === "dias" ? { tipo: "dias", dias: [0, 1, 2, 3, 4] } : { tipo: "semanal", veces: 3 });
                }}
              >
                {t.nombre}
              </button>
            ))}
          </div>
          {frecuencia.tipo === "dias" && (
            <div role="group" aria-label="Días de la semana" className="mt-2 flex gap-1">
              {INICIALES_DIA.map((inicial, d) => {
                const activo = frecuencia.dias.includes(d);
                return (
                  <button key={d} type="button" aria-label={NOMBRES_DIA[d]} aria-pressed={activo} className={`h-8 w-8 rounded-full border text-xs ${activo ? "border-acento bg-acento text-sobre-acento" : "border-borde hover:bg-suave"}`} onClick={() => setFrecuencia({ tipo: "dias", dias: activo ? frecuencia.dias.filter((x) => x !== d) : [...frecuencia.dias, d] })}>
                    {inicial}
                  </button>
                );
              })}
            </div>
          )}
          {diasVacios && <p className="mt-1 text-xs text-peligro">Elige al menos un día.</p>}
          {frecuencia.tipo === "semanal" && (
            <label className="mt-2 flex items-center gap-2">
              <input type="number" min={1} max={7} aria-label="Veces por semana" className={`${claseCampo} w-20`} value={frecuencia.veces} onChange={(e) => setFrecuencia({ tipo: "semanal", veces: Math.min(7, Math.max(1, Number(e.target.value) || 1)) })} />
              <span className="text-tenue">veces por semana</span>
            </label>
          )}
        </div>
        <div className={enTarjeta ? "col-span-2 lg:row-start-3" : "contents"}>{entreFrecuenciaYObjetivo}</div>
        {enTarjeta ? (
          <>
            <label className="text-sm lg:col-start-2 lg:row-start-2">
              <span className="mb-1 block text-tenue">Objetivo por día</span>
              <input type="number" min={1} aria-label="Objetivo por día" className={claseCampo} value={meta} onChange={(e) => setMeta(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            {interruptorConfeti("lg:col-start-2 lg:row-start-1 lg:self-start")}
            {recordatoriosActivos && (
              <label className="col-span-2 text-sm lg:row-start-4">
                <span className="mb-1 block text-tenue">Recordatorio (opcional)</span>
                <input type="time" aria-label="Hora del recordatorio" className={claseCampo} value={hora} onChange={(e) => setHora(e.target.value)} />
              </label>
            )}
          </>
        ) : (
          <>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            <span className="mb-1 block text-tenue">Objetivo por día</span>
            <input type="number" min={1} aria-label="Objetivo por día" className={claseCampo} value={meta} onChange={(e) => setMeta(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          {recordatoriosActivos && (
            <label>
              <span className="mb-1 block text-tenue">Recordatorio (opcional)</span>
              <input type="time" aria-label="Hora del recordatorio" className={claseCampo} value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
          )}
        </div>
        {interruptorConfeti("")}
          </>
        )}
        </div>
    </>
  );

  const reiniciar = () => {
    setNombre(habito?.nombre ?? "");
    setIcono(habito?.icono ?? "estrella");
    setColor(habito?.color ?? COLORES_LISTA[4]);
    setFrecuencia(habito?.frecuencia ?? { tipo: "diaria" });
    setMeta(habito?.metaDiaria ?? 1);
    setInicio(habito?.inicio ?? inicioSugerido ?? format(new Date(), "yyyy-MM-dd"));
    setFin(habito?.fin ?? "");
    setHora(habito?.recordatorioHora ?? "");
    setConfeti(habito?.confeti !== false);
  };
  return { nombre, setNombre, valido, enviar, campos, reiniciar };
}

export function DialogoHabito({ habito, alCerrar, alEliminar, inicioSugerido }: { habito: Habito | null; alCerrar: () => void; /** Fecha de inicio propuesta para un hábito nuevo (yyyy-MM-dd). */ inicioSugerido?: string; /** Con esto se muestra como panel de detalle (al costado), con Eliminar y Guardar. */ alEliminar?: () => void }) {
  const { valido, enviar, campos } = useBorradorHabito(habito, inicioSugerido, alCerrar, !alEliminar, true);
  if (alEliminar) {
    return (
      <FondoDetalle alCerrar={alCerrar}>
        <aside aria-label="Detalle del hábito" className={clasePanelDetalle}>
          <form onSubmit={enviar} className="flex min-h-0 flex-1 flex-col">
            <div className="sin-barra min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{campos}</div>
            <footer className="flex items-center justify-between gap-2 border-t border-borde px-5 py-3">
              <button type="button" className={claseBotonEliminar} onClick={alEliminar}>
                <Trash2 size={14} /> Eliminar
              </button>
              <div className="flex items-center gap-2">
                <button type="button" className={claseBoton} onClick={alCerrar}>
                  Cancelar
                </button>
                <button type="submit" className={claseBotonPrincipal} disabled={!valido}>
                  Guardar
                </button>
              </div>
            </footer>
          </form>
        </aside>
      </FondoDetalle>
    );
  }

  return (
    <Modal titulo={habito ? "Editar hábito" : "Nuevo hábito"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        {campos}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!valido}>
            {habito ? "Guardar" : "Crear hábito"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Detalle de un hábito al costado (se abre tocando su nombre en la Semana): sus datos, Eliminar y Guardar. */
export function DetalleHabito({ habitoId, seccion }: { habitoId: string; seccion: Seccion }) {
  const habito = useTienda((s) => s.habitos.find((h) => h.id === habitoId));
  const borrarHabito = useTienda((s) => s.borrarHabito);
  const [borrando, setBorrando] = useState(false);
  const cerrar = () => irA(seccion);
  if (!habito) return null;
  return (
    <>
      <DialogoHabito habito={habito} alCerrar={cerrar} alEliminar={() => setBorrando(true)} />
      {borrando && (
        <Confirmar
          titulo={`¿Borrar "${habito.nombre}" para siempre?`}
          mensaje="También se borrará su historial. Si quieres conservarlo, apaga «Activo» en Hábitos."
          textoAccion="Borrar para siempre"
          alCerrar={() => setBorrando(false)}
          alConfirmar={() => {
            void borrarHabito(habito.id);
            cerrar();
          }}
        />
      )}
    </>
  );
}

function DialogoCantidad({ habito, dia, registro, alCerrar }: { habito: Habito; dia: Date; registro?: RegistroHabito; alCerrar: () => void }) {
  const registrarHabito = useTienda((s) => s.registrarHabito);
  const fecha = claveDia(dia);
  const [valor, setValor] = useState(registro?.valor ?? 0);
  const unidad = habito.unidad ? ` ${habito.unidad}` : "";

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    void registrarHabito(habito.id, fecha, { estado: estadoPorValor(valor, habito.metaDiaria), valor });
    alCerrar();
  };

  return (
    <Modal titulo={`${habito.nombre}: ${format(dia, "EEEE d 'de' MMMM", { locale: es })}`} alCerrar={alCerrar}>
      <form onSubmit={guardar} className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <button type="button" aria-label="Restar uno" className={claseBoton} onClick={() => setValor(Math.max(0, valor - 1))}>
            <Minus size={16} />
          </button>
          <input autoFocus type="number" min={0} aria-label="Cantidad" className={`${claseCampo} w-24 text-center`} value={valor} onChange={(e) => setValor(Math.max(0, Number(e.target.value) || 0))} />
          <button type="button" aria-label="Sumar uno" className={claseBoton} onClick={() => setValor(valor + 1)}>
            <Plus size={16} />
          </button>
        </div>
        <p className="text-center text-sm text-tenue">
          Objetivo: {habito.metaDiaria}
          {unidad}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          {registro && (
            <button
              type="button"
              className={`${claseBoton} mr-auto`}
              onClick={() => {
                void registrarHabito(habito.id, fecha, null);
                alCerrar();
              }}
            >
              Quitar registro
            </button>
          )}
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal}>
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CeldaEstado({ estado, color, inhabilitado, etiqueta, alPulsar, tamano = "h-8 w-8", contorno = false, children }: { estado: EstadoHabito | null; color: string; inhabilitado: boolean; etiqueta: string; alPulsar: () => void; tamano?: string; /** El círculo vacío se ve siempre (también en días que aún no llegan). */ contorno?: boolean; children?: React.ReactNode }) {
  const fondo = estado === "hecho" ? color : estado === "parcial" ? `color-mix(in srgb, ${color} 30%, transparent)` : undefined;
  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={inhabilitado}
      data-estado={estado ?? "vacio"}
      style={{ background: fondo, borderColor: estado === "hecho" || estado === "parcial" ? color : undefined }}
      className={`relative flex ${tamano} shrink-0 items-center justify-center rounded-full border text-xs ${contorno ? `border-[color-mix(in_srgb,var(--tenue)_60%,transparent)] ${inhabilitado ? "cursor-default opacity-45" : "hover:border-acento"}` : inhabilitado ? "cursor-default border-transparent opacity-30" : "border-borde hover:border-acento"}`}
      onClick={alPulsar}
    >
      {children}
      {!children && estado === "hecho" && <Check size={14} strokeWidth={3} className="text-white" />}
      {!children && estado === "parcial" && <Minus size={14} strokeWidth={3} style={{ color }} />}
      {!children && estado === "no-hecho" && <X size={14} className="text-tenue" />}
    </button>
  );
}

const TIPOS_FRECUENCIA: { tipo: FrecuenciaHabito["tipo"]; nombre: string }[] = [
  { tipo: "diaria", nombre: "Diario" },
  { tipo: "dias", nombre: "Algunos días" },
  { tipo: "semanal", nombre: "Veces por semana" },
];

/** Lo que se cambia al desplegar un hábito: ícono, color y frecuencia. Cada cambio se guarda al momento. */
/** Tarjeta de un hábito en la vista Hábitos: cerrada es una fila y abierta es el formulario completo (nombre incluido) con Eliminar, Historial, Cancelar y Guardar. */
function TarjetaHabito({ h, abierto, alternar, rachas, unidad, indice, semana, hoy, marcar, historialAbierto, alternarHistorial, alEliminar, historial }: {
  h: Habito;
  abierto: boolean;
  alternar: () => void;
  rachas: { actual: number };
  unidad: string;
  indice: Map<string, RegistroHabito>;
  semana: Date[];
  hoy: Date;
  marcar: (h: Habito, dia: Date) => void;
  historialAbierto: boolean;
  alternarHistorial: () => void;
  alEliminar: () => void;
  historial: React.ReactNode;
}) {
  const actualizarHabito = useTienda((s) => s.actualizarHabito);
  const ultimosDias = (
    <div className="text-sm">
      <span className="mb-1 flex items-center gap-2 text-tenue">Últimos 7 días</span>
      <div className="flex gap-1">
        {semana.map((dia) => {
          const r = indice.get(claveDia(dia));
          return (
            <div key={claveDia(dia)} className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-tenue">{INICIALES_DIA[(dia.getDay() + 6) % 7]}</span>
              <CeldaEstado
                estado={r?.estado ?? null}
                color={h.color}
                inhabilitado={!esEditable(h, dia, hoy) || h.archivado}
                etiqueta={`${h.nombre}, ${format(dia, "EEEE d 'de' MMMM", { locale: es })}: ${NOMBRES_ESTADO[r?.estado ?? "vacio"]}`}
                alPulsar={() => marcar(h, dia)}
              >
                {h.metaDiaria > 1 && r ? <span className={`tabular-nums ${r.estado === "hecho" ? "font-medium text-white" : ""}`}>{r.valor}</span> : undefined}
              </CeldaEstado>
            </div>
          );
        })}
      </div>
    </div>
  );
  const cerrar = () => {
    b.reiniciar();
    // Al cerrar la tarjeta también se esconde su historial.
    if (historialAbierto) alternarHistorial();
    alternar();
  };
  const b = useBorradorHabito(h, undefined, alternar, false, false, ultimosDias);
  // Al abrirla, el borrador parte de lo que tiene el hábito ahora (por si cambió desde un widget).
  useEffect(() => {
    if (abierto) b.reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);
  return (
    <li data-testid="habito" className={`rounded-xl border bg-panel ${abierto ? "border-acento" : "border-borde"}`}>
      <div className="flex items-center gap-2 p-2 lg:p-3">
        <IconoHabito nombre={h.icono} color={h.color} />
        {abierto ? (
          <span className="min-w-0 flex-1">
            <input maxLength={64} aria-label={`Nombre de ${h.nombre}`} className={`${claseCampo} !py-1 text-sm font-medium`} placeholder="Nombre del hábito" value={b.nombre} onChange={(e) => b.setNombre(e.target.value)} />
            <span aria-hidden="true" className="sr-only">{h.nombre}</span>
          </span>
        ) : (
          <button type="button" className={`flex min-w-0 flex-1 items-center gap-2 text-left ${h.archivado ? "opacity-50" : ""}`} onClick={alternar}>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{h.nombre}</span>
              <span className="block truncate text-xs text-tenue">
                {describirFrecuencia(h.frecuencia)}
                {h.metaDiaria > 1 && ` · ${h.metaDiaria}${h.unidad ? ` ${h.unidad}` : ""}`}
              </span>
            </span>
          </button>
        )}
        <span data-testid="racha-fila" title="Racha actual" className="hidden shrink-0 items-center gap-1 text-sm font-medium tabular-nums sm:flex">
          <Flame size={15} className={rachas.actual ? "text-prio-media" : "text-tenue"} />
          {rachas.actual} {unidad}
        </span>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-tenue">
          <span>Activo</span>
          <button
            type="button"
            role="switch"
            aria-checked={!h.archivado}
            aria-label={`Activo: ${h.nombre}`}
            className={`relative h-5 w-9 rounded-full transition-colors ${h.archivado ? "bg-suave" : "bg-acento"}`}
            onClick={() => void actualizarHabito(h.id, { archivado: !h.archivado })}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${h.archivado ? "left-0.5" : "left-[18px]"}`} />
          </button>
        </label>
        <button type="button" aria-label={`${abierto ? "Cerrar" : "Desplegar"} ${h.nombre}`} aria-expanded={abierto} className="shrink-0 rounded-md p-1.5 text-tenue hover:bg-suave" onClick={abierto ? cerrar : alternar}>
          <ChevronDown size={18} className={`transition-transform ${abierto ? "rotate-180" : ""}`} />
        </button>
      </div>
      {abierto && (
        <form onSubmit={b.enviar} className="space-y-3 border-t border-borde p-3">
          {b.campos}
          <div className="grid grid-cols-4 gap-2">
            <button type="button" className={`${claseBotonEliminar} w-full justify-center !px-2`} onClick={alEliminar}>
              <Trash2 size={14} className="hidden sm:block" /> Eliminar
            </button>
            <button type="button" aria-pressed={historialAbierto} className={`${claseBoton} flex w-full items-center justify-center gap-1.5 !px-2`} onClick={alternarHistorial}>
              <CalendarDays size={14} className="hidden sm:block" /> Historial
            </button>
            <button type="button" className={`${claseBoton} w-full !px-2`} onClick={cerrar}>
              Cancelar
            </button>
            <button type="submit" className={`${claseBotonPrincipal} w-full !px-2`} disabled={!b.valido}>
              Guardar
            </button>
          </div>
        </form>
      )}
      {historial}
    </li>
  );
}

export function VistaHabitos() {
  const habitos = useTienda((s) => s.habitos);
  const registros = useTienda((s) => s.registros);
  const registrarHabito = useTienda((s) => s.registrarHabito);
  const borrarHabito = useTienda((s) => s.borrarHabito);
  const [dialogo, setDialogo] = useState<{ habito: Habito | null } | null>(null);
  const [cantidad, setCantidad] = useState<{ habito: Habito; dia: Date } | null>(null);
  const [borrando, setBorrando] = useState<Habito | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [mes, setMes] = useState(() => new Date());
  // Tabla del computador: una semana (lunes a domingo) o un mes completo, con flechas para moverse.
  const [alcanceTabla, setAlcanceTabla] = useState<"semana" | "mes">("semana");
  const [baseTabla, setBaseTabla] = useState(() => startOfDay(new Date()));

  const hoy = startOfDay(new Date());
  const diasTabla = alcanceTabla === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(baseTabla, { weekStartsOn: 1 }), i)) : eachDayOfInterval({ start: startOfMonth(baseTabla), end: endOfMonth(baseTabla) });
  const moverTabla = (pasos: number) => setBaseTabla(alcanceTabla === "semana" ? addDays(baseTabla, 7 * pasos) : addMonths(baseTabla, pasos));
  const tituloTabla = format(alcanceTabla === "semana" ? diasTabla[0] : baseTabla, "MMM yyyy", { locale: es }).replace(".", "");
  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(hoy, i - 6)), [hoy.getTime()]);
  // Todos en una sola lista: primero los activos y al final los que están apagados.
  const visibles = [...habitos].sort((a, b) => Number(a.archivado) - Number(b.archivado) || a.orden - b.orden);
  const seleccionado = habitos.find((h) => h.id === seleccionId) ?? null;
  // En el computador el historial va al costado; en el celular, justo bajo la tarjeta de su hábito.
  const [enEscritorio, setEnEscritorio] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const cambio = () => setEnEscritorio(m.matches);
    m.addEventListener("change", cambio);
    return () => m.removeEventListener("change", cambio);
  }, []);
  const activos = visibles.filter((h) => !h.archivado);

  const marcar = (h: Habito, dia: Date) => {
    if (h.metaDiaria > 1) {
      setCantidad({ habito: h, dia });
      return;
    }
    const fecha = claveDia(dia);
    const actual = registros.find((r) => r.id === `${h.id}|${fecha}`)?.estado ?? null;
    // El primer toque marca (✓) y el segundo desmarca.
    void registrarHabito(h.id, fecha, actual === "hecho" ? null : { estado: "hecho", valor: 1 });
  };

  const detalle = seleccionado && (() => {
    const indice = indexarRegistros(registros, seleccionado.id);
    const rachas = calcularRachas(seleccionado, indice, hoy);
    const tasa = tasaCumplimiento(seleccionado, indice, hoy);
    const hechos = [...indice.values()].filter((r) => r.estado === "hecho").length;
    return (
      <section aria-label={`Historial de ${seleccionado.nombre}`} className="space-y-3 rounded-xl border border-borde bg-panel p-4">
        <header className="flex items-start gap-2">
          <IconoHabito nombre={seleccionado.icono} color={seleccionado.color} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{seleccionado.nombre}</h2>
            <p className="text-xs text-tenue">{describirFrecuencia(seleccionado.frecuencia)}</p>
          </div>
          <button type="button" aria-label="Cerrar historial" className="rounded p-1 text-tenue hover:bg-suave" onClick={() => setSeleccionId(null)}>
            <X size={16} />
          </button>
        </header>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {[
            { t: "Racha actual", v: `${rachas.actual} ${rachas.unidad}`, id: "racha-actual" },
            { t: "Racha máxima", v: `${rachas.maxima} ${rachas.unidad}`, id: "racha-maxima" },
            { t: "Cumplimiento", v: tasa === null ? "—" : `${tasa} %`, id: "cumplimiento" },
            { t: "Veces hecho", v: String(hechos), id: "veces" },
          ].map((m) => (
            <div key={m.id} className="rounded-lg bg-suave/60 p-2">
              <p className="text-xs text-tenue">{m.t}</p>
              <p data-testid={m.id} className="font-semibold tabular-nums">{m.v}</p>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <button type="button" aria-label="Mes anterior" className="rounded p-1 hover:bg-suave" onClick={() => setMes(addMonths(mes, -1))}>
              <ChevronLeft size={15} />
            </button>
            <span data-testid="mes-habito" className="text-sm font-medium first-letter:uppercase">{format(mes, "MMMM yyyy", { locale: es })}</span>
            <button type="button" aria-label="Mes siguiente" className="rounded p-1 hover:bg-suave" onClick={() => setMes(addMonths(mes, 1))}>
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-7 justify-items-center gap-1">
            {INICIALES_DIA.map((d) => (
              <span key={d} className="text-[11px] text-tenue">{d}</span>
            ))}
            {diasDeMes(mes).map((dia) => {
              const r = indice.get(claveDia(dia));
              return (
                <CeldaEstado
                  key={claveDia(dia)}
                  tamano="h-7 w-7"
                  estado={r?.estado ?? null}
                  color={seleccionado.color}
                  inhabilitado={!esEditable(seleccionado, dia, hoy) || !isSameMonth(dia, mes)}
                  etiqueta={`${format(dia, "d 'de' MMMM", { locale: es })}: ${NOMBRES_ESTADO[r?.estado ?? "vacio"]}`}
                  alPulsar={() => marcar(seleccionado, dia)}
                >
                  <span className={r?.estado === "hecho" ? "font-medium text-white" : ""}>{format(dia, "d")}</span>
                </CeldaEstado>
              );
            })}
          </div>
        </div>
      </section>
    );
  })();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5">
        {/* Celular: título y +. En el computador van dentro del recuadro de la tabla. */}
        <header className={`mb-4 flex items-center gap-2 ${activos.length > 0 ? "lg:hidden" : ""}`}>
          <h1 className="text-xl font-semibold">Hábitos</h1>
          <button type="button" aria-label="Nuevo hábito" title="Nuevo hábito" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-acento text-sobre-acento hover:opacity-90 lg:h-8 lg:w-8 lg:rounded-md lg:border lg:border-borde lg:bg-panel lg:text-texto lg:hover:bg-suave" onClick={() => setDialogo({ habito: null })}>
            <Plus size={18} />
          </button>
        </header>

        {/* Solo en el computador: los hábitos activos contra los días, para marcarlos de un vistazo. */}
        {activos.length > 0 && (
          <section aria-label="Hábitos por día" data-testid="tabla-habitos" className="mb-6 hidden rounded-xl border border-borde bg-[color-mix(in_srgb,var(--panel)_55%,transparent)] p-3 lg:block">
            {/* En el computador, en la misma fila y dentro del recuadro: título, < mes >, Semana | Mes y el +. */}
            <div className="relative mb-3">
              {/* Mismas columnas que la tabla: "Hábitos" centrado sobre los nombres y el mes centrado sobre el primer día. */}
              <div
                className="grid items-center gap-x-1"
                style={{ gridTemplateColumns: alcanceTabla === "semana" ? "minmax(6.5rem, 9rem) repeat(7, minmax(3.5rem, 1fr))" : `minmax(6rem, 8rem) repeat(${diasTabla.length}, minmax(1.5rem, 1fr))` }}
              >
                <h1 className="text-center text-xl font-semibold">Hábitos</h1>
                {/* Tarjeta con < mes >: empieza donde empieza la primera columna de días. */}
                <div className="relative h-8">
                  <div data-testid="nav-tabla-habitos" className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center whitespace-nowrap rounded-lg border border-borde bg-panel p-0.5">
                    <button type="button" aria-label={alcanceTabla === "semana" ? "Semana anterior" : "Mes anterior de la tabla"} className="rounded-md border border-borde bg-panel p-1 text-texto hover:bg-suave" onClick={() => moverTabla(-1)}>
                      <ChevronLeft size={18} />
                    </button>
                    <span data-testid="titulo-tabla-habitos" title={format(baseTabla, "MMMM yyyy", { locale: es })} className="min-w-12 px-3 text-center text-lg font-semibold first-letter:uppercase">
                      {tituloTabla}
                    </span>
                    <button type="button" aria-label={alcanceTabla === "semana" ? "Semana siguiente" : "Mes siguiente de la tabla"} className="rounded-md border border-borde bg-panel p-1 text-texto hover:bg-suave" onClick={() => moverTabla(1)}>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2"><div role="group" aria-label="Ver por" className="flex gap-1">
                {(["semana", "mes"] as const).map((a) => (
                  <button key={a} type="button" aria-pressed={alcanceTabla === a} className={`rounded-md border px-3 py-1.5 text-xs first-letter:uppercase ${alcanceTabla === a ? "border-acento bg-panel font-medium shadow-sm" : "border-borde bg-panel text-tenue hover:text-texto"}`} onClick={() => setAlcanceTabla(a)}>
                    {a === "semana" ? "Semana" : "Mes"}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Nuevo hábito" title="Nuevo hábito" className="flex h-8 w-8 items-center justify-center rounded-md border border-borde bg-panel text-texto hover:bg-suave" onClick={() => setDialogo({ habito: null })}>
                <Plus size={18} />
              </button>
              </div>
            </div>
            <div className="overflow-x-auto pb-1">
              <div
                className={`grid items-stretch gap-y-1.5 ${alcanceTabla === "semana" ? "gap-x-1" : "gap-x-0.5"}`}
                style={{ gridTemplateColumns: alcanceTabla === "semana" ? "minmax(6.5rem, 9rem) repeat(7, minmax(3.5rem, 1fr))" : `minmax(6rem, 8rem) repeat(${diasTabla.length}, minmax(1.5rem, 1fr))` }}
              >
                <span />
                {diasTabla.map((dia) => {
                  const esHoy = isSameDay(dia, hoy);
                  return (
                    <div key={claveDia(dia)} className={`flex flex-col items-center rounded-lg py-1 leading-tight ${esHoy ? "bg-acento-suave" : "bg-panel"}`}>
                      <span className={`first-letter:uppercase ${alcanceTabla === "semana" ? "text-xs" : "text-[10px]"} ${esHoy ? "font-semibold text-acento" : "text-texto"}`}>{alcanceTabla === "semana" ? NOMBRES_DIA[(dia.getDay() + 6) % 7].slice(0, 3) : INICIALES_DIA[(dia.getDay() + 6) % 7]}</span>
                      <span className={`font-semibold tabular-nums ${alcanceTabla === "semana" ? "text-base" : "text-xs"} ${esHoy ? "text-acento" : ""}`}>{format(dia, "d")}</span>
                    </div>
                  );
                })}
                {activos.map((h) => {
                  const indice = indexarRegistros(registros, h.id);
                  return (
                    <Fragment key={h.id}>
                      <div data-testid="fila-tabla-habito" className="flex min-w-0 items-center gap-2 rounded-lg border-l-4 bg-panel px-2 py-1.5" style={{ borderLeftColor: h.color }}>
                        <IconoHabito nombre={h.icono} color={h.color} />
                        <span className="truncate text-sm font-medium" title={h.nombre}>{h.nombre}</span>
                      </div>
                      {diasTabla.map((dia) => {
                        const r = indice.get(claveDia(dia));
                        return (
                          <div key={claveDia(dia)} className={`flex items-center justify-center rounded-lg py-1 ${isSameDay(dia, hoy) ? "bg-acento-suave" : "bg-panel"}`}>
                            <CeldaEstado
                              contorno
                              tamano={alcanceTabla === "semana" ? "h-10 w-10" : "h-6 w-6"}
                              estado={r?.estado ?? null}
                              color={h.color}
                              inhabilitado={!esEditable(h, dia, hoy)}
                              etiqueta={`Marcar ${h.nombre} el ${format(dia, "EEEE d 'de' MMMM", { locale: es })}: ${NOMBRES_ESTADO[r?.estado ?? "vacio"]}`}
                              alPulsar={() => marcar(h, dia)}
                            >
                              {h.metaDiaria > 1 && r ? <span className={`tabular-nums ${r.estado === "hecho" ? "font-medium text-white" : ""}`}>{r.valor}</span> : undefined}
                            </CeldaEstado>
                          </div>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <div className="lg:rounded-xl lg:border lg:border-borde lg:bg-[color-mix(in_srgb,var(--panel)_55%,transparent)] lg:p-3">
        <div className={`grid items-start gap-4 ${seleccionado ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
          <div className="min-w-0">
            {!visibles.length && (
              <div className="mt-16 text-center">
                <p className="font-medium">Aún no tienes hábitos</p>
                <p className="mt-1 text-sm text-tenue">Crea uno pequeño y fácil de cumplir para empezar.</p>
              </div>
            )}
            {/* Una tarjeta por fila. */}
            <ul className="grid items-start gap-1.5 lg:gap-2">
              {visibles.map((h) => {
                const indice = indexarRegistros(registros, h.id);
                const rachas = calcularRachas(h, indice, hoy);
                const unidad = rachas.unidad === "semanas" ? "sem." : rachas.actual === 1 ? "día" : "días";
                const abierto = abiertoId === h.id;
                const alternar = () => setAbiertoId(abierto ? null : h.id);
                return (
                  <TarjetaHabito
                    key={h.id}
                    h={h}
                    abierto={abierto}
                    alternar={alternar}
                    rachas={rachas}
                    unidad={unidad}
                    indice={indice}
                    semana={semana}
                    hoy={hoy}
                    marcar={marcar}
                    historialAbierto={seleccionId === h.id}
                    alternarHistorial={() => {
                      setSeleccionId(seleccionId === h.id ? null : h.id);
                      setMes(new Date());
                    }}
                    alEliminar={() => setBorrando(h)}
                    historial={!enEscritorio && seleccionado?.id === h.id ? <div className="border-t border-borde p-3">{detalle}</div> : null}
                  />
                );
              })}
            </ul>
            {visibles.length > 0 && <p className="mt-3 text-xs text-tenue">Despliega un hábito con la flecha para cambiar su nombre, fechas, ícono, color y frecuencia, o para marcar sus días.</p>}
          </div>
          {enEscritorio && detalle}
        </div>
        </div>
      </div>

      {dialogo && <DialogoHabito habito={dialogo.habito} alCerrar={() => setDialogo(null)} />}
      {cantidad && <DialogoCantidad habito={cantidad.habito} dia={cantidad.dia} registro={registros.find((r) => r.id === `${cantidad.habito.id}|${claveDia(cantidad.dia)}`)} alCerrar={() => setCantidad(null)} />}
      {borrando && (
        <Confirmar
          titulo={`¿Borrar "${borrando.nombre}" para siempre?`}
          mensaje="También se borrará su historial. Si quieres conservarlo, apaga «Activo»."
          textoAccion="Borrar para siempre"
          alCerrar={() => setBorrando(null)}
          alConfirmar={() => {
            void borrarHabito(borrando.id);
            setSeleccionId(null);
          }}
        />
      )}
    </div>
  );
}
