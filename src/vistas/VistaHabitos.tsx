import { useMemo, useState, type FormEvent } from "react";
import { addDays, addMonths, format, isSameMonth, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, Flame, Minus, Pencil, Plus, Trash2, X } from "lucide-react";
import { IconoHabito, ICONOS_HABITO } from "../componentes/IconoHabito";
import { recordatoriosActivos } from "../config";
import { claseBoton, claseBotonPrincipal, claseCampo, Confirmar, Modal } from "../componentes/Modal";
import { useTienda } from "../datos/tienda";
import { claveDia, diasDeMes } from "../logica/calendario";
import { calcularRachas, describirFrecuencia, esEditable, estadoPorValor, indexarRegistros, siguienteEstado, tasaCumplimiento } from "../logica/habitos";
import { INICIALES_DIA, NOMBRES_DIA } from "../logica/repeticion";
import { COLORES_LISTA, type EstadoHabito, type FrecuenciaHabito, type Habito, type RegistroHabito } from "../modelos/tipos";

const NOMBRES_ESTADO: Record<EstadoHabito | "vacio", string> = { hecho: "hecho", parcial: "parcial", "no-hecho": "no hecho", vacio: "sin marcar" };

function DialogoHabito({ habito, alCerrar }: { habito: Habito | null; alCerrar: () => void }) {
  const crearHabito = useTienda((s) => s.crearHabito);
  const actualizarHabito = useTienda((s) => s.actualizarHabito);
  const [nombre, setNombre] = useState(habito?.nombre ?? "");
  const [icono, setIcono] = useState(habito?.icono ?? "estrella");
  const [color, setColor] = useState(habito?.color ?? COLORES_LISTA[4]);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaHabito>(habito?.frecuencia ?? { tipo: "diaria" });
  const [meta, setMeta] = useState(habito?.metaDiaria ?? 1);
  const [unidad, setUnidad] = useState(habito?.unidad ?? "");
  const [inicio, setInicio] = useState(habito?.inicio ?? format(new Date(), "yyyy-MM-dd"));
  const [hora, setHora] = useState(habito?.recordatorioHora ?? "");

  const diasVacios = frecuencia.tipo === "dias" && frecuencia.dias.length === 0;
  const valido = Boolean(nombre.trim()) && meta >= 1 && !diasVacios && Boolean(inicio);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    // Con los recordatorios apagados se conserva lo que ya tuviera el hábito.
    const datos = { nombre: nombre.trim(), icono, color, frecuencia, metaDiaria: meta, unidad: unidad.trim(), inicio, recordatorioHora: recordatoriosActivos ? hora || null : (habito?.recordatorioHora ?? null) };
    if (habito) await actualizarHabito(habito.id, datos);
    else await crearHabito(datos);
    alCerrar();
  };

  return (
    <Modal titulo={habito ? "Editar hábito" : "Nuevo hábito"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Nombre</span>
          <input autoFocus maxLength={64} aria-label="Nombre del hábito" className={claseCampo} placeholder="Tomar agua" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
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
        <div className="text-sm">
          <span className="mb-1 block text-tenue">Color</span>
          <div role="group" aria-label="Color" className="flex flex-wrap gap-1.5">
            {COLORES_LISTA.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} style={{ background: c }} className={`flex h-7 w-7 items-center justify-center rounded-full ${color === c ? "ring-2 ring-acento ring-offset-1 ring-offset-panel" : ""}`} onClick={() => setColor(c)}>
                {color === c && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm">
          <label className="block">
            <span className="mb-1 block text-tenue">Frecuencia</span>
            <select
              aria-label="Frecuencia"
              className={claseCampo}
              value={frecuencia.tipo}
              onChange={(e) => {
                const tipo = e.target.value;
                if (tipo === "diaria") setFrecuencia({ tipo: "diaria" });
                else if (tipo === "dias") setFrecuencia({ tipo: "dias", dias: [0, 1, 2, 3, 4] });
                else setFrecuencia({ tipo: "semanal", veces: 3 });
              }}
            >
              <option value="diaria">Cada día</option>
              <option value="dias">Días de la semana</option>
              <option value="semanal">Varias veces por semana</option>
            </select>
          </label>
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
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            <span className="mb-1 block text-tenue">Objetivo por día</span>
            <input type="number" min={1} aria-label="Objetivo por día" className={claseCampo} value={meta} onChange={(e) => setMeta(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label>
            <span className="mb-1 block text-tenue">Unidad (opcional)</span>
            <input maxLength={20} aria-label="Unidad" className={claseCampo} placeholder="vasos" value={unidad} onChange={(e) => setUnidad(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-tenue">Empieza el</span>
            <input type="date" aria-label="Fecha de inicio" className={claseCampo} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          {recordatoriosActivos && (
            <label>
              <span className="mb-1 block text-tenue">Recordatorio (opcional)</span>
              <input type="time" aria-label="Hora del recordatorio" className={claseCampo} value={hora} onChange={(e) => setHora(e.target.value)} />
            </label>
          )}
        </div>
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

function CeldaEstado({ estado, color, inhabilitado, etiqueta, alPulsar, tamano = "h-8 w-8", children }: { estado: EstadoHabito | null; color: string; inhabilitado: boolean; etiqueta: string; alPulsar: () => void; tamano?: string; children?: React.ReactNode }) {
  const fondo = estado === "hecho" ? color : estado === "parcial" ? `color-mix(in srgb, ${color} 30%, transparent)` : undefined;
  return (
    <button
      type="button"
      aria-label={etiqueta}
      disabled={inhabilitado}
      data-estado={estado ?? "vacio"}
      style={{ background: fondo, borderColor: estado === "hecho" || estado === "parcial" ? color : undefined }}
      className={`relative flex ${tamano} shrink-0 items-center justify-center rounded-full border text-xs ${inhabilitado ? "cursor-default border-transparent opacity-30" : "border-borde hover:border-acento"}`}
      onClick={alPulsar}
    >
      {children}
      {!children && estado === "hecho" && <Check size={14} strokeWidth={3} className="text-white" />}
      {!children && estado === "parcial" && <Minus size={14} strokeWidth={3} style={{ color }} />}
      {!children && estado === "no-hecho" && <X size={14} className="text-tenue" />}
    </button>
  );
}

export function VistaHabitos() {
  const habitos = useTienda((s) => s.habitos);
  const registros = useTienda((s) => s.registros);
  const registrarHabito = useTienda((s) => s.registrarHabito);
  const actualizarHabito = useTienda((s) => s.actualizarHabito);
  const borrarHabito = useTienda((s) => s.borrarHabito);
  const [dialogo, setDialogo] = useState<{ habito: Habito | null } | null>(null);
  const [cantidad, setCantidad] = useState<{ habito: Habito; dia: Date } | null>(null);
  const [borrando, setBorrando] = useState<Habito | null>(null);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [verArchivados, setVerArchivados] = useState(false);
  const [mes, setMes] = useState(() => new Date());

  const hoy = startOfDay(new Date());
  const semana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(hoy, i - 6)), [hoy.getTime()]);
  const visibles = habitos.filter((h) => h.archivado === verArchivados).sort((a, b) => a.orden - b.orden);
  const archivados = habitos.filter((h) => h.archivado).length;
  const seleccionado = habitos.find((h) => h.id === seleccionId) ?? null;

  const marcar = (h: Habito, dia: Date) => {
    if (h.metaDiaria > 1) {
      setCantidad({ habito: h, dia });
      return;
    }
    const fecha = claveDia(dia);
    const actual = registros.find((r) => r.id === `${h.id}|${fecha}`)?.estado ?? null;
    const siguiente = siguienteEstado(actual);
    void registrarHabito(h.id, fecha, siguiente ? { estado: siguiente, valor: siguiente === "hecho" ? 1 : 0 } : null);
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
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={() => setDialogo({ habito: seleccionado })}>
            <Pencil size={14} /> Editar
          </button>
          <button
            type="button"
            className={`${claseBoton} flex items-center gap-1.5`}
            onClick={() => {
              void actualizarHabito(seleccionado.id, { archivado: !seleccionado.archivado });
              setSeleccionId(null);
            }}
          >
            {seleccionado.archivado ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {seleccionado.archivado ? "Restaurar" : "Archivar"}
          </button>
          <button type="button" className={`${claseBoton} flex items-center gap-1.5 text-peligro`} onClick={() => setBorrando(seleccionado)}>
            <Trash2 size={14} /> Borrar
          </button>
        </div>
      </section>
    );
  })();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-5">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{verArchivados ? "Hábitos archivados" : "Hábitos"}</h1>
          <div className="ml-auto flex items-center gap-2">
            {(archivados > 0 || verArchivados) && (
              <button type="button" className={claseBoton} onClick={() => { setVerArchivados(!verArchivados); setSeleccionId(null); }}>
                {verArchivados ? "Ver activos" : `Archivados (${archivados})`}
              </button>
            )}
            <button type="button" className={`${claseBotonPrincipal} flex items-center gap-1.5`} onClick={() => setDialogo({ habito: null })}>
              <Plus size={15} /> Nuevo hábito
            </button>
          </div>
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0">
            {!visibles.length && (
              <div className="mt-16 text-center">
                <p className="font-medium">{verArchivados ? "No hay hábitos archivados" : "Aún no tienes hábitos"}</p>
                {!verArchivados && <p className="mt-1 text-sm text-tenue">Crea uno pequeño y fácil de cumplir para empezar.</p>}
              </div>
            )}
            <ul className="space-y-2">
              {visibles.map((h) => {
                const indice = indexarRegistros(registros, h.id);
                const rachas = calcularRachas(h, indice, hoy);
                const unidad = rachas.unidad === "semanas" ? "sem." : rachas.actual === 1 ? "día" : "días";
                return (
                  <li key={h.id} data-testid="habito" className={`rounded-xl border bg-panel p-3 ${seleccionId === h.id ? "border-acento" : "border-borde"}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <button type="button" className="flex min-w-40 flex-1 items-center gap-2 text-left" onClick={() => { setSeleccionId(h.id); setMes(new Date()); }}>
                        <IconoHabito nombre={h.icono} color={h.color} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{h.nombre}</span>
                          <span className="flex items-center gap-1 text-xs text-tenue">
                            {describirFrecuencia(h.frecuencia)}
                            {h.metaDiaria > 1 && ` · ${h.metaDiaria}${h.unidad ? ` ${h.unidad}` : ""}`}
                          </span>
                        </span>
                      </button>
                      <span data-testid="racha-fila" title="Racha actual" className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums">
                        <Flame size={15} className={rachas.actual ? "text-prio-media" : "text-tenue"} />
                        {rachas.actual} {unidad}
                      </span>
                      <div className="flex shrink-0 gap-1">
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
                  </li>
                );
              })}
            </ul>
            {visibles.length > 0 && <p className="mt-3 text-xs text-tenue">Pulsa un día para marcarlo: hecho, parcial, no hecho o sin marcar. Pulsa el nombre para ver su historial.</p>}
          </div>
          {detalle}
        </div>
      </div>

      {dialogo && <DialogoHabito habito={dialogo.habito} alCerrar={() => setDialogo(null)} />}
      {cantidad && <DialogoCantidad habito={cantidad.habito} dia={cantidad.dia} registro={registros.find((r) => r.id === `${cantidad.habito.id}|${claveDia(cantidad.dia)}`)} alCerrar={() => setCantidad(null)} />}
      {borrando && (
        <Confirmar
          titulo={`¿Borrar "${borrando.nombre}" para siempre?`}
          mensaje="También se borrará su historial. Si quieres conservarlo, archívalo."
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
