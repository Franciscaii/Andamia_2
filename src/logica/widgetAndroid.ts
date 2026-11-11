import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { addDays, endOfMonth, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useTienda } from "../datos/tienda";
import type { Etiqueta, Habito, Lista, Prioridad, RegistroHabito, Tarea } from "../modelos/tipos";
import { gruposDeEtiquetas, gruposDeHabitos, hechosDeHabitos, hechosDeTareas, resumir, tituloPeriodo, type Resumen } from "./estadisticas";
import { CUADRANTES, repartirEnCuadrantes } from "./matriz";
import { leerEleccion, temaEfectivo } from "./temas";
import { diasHasta, fechaDeTarea } from "./fechas";
import { irA } from "./ruta";
import { contenidoDelDia, diasDeSemana, dificultadDe, nombreCortoDia, tituloDelDia } from "./semana";

/** Puente con el widget "Hoy" de Android (android/app/src/main/java/cl/andamia/app). */
interface PluginWidget {
  actualizar(opciones: { datos: string }): Promise<void>;
  pendientes(): Promise<{ ids: string[] }>;
}

const widget = registerPlugin<PluginWidget>("AndamiaWidget");

const MAX_TAREAS = 30;
const NIVEL: Record<Prioridad, number> = { ninguna: 0, baja: 1, media: 2, alta: 3 };

const MAX_POR_SECCION = 15;
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

/** Widget "Semana": cada día de esta semana con sus eventos y tareas, en filas. */
export function filasDeSemana(e: Estado, ahora: Date) {
  const { evento, tarea } = filasDe(e.listas, e.etiquetas, ahora);
  return diasDeSemana(ahora).flatMap((dia) => {
    const c = contenidoDelDia(e.tareas, e.listas, dia, ahora);
    const pendientes = c.tareas.filter((t) => t.estado === "pendiente");
    const hechas = c.tareas.filter((t) => t.estado === "completada");
    const titulo = `${nombreCortoDia(dia)} ${format(dia, "d")}${isSameDay(dia, ahora) ? " · Hoy" : ""}${c.progreso.total ? `  ${c.progreso.hechas}/${c.progreso.total}` : ""}`;
    return [
      // dia y numero: para la tira de días del widget Semana (vista Día) del celular.
      { tipo: "seccion", titulo, hoy: isSameDay(dia, ahora), dia: nombreCortoDia(dia), numero: format(dia, "d") },
      ...c.eventos.slice(0, MAX_POR_SECCION).map((t) => ({ tipo: "evento", ...evento(t) })),
      ...[...pendientes, ...hechas].slice(0, MAX_POR_SECCION).map((t) => ({ tipo: "tarea", ...tarea(t) })),
    ];
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

/** Widget "Calendario": el mes de hoy, de lunes a domingo, con lo que tiene cada día. */
export function mesDelWidget(e: Estado, ahora: Date) {
  const inicio = startOfWeek(startOfMonth(ahora), { weekStartsOn: 1 });
  const fin = endOfMonth(ahora);
  const celdas = [];
  for (let dia = inicio; dia <= fin || celdas.length % 7 !== 0; dia = addDays(dia, 1)) {
    const c = contenidoDelDia(e.tareas, e.listas, dia, ahora);
    const entradas = [
      ...c.eventos.map((t) => ({ titulo: t.titulo, color: t.colorEvento ?? "", evento: true, hecha: false, nivel: 0 })),
      ...c.tareas.map((t) => ({ titulo: t.titulo, color: "", evento: false, hecha: t.estado === "completada", nivel: NIVEL[t.prioridad] ?? 0 })),
    ];
    celdas.push({ dia: dia.getDate(), delMes: isSameMonth(dia, ahora), hoy: isSameDay(dia, ahora), entradas: entradas.slice(0, MAX_POR_CELDA), total: entradas.length });
  }
  const mes = format(ahora, "MMMM yyyy", { locale: es });
  return { titulo: mes.charAt(0).toUpperCase() + mes.slice(1), celdas };
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

/** Todo lo que leen los widgets de Android. */
export function datosDeWidgets(e: Estado, ahora: Date = new Date()) {
  let acento = "";
  try {
    acento = temaEfectivo(leerEleccion()).acento;
  } catch {
    // Sin tema guardado: el widget usa su azul.
  }
  return {
    ...datosDelWidget(e.tareas, e.listas, ahora, e.etiquetas),
    acento,
    semana: filasDeSemana(e, ahora),
    matriz: filasDeMatriz(e, ahora),
    mes: mesDelWidget(e, ahora),
    estadisticas: estadisticasDelWidget(e, ahora),
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

/** Completa en Andamia las tareas que se marcaron como hechas desde el widget. */
async function aplicarMarcadasEnWidget(): Promise<void> {
  const estado = useTienda.getState();
  if (estado.cargando) return;
  const { ids } = await widget.pendientes();
  for (const id of ids) {
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
