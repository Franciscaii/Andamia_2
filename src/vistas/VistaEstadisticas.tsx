import { useId, useEffect, useMemo, useRef, useState } from "react";
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

export type TipoEstadistica = "tareas" | "habitos";

const ATENUADO = 0.22;
const opacidad = (clave: string, elegido: string | null) => (elegido === null || elegido === clave ? 1 : ATENUADO);

// ---------- Gráfico circular ----------

function puntoEnCirculo(cx: number, cy: number, r: number, angulo: number) {
  const a = ((angulo - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arco(cx: number, cy: number, rExt: number, rInt: number, desde: number, hasta: number): string {
  // Un círculo completo se dibuja en dos mitades.
  if (hasta - desde >= 359.99) return `${arco(cx, cy, rExt, rInt, 0, 180)} ${arco(cx, cy, rExt, rInt, 180, 360)}`;
  const grande = hasta - desde > 180 ? 1 : 0;
  const a = puntoEnCirculo(cx, cy, rExt, desde);
  const b = puntoEnCirculo(cx, cy, rExt, hasta);
  const c = puntoEnCirculo(cx, cy, rInt, hasta);
  const d = puntoEnCirculo(cx, cy, rInt, desde);
  return `M${a.x},${a.y} A${rExt},${rExt} 0 ${grande} 1 ${b.x},${b.y} L${c.x},${c.y} A${rInt},${rInt} 0 ${grande} 0 ${d.x},${d.y} Z`;
}

function Circular({ filas, total, elegido, alElegir, unidad }: { filas: FilaResumen[]; total: number; elegido: string | null; alElegir: (c: string) => void; unidad: string }) {
  const tam = 180;
  const c = tam / 2;
  let angulo = 0;
  const fila = filas.find((f) => f.clave === elegido);
  return (
    <figure data-testid="grafico-circular" className="flex justify-center">
      <svg viewBox={`0 0 ${tam} ${tam}`} className="h-48 w-48" role="img" aria-label={`Reparto por grupo: ${filas.map((f) => `${f.nombre} ${f.porcentaje}%`).join(", ")}`}>
        {filas.map((f) => {
          const desde = angulo;
          angulo += (f.cantidad / total) * 360;
          return (
            <path
              key={f.clave}
              data-clave={f.clave}
              d={arco(c, c, 86, 62, desde, angulo)}
              fill={f.color}
              stroke="var(--panel)"
              strokeWidth={3}
              strokeLinejoin="round"
              opacity={opacidad(f.clave, elegido)}
              className="cursor-pointer transition-opacity"
              onClick={() => alElegir(f.clave)}
            >
              <title>{`${f.nombre}: ${f.cantidad} (${f.porcentaje}%)`}</title>
            </path>
          );
        })}
        <text x={c} y={c - 4} textAnchor="middle" className="fill-texto text-[22px] font-semibold tabular-nums">
          {fila ? `${fila.porcentaje}%` : total}
        </text>
        <text x={c} y={c + 16} textAnchor="middle" className="fill-tenue text-[11px]">
          {fila ? (fila.nombre.length > 16 ? `${fila.nombre.slice(0, 15)}…` : fila.nombre) : unidad}
        </text>
      </svg>
    </figure>
  );
}

// ---------- Ondas en el tiempo ----------

/**
 * Curva suave tipo "onda": cada tramo es una Bézier con tangentes horizontales en los puntos.
 * Queda redondeada (sin picos) y nunca se pasa de los valores, así no baja de cero.
 */
function onda(puntos: { x: number; y: number }[]): string {
  if (!puntos.length) return "";
  let d = `M${puntos[0].x},${puntos[0].y}`;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    const h = (b.x - a.x) / 2;
    d += ` C${a.x + h},${a.y} ${b.x - h},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

function Areas({ resumen, elegido, alElegir }: { resumen: Resumen; elegido: string | null; alElegir: (c: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  // El lienzo mide lo mismo que su recuadro: así las letras no se agrandan ni las ondas se estiran.
  const caja = useRef<HTMLElement>(null);
  const [ancho, setAncho] = useState(360);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(240, Math.round(el.clientWidth)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const idBase = useId().replace(/:/g, "");
  const alto = 230;
  const margen = { izq: 26, der: 10, arr: 14, aba: 24 };
  const { serie, filas } = resumen;
  const n = serie.length;
  // Cada grupo es su propia onda desde la base (no apiladas): se dibujan primero las más grandes.
  const maximo = Math.max(1, ...serie.flatMap((t) => filas.map((f) => t.valores[f.clave] ?? 0)));
  const x = (i: number) => margen.izq + (n === 1 ? (ancho - margen.izq - margen.der) / 2 : (i / (n - 1)) * (ancho - margen.izq - margen.der));
  const base = alto - margen.aba;
  const y = (v: number) => base - (v / maximo) * (alto - margen.arr - margen.aba);
  const ondas = [...filas]
    .sort((a, b) => b.cantidad - a.cantidad)
    .map((f) => {
      const puntos = serie.map((t, i) => ({ x: x(i), y: y(t.valores[f.clave] ?? 0) }));
      const linea = onda(puntos);
      return { fila: f, linea, area: `${linea} L${puntos[puntos.length - 1].x},${base} L${puntos[0].x},${base} Z` };
    });
  const totales = serie.map((t) => filas.reduce((s, f) => s + (t.valores[f.clave] ?? 0), 0));

  const cadaCuanto = Math.ceil(n / 8);
  const pasoY = maximo <= 4 ? 1 : Math.ceil(maximo / 4);
  const marcasY: number[] = [];
  for (let v = 0; v <= maximo; v += pasoY) marcasY.push(v);

  return (
    <figure ref={caja} data-testid="grafico-areas" className="relative">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="h-auto w-full"
        role="img"
        aria-label="Completadas a lo largo del período, por grupo"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * ancho;
          const i = n === 1 ? 0 : Math.round(((px - margen.izq) / (ancho - margen.izq - margen.der)) * (n - 1));
          setHover(Math.min(n - 1, Math.max(0, i)));
        }}
      >
        <defs>
          {ondas.map(({ fila }, i) => (
            <linearGradient key={fila.clave} id={`${idBase}-o${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fila.color} stopOpacity={0.75} />
              <stop offset="100%" stopColor={fila.color} stopOpacity={0.08} />
            </linearGradient>
          ))}
        </defs>
        {/* Guías: horizontales punteadas con su valor y verticales finas en cada tramo. */}
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={margen.izq} x2={ancho - margen.der} y1={y(v)} y2={y(v)} stroke="var(--borde)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : "2 4"} />
            <text x={margen.izq - 7} y={y(v) + 3.5} textAnchor="end" className="fill-tenue text-[11px] tabular-nums">
              {v}
            </text>
          </g>
        ))}
        {serie.map((_, i) =>
          i % cadaCuanto === 0 || i === n - 1 ? <line key={`v${i}`} x1={x(i)} x2={x(i)} y1={margen.arr} y2={base} stroke="var(--borde)" strokeWidth={1} opacity={0.55} /> : null,
        )}
        {ondas.map(({ fila, area }, i) => (
          <path
            key={fila.clave}
            data-clave={fila.clave}
            d={area}
            fill={`url(#${idBase}-o${i})`}
            fillOpacity={0.85 * opacidad(fila.clave, elegido)}
            className="cursor-pointer transition-[fill-opacity] duration-300"
            onClick={() => alElegir(fila.clave)}
          />
        ))}
        {ondas.map(({ fila, linea }) => (
          <path
            key={`l-${fila.clave}`}
            d={linea}
            fill="none"
            stroke={fila.color}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={opacidad(fila.clave, elegido)}
            pointerEvents="none"
            className="transition-opacity duration-300"
          />
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={margen.arr} y2={base} stroke="var(--tenue)" strokeWidth={1} strokeDasharray="3 3" />
            {ondas.map(({ fila }) => {
              const v = serie[hover].valores[fila.clave] ?? 0;
              return v > 0 ? <circle key={fila.clave} cx={x(hover)} cy={y(v)} r={4} fill="var(--panel)" stroke={fila.color} strokeWidth={2} opacity={opacidad(fila.clave, elegido)} /> : null;
            })}
          </g>
        )}
        {serie.map((t, i) =>
          i % cadaCuanto === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={alto - 6} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} className="fill-tenue text-[11px]">
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
  const unidad = esTareas ? (resumen.total === 1 ? "completada" : "completadas") : resumen.total === 1 ? "día cumplido" : "días cumplidos";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="px-4 pt-4 pb-2 sm:px-6">
        <h1 className="text-xl font-semibold">{esTareas ? "Mis tareas completadas" : "Mis hábitos cumplidos"}</h1>
        <div role="group" aria-label="Período" className="mt-3 flex gap-0.5 rounded-lg bg-suave p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={periodo === p.id}
              onClick={() => setPeriodo(p.id)}
              className={`flex-1 rounded-md px-2 py-1 text-xs transition-colors ${periodo === p.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button type="button" aria-label="Período anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => setReferencia((r) => moverPeriodo(periodo, r, -1))}>
            <ChevronLeft size={18} />
          </button>
          <span data-testid="titulo-periodo" className="text-sm font-medium">
            {tituloPeriodo(periodo, referencia)}
          </span>
          <button type="button" aria-label="Período siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => setReferencia((r) => moverPeriodo(periodo, r, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        {resumen.total === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-borde px-6 py-10 text-center text-sm text-tenue">{esTareas ? "No completaste tareas en este período." : "No hay días cumplidos en este período."}</p>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-borde bg-panel p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-semibold">{esTareas ? "Por etiqueta" : "Por hábito"}</h2>
              <p className="text-xs text-tenue">{esTareas ? "Toca una etiqueta para filtrar la lista de tareas." : "Toca un hábito para filtrar la lista."}</p>
              <ul className="mt-3 space-y-1">
                {resumen.filas.map((f) => (
                  <li key={f.clave} style={{ opacity: opacidad(f.clave, elegidoVisible) }} className="transition-opacity">
                    <button type="button" aria-pressed={elegidoVisible === f.clave} data-testid="fila-grupo" onClick={() => alElegir(f.clave)} className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-suave ${elegidoVisible === f.clave ? "bg-suave" : ""}`}>
                      <span className="flex items-center gap-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                        <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
                        <span className="shrink-0 text-xs text-tenue tabular-nums">
                          {f.cantidad} • {f.porcentaje}%
                        </span>
                      </span>
                      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-suave">
                        <span className="block h-full rounded-full" style={{ width: `${f.porcentaje}%`, background: f.color }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Circular filas={resumen.filas} total={resumen.total} elegido={elegidoVisible} alElegir={alElegir} unidad={unidad} />
              </div>
            </section>

            <section className="rounded-2xl border border-borde bg-panel p-4 shadow-sm sm:p-5">
              <h2 className="mb-2 text-sm font-semibold">En el tiempo</h2>
              <Areas resumen={resumen} elegido={elegidoVisible} alElegir={alElegir} />
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
