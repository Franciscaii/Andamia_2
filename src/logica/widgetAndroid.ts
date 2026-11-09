import { registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { format } from "date-fns";
import { useTienda } from "../datos/tienda";
import type { Etiqueta, Lista, Prioridad, Tarea } from "../modelos/tipos";
import { diasHasta, fechaDeTarea } from "./fechas";
import { irA } from "./ruta";
import { contenidoDelDia, dificultadDe, tituloDelDia } from "./semana";

/** Puente con el widget "Hoy" de Android (android/app/src/main/java/cl/andamia/app). */
interface PluginWidget {
  actualizar(opciones: { datos: string }): Promise<void>;
  pendientes(): Promise<{ ids: string[] }>;
}

const widget = registerPlugin<PluginWidget>("AndamiaWidget");

const MAX_TAREAS = 30;
const NIVEL: Record<Prioridad, number> = { ninguna: 0, baja: 1, media: 2, alta: 3 };

/** Lo que el widget muestra: el día de hoy como en la semana (eventos, progreso y tareas). */
export function datosDelWidget(tareas: Tarea[], listas: Lista[], ahora: Date = new Date(), etiquetas: Etiqueta[] = []) {
  const nombreLista = new Map(listas.map((l) => [l.id, l.nombre]));
  const etiquetaPorNombre = new Map(etiquetas.map((e) => [e.nombre, e]));
  const hoy = contenidoDelDia(tareas, listas, ahora, ahora);
  const hora = (t: Tarea) => {
    const fecha = fechaDeTarea(t);
    return fecha && !t.todoElDia ? format(fecha, "HH:mm") : "";
  };
  return {
    fecha: format(ahora, "yyyy-MM-dd"),
    titulo: tituloDelDia(ahora, ahora),
    eventos: hoy.eventos.slice(0, MAX_TAREAS).map((t) => ({ id: t.id, titulo: t.titulo, hora: hora(t) })),
    tareas: hoy.tareas.slice(0, MAX_TAREAS).map((t) => {
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
    }),
  };
}

let ultimoEnviado = "";
let temporizador: ReturnType<typeof setTimeout> | null = null;

function enviarAlWidget(): void {
  const { cargando, tareas, listas, etiquetas } = useTienda.getState();
  if (cargando) return;
  const datos = JSON.stringify(datosDelWidget(tareas, listas, new Date(), etiquetas));
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
  else if (boton) boton.click();
  else if (intentos < 30) setTimeout(() => enfocarEntradaRapida(intentos + 1), 100);
}

/** Abre lo que pidió el widget: andamia://hoy, andamia://nueva o andamia://tarea/ID. */
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
    if (estado.tareas !== previo.tareas || estado.listas !== previo.listas || estado.etiquetas !== previo.etiquetas || estado.cargando !== previo.cargando) programarEnvio();
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
