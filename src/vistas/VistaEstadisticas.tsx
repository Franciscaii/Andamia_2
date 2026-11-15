import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTienda } from "../datos/tienda";
import {
  gruposDeEtiquetas,
  gruposDeHabitos,
  hechosDeHabitos,
  hechosDeTareas,
  moverPeriodo,
  PERIODOS,
  resumir,
  tituloPeriodo,
  type FilaResumen,
  type Periodo,
  type Resumen,
} from "../logica/estadisticas";
import { WIDGET_ACTUAL } from "../logica/widgetEscritorio";

/** En el widget de estadísticas del PC no va el título: ya lo dice la barra del widget. */
const EN_WIDGET = WIDGET_ACTUAL?.id === "estadistica-tareas" || WIDGET_ACTUAL?.id === "estadistica-habitos";
export type TipoEstadistica = "tareas" | "habitos";

const ATENUADO = 0.22;
const opacidad = (clave: string, elegido: string | null) => (elegido === null || elegido === clave ? 1 : ATENUADO);

// ---------- Gráfico circular ----------

function puntoEnCirculo(cx: number, cy: number, r: number, angulo: number) {
  const a = ((angulo - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Trazo de arco (solo la línea) desde un ángulo a otro; una vuelta completa se hace en dos mitades. */
function trazoArco(cx: number, cy: number, r: number, desde: number, hasta: number): string {
  if (hasta - desde >= 359.99) return `${trazoArco(cx, cy, r, 0, 180)} ${trazoArco(cx, cy, r, 180, 360).replace(/^M[^A]+/, "")}`;
  const a = puntoEnCirculo(cx, cy, r, desde);
  const b = puntoEnCirculo(cx, cy, r, hasta);
  return `M${a.x},${a.y} A${r},${r} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${b.x},${b.y}`;
}

/**
 * Un solo anillo grueso: cada grupo ocupa su parte, con los colores pegados (sin bordes blancos entre tramos).
 */
function Circular({ filas, total, elegido, alElegir, unidad, clase = "h-56 w-56", claseCaja = "" }: { filas: FilaResumen[]; total: number; elegido: string | null; alElegir: (c: string) => void; unidad: string; clase?: string; claseCaja?: string }) {
  const tam = 240;
  const c = tam / 2;
  const grosor = 22;
  const r = c - grosor / 2 - 4;
  const fila = filas.find((f) => f.clave === elegido);
  let angulo = 0;
  return (
    <figure data-testid="grafico-circular" className={`flex justify-center ${claseCaja}`}>
      <svg viewBox={`0 0 ${tam} ${tam}`} className={clase} shapeRendering="geometricPrecision" role="img" aria-label={`Reparto por grupo: ${filas.map((f) => `${f.nombre} ${f.porcentaje}%`).join(", ")}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--suave)" strokeWidth={grosor} />
        {filas.map((f) => {
          const desde = angulo;
          angulo += (f.cantidad / total) * 360;
          // Se alarga un pelo hacia atrás para que no quede una rendija entre colores.
          const inicio = desde === 0 ? 0 : desde - 0.4;
          return (
            <path
              key={f.clave}
              data-clave={f.clave}
              d={trazoArco(c, c, r, inicio, angulo)}
              fill="none"
              stroke={f.color}
              strokeWidth={grosor}
              opacity={opacidad(f.clave, elegido)}
              className="cursor-pointer transition-opacity"
              onClick={() => alElegir(f.clave)}
            >
              <title>{`${f.nombre}: ${f.cantidad} (${f.porcentaje}%)`}</title>
            </path>
          );
        })}
        <text x={c} y={c + 2} textAnchor="middle" className="fill-texto text-[28px] font-semibold tabular-nums">
          {fila ? `${fila.porcentaje}%` : total}
        </text>
        <text x={c} y={c + 22} textAnchor="middle" className="fill-tenue text-[12px]">
          {fila ? (fila.nombre.length > 16 ? `${fila.nombre.slice(0, 15)}…` : fila.nombre) : unidad}
        </text>
      </svg>
    </figure>
  );
}

// ---------- Curvas suaves en el tiempo ----------

/**
 * Trazo suave tipo onda (B-spline): redondea las cimas y nunca baja de cero ni sube más que los datos,
 * así el gráfico no tiene puntas.
 */
function curvaSuave(puntos: [number, number][]): string {
  const n = puntos.length;
  if (n === 0) return "";
  if (n < 3) return puntos.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
  let [x0, y0] = puntos[0];
  let [x1, y1] = puntos[0];
  const tramo = (x: number, y: number) => ` C${(2 * x0 + x1) / 3},${(2 * y0 + y1) / 3} ${(x0 + 2 * x1) / 3},${(y0 + 2 * y1) / 3} ${(x0 + 4 * x1 + x) / 6},${(y0 + 4 * y1 + y) / 6}`;
  let d = `M${x1},${y1}`;
  for (let i = 1; i < n; i++) {
    const [x, y] = puntos[i];
    if (i === 2) d += ` L${(5 * x0 + x1) / 6},${(5 * y0 + y1) / 6}`;
    if (i >= 2) d += tramo(x, y);
    [x0, y0, x1, y1] = [x1, y1, x, y];
  }
  d += tramo(x1, y1) + ` L${x1},${y1}`;
  return d;
}

/** Con `llenar`, el gráfico ocupa todo el alto de su recuadro en vez de un alto fijo. */
function Areas({ resumen, elegido, alElegir, llenar = false }: { resumen: Resumen; elegido: string | null; alElegir: (c: string) => void; llenar?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  // El lienzo mide lo mismo que su recuadro: así las letras no se agrandan en pantallas anchas.
  const caja = useRef<HTMLElement>(null);
  const [ancho, setAncho] = useState(360);
  const [alto, setAlto] = useState(220);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => {
      setAncho(Math.max(240, Math.round(el.clientWidth)));
      setAlto(llenar ? Math.max(130, Math.round(el.clientHeight)) : 220);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [llenar]);
  const margen = { izq: 26, der: 10, arr: 14, aba: 24 };
  const { serie, filas } = resumen;
  const n = serie.length;
  const maximo = Math.max(1, ...serie.flatMap((t) => filas.map((f) => t.valores[f.clave] ?? 0)));
  const anchoUtil = ancho - margen.izq - margen.der;
  const x = (i: number) => (n === 1 ? margen.izq + anchoUtil / 2 : margen.izq + (i * anchoUtil) / (n - 1));
  const base = alto - margen.aba;
  const y = (v: number) => base - (v / maximo) * (base - margen.arr);
  const totales = serie.map((t) => filas.reduce((s, f) => s + (t.valores[f.clave] ?? 0), 0));

  const cadaCuanto = Math.ceil(n / 7);
  const pasoY = maximo <= 4 ? 1 : Math.ceil(maximo / 4);
  const marcasY: number[] = [];
  for (let v = 0; v <= maximo; v += pasoY) marcasY.push(v);

  // Las curvas más grandes van atrás para que las chicas se sigan viendo; la elegida va al frente.
  const capas = [...filas].sort((a, b) => (a.clave === elegido ? 1 : b.clave === elegido ? -1 : b.cantidad - a.cantidad));

  return (
    <figure ref={caja} data-testid="grafico-areas" className={`relative ${llenar ? "h-full min-h-0 overflow-hidden" : ""}`}>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className={llenar ? "absolute inset-0 h-full w-full" : "h-auto w-full"}
        role="img"
        aria-label="Completadas a lo largo del período, por grupo"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * ancho;
          const i = n === 1 ? 0 : Math.round(((px - margen.izq) / anchoUtil) * (n - 1));
          setHover(Math.min(n - 1, Math.max(0, i)));
        }}
      >
        <defs>
          {filas.map((f) => (
            <linearGradient key={f.clave} id={`degradado-${f.clave}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={f.color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={f.color} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>
        {/* Guías verticales finas, una por fecha marcada. */}
        {serie.map((_, i) => (i % cadaCuanto === 0 || i === n - 1 ? <line key={`v${i}`} x1={x(i)} x2={x(i)} y1={margen.arr} y2={base} stroke="var(--borde)" strokeWidth={1} strokeOpacity={0.6} /> : null))}
        <line x1={margen.izq} x2={ancho - margen.der} y1={base} y2={base} stroke="var(--borde)" strokeWidth={1} />
        {marcasY.map((v) => (
          <text key={v} x={margen.izq - 8} y={y(v) + 3.5} textAnchor="end" className="fill-tenue text-[11px] tabular-nums">
            {v}
          </text>
        ))}
        {capas.map((f) => {
          const puntos = serie.map((t, i) => [x(i), y(t.valores[f.clave] ?? 0)] as [number, number]);
          const linea = n === 1 ? `M${x(0) - 12},${puntos[0][1]} H${x(0) + 12}` : curvaSuave(puntos);
          const xIni = n === 1 ? x(0) - 12 : x(0);
          const xFin = n === 1 ? x(0) + 12 : x(n - 1);
          const area = `${linea} L${xFin},${base} L${xIni},${base} Z`;
          const o = opacidad(f.clave, elegido);
          return (
            <g key={f.clave} className="cursor-pointer" onClick={() => alElegir(f.clave)}>
              <path data-clave={f.clave} d={area} fill={`url(#degradado-${f.clave})`} fillOpacity={0.9 * o} className="transition-[fill-opacity]" />
              <path d={linea} fill="none" stroke={f.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={o} />
            </g>
          );
        })}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={margen.arr - 4} y2={base} stroke="var(--tenue)" strokeWidth={1} strokeDasharray="3 3" />
          </g>
        )}
        {serie.map((t, i) =>
          i % cadaCuanto === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={alto - 6} textAnchor={n > 1 && i === 0 ? "start" : n > 1 && i === n - 1 ? "end" : "middle"} className="fill-tenue text-[11px]">
              {t.etiqueta}
            </text>
          ) : null,
        )}
      </svg>
      {hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-1 z-10 min-w-[8rem] rounded-lg border border-borde bg-panel px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(x(hover) / ancho) * 100}%`, transform: x(hover) > ancho / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
        >
          <p className="mb-0.5 font-semibold">{serie[hover].etiqueta}</p>
          {filas
            .filter((f) => (serie[hover].valores[f.clave] ?? 0) > 0)
            .map((f) => (
              <p key={f.clave} className="flex items-center gap-1.5" style={{ opacity: opacidad(f.clave, elegido) }}>
                <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                <span className="flex-1 truncate">{f.nombre}</span>
                <span className="tabular-nums">{serie[hover].valores[f.clave]}</span>
              </p>
            ))}
          {totales[hover] === 0 && <p className="text-tenue">Nada</p>}
        </div>
      )}
    </figure>
  );
}

// ---------- Vista ----------

export function VistaEstadisticas({ tipo }: { tipo: TipoEstadistica }) {
  const tareas = useTienda((s) => s.tareas);
  const etiquetas = useTienda((s) => s.etiquetas);
  const habitos = useTienda((s) => s.habitos);
  const registros = useTienda((s) => s.registros);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [referencia, setReferencia] = useState(() => new Date());
  const [elegido, setElegido] = useState<string | null>(null);
  const esTareas = tipo === "tareas";

  const resumen = useMemo(() => {
    const hechos = esTareas ? hechosDeTareas(tareas) : hechosDeHabitos(habitos, registros);
    const grupos = esTareas ? gruposDeEtiquetas(etiquetas) : gruposDeHabitos(habitos);
    return resumir(hechos, grupos, periodo, referencia);
  }, [esTareas, tareas, etiquetas, habitos, registros, periodo, referencia]);

  // Si el grupo elegido no tiene nada en este período, se suelta.
  const elegidoVisible = elegido !== null && resumen.filas.some((f) => f.clave === elegido) ? elegido : null;
  const alElegir = (clave: string) => setElegido((e) => (e === clave ? null : clave));

  const mover = (paso: number) => setReferencia((r) => moverPeriodo(periodo, r, paso));
  const vacio = esTareas ? "No completaste tareas en este período." : "No hay días cumplidos en este período.";

  // Como el boceto: arriba el período; abajo una tarjeta con el anillo, la leyenda y las ondas.
  // La tarjeta se reparte en cuadrados (en el celular y en el computador): anillo y etiquetas arriba (una mitad cada uno) y las ondas en la mitad de abajo.
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-3 ${EN_WIDGET ? "p-3" : "p-4 lg:p-5"}`}>
      {!EN_WIDGET && <h1 className="text-xl font-semibold">{esTareas ? "Mis tareas completadas" : "Mis hábitos cumplidos"}</h1>}
      <header className="shrink-0 rounded-2xl border border-borde bg-panel px-3 py-2.5 shadow-sm">
        <div role="group" aria-label="Período" className="mx-auto flex max-w-md gap-1 rounded-full bg-suave p-1">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)} className={`flex-1 rounded-full px-2 py-1 text-xs transition-colors ${periodo === p.id ? "bg-acento font-medium text-sobre-acento shadow-sm" : "text-tenue hover:text-texto"}`}>
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-center gap-3">
          <button type="button" aria-label="Período anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => mover(-1)}>
            <ChevronLeft size={18} />
          </button>
          <span data-testid="titulo-periodo" className="min-w-28 text-center text-sm font-medium">
            {tituloPeriodo(periodo, referencia)}
          </span>
          <button type="button" aria-label="Período siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => mover(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-borde bg-panel p-3 shadow-sm">
        {resumen.total === 0 ? (
          <p className="m-auto px-6 text-center text-sm text-tenue">{vacio}</p>
        ) : (
          <>
            <div className={`flex shrink-0 items-center gap-3 h-[calc(50%-0.25rem)]`}>
              <Circular clase="aspect-square max-h-full w-full" claseCaja="h-full w-1/2 items-center" filas={resumen.filas} total={resumen.total} elegido={elegidoVisible} alElegir={alElegir} unidad={esTareas ? (resumen.total === 1 ? "tarea" : "tareas") : resumen.total === 1 ? "día" : "días"} />
              <ul aria-label={esTareas ? "Por etiqueta" : "Por hábito"} className={`max-h-full min-w-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-borde p-2 self-stretch`}>
                {resumen.filas.map((f) => (
                  <li key={f.clave} style={{ opacity: opacidad(f.clave, elegidoVisible) }} className="transition-opacity">
                    <button type="button" aria-pressed={elegidoVisible === f.clave} data-testid="fila-grupo" onClick={() => alElegir(f.clave)} className="flex w-full items-center gap-2 text-left text-xs">
                      <span title={f.nombre} className="min-w-0 flex-1 truncate rounded-full px-2.5 py-1 font-medium" style={{ background: `color-mix(in srgb, ${f.color} 30%, transparent)`, boxShadow: elegidoVisible === f.clave ? `inset 0 0 0 1.5px ${f.color}` : undefined }}>
                        {f.nombre}
                      </span>
                      <span className="shrink-0 text-tenue tabular-nums">
                        {f.cantidad} • {f.porcentaje}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-2 min-h-0 flex-1">
              <Areas llenar resumen={resumen} elegido={elegidoVisible} alElegir={alElegir} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
