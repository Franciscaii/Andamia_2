import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChartArea, ChartPie, ChevronDown, Grid2x2, Monitor, type LucideIcon } from "lucide-react";
import { puenteEscritorio, useWidgetsAbiertos } from "../logica/puenteEscritorio";
import { WIDGETS, type TipoWidget } from "../logica/widgetEscritorio";
import { esAppNativa } from "../logica/plataforma";
import { MAX_TRANSPARENCIA } from "../logica/aspectoWidget";
import { presetDe, TEMAS } from "../logica/temas";
import { anclarWidget, CONFIG_INICIAL, LETRA_MAX, LETRA_MIN, configurarTipoWidget, puedeAnclarWidget, widgetsPorTipo, type ConfigWidget } from "../logica/widgetAndroid";

const DETALLE: Record<TipoWidget, { icono: LucideIcon; texto: string }> = {
  semana: { icono: CalendarRange, texto: "Los 7 días con sus eventos y tareas." },
  calendario: { icono: CalendarDays, texto: "El mes completo, con lo que tienes cada día." },
  matriz: { icono: Grid2x2, texto: "Los 4 cuadrantes de la Matriz de Eisenhower." },
  "estadistica-tareas": { icono: ChartPie, texto: "Cómo vas con tus tareas." },
  "estadistica-habitos": { icono: ChartArea, texto: "Rachas y cumplimiento de tus hábitos." },
};

/** Widgets de la pantalla de inicio del celular, en el orden en que aparecen. */
const WIDGETS_ANDROID: { tipo: string; nombre: string; icono: LucideIcon }[] = [
  { tipo: "semana", nombre: "Semana", icono: CalendarRange },
  { tipo: "calendario", nombre: "Calendario", icono: CalendarDays },
  { tipo: "estadistica-tareas", nombre: "Estadística Tareas", icono: ChartPie },
  { tipo: "estadistica-habitos", nombre: "Estadística Hábitos", icono: ChartArea },
];

/** Esquinas máximas en el celular (dp); se muestran como porcentaje de este máximo. */
const MAX_ESQUINAS_ANDROID = 40;

function Deslizador({ etiqueta, valor, min = 0, max, porcentaje, alCambiar }: { etiqueta: string; valor: number; min?: number; max: number; porcentaje: number; alCambiar: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex justify-between text-sm">
        <span>{etiqueta}</span>
        <span className="text-tenue tabular-nums">{porcentaje}%</span>
      </span>
      <input type="range" min={min} max={max} step={min ? 5 : 1} value={valor} aria-label={etiqueta} onChange={(e) => alCambiar(Number(e.target.value))} className="mt-2 w-full accent-[var(--acento)]" />
    </label>
  );
}

/** Una tarjeta por widget: Añadir/Quitar y, al desplegarla, su tema, transparencia y esquinas. */
function TarjetaWidget({
  w,
  puestos,
  configInicial,
  puede,
  alAnclar,
  alQuitar,
}: {
  w: (typeof WIDGETS_ANDROID)[number];
  puestos: number;
  configInicial: ConfigWidget;
  puede: boolean;
  alAnclar: () => void;
  alQuitar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [config, setConfig] = useState<ConfigWidget>(configInicial);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Si los ajustes llegan del celular después de abrir el apartado, se muestran.
  useEffect(() => setConfig(configInicial), [configInicial]);
  const cambiar = (c: ConfigWidget) => {
    setConfig(c);
    // Se guarda al soltar el deslizador (un poco después del último cambio).
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => void configurarTipoWidget(w.tipo, c), 250);
  };
  const puesto = puestos > 0;
  return (
    <li data-testid="widget-celular" className="rounded-2xl border border-borde bg-panel shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento">
          <w.icono size={20} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold">{w.nombre}</p>
        {puesto ? (
          <button type="button" aria-label={`Quitar de la pantalla de inicio: ${w.nombre}`} className="shrink-0 rounded-full border border-borde px-3 py-1.5 text-xs font-medium hover:bg-suave" onClick={alQuitar}>
            Quitar
          </button>
        ) : (
          puede && (
            <button type="button" aria-label={`Añadir a la pantalla de inicio: ${w.nombre}`} className="shrink-0 rounded-full bg-acento px-3 py-1.5 text-xs font-medium text-sobre-acento hover:opacity-90" onClick={alAnclar}>
              Añadir
            </button>
          )
        )}
        <button type="button" aria-expanded={abierta} aria-label={`Ajustes de ${w.nombre}`} className="shrink-0 rounded p-1 text-tenue hover:bg-suave" onClick={() => setAbierta(!abierta)}>
          <ChevronDown size={18} className={`transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
      </div>
      {abierta && (
        <div className="mx-3 mb-3 space-y-4 rounded-xl border border-borde p-3">
          <div>
            <p className="text-sm">Tema</p>
            <div role="radiogroup" aria-label={`Tema de ${w.nombre}`} className="mt-2 flex flex-wrap gap-2.5">
              {TEMAS.map((tema) => {
                const elegido = config.temaId === tema.id;
                return (
                  <button
                    key={tema.id}
                    type="button"
                    role="radio"
                    aria-checked={elegido}
                    aria-label={tema.nombre}
                    title={tema.nombre}
                    onClick={() => cambiar({ ...config, temaId: tema.id })}
                    className={`h-8 w-8 rounded-full border border-black/10 ${elegido ? "ring-2 ring-acento ring-offset-2 ring-offset-[var(--panel)]" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${tema.panel} 50%, ${tema.acento} 50%)` }}
                  />
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-tenue">{presetDe(config.temaId).nombre}</p>
          </div>
          <Deslizador etiqueta="Transparencia" valor={config.transparencia} max={MAX_TRANSPARENCIA} porcentaje={config.transparencia} alCambiar={(v) => cambiar({ ...config, transparencia: v })} />
          <Deslizador
            etiqueta="Esquinas"
            valor={config.esquinas}
            max={MAX_ESQUINAS_ANDROID}
            porcentaje={Math.round((config.esquinas / MAX_ESQUINAS_ANDROID) * 100)}
            alCambiar={(v) => cambiar({ ...config, esquinas: v })}
          />
          <Deslizador etiqueta="Tamaño de letra" valor={config.letra} min={LETRA_MIN} max={LETRA_MAX} porcentaje={config.letra} alCambiar={(v) => cambiar({ ...config, letra: v })} />
        </div>
      )}
    </li>
  );
}

/** Apartado "Widgets" en el celular: ponerlos en la pantalla de inicio y ajustar cada uno. */
function WidgetsCelular() {
  const [puede, setPuede] = useState(true);
  const [aviso, setAviso] = useState("");
  const [porTipo, setPorTipo] = useState<Record<string, { puestos: number; config: ConfigWidget }>>({});
  const recargar = useCallback(() => void widgetsPorTipo().then(setPorTipo), []);
  useEffect(() => {
    void puedeAnclarWidget().then(setPuede);
    recargar();
    // Al volver de la pantalla de inicio (después de poner o quitar un widget), se actualiza.
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", recargar);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", recargar);
    };
  }, [recargar]);
  const anclar = async (tipo: string, nombre: string) => {
    const pedido = await anclarWidget(tipo);
    setAviso(pedido ? `Confirma en el aviso del celular para poner "${nombre}" en la pantalla de inicio.` : "Este celular no deja ponerlo desde aquí: mantén presionada la pantalla de inicio → Widgets → Andamia.");
    if (pedido) for (const ms of [2000, 5000, 10000]) setTimeout(recargar, ms);
  };
  // Android no deja que una app quite widgets: se explica cómo hacerlo.
  const quitar = (nombre: string) => setAviso(`Para quitar "${nombre}": en la pantalla de inicio, mantén presionado el widget y toca "Quitar".`);
  return (
    <>
      <p className="mt-1 text-sm text-tenue">Ponlos en la pantalla de inicio. Cada widget tiene su propio tema, transparencia, esquinas y tamaño de letra.</p>
      {aviso && (
        <p role="status" className="mt-4 rounded-lg bg-acento-suave px-3 py-2 text-sm">
          {aviso}
        </p>
      )}
      <ul className="mt-4 space-y-3" aria-label="Widgets del celular">
        {WIDGETS_ANDROID.map((w) => (
          <TarjetaWidget
            key={w.tipo}
            w={w}
            puestos={porTipo[w.tipo]?.puestos ?? 0}
            configInicial={porTipo[w.tipo]?.config ?? CONFIG_INICIAL}
            puede={puede}
            alAnclar={() => void anclar(w.tipo, w.nombre)}
            alQuitar={() => quitar(w.nombre)}
          />
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
