import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { addDays, addMonths, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useTienda } from "../datos/tienda";
import { COLORES_ETIQUETA, COLORES_LISTA, type Etiqueta, type FrecuenciaHabito, type Habito, type Lista, type Prioridad, type RegistroHabito, type Tarea } from "../modelos/tipos";
import { gruposDeEtiquetas, gruposDeHabitos, hechosDeHabitos, hechosDeTareas, resumir, tituloPeriodo, type Resumen } from "./estadisticas";
import { CUADRANTES, repartirEnCuadrantes } from "./matriz";
import { leerEleccion, presetDe, TEMA_INICIAL, TEMAS, temaEfectivo, textoSobre, type Tema } from "./temas";
import type { AspectoWidget } from "./aspectoWidget";
import { diasHasta, fechaDeTarea } from "./fechas";
import { irA } from "./ruta";
import { contenidoDelDia, diasDeSemana, dificultadDe, nombreCortoDia, tituloDelDia } from "./semana";

/** Puente con el widget "Hoy" de Android (android/app/src/main/java/cl/andamia/app). */
interface PluginWidget {
  actualizar(opciones: { datos: string }): Promise<void>;
  pendientes(): Promise<{ ids: string[] }>;
  /** Tareas y eventos escritos en el "+" de los widgets, como JSON (ver TareaRapida.java). */
  rapidas(): Promise<{ items: string }>;
  addListener(evento: "rapida", alAvisar: () => void): Promise<PluginListenerHandle>;
  puedeAnclar(): Promise<{ puede: boolean }>;
  listar(): Promise<{ widgets: { id: number; tipo: string; config: string }[]; tipos?: Record<string, string> }>;
  configurar(opciones: { id: number; config: string }): Promise<void>;
  configurarTipo(opciones: { tipo: string; config: string }): Promise<void>;
  anclar(opciones: { tipo: string }): Promise<{ pedido: boolean }>;
}

const widget = registerPlugin<PluginWidget>("AndamiaWidget");

const MAX_TAREAS = 30;
const NIVEL: Record<Prioridad, number> = { ninguna: 0, baja: 1, media: 2, alta: 3 };

const MAX_POR_SECCION = 15;
/** Semanas que lleva el widget Semana del celular (desde la pasada). */
export const SEMANAS_WIDGET = 6;
const MAX_POR_CELDA = 4;

/** Lo que el widget muestra: el día de hoy como en la semana (eventos, progreso y tareas). */
export function datosDelWidget(tareas: Tarea[], listas: Lista[], ahora: Date = new Date(), etiquetas: Etiqueta[] = []) {
  const { evento, tarea } = filasDe(listas, etiquetas, ahora);
  const hoy = contenidoDelDia(tareas, listas, ahora, ahora);
  return {
    fecha: format(ahora, "yyyy-MM-dd"),
    titulo: tituloDelDia(ahora, ahora),
    eventos: hoy.eventos.slice(0, MAX_TAREAS).map(evento),
    tareas: hoy.tareas.slice(0, MAX_TAREAS).map(tarea),
  };
}

/** Cómo se ve cada evento y cada tarea en las filas de los widgets. */
function filasDe(listas: Lista[], etiquetas: Etiqueta[], ahora: Date) {
  const nombreLista = new Map(listas.map((l) => [l.id, l.nombre]));
  const etiquetaPorNombre = new Map(etiquetas.map((e) => [e.nombre, e]));
  const hora = (t: Tarea) => {
    const fecha = fechaDeTarea(t);
    return fecha && !t.todoElDia ? format(fecha, "HH:mm") : "";
  };
  return {
    evento: (t: Tarea) => ({ id: t.id, titulo: t.titulo, hora: hora(t), color: t.colorEvento ?? "" }),
    tarea: (t: Tarea) => {
      const lista = t.listaId !== "bandeja" ? nombreLista.get(t.listaId) ?? "" : "";
      const etiqueta = t.etiquetas[0] ? etiquetaPorNombre.get(t.etiquetas[0]) : undefined;
      return {
        id: t.id,
        titulo: t.titulo,
        detalle: [hora(t), lista].filter(Boolean).join(" · "),
        atrasada: t.estado === "pendiente" && (diasHasta(t, ahora) ?? 0) < 0,
        hecha: t.estado === "completada",
        /** Importancia. */
        prioridad: NIVEL[t.prioridad] ?? 0,
        dificultad: NIVEL[dificultadDe(t)] ?? 0,
        etiqueta: etiqueta?.nombreVisible ?? t.etiquetas[0] ?? "",
        colorEtiqueta: etiqueta?.color ?? "",
      };
    },
  };
}

interface Estado {
  tareas: Tarea[];
  listas: Lista[];
  etiquetas: Etiqueta[];
  habitos: Habito[];
  registros: RegistroHabito[];
}

/**
 * Widget "Semana" del celular: los 7 días de esta semana, cada uno con sus eventos y tareas.
 * El widget muestra un solo día a la vez (como "Día" en la app) y se elige tocando la tira de días.
 */
export function diasDeSemanaWidget(e: Estado, ahora: Date) {
  const { evento, tarea } = filasDe(e.listas, e.etiquetas, ahora);
  // La semana pasada, esta y las 4 siguientes: el widget se mueve entre ellas con sus flechas.
  const lunes = addDays(diasDeSemana(ahora)[0], -7);
  const dias = Array.from({ length: SEMANAS_WIDGET * 7 }, (_, i) => addDays(lunes, i));
  return dias.map((dia) => {
    const c = contenidoDelDia(e.tareas, e.listas, dia, ahora);
    const pendientes = c.tareas.filter((t) => t.estado === "pendiente");
    const hechas = c.tareas.filter((t) => t.estado === "completada");
    return {
      fecha: format(dia, "yyyy-MM-dd"),
      nombre: nombreCortoDia(dia),
      numero: dia.getDate(),
      mes: format(dia, "MMM", { locale: es }).replace(".", ""),
      hoy: isSameDay(dia, ahora),
      titulo: tituloDelDia(dia, ahora),
      eventos: c.eventos.slice(0, MAX_TAREAS).map(evento),
      tareas: [...pendientes, ...hechas].slice(0, MAX_TAREAS).map(tarea),
    };
  });
}

/** Widget "Matriz": los cuatro cuadrantes, numerados como en la app, con sus pendientes. */
export function filasDeMatriz(e: Estado, ahora: Date) {
  const { tarea } = filasDe(e.listas, e.etiquetas, ahora);
  const reparto = repartirEnCuadrantes(e.tareas, e.listas, { listaId: null, etiqueta: null });
  return CUADRANTES.flatMap((c, i) => [
    { tipo: "seccion", titulo: `${i + 1}  ${c.nombre}  ${reparto[c.id].length}`, nivel: NIVEL[c.prioridad] },
    ...reparto[c.id].filter((t) => !t.esEvento).slice(0, MAX_POR_SECCION).map((t) => ({ tipo: "tarea", ...tarea(t) })),
  ]);
}

/** Widget "Calendario": un mes (por defecto el de hoy), de lunes a domingo, con lo que tiene cada día. */
export function mesDelWidget(e: Estado, ahora: Date, base: Date = ahora) {
  const inicio = startOfWeek(startOfMonth(base), { weekStartsOn: 1 });
  const fin = endOfMonth(base);
  const celdas = [];
  for (let dia = inicio; dia <= fin || celdas.length % 7 !== 0; dia = addDays(dia, 1)) {
    const c = contenidoDelDia(e.tareas, e.listas, dia, ahora);
    const entradas = [
      ...c.eventos.map((t) => ({ titulo: t.titulo, color: t.colorEvento ?? "", evento: true, hecha: false, nivel: 0 })),
      ...c.tareas.map((t) => ({ titulo: t.titulo, color: "", evento: false, hecha: t.estado === "completada", nivel: NIVEL[t.prioridad] ?? 0 })),
    ];
    celdas.push({
      fecha: format(dia, "yyyy-MM-dd"),
      dia: dia.getDate(),
      delMes: isSameMonth(dia, base),
      hoy: isSameDay(dia, ahora),
      entradas: entradas.slice(0, MAX_POR_CELDA),
      total: entradas.length,
      eventos: c.eventos.length,
    });
  }
  const mes = format(base, "MMMM yyyy", { locale: es });
  const corto = format(base, "MMM", { locale: es }).replace(".", "");
  return {
    titulo: mes.charAt(0).toUpperCase() + mes.slice(1),
    // Como en la app: "Nov", y el año solo si no es el actual.
    corto: corto.charAt(0).toUpperCase() + corto.slice(1) + (base.getFullYear() !== ahora.getFullYear() ? ` ${base.getFullYear()}` : ""),
    actual: isSameMonth(base, ahora),
    celdas,
  };
}

/** Meses que el widget Calendario puede mostrar con sus flechas: desde 2 antes hasta 6 después del actual. */
export const MESES_ANTES_WIDGET = 2;
export const MESES_DESPUES_WIDGET = 6;

export function mesesDelWidget(e: Estado, ahora: Date) {
  return Array.from({ length: MESES_ANTES_WIDGET + MESES_DESPUES_WIDGET + 1 }, (_, i) => mesDelWidget(e, ahora, addMonths(ahora, i - MESES_ANTES_WIDGET)));
}

function resumenParaWidget(r: Resumen, titulo: string, periodo: string) {
  const filas = r.filas.slice(0, 8);
  return {
    titulo,
    periodo,
    total: r.total,
    filas: filas.map((f) => ({ nombre: f.nombre, color: f.color, cantidad: f.cantidad, porcentaje: f.porcentaje })),
    serie: r.serie.map((s) => ({ etiqueta: s.etiqueta, valores: filas.map((f) => s.valores[f.clave] ?? 0) })),
  };
}

/** Widgets de estadísticas: lo cumplido esta semana, por etiqueta (tareas) o por hábito. */
export function estadisticasDelWidget(e: Estado, ahora: Date) {
  const periodo = tituloPeriodo("semana", ahora, ahora);
  return {
    tareas: resumenParaWidget(resumir(hechosDeTareas(e.tareas), gruposDeEtiquetas(e.etiquetas), "semana", ahora), "Tareas completadas", periodo),
    habitos: resumenParaWidget(resumir(hechosDeHabitos(e.habitos, e.registros), gruposDeHabitos(e.habitos), "semana", ahora), "Hábitos cumplidos", periodo),
  };
}

/** Mezcla dos colores #rrggbb: pct% del primero y el resto del segundo (como color-mix en la app). */
export function mezclarHex(a: string, pct: number, b: string): string {
  const rgb = (h: string) => {
    let x = h.replace("#", "");
    if (x.length === 3) x = x.replace(/./g, (c) => c + c);
    const n = parseInt(x.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round((v * pct + y[i] * (100 - pct)) / 100).toString(16).padStart(2, "0")).join("")}`;
}

/** Colores del tema de la app para los widgets: fondo, textos, gris suave y acento. */
export function temaParaWidget(t: Tema) {
  return {
    fondo: t.panel,
    texto: t.texto,
    tenue: mezclarHex(t.texto, 62, t.panel),
    suave: mezclarHex(t.texto, 8, t.panel),
    acento: t.acento,
    sobreAcento: textoSobre(t.acento),
  };
}

/** Todo lo que leen los widgets de Android. */
export function datosDeWidgets(e: Estado, ahora: Date = new Date()) {
  let acento = "";
  try {
    acento = temaEfectivo(leerEleccion()).acento;
  } catch {
    // Sin tema guardado.
  }
  // Cada widget elige su propio tema en el apartado Widgets; mientras no elija, usa Clásico.
  const tema = temaParaWidget(presetDe(TEMA_INICIAL));
  return {
    ...datosDelWidget(e.tareas, e.listas, ahora, e.etiquetas),
    acento,
    tema,
    semanaDias: diasDeSemanaWidget(e, ahora),
    matriz: filasDeMatriz(e, ahora),
    mes: mesDelWidget(e, ahora),
    meses: mesesDelWidget(e, ahora),
    estadisticas: estadisticasDelWidget(e, ahora),
    formulario: formularioDelWidget(e),
  };
}

/** Opciones del cuadro "+" de los widgets: las índoles (etiquetas) y los colores, como en la app. */
export function formularioDelWidget(e: Pick<Estado, "etiquetas">) {
  return {
    indoles: e.etiquetas.map((t) => ({ clave: t.nombre, nombre: t.nombreVisible, color: t.color })),
    coloresEvento: COLORES_ETIQUETA,
    coloresHabito: COLORES_LISTA,
  };
}

let ultimoEnviado = "";
let temporizador: ReturnType<typeof setTimeout> | null = null;

function enviarAlWidget(): void {
  const estado = useTienda.getState();
  if (estado.cargando) return;
  const datos = JSON.stringify(datosDeWidgets(estado));
  if (datos === ultimoEnviado) return;
  ultimoEnviado = datos;
  void widget.actualizar({ datos }).catch(() => {
    ultimoEnviado = "";
  });
}

function programarEnvio(): void {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(enviarAlWidget, 400);
}

/** ¿Se pueden poner widgets en la pantalla de inicio desde la app? */
export async function puedeAnclarWidget(): Promise<boolean> {
  try {
    return (await widget.puedeAnclar()).puede;
  } catch {
    return false;
  }
}

/** Cómo se ve un widget puesto: su tema, transparencia y esquinas (cada uno el suyo). */
export interface ConfigWidget extends AspectoWidget {
  temaId: string;
}

export const CONFIG_INICIAL: ConfigWidget = { temaId: TEMA_INICIAL, transparencia: 0, esquinas: 20 };

export interface WidgetPuesto {
  id: number;
  tipo: string;
  config: ConfigWidget;
}

function leerConfig(json: string): ConfigWidget {
  try {
    const c = JSON.parse(json);
    if (c && typeof c === "object") {
      return {
        temaId: TEMAS.some((t) => t.id === c.temaId) ? c.temaId : CONFIG_INICIAL.temaId,
        transparencia: typeof c.transparencia === "number" ? c.transparencia : CONFIG_INICIAL.transparencia,
        esquinas: typeof c.esquinas === "number" ? c.esquinas : CONFIG_INICIAL.esquinas,
      };
    }
  } catch {
    // Sin configurar todavía.
  }
  return CONFIG_INICIAL;
}

/** Lo que se guarda en el celular para un widget: los colores ya calculados de su tema. */
export function configParaAndroid(c: ConfigWidget): string {
  return JSON.stringify({ ...c, tema: temaParaWidget(presetDe(c.temaId)) });
}

/** Los widgets que están puestos en la pantalla de inicio, con su configuración. */
export async function widgetsPuestos(): Promise<WidgetPuesto[]> {
  try {
    const { widgets } = await widget.listar();
    return widgets.map((w) => ({ id: w.id, tipo: w.tipo, config: leerConfig(w.config) }));
  } catch {
    return [];
  }
}

/**
 * Ajustes por tipo de widget (Semana, Calendario...) y cuántos hay puestos de cada uno.
 * Si un tipo no tiene ajustes propios todavía, toma los del primero que esté puesto.
 */
export async function widgetsPorTipo(): Promise<Record<string, { puestos: number; config: ConfigWidget }>> {
  try {
    const { widgets, tipos = {} } = await widget.listar();
    const resultado: Record<string, { puestos: number; config: ConfigWidget }> = {};
    for (const [tipo, json] of Object.entries(tipos)) resultado[tipo] = { puestos: 0, config: leerConfig(json) };
    for (const w of widgets) {
      const actual = resultado[w.tipo] ?? { puestos: 0, config: leerConfig(w.config) };
      resultado[w.tipo] = { ...actual, puestos: actual.puestos + 1 };
    }
    return resultado;
  } catch {
    return {};
  }
}

/** Guarda tema, transparencia y esquinas de un tipo de widget y los aplica a todos los de ese tipo. */
export async function configurarTipoWidget(tipo: string, c: ConfigWidget): Promise<void> {
  try {
    await widget.configurarTipo({ tipo, config: configParaAndroid(c) });
  } catch {
    // Sin el plugin (navegador): no hay widgets que cambiar.
  }
}

export async function configurarWidget(id: number, c: ConfigWidget): Promise<void> {
  try {
    await widget.configurar({ id, config: configParaAndroid(c) });
  } catch {
    // Sin el plugin (navegador): no hay widgets que cambiar.
  }
}

/** Pide al celular poner ese widget en la pantalla de inicio. */
export async function anclarWidget(tipo: string): Promise<boolean> {
  try {
    return (await widget.anclar({ tipo })).pedido;
  } catch {
    return false;
  }
}

/** Lo que se escribió en el "+" de un widget sin abrir la app (cola de TareaRapida.java). */
export interface NuevaDesdeWidget {
  id: string;
  /** Las de la 1.10 no traen tipo: se deduce de "evento". */
  tipo?: "tarea" | "evento" | "habito";
  titulo: string;
  fecha: string;
  evento: boolean;
  prioridad?: Prioridad;
  dificultad?: Prioridad;
  indole?: string;
  color?: string;
  icono?: string;
  frecuencia?: FrecuenciaHabito;
}

const NIVELES_VALIDOS: Prioridad[] = ["alta", "media", "baja", "ninguna"];
const nivelValido = (v: unknown): Prioridad => (NIVELES_VALIDOS.includes(v as Prioridad) ? (v as Prioridad) : "ninguna");

/** Frecuencia de un hábito escrito en el widget; si viene rara, diaria. */
export function frecuenciaValida(f: unknown): FrecuenciaHabito {
  const o = f as { tipo?: unknown; dias?: unknown; veces?: unknown } | null;
  if (o?.tipo === "dias" && Array.isArray(o.dias)) {
    const dias = [...new Set(o.dias.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort();
    if (dias.length > 0) return { tipo: "dias", dias };
  }
  if (o?.tipo === "semanal" && typeof o.veces === "number") return { tipo: "semanal", veces: Math.min(7, Math.max(1, Math.round(o.veces))) };
  return { tipo: "diaria" };
}

/** Crea en Andamia una tarea, un evento o un hábito escrito en el widget; devuelve el id de la tarea creada. */
async function crearDesdeWidget(n: NuevaDesdeWidget): Promise<string | null> {
  const tienda = useTienda.getState();
  const tipo = n.tipo ?? (n.evento ? "evento" : "tarea");
  if (tipo === "habito") {
    await tienda.crearHabito({
      nombre: n.titulo,
      icono: typeof n.icono === "string" && n.icono ? n.icono : "estrella",
      color: typeof n.color === "string" && /^#[0-9a-f]{6}$/i.test(n.color) ? n.color : COLORES_LISTA[4],
      frecuencia: frecuenciaValida(n.frecuencia),
      metaDiaria: 1,
      unidad: "",
      inicio: n.fecha,
      recordatorioHora: null,
    });
    return null;
  }
  const esEvento = tipo === "evento";
  const tarea = await tienda.crearTarea({
    titulo: n.titulo,
    esEvento,
    colorEvento: esEvento && typeof n.color === "string" && n.color ? n.color : null,
    vence: n.fecha,
    todoElDia: true,
    prioridad: esEvento ? "ninguna" : nivelValido(n.prioridad),
    dificultad: esEvento ? "ninguna" : nivelValido(n.dificultad),
    etiquetas: typeof n.indole === "string" && n.indole ? [n.indole] : [],
  });
  return tarea?.id ?? null;
}

/** Lee la cola que manda el widget; descarta lo que no tenga forma de tarea. */
export function leerRapidas(json: string): NuevaDesdeWidget[] {
  try {
    const lista: unknown = JSON.parse(json);
    if (!Array.isArray(lista)) return [];
    return lista.filter(
      (n): n is NuevaDesdeWidget =>
        typeof n === "object" && n !== null && typeof n.titulo === "string" && n.titulo.trim() !== "" && typeof n.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.fecha),
    );
  } catch {
    return [];
  }
}

let aplicando: Promise<void> | null = null;

/** Crea lo escrito en los widgets y completa lo que se marcó como hecho ahí. */
function aplicarMarcadasEnWidget(): Promise<void> {
  // Una sola pasada a la vez: el aviso del widget y el "resume" pueden llegar juntos.
  aplicando ??= aplicarAhora().finally(() => {
    aplicando = null;
  });
  return aplicando;
}

async function aplicarAhora(): Promise<void> {
  const estado = useTienda.getState();
  if (estado.cargando) return;
  // Las de la cola se muestran en el widget con un id provisorio; se anota el real.
  const real = new Map<string, string>();
  const { items } = await widget.rapidas();
  for (const n of leerRapidas(items)) {
    const id = await crearDesdeWidget(n);
    if (id && n.id) real.set(n.id, id);
  }
  const { ids } = await widget.pendientes();
  for (const marcado of ids) {
    const id = real.get(marcado) ?? marcado;
    const tarea = useTienda.getState().tareas.find((t) => t.id === id);
    if (tarea && tarea.estado === "pendiente" && tarea.eliminadaEn === null) {
      await useTienda.getState().completarTarea(id, true);
    }
  }
  ultimoEnviado = "";
  programarEnvio();
}

function enfocarEntradaRapida(intentos = 0): void {
  const campo = document.getElementById("entrada-rapida");
  const boton = document.querySelector<HTMLButtonElement>("[data-nueva-tarea]");
  if (campo) campo.focus();
  else if (boton) {
    // En la semana, el + abre un menú: se elige "Tarea" y su campo se enfoca solo.
    boton.click();
    setTimeout(() => document.querySelector<HTMLButtonElement>('[data-crear="tarea"]')?.click(), 0);
  } else if (intentos < 30) setTimeout(() => enfocarEntradaRapida(intentos + 1), 100);
}

/** Abre lo que pidió el widget: andamia://hoy, andamia://nueva, andamia://tarea/ID o la vista de cada widget. */
export function abrirEnlace(url: string): void {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    return;
  }
  if (destino.protocol !== "andamia:") return;
  // La semana abre en el día de hoy.
  const hoy = { tipo: "vista", vista: "semana" } as const;
  if (destino.host === "nueva") {
    irA(hoy);
    enfocarEntradaRapida();
  } else if (destino.host === "dia") {
    // El día elegido en el widget Semana: la Semana lo abre en "Día".
    const fecha = destino.pathname.replace(/^\//, "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) void import("../vistas/VistaSemana").then((m) => m.verDiaEnSemana(parseISO(fecha)));
    else irA(hoy);
  } else if (destino.host === "calendario") {
    irA({ tipo: "calendario", modo: "mes" });
  } else if (destino.host === "matriz") {
    irA({ tipo: "matriz" });
  } else if (destino.host === "estadisticas") {
    irA({ tipo: "estadisticas", de: destino.pathname.includes("habitos") ? "habitos" : "tareas" });
  } else if (destino.host === "tarea") {
    const id = decodeURIComponent(destino.pathname.replace(/^\//, ""));
    irA(hoy, id || null);
  } else {
    irA(hoy);
  }
}

export async function iniciarWidgetAndroid(): Promise<void> {
  useTienda.subscribe((estado, previo) => {
    if (previo.cargando && !estado.cargando) void aplicarMarcadasEnWidget();
    if (
      estado.tareas !== previo.tareas ||
      estado.listas !== previo.listas ||
      estado.etiquetas !== previo.etiquetas ||
      estado.habitos !== previo.habitos ||
      estado.registros !== previo.registros ||
      estado.eleccionTema !== previo.eleccionTema ||
      estado.cargando !== previo.cargando
    )
      programarEnvio();
  });
  await App.addListener("appUrlOpen", ({ url }) => abrirEnlace(url));
  // Con la app viva, lo escrito en el "+" de un widget se crea al instante.
  await widget.addListener("rapida", () => void aplicarMarcadasEnWidget());
  await App.addListener("resume", () => {
    void aplicarMarcadasEnWidget();
    // Al volver otro día, "Hoy" cambia aunque no cambien las tareas.
    ultimoEnviado = "";
    programarEnvio();
  });
  const inicio = await App.getLaunchUrl();
  if (inicio?.url) abrirEnlace(inicio.url);
  void aplicarMarcadasEnWidget();
  programarEnvio();
}
