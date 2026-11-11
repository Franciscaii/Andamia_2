import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
/** Cómo se llama cada tramo del gráfico según el período. */
const NOMBRE_TRAMO: Record<Periodo, string> = { dia: "bloque de 2 h", semana: "día", mes: "día", anio: "mes" };
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
      <svg viewBox={`0 0 ${tam} ${tam}`} className="h-44 w-44" role="img" aria-label={`Reparto por grupo: ${filas.map((f) => `${f.nombre} ${f.porcentaje}%`).join(", ")}`}>
        {filas.map((f) => {
          const desde = angulo;
          angulo += (f.cantidad / total) * 360;
          return (
            <path
              key={f.clave}
              data-clave={f.clave}
              d={arco(c, c, 84, 58, desde, angulo)}
              fill={f.color}
              stroke="var(--panel)"
              strokeWidth={2}
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

// ---------- Gráfico de áreas apiladas ----------

/** Curva suave que no se pasa de los puntos (monótona), para que las áreas no se crucen. */
function curva(puntos: { x: number; y: number }[]): string {
  const n = puntos.length;
  if (n === 0) return "";
  if (n === 1) return `L${puntos[0].x},${puntos[0].y}`;
  const m: number[] = [];
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((puntos[i + 1].y - puntos[i].y) / (puntos[i + 1].x - puntos[i].x));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let camino = "";
  for (let i = 0; i < n - 1; i++) {
    const h = (puntos[i + 1].x - puntos[i].x) / 3;
    camino += ` C${puntos[i].x + h},${puntos[i].y + m[i] * h} ${puntos[i + 1].x - h},${puntos[i + 1].y - m[i + 1] * h} ${puntos[i + 1].x},${puntos[i + 1].y}`;
  }
  return camino;
}

function Areas({ resumen, elegido, alElegir }: { resumen: Resumen; elegido: string | null; alElegir: (c: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  // Lienzo angosto: en el celular los textos del eje se leen bien.
  const ancho = 360;
  const alto = 190;
  const margen = { izq: 22, der: 6, arr: 8, aba: 20 };
  const { serie, filas } = resumen;
  const n = serie.length;
  const totales = serie.map((t) => filas.reduce((s, f) => s + (t.valores[f.clave] ?? 0), 0));
  const maximo = Math.max(1, ...totales);
  const x = (i: number) => margen.izq + (n === 1 ? 0 : (i / (n - 1)) * (ancho - margen.izq - margen.der));
  const y = (v: number) => alto - margen.aba - (v / maximo) * (alto - margen.arr - margen.aba);

  // Apilar en el orden de la lista: el grupo más grande queda abajo.
  const base = new Array(n).fill(0);
  const capas = filas.map((f) => {
    const abajo = [...base];
    const arriba = serie.map((t, i) => (base[i] += t.valores[f.clave] ?? 0));
    const sup = arriba.map((v, i) => ({ x: x(i), y: y(v) }));
    const inf = abajo.map((v, i) => ({ x: x(i), y: y(v) })).reverse();
    const d = `M${sup[0].x},${sup[0].y}${curva(sup)} L${inf[0].x},${inf[0].y}${curva(inf)} Z`;
    return { fila: f, d };
  });

  const cadaCuanto = Math.ceil(n / 7);
  const pasoY = maximo <= 4 ? 1 : Math.ceil(maximo / 4);
  const marcasY: number[] = [];
  for (let v = 0; v <= maximo; v += pasoY) marcasY.push(v);

  return (
    <figure data-testid="grafico-areas" className="relative">
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="h-auto w-full"
        role="img"
        aria-label="Completadas a lo largo del período, apiladas por grupo"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const caja = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - caja.left) / caja.width) * ancho;
          const i = Math.round(((px - margen.izq) / (ancho - margen.izq - margen.der)) * (n - 1));
          setHover(Math.min(n - 1, Math.max(0, i)));
        }}
      >
        {marcasY.map((v) => (
          <g key={v}>
            <line x1={margen.izq} x2={ancho - margen.der} y1={y(v)} y2={y(v)} stroke="var(--borde)" strokeWidth={1} />
            <text x={margen.izq - 6} y={y(v) + 4} textAnchor="end" className="fill-tenue text-[10px] tabular-nums">
              {v}
            </text>
          </g>
        ))}
        {capas.map(({ fila, d }) => (
          <path
            key={fila.clave}
            data-clave={fila.clave}
            d={d}
            fill={fila.color}
            fillOpacity={0.85 * opacidad(fila.clave, elegido)}
            stroke="var(--panel)"
            strokeWidth={2}
            className="cursor-pointer transition-[fill-opacity]"
            onClick={() => alElegir(fila.clave)}
          />
        ))}
        {serie.map((t, i) =>
          i % cadaCuanto === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={alto - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-tenue text-[10px]">
              {t.etiqueta}
            </text>
          ) : null,
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={margen.arr} y2={alto - margen.aba} stroke="var(--tenue)" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none" />}
      </svg>
      {hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-1 z-10 min-w-[8rem] rounded-md border border-borde bg-panel px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: `${(x(hover) / ancho) * 100}%`, transform: x(hover) > ancho / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
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

  // Cifras para las tarjetas de arriba.
  const tramo = NOMBRE_TRAMO[periodo];
  const totalesTramo = resumen.serie.map((t) => Object.values(t.valores).reduce((a, b) => a + b, 0));
  const promedio = resumen.serie.length ? resumen.total / resumen.serie.length : 0;
  const iMejor = totalesTramo.reduce((m, v, i) => (v > totalesTramo[m] ? i : m), 0);
  const principal = resumen.filas[0];
  const recientes = resumen.hechos.slice(0, 6);
  const colorDe = new Map(resumen.filas.map((f) => [f.clave, f]));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto w-full max-w-5xl px-4 pt-4 pb-3 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h1 className="text-xl font-semibold">{esTareas ? "Mis tareas completadas" : "Mis hábitos cumplidos"}</h1>
            <p className="text-xs text-tenue">{esTareas ? "Cuánto avanzas y en qué ámbitos." : "Qué tan constante eres con cada hábito."}</p>
          </div>
          <div role="group" aria-label="Período" className="flex gap-0.5 rounded-lg bg-suave p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={periodo === p.id}
                onClick={() => setPeriodo(p.id)}
                className={`rounded-md px-3 py-1 text-xs ${periodo === p.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1">
          <button type="button" aria-label="Período anterior" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => setReferencia((r) => moverPeriodo(periodo, r, -1))}>
            <ChevronLeft size={18} />
          </button>
          <span data-testid="titulo-periodo" className="min-w-0 text-sm font-medium first-letter:uppercase">
            {tituloPeriodo(periodo, referencia)}
          </span>
          <button type="button" aria-label="Período siguiente" className="rounded-md p-1 text-tenue hover:bg-suave" onClick={() => setReferencia((r) => moverPeriodo(periodo, r, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        {resumen.total === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-borde bg-panel/60 px-6 py-12 text-center">
            <p className="text-sm font-medium">{esTareas ? "No completaste tareas en este período." : "No hay días cumplidos en este período."}</p>
            <p className="mt-1 text-xs text-tenue">Prueba con otro período o vuelve cuando marques algo como hecho.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div data-testid="cifras" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Cifra titulo={esTareas ? "Completadas" : "Días cumplidos"} valor={String(resumen.total)} destacada />
              <Cifra titulo={`Promedio por ${tramo}`} valor={promedio >= 10 ? String(Math.round(promedio)) : promedio.toFixed(1).replace(".", ",")} />
              <Cifra titulo={`Mejor ${tramo}`} valor={String(totalesTramo[iMejor] ?? 0)} detalle={periodo === "mes" ? `Día ${resumen.serie[iMejor]?.etiqueta}` : periodo === "dia" ? `Desde las ${resumen.serie[iMejor]?.etiqueta}` : resumen.serie[iMejor]?.etiqueta} />
              <Cifra titulo={esTareas ? "Ámbito principal" : "Hábito principal"} valor={`${principal.porcentaje}%`} detalle={principal.nombre} color={principal.color} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <section className="rounded-2xl border border-borde bg-panel p-4 shadow-sm sm:p-5">
                <h2 className="text-sm font-semibold">{esTareas ? "Por etiqueta" : "Por hábito"}</h2>
                <p className="text-xs text-tenue">{esTareas ? "Toca una etiqueta para resaltarla." : "Toca un hábito para resaltarlo."}</p>
                <div className="mt-3">
                  <Circular filas={resumen.filas} total={resumen.total} elegido={elegidoVisible} alElegir={alElegir} unidad={unidad} />
                </div>
                <ul className="mt-3 space-y-0.5">
                  {resumen.filas.map((f) => (
                    <li key={f.clave} style={{ opacity: opacidad(f.clave, elegidoVisible) }} className="transition-opacity">
                      <button type="button" aria-pressed={elegidoVisible === f.clave} data-testid="fila-grupo" onClick={() => alElegir(f.clave)} className={`w-full rounded-lg px-2 py-1.5 text-left hover:bg-suave ${elegidoVisible === f.clave ? "bg-suave" : ""}`}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.color }} />
                          <span className="min-w-0 flex-1 truncate">{f.nombre}</span>
                          <span className="shrink-0 text-xs tabular-nums">
                            <span className="font-medium">{f.cantidad}</span>
                            <span className="text-tenue"> · {f.porcentaje}%</span>
                          </span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-suave">
                          <span className="block h-full rounded-full" style={{ width: `${f.porcentaje}%`, background: f.color }} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="space-y-4">
                <section className="rounded-2xl border border-borde bg-panel p-4 shadow-sm sm:p-5">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold">En el tiempo</h2>
                    {resumen.filas.length > 1 && (
                      <ul aria-label="Leyenda" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-tenue">
                        {resumen.filas.map((f) => (
                          <li key={f.clave} className="flex items-center gap-1" style={{ opacity: opacidad(f.clave, elegidoVisible) }}>
                            <span className="h-2 w-2 rounded-full" style={{ background: f.color }} />
                            {f.nombre}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <Areas resumen={resumen} elegido={elegidoVisible} alElegir={alElegir} />
                </section>

                <section className="rounded-2xl border border-borde bg-panel p-4 shadow-sm sm:p-5">
                  <h2 className="mb-2 text-sm font-semibold">{esTareas ? "Últimas completadas" : "Últimos días cumplidos"}</h2>
                  <ul className="divide-y divide-borde">
                    {recientes.map((h) => (
                      <li key={h.id} className="flex items-center gap-2.5 py-2 text-sm" style={{ opacity: opacidad(h.grupo, elegidoVisible) }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorDe.get(h.grupo)?.color ?? "var(--tenue)" }} />
                        <span className="min-w-0 flex-1 truncate">{h.titulo || "Sin título"}</span>
                        <span className="shrink-0 text-xs text-tenue tabular-nums">{format(h.momento, esTareas ? "d MMM, HH:mm" : "d MMM", { locale: es })}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** Tarjeta con una cifra grande y su explicación. */
function Cifra({ titulo, valor, detalle, color, destacada = false }: { titulo: string; valor: string; detalle?: string; color?: string; destacada?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3.5 shadow-sm ${destacada ? "border-transparent bg-acento text-sobre-acento" : "border-borde bg-panel"}`}>
      <p className={`text-[11px] font-medium uppercase tracking-wide ${destacada ? "opacity-80" : "text-tenue"}`}>{titulo}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
      {detalle && (
        <p className={`mt-0.5 flex items-center gap-1.5 truncate text-xs ${destacada ? "opacity-80" : "text-tenue"}`}>
          {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
          <span className="truncate">{detalle}</span>
        </p>
      )}
    </div>
  );
}
