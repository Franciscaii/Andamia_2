import { FlechaVolver } from "../componentes/FlechaVolver";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarRange, ChartArea, ChartPie, ChevronDown, Grid2x2, Monitor, type LucideIcon } from "lucide-react";
import { puenteEscritorio, useWidgetsAbiertos } from "../logica/puenteEscritorio";
import { WIDGETS, type TipoWidget } from "../logica/widgetEscritorio";
import { esAppNativa } from "../logica/plataforma";
import { guardarAspecto, leerAspecto, transparenciaTarjetas, LETRA_MAX_ESCRITORIO, LETRA_MIN_ESCRITORIO, MAX_ESQUINAS, MAX_TRANSPARENCIA, type AspectoWidget } from "../logica/aspectoWidget";
import { leerEleccion, presetDe, TEMAS, temaEfectivo } from "../logica/temas";
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

/** Widget pedido en la dirección ("#/widgets/semana"): llega desde "Ajustes del Widget". */
const widgetPedido = () => decodeURIComponent(window.location.hash.replace(/^#\/?/, "").split("/")[1] ?? "");

/** Tarjeta de un widget: parte desplegada (y a la vista) si la dirección pide ese widget. */
function useTarjetaPedida(id: string) {
  const [abierta, setAbierta] = useState(() => widgetPedido() === id);
  const tarjeta = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const alPedir = () => {
      if (widgetPedido() !== id) return;
      setAbierta(true);
      tarjeta.current?.scrollIntoView({ block: "nearest" });
    };
    alPedir();
    window.addEventListener("hashchange", alPedir);
    return () => window.removeEventListener("hashchange", alPedir);
  }, [id]);
  return { abierta, setAbierta, tarjeta };
}

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
  abierta,
  setAbierta,
  alAnclar,
  alQuitar,
}: {
  w: (typeof WIDGETS_ANDROID)[number];
  puestos: number;
  configInicial: ConfigWidget;
  puede: boolean;
  abierta: boolean;
  setAbierta: (abierta: boolean) => void;
  alAnclar: () => void;
  alQuitar: () => void;
}) {
  const tarjeta = useRef<HTMLLIElement>(null);
  // Al desplegarse, la tarjeta queda a la vista (las demás se retraen y todo sube).
  useEffect(() => {
    if (abierta) tarjeta.current?.scrollIntoView({ block: "nearest" });
  }, [abierta]);
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
  // La vista previa usa el aspecto del widget del PC con los mismos ajustes (las esquinas pasan de la escala del celular a la del PC).
  useEffect(() => {
    if (!abierta) return;
    guardarAspecto(w.tipo, { transparencia: config.transparencia, tarjetas: config.tarjetas, esquinas: Math.round((config.esquinas / MAX_ESQUINAS_ANDROID) * MAX_ESQUINAS), temaId: config.temaId, letra: config.letra });
  }, [abierta, config, w.tipo]);
  return (
    <li ref={tarjeta} data-testid="widget-celular" className="rounded-2xl border border-borde bg-panel shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento">
          <w.icono size={20} />
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold">{w.nombre}</p>
        {puesto ? (
          <button type="button" aria-label={`Quitar de la pantalla de inicio: ${w.nombre}`} className="shrink-0 rounded-full bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600" onClick={alQuitar}>
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
                    className={`h-8 w-8 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${elegido ? "ring-2 ring-acento ring-offset-2 ring-offset-[var(--panel)]" : ""}`}
                    style={{ background: `linear-gradient(135deg, ${tema.panel} 50%, ${tema.acento} 50%)` }}
                  />
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-tenue">{presetDe(config.temaId).nombre}</p>
          </div>
          <Deslizador etiqueta="Transparencia" valor={config.transparencia} max={MAX_TRANSPARENCIA} porcentaje={config.transparencia} alCambiar={(v) => cambiar({ ...config, transparencia: v })} />
          <Deslizador etiqueta="Transparencia de tarjetas" valor={config.tarjetas ?? 0} max={MAX_TRANSPARENCIA} porcentaje={config.tarjetas ?? 0} alCambiar={(v) => cambiar({ ...config, tarjetas: v })} />
          <Deslizador
            etiqueta="Esquinas"
            valor={config.esquinas}
            max={MAX_ESQUINAS_ANDROID}
            porcentaje={Math.round((config.esquinas / MAX_ESQUINAS_ANDROID) * 100)}
            alCambiar={(v) => cambiar({ ...config, esquinas: v })}
          />
          <Deslizador etiqueta="Tamaño de letra" valor={config.letra} min={LETRA_MIN} max={LETRA_MAX} porcentaje={config.letra} alCambiar={(v) => cambiar({ ...config, letra: v })} />
          <MiniaturaWidget celular id={w.tipo} nombre={w.nombre} maxAncho={Math.min(300, window.innerWidth - 104)} />
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
  // Solo un widget desplegado a la vez: al abrir el detalle de uno, el resto se retrae.
  const [abierto, setAbierto] = useState<string | null>(() => widgetPedido());
  useEffect(() => {
    const alPedir = () => {
      const pedido = widgetPedido();
      if (pedido) setAbierto(pedido);
    };
    window.addEventListener("hashchange", alPedir);
    return () => window.removeEventListener("hashchange", alPedir);
  }, []);
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
            abierta={abierto === w.tipo}
            setAbierta={(a) => setAbierto(a ? w.tipo : null)}
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
        <div className="flex items-center"><FlechaVolver /><h1 className="text-xl font-semibold">Widgets</h1></div>
        <WidgetsCelular />
      </div>
    );
  }
  return <WidgetsEscritorio />;
}

/** Círculos de tema; con `comoApp`, el primero deja el widget con el tema de la app. */
function ElegirTema({ nombre, valor, comoApp, alElegir }: { nombre: string; valor: string; comoApp?: boolean; alElegir: (id: string) => void }) {
  const app = temaEfectivo(leerEleccion());
  const opciones = [...(comoApp ? [{ id: "", nombre: "Como la app", panel: app.panel, acento: app.acento }] : []), ...TEMAS];
  return (
    <div>
      <p className="text-sm">Tema</p>
      <div role="radiogroup" aria-label={`Tema de ${nombre}`} className="mt-2 flex flex-wrap gap-2.5">
        {opciones.map((tema) => {
          const elegido = valor === tema.id;
          return (
            <button
              key={tema.id || "app"}
              type="button"
              role="radio"
              aria-checked={elegido}
              aria-label={tema.nombre}
              title={tema.nombre}
              onClick={() => alElegir(tema.id)}
              className={`h-8 w-8 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.12)] ${elegido ? "ring-2 ring-acento ring-offset-2 ring-offset-[var(--panel)]" : ""} ${tema.id ? "" : "outline-2 outline-dashed outline-offset-1 outline-borde"}`}
              style={{ background: `linear-gradient(135deg, ${tema.panel} 50%, ${tema.acento} 50%)` }}
            />
          );
        })}
      </div>
      <p className="mt-1.5 text-xs text-tenue">{valor ? presetDe(valor).nombre : "Como la app"}</p>
    </div>
  );
}

/** Tema, transparencia, esquinas y letra de un widget del PC; se ven al tiro en su ventana. */
function AjustesWidgetEscritorio({ id, nombre }: { id: string; nombre: string }) {
  const [a, setA] = useState<AspectoWidget>(() => leerAspecto(id));
  // Si se cambia desde la esquinita del widget, también se ve aquí.
  useEffect(() => {
    const alCambiar = () => setA(leerAspecto(id));
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, [id]);
  const cambiar = (c: Partial<AspectoWidget>) => {
    const nuevo = { ...a, ...c };
    setA(nuevo);
    guardarAspecto(id, nuevo);
  };
  const letra = a.letra ?? 100;
  return (
    <div className="mx-3 mb-3 flex flex-col gap-4 rounded-xl border border-borde p-3 lg:mx-6 lg:mb-6 lg:flex-row lg:gap-8 lg:p-5">
      <div className="min-w-0 flex-1 space-y-4">
      <ElegirTema nombre={nombre} valor={a.temaId ?? ""} comoApp alElegir={(temaId) => cambiar({ temaId })} />
      <Deslizador etiqueta="Transparencia" valor={a.transparencia} max={MAX_TRANSPARENCIA} porcentaje={a.transparencia} alCambiar={(v) => cambiar({ transparencia: v })} />
      <Deslizador etiqueta="Transparencia de tarjetas" valor={transparenciaTarjetas(a)} max={MAX_TRANSPARENCIA} porcentaje={transparenciaTarjetas(a)} alCambiar={(v) => cambiar({ tarjetas: v })} />
      <Deslizador etiqueta="Esquinas" valor={a.esquinas} max={MAX_ESQUINAS} porcentaje={Math.round((a.esquinas / MAX_ESQUINAS) * 100)} alCambiar={(v) => cambiar({ esquinas: v })} />
      <Deslizador etiqueta="Tamaño de letra" valor={letra} min={LETRA_MIN_ESCRITORIO} max={LETRA_MAX_ESCRITORIO} porcentaje={letra} alCambiar={(v) => cambiar({ letra: v })} />
      </div>
      <MiniaturaWidget id={id} nombre={nombre} />
    </div>
  );
}

/** El widget en chiquito, dentro de su tarjeta: se actualiza solo con cada cambio de tema, transparencia, esquinas o letra. */
/** Tamaño (en píxeles de pantalla) con que se dibuja cada widget del celular: angosto y alto, como en la pantalla de inicio. */
const TAMANO_CELULAR: Record<string, { ancho: number; alto: number }> = {
  semana: { ancho: 360, alto: 620 },
  calendario: { ancho: 360, alto: 620 },
  matriz: { ancho: 360, alto: 620 },
  "estadistica-tareas": { ancho: 360, alto: 700 },
  "estadistica-habitos": { ancho: 360, alto: 700 },
};

function MiniaturaWidget({ id, nombre, maxAncho = 560, celular = false }: { id: string; nombre: string; maxAncho?: number; celular?: boolean }) {
  const base = celular ? { ...WIDGETS.find((x) => x.id === id)!, ...TAMANO_CELULAR[id] } : WIDGETS.find((x) => x.id === id)!;
  // Se achica para que el widget entre COMPLETO en la caja (a lo ancho y a lo alto).
  const escala = Math.min(maxAncho / base.ancho, (celular ? 580 : 440) / base.alto);
  const ancho = Math.round(base.ancho * escala);
  const alto = Math.round(base.alto * escala);
  return (
    <div data-testid="miniatura-widget" className="shrink-0 self-start">
      <p className="mb-2 text-sm">Vista previa</p>
      <div className="relative overflow-hidden rounded-lg" style={{ width: ancho, height: alto }}>
        <iframe
          title={`Vista previa de ${nombre}`}
          src={`${window.location.pathname}?${celular ? "previa" : "widget"}=${id}`}
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 border-0"
          style={{ width: base.ancho, height: base.alto, transform: `scale(${escala})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}

function TarjetaWidgetEscritorio({ w, puesto, alCambiarPuesto }: { w: (typeof WIDGETS)[number]; puesto: boolean; alCambiarPuesto: () => void }) {
  const { abierta, setAbierta, tarjeta } = useTarjetaPedida(w.id);
  const { icono: Icono, texto } = DETALLE[w.id];
  return (
    <li ref={tarjeta} data-testid="widget-disponible" className="rounded-2xl border border-borde bg-panel shadow-sm [--panel:var(--panel-solido)]">
      <div className="flex items-center gap-3 p-4 lg:gap-4 lg:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-acento-suave text-acento lg:h-14 lg:w-14 lg:rounded-xl">
          <Icono size={20} className="lg:h-7 lg:w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold lg:text-lg">{w.nombre}</p>
          <p className="text-xs text-tenue lg:text-base">{texto}</p>
        </div>
        <button
          type="button"
          aria-label={`${puesto ? "Quitar del escritorio" : "Añadir al escritorio"}: ${w.nombre}`}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium lg:px-5 lg:py-2 lg:text-base ${puesto ? "bg-gray-500 text-white hover:bg-gray-600" : "bg-acento text-sobre-acento hover:opacity-90"}`}
          onClick={alCambiarPuesto}
        >
          {puesto ? "Quitar" : "Añadir"}
        </button>
        <button type="button" aria-expanded={abierta} aria-label={`Ajustes de ${w.nombre}`} className="shrink-0 rounded p-1 text-tenue hover:bg-suave" onClick={() => setAbierta(!abierta)}>
          <ChevronDown size={18} className={`transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
      </div>
      {abierta && <AjustesWidgetEscritorio id={w.id} nombre={w.nombre} />}
    </li>
  );
}

function WidgetsEscritorio() {
  const abiertos = useWidgetsAbiertos();
  const puente = puenteEscritorio();
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8 lg:px-8 lg:pt-12">
      <div className="flex items-center"><FlechaVolver /><h1 className="text-xl font-semibold lg:text-2xl">Widgets</h1></div>
      <p className="mt-1 text-sm text-texto lg:text-base">Ponlos en el escritorio de Windows. Quedan detrás de las ventanas y vuelven al iniciar. Cada widget tiene su propio tema, transparencia, esquinas y tamaño de letra.</p>
      {!puente ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg border border-borde bg-panel p-4 text-sm text-tenue">
          <Monitor size={18} /> Los widgets están disponibles en la app de Andamia para Windows.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-1 items-start gap-3 lg:mt-6 lg:gap-5" aria-label="Widgets del escritorio">
          {WIDGETS.map((w) => {
            const puesto = abiertos.includes(w.id);
            return <TarjetaWidgetEscritorio key={w.id} w={w} puesto={puesto} alCambiarPuesto={() => (puesto ? puente.cerrarWidget(w.id) : puente.abrirWidget(w.id))} />;
          })}
        </ul>
      )}
    </div>
  );
}
