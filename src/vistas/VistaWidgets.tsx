import { useEffect, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarRange, ChartArea, ChartPie, Grid2x2, Monitor, type LucideIcon } from "lucide-react";
import { puenteEscritorio, useWidgetsAbiertos } from "../logica/puenteEscritorio";
import { WIDGETS, type TipoWidget } from "../logica/widgetEscritorio";
import { esAppNativa } from "../logica/plataforma";
import { guardarAspecto, leerAspecto, MAX_TRANSPARENCIA, type AspectoWidget } from "../logica/aspectoWidget";
import { anclarWidget, ASPECTO_ANDROID, avisarCambioAspecto, puedeAnclarWidget } from "../logica/widgetAndroid";

const DETALLE: Record<TipoWidget, { icono: LucideIcon; texto: string }> = {
  semana: { icono: CalendarRange, texto: "Los 7 días con sus eventos y tareas." },
  calendario: { icono: CalendarDays, texto: "El mes completo, con lo que tienes cada día." },
  matriz: { icono: Grid2x2, texto: "Los 4 cuadrantes de la Matriz de Eisenhower." },
  "estadistica-tareas": { icono: ChartPie, texto: "Cómo vas con tus tareas." },
  "estadistica-habitos": { icono: ChartArea, texto: "Rachas y cumplimiento de tus hábitos." },
};

/** Widgets de la pantalla de inicio del celular, en el orden en que aparecen. */
const WIDGETS_ANDROID: { tipo: string; nombre: string; texto: string; icono: LucideIcon }[] = [
  { tipo: "semana", nombre: "Semana", texto: "La tira de 7 días y lo del día que elijas.", icono: CalendarRange },
  { tipo: "hoy", nombre: "Hoy", texto: "Eventos, progreso y tareas de hoy.", icono: CalendarCheck },
  { tipo: "calendario", nombre: "Calendario", texto: "El mes completo, con lo que tienes cada día.", icono: CalendarDays },
  { tipo: "matriz", nombre: "Matriz", texto: "Los 4 cuadrantes de la Matriz de Eisenhower.", icono: Grid2x2 },
  { tipo: "estadistica-tareas", nombre: "Estadística Tareas", texto: "Tareas completadas esta semana.", icono: ChartPie },
  { tipo: "estadistica-habitos", nombre: "Estadística Hábitos", texto: "Hábitos cumplidos esta semana.", icono: ChartArea },
];

/** Esquinas máximas en el celular (dp). */
const MAX_ESQUINAS_ANDROID = 40;

function Deslizador({ etiqueta, valor, max, unidad, alCambiar }: { etiqueta: string; valor: number; max: number; unidad: string; alCambiar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span>{etiqueta}</span>
        <span className="text-tenue tabular-nums">
          {valor}
          {unidad}
        </span>
      </span>
      <input type="range" min={0} max={max} value={valor} aria-label={etiqueta} onChange={(e) => alCambiar(Number(e.target.value))} className="mt-2 w-full accent-[var(--acento)]" />
    </label>
  );
}

/** Apartado "Widgets" en el celular: ponerlos en la pantalla de inicio y elegir su transparencia y esquinas. */
function WidgetsCelular() {
  const [puede, setPuede] = useState(true);
  const [aviso, setAviso] = useState("");
  const [aspecto, setAspecto] = useState<AspectoWidget>(() => leerAspecto(ASPECTO_ANDROID));
  useEffect(() => {
    void puedeAnclarWidget().then(setPuede);
  }, []);
  const cambiar = (a: AspectoWidget) => {
    setAspecto(a);
    guardarAspecto(ASPECTO_ANDROID, a);
    avisarCambioAspecto();
  };
  const anclar = async (tipo: string, nombre: string) => {
    const pedido = await anclarWidget(tipo);
    setAviso(pedido ? `Confirma en el aviso del celular para poner "${nombre}" en la pantalla de inicio.` : "Este celular no deja ponerlo desde aquí: mantén presionada la pantalla de inicio → Widgets → Andamia.");
  };
  const opacidad = 1 - aspecto.transparencia / 100;
  return (
    <>
      <p className="mt-1 text-sm text-tenue">Ponlos en la pantalla de inicio. Usan los colores del tema que elijas en la app.</p>

      <section className="mt-5 rounded-2xl border border-borde bg-panel p-4 shadow-sm" aria-label="Apariencia de los widgets">
        <h2 className="text-sm font-semibold">Apariencia</h2>
        <div className="mt-3 rounded-xl bg-gradient-to-br from-slate-500 to-slate-800 p-5">
          <div
            data-testid="vista-previa-widget"
            className="mx-auto max-w-56 border border-white/10 px-4 py-3 shadow-lg"
            style={{ borderRadius: aspecto.esquinas, background: `color-mix(in srgb, var(--panel-solido) ${Math.round(opacidad * 100)}%, transparent)` }}
          >
            <p className="text-sm font-semibold">Hoy</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-suave">
              <div className="h-full w-1/3 rounded-full bg-acento" />
            </div>
            <p className="mt-2 text-xs text-tenue">Así se verán tus widgets.</p>
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <Deslizador etiqueta="Transparencia" valor={aspecto.transparencia} max={MAX_TRANSPARENCIA} unidad="%" alCambiar={(v) => cambiar({ ...aspecto, transparencia: v })} />
          <Deslizador etiqueta="Esquinas" valor={aspecto.esquinas} max={MAX_ESQUINAS_ANDROID} unidad="" alCambiar={(v) => cambiar({ ...aspecto, esquinas: v })} />
        </div>
      </section>

      {aviso && (
        <p role="status" className="mt-4 rounded-lg bg-acento-suave px-3 py-2 text-sm">
          {aviso}
        </p>
      )}
      <ul className="mt-4 grid gap-3" aria-label="Widgets de la pantalla de inicio">
        {WIDGETS_ANDROID.map((w) => (
          <li key={w.tipo} data-testid="widget-celular" className="flex items-center gap-3 rounded-xl border border-borde bg-panel p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento">
              <w.icono size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{w.nombre}</p>
              <p className="text-xs text-tenue">{w.texto}</p>
            </div>
            {puede && (
              <button type="button" aria-label={`Añadir a la pantalla de inicio: ${w.nombre}`} className="shrink-0 rounded-md bg-acento px-3 py-1.5 text-xs font-medium text-sobre-acento hover:opacity-90" onClick={() => void anclar(w.tipo, w.nombre)}>
                Añadir
              </button>
            )}
          </li>
        ))}
      </ul>
      {!puede && <p className="mt-3 text-xs text-tenue">Para ponerlos: mantén presionada la pantalla de inicio → Widgets → Andamia.</p>}
    </>
  );
}

/** Apartado "Widgets": en el PC, poner o quitar widgets del escritorio; en el celular, de la pantalla de inicio. */
export function VistaWidgets() {
  if (esAppNativa()) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">
        <h1 className="text-xl font-semibold">Widgets</h1>
        <WidgetsCelular />
      </div>
    );
  }
  return <WidgetsEscritorio />;
}

function WidgetsEscritorio() {
  const abiertos = useWidgetsAbiertos();
  const puente = puenteEscritorio();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">
      <h1 className="text-xl font-semibold">Widgets</h1>
      <p className="mt-1 text-sm text-tenue">Ponlos en el escritorio de Windows. Quedan detrás de las ventanas y vuelven al iniciar.</p>
      {!puente ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg border border-borde bg-panel p-4 text-sm text-tenue">
          <Monitor size={18} /> Los widgets están disponibles en la app de Andamia para Windows.
        </p>
      ) : (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Widgets del escritorio">
          {WIDGETS.map((w) => {
            const { icono: Icono, texto } = DETALLE[w.id];
            const puesto = abiertos.includes(w.id);
            return (
              <li key={w.id} data-testid="widget-disponible" className="flex items-center gap-3 rounded-xl border border-borde bg-panel p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento">
                  <Icono size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{w.nombre}</p>
                  <p className="text-xs text-tenue">{texto}</p>
                </div>
                <button
                  type="button"
                  aria-label={`${puesto ? "Quitar del escritorio" : "Añadir al escritorio"}: ${w.nombre}`}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${puesto ? "border border-borde text-tenue hover:text-texto" : "bg-acento text-sobre-acento hover:opacity-90"}`}
                  onClick={() => (puesto ? puente.cerrarWidget(w.id) : puente.abrirWidget(w.id))}
                >
                  {puesto ? "Quitar del escritorio" : "Añadir al escritorio"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
