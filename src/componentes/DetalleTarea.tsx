import { useState, type FormEvent } from "react";
import { Check, Flag, RotateCcw, Timer, Trash2, X } from "lucide-react";
import { useEnfoque } from "../datos/enfoque";
import { useTienda } from "../datos/tienda";
import { formatoMinutos, minutosDeTarea } from "../logica/enfoque";
import { aFechaInput, aHoraInput, componerVence } from "../logica/fechas";
import { describirRecordatorio, OPCIONES_RECORDATORIO } from "../logica/recordatorios";
import { construirRegla, describirRegla, INICIALES_DIA, leerRegla, NOMBRES_DIA, venceParaRegla, type Frecuencia, type OpcionesRepeticion } from "../logica/repeticion";
import { irA, type Seccion } from "../logica/ruta";
import { nuevoId } from "../logica/texto";
import { LISTA_BANDEJA, PRIORIDADES, type Subtarea, type Tarea } from "../modelos/tipos";
import { COLOR_PRIORIDAD } from "./FilaTarea";
import { claseBoton, claseCampo } from "./Modal";

const UNIDADES: { valor: Frecuencia; nombre: string }[] = [
  { valor: "diaria", nombre: "días" },
  { valor: "semanal", nombre: "semanas" },
  { valor: "mensual", nombre: "meses" },
  { valor: "anual", nombre: "años" },
];

type Preajuste = "ninguna" | Frecuencia | "laborables" | "personalizada";

function preajusteDe(regla: string | null): Preajuste {
  if (!regla) return "ninguna";
  const { frecuencia, intervalo, diasSemana } = leerRegla(regla);
  if (intervalo !== 1) return "personalizada";
  if (frecuencia === "semanal" && diasSemana.join() === "0,1,2,3,4") return "laborables";
  return frecuencia;
}

function EditorRepeticion({ tarea }: { tarea: Tarea }) {
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [forzarPersonalizada, setForzarPersonalizada] = useState(false);
  const opciones: OpcionesRepeticion = tarea.repeticion ? leerRegla(tarea.repeticion) : { frecuencia: "diaria", intervalo: 1, diasSemana: [] };
  const preajuste: Preajuste = forzarPersonalizada ? "personalizada" : preajusteDe(tarea.repeticion);
  const hoyEnSemana = (((tarea.vence ? new Date(tarea.vence.length === 10 ? `${tarea.vence}T00:00:00` : tarea.vence) : new Date()).getDay() + 6) % 7);

  const aplicar = (o: OpcionesRepeticion) => {
    const regla = construirRegla(o);
    actualizarTarea(tarea.id, { repeticion: regla, ...venceParaRegla(regla, tarea, new Date()) });
  };

  const elegir = (valor: Preajuste) => {
    setForzarPersonalizada(valor === "personalizada");
    if (valor === "ninguna") actualizarTarea(tarea.id, { repeticion: null });
    else if (valor === "laborables") aplicar({ frecuencia: "semanal", intervalo: 1, diasSemana: [0, 1, 2, 3, 4] });
    else if (valor === "semanal") aplicar({ frecuencia: "semanal", intervalo: 1, diasSemana: [hoyEnSemana] });
    else if (valor === "personalizada") aplicar(tarea.repeticion ? opciones : { frecuencia: "semanal", intervalo: 2, diasSemana: [hoyEnSemana] });
    else aplicar({ frecuencia: valor, intervalo: 1, diasSemana: [] });
  };

  const alternarDia = (d: number) => {
    const dias = opciones.diasSemana.includes(d) ? opciones.diasSemana.filter((x) => x !== d) : [...opciones.diasSemana, d];
    // Una regla semanal necesita al menos un día.
    if (dias.length) aplicar({ ...opciones, diasSemana: dias });
  };

  return (
    <section>
      <label className="block text-xs text-tenue">
        Repetir
        <select aria-label="Repetir" className={`${claseCampo} mt-1`} value={preajuste} onChange={(e) => elegir(e.target.value as Preajuste)}>
          <option value="ninguna">No se repite</option>
          <option value="diaria">Cada día</option>
          <option value="semanal">Cada semana</option>
          <option value="mensual">Cada mes</option>
          <option value="anual">Cada año</option>
          <option value="laborables">Días laborables (lunes a viernes)</option>
          <option value="personalizada">Personalizada</option>
        </select>
      </label>
      {preajuste === "personalizada" && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-tenue">Cada</span>
          <input
            type="number"
            min={1}
            max={999}
            aria-label="Intervalo de repetición"
            className={`${claseCampo} w-20`}
            value={opciones.intervalo}
            onChange={(e) => aplicar({ ...opciones, intervalo: Number(e.target.value) || 1 })}
          />
          <select
            aria-label="Unidad de repetición"
            className={claseCampo}
            value={opciones.frecuencia}
            onChange={(e) => {
              const frecuencia = e.target.value as Frecuencia;
              aplicar({ ...opciones, frecuencia, diasSemana: frecuencia === "semanal" ? (opciones.diasSemana.length ? opciones.diasSemana : [hoyEnSemana]) : [] });
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
      {tarea.repeticion && opciones.frecuencia === "semanal" && (
        <div className="mt-2 flex gap-1" role="group" aria-label="Días de la semana">
          {INICIALES_DIA.map((inicial, d) => (
            <button key={d} type="button" aria-label={NOMBRES_DIA[d]} aria-pressed={opciones.diasSemana.includes(d)} onClick={() => alternarDia(d)} className={`h-7 w-7 rounded-full border text-xs ${opciones.diasSemana.includes(d) ? "border-acento bg-acento text-sobre-acento" : "border-borde hover:bg-suave"}`}>
              {inicial}
            </button>
          ))}
        </div>
      )}
      {tarea.repeticion && (
        <>
          <p className="mt-2 text-xs text-tenue">{describirRegla(tarea.repeticion)}</p>
          <label className="mt-2 block text-xs text-tenue">
            Calcular la siguiente fecha desde
            <select aria-label="Calcular la siguiente fecha desde" className={`${claseCampo} mt-1`} value={tarea.repetirDesde} onChange={(e) => actualizarTarea(tarea.id, { repetirDesde: e.target.value as Tarea["repetirDesde"] })}>
              <option value="vencimiento">La fecha de la tarea</option>
              <option value="completado">El día en que la completo</option>
            </select>
          </label>
        </>
      )}
    </section>
  );
}

function EditorRecordatorios({ tarea }: { tarea: Tarea }) {
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [personalizado, setPersonalizado] = useState(false);
  const [cantidad, setCantidad] = useState("10");
  const [unidad, setUnidad] = useState("1");

  const agregar = (minutosAntes: number) => {
    if (!Number.isFinite(minutosAntes) || minutosAntes < 0 || tarea.recordatorios.some((r) => r.minutosAntes === minutosAntes)) return;
    actualizarTarea(tarea.id, { recordatorios: [...tarea.recordatorios, { id: nuevoId(), minutosAntes }].sort((a, b) => a.minutosAntes - b.minutosAntes) });
  };

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Recordatorios</h3>
      {!tarea.vence && <p className="text-xs text-tenue">Elige una fecha para poder añadir recordatorios.</p>}
      <ul className="mb-1.5 flex flex-wrap gap-1">
        {tarea.recordatorios.map((r) => (
          <li key={r.id} className="flex items-center gap-1 rounded-full bg-suave px-2 py-0.5 text-xs">
            {describirRecordatorio(r.minutosAntes, tarea.todoElDia)}
            <button type="button" aria-label={`Quitar recordatorio: ${describirRecordatorio(r.minutosAntes, tarea.todoElDia)}`} onClick={() => actualizarTarea(tarea.id, { recordatorios: tarea.recordatorios.filter((x) => x.id !== r.id) })}>
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>
      {tarea.vence && (
        <select
          aria-label="Añadir recordatorio"
          className={claseCampo}
          value=""
          onChange={(e) => {
            if (e.target.value === "personalizado") setPersonalizado(true);
            else if (e.target.value) agregar(Number(e.target.value));
          }}
        >
          <option value="">Añadir recordatorio…</option>
          {OPCIONES_RECORDATORIO.map((o) => (
            <option key={o.minutos} value={o.minutos}>
              {describirRecordatorio(o.minutos, tarea.todoElDia)}
            </option>
          ))}
          <option value="personalizado">Personalizado…</option>
        </select>
      )}
      {tarea.vence && personalizado && (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agregar(Math.round(Number(cantidad) * Number(unidad)));
            setPersonalizado(false);
          }}
        >
          <input type="number" min={0} aria-label="Cantidad de tiempo" className={`${claseCampo} w-20`} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          <select aria-label="Unidad de tiempo" className={claseCampo} value={unidad} onChange={(e) => setUnidad(e.target.value)}>
            <option value="1">minutos antes</option>
            <option value="60">horas antes</option>
            <option value="1440">días antes</option>
          </select>
          <button type="submit" className={claseBoton}>
            Añadir
          </button>
        </form>
      )}
    </section>
  );
}

function EnfoqueDeTarea({ tarea }: { tarea: Tarea }) {
  const sesiones = useTienda((s) => s.sesiones);
  const enfocarEnTarea = useEnfoque((s) => s.enfocarEnTarea);
  const minutos = minutosDeTarea(sesiones, tarea.id);
  return (
    <section className="flex items-center justify-between gap-2">
      <span className="text-xs text-tenue">{minutos > 0 ? `Enfoque acumulado: ${formatoMinutos(minutos)}` : "Sin tiempo de enfoque"}</span>
      {tarea.estado === "pendiente" && (
        <button
          type="button"
          className={`${claseBoton} flex shrink-0 items-center gap-1.5`}
          onClick={() => {
            enfocarEnTarea(tarea.id);
            irA({ tipo: "enfoque" });
          }}
        >
          <Timer size={14} /> Enfocar
        </button>
      )}
    </section>
  );
}

function Subtareas({ tarea }: { tarea: Tarea }) {
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const [nueva, setNueva] = useState("");
  const guardar = (subtareas: Subtarea[]) => actualizarTarea(tarea.id, { subtareas });
  const cambiar = (id: string, cambios: Partial<Subtarea>) => guardar(tarea.subtareas.map((s) => (s.id === id ? { ...s, ...cambios } : s)));

  const agregar = (e: FormEvent) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    guardar([...tarea.subtareas, { id: nuevoId(), titulo: nueva.trim(), estado: "pendiente", orden: tarea.subtareas.length }]);
    setNueva("");
  };

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Subtareas</h3>
      <ul className="space-y-1">
        {tarea.subtareas.map((s) => {
          const hecha = s.estado === "completada";
          return (
            <li key={s.id} className="group flex items-center gap-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={hecha}
                aria-label={`Completar subtarea: ${s.titulo}`}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${hecha ? "border-acento bg-acento" : "border-tenue"}`}
                onClick={() => cambiar(s.id, { estado: hecha ? "pendiente" : "completada" })}
              >
                {hecha && <Check size={11} strokeWidth={3} className="text-sobre-acento" />}
              </button>
              <input
                aria-label="Título de la subtarea"
                className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${hecha ? "text-tenue line-through" : ""}`}
                value={s.titulo}
                onChange={(e) => cambiar(s.id, { titulo: e.target.value })}
              />
              <button type="button" aria-label={`Quitar subtarea: ${s.titulo}`} className="text-tenue opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => guardar(tarea.subtareas.filter((x) => x.id !== s.id))}>
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <form onSubmit={agregar} className="mt-1.5">
        <input aria-label="Nueva subtarea" className={claseCampo} placeholder="Añadir subtarea y pulsar Enter" value={nueva} onChange={(e) => setNueva(e.target.value)} />
      </form>
    </section>
  );
}

function Etiquetas({ tarea }: { tarea: Tarea }) {
  const etiquetas = useTienda((s) => s.etiquetas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const agregarEtiquetaATarea = useTienda((s) => s.agregarEtiquetaATarea);
  const [nueva, setNueva] = useState("");

  const agregar = (e: FormEvent) => {
    e.preventDefault();
    const nombre = nueva.replace(/^#/, "").trim();
    if (!nombre) return;
    void agregarEtiquetaATarea(tarea, nombre);
    setNueva("");
  };

  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Etiquetas</h3>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {tarea.etiquetas.map((clave) => {
          const e = etiquetas.find((x) => x.nombre === clave);
          return (
            <span key={clave} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: e?.color, background: `color-mix(in srgb, ${e?.color ?? "gray"} 16%, transparent)` }}>
              {e?.nombreVisible ?? clave}
              <button type="button" aria-label={`Quitar etiqueta ${e?.nombreVisible ?? clave}`} onClick={() => actualizarTarea(tarea.id, { etiquetas: tarea.etiquetas.filter((x) => x !== clave) })}>
                <X size={12} />
              </button>
            </span>
          );
        })}
      </div>
      <form onSubmit={agregar}>
        <input aria-label="Nueva etiqueta" list="etiquetas-existentes" className={claseCampo} placeholder="Añadir etiqueta y pulsar Enter" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        <datalist id="etiquetas-existentes">
          {etiquetas.filter((e) => !tarea.etiquetas.includes(e.nombre)).map((e) => (
            <option key={e.nombre} value={e.nombreVisible} />
          ))}
        </datalist>
      </form>
    </section>
  );
}

export function DetalleTarea({ tareaId, seccion }: { tareaId: string; seccion: Seccion }) {
  const tarea = useTienda((s) => s.tareas.find((t) => t.id === tareaId));
  const listas = useTienda((s) => s.listas);
  const actualizarTarea = useTienda((s) => s.actualizarTarea);
  const completarTarea = useTienda((s) => s.completarTarea);
  const enviarAPapelera = useTienda((s) => s.enviarAPapelera);
  const restaurarTarea = useTienda((s) => s.restaurarTarea);

  const cerrar = () => irA(seccion);
  const clasePanel = "fixed inset-0 z-40 flex flex-col bg-panel md:static md:z-auto md:w-96 md:shrink-0 md:border-l md:border-borde";

  if (!tarea) {
    return (
      <aside aria-label="Detalle de la tarea" className={clasePanel}>
        <div className="flex items-center justify-between p-4 text-sm text-tenue">
          Esta tarea ya no existe.
          <button type="button" aria-label="Cerrar detalle" onClick={cerrar}>
            <X size={18} />
          </button>
        </div>
      </aside>
    );
  }

  const enPapelera = tarea.eliminadaEn !== null;
  const hecha = tarea.estado === "completada";
  const fecha = aFechaInput(tarea);
  const hora = aHoraInput(tarea);

  return (
    <aside aria-label="Detalle de la tarea" className={clasePanel}>
      <header className="flex items-center gap-2 border-b border-borde px-4 py-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={hecha}
          aria-label={hecha ? "Marcar como pendiente" : "Completar tarea"}
          disabled={enPapelera}
          onClick={() => void completarTarea(tarea.id, !hecha)}
          style={{ borderColor: COLOR_PRIORIDAD[tarea.prioridad], background: hecha ? COLOR_PRIORIDAD[tarea.prioridad] : undefined }}
          className="flex h-5 w-5 items-center justify-center rounded-full border-2"
        >
          {hecha && <Check size={13} strokeWidth={3} className="text-panel" />}
        </button>
        <span className="text-xs text-tenue">{enPapelera ? "En la papelera" : hecha ? "Completada" : "Pendiente"}</span>
        <button type="button" aria-label="Cerrar detalle" className="ml-auto rounded p-1 text-tenue hover:bg-suave" onClick={cerrar}>
          <X size={18} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <fieldset disabled={enPapelera} className="min-w-0 space-y-5">
          <input
            aria-label="Título"
            className="w-full bg-transparent text-lg font-semibold outline-none"
            placeholder="Sin título"
            value={tarea.titulo}
            onChange={(e) => actualizarTarea(tarea.id, { titulo: e.target.value })}
          />

          <section className="grid grid-cols-2 gap-2">
            <label className="text-xs text-tenue">
              Fecha
              <input
                type="date"
                className={`${claseCampo} mt-1`}
                value={fecha}
                onChange={(e) => {
                  // Sin fecha no hay de dónde repetir.
                  const fin = e.target.value ? {} : { repeticion: null };
                  actualizarTarea(tarea.id, { ...componerVence(e.target.value, hora), ...fin });
                }}
              />
            </label>
            <label className="text-xs text-tenue">
              Hora
              <input type="time" disabled={!fecha} className={`${claseCampo} mt-1 disabled:opacity-50`} value={hora} onChange={(e) => actualizarTarea(tarea.id, componerVence(fecha, e.target.value))} />
            </label>
          </section>

          <EditorRepeticion tarea={tarea} />
          <EditorRecordatorios tarea={tarea} />

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-tenue uppercase">Prioridad</h3>
            <div className="flex gap-1">
              {PRIORIDADES.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  aria-pressed={tarea.prioridad === p.valor}
                  onClick={() => actualizarTarea(tarea.id, { prioridad: p.valor })}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-xs ${tarea.prioridad === p.valor ? "border-acento bg-acento-suave font-medium" : "border-borde hover:bg-suave"}`}
                >
                  <Flag size={12} style={{ color: COLOR_PRIORIDAD[p.valor] }} />
                  {p.nombre}
                </button>
              ))}
            </div>
          </section>

          <label className="block text-xs text-tenue">
            Lista
            <select aria-label="Lista" className={`${claseCampo} mt-1`} value={tarea.listaId} onChange={(e) => actualizarTarea(tarea.id, { listaId: e.target.value, columnaId: null })}>
              <option value={LISTA_BANDEJA}>Bandeja de entrada</option>
              {listas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-tenue">
            Notas
            <textarea aria-label="Notas" rows={5} className={`${claseCampo} mt-1 resize-y`} placeholder="Escribe aquí tus notas" value={tarea.descripcion} onChange={(e) => actualizarTarea(tarea.id, { descripcion: e.target.value })} />
          </label>

          <Subtareas tarea={tarea} />
          <Etiquetas tarea={tarea} />
          <EnfoqueDeTarea tarea={tarea} />
        </fieldset>
      </div>

      <footer className="flex justify-end border-t border-borde px-4 py-2.5">
        {enPapelera ? (
          <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={() => void restaurarTarea(tarea.id)}>
            <RotateCcw size={14} /> Restaurar
          </button>
        ) : (
          <button
            type="button"
            className={`${claseBoton} flex items-center gap-1.5 text-peligro`}
            onClick={() => {
              void enviarAPapelera(tarea.id);
              cerrar();
            }}
          >
            <Trash2 size={14} /> Enviar a la papelera
          </button>
        )}
      </footer>
    </aside>
  );
}
