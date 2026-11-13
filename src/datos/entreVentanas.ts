import { cargarTodo } from "./repositorio";
import { useTienda } from "./tienda";

/**
 * Varias ventanas de Andamia en el mismo equipo (la app del PC y sus widgets, o varias
 * pestañas) comparten la base local. Cuando una cambia los datos (por algo hecho aquí o por
 * algo que llegó de la nube, como una tarea completada en el celular), avisa a las demás para
 * que vuelvan a leer: si no, la que no aplicó el cambio seguiría mostrando lo de antes.
 */
const CANAL = "andamia-datos";

let iniciado = false;

export function sincronizarVentanas(): void {
  if (iniciado || typeof BroadcastChannel === "undefined") return;
  iniciado = true;
  const canal = new BroadcastChannel(CANAL);
  let recibiendo = false;
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  canal.onmessage = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      void cargarTodo()
        .then((datos) => {
          // Lo que llega de otra ventana no se vuelve a anunciar (si no, se avisarían sin fin).
          recibiendo = true;
          try {
            useTienda.setState(datos);
          } finally {
            recibiendo = false;
          }
        })
        .catch(console.error);
    }, 150);
  };

  useTienda.subscribe((estado, previo) => {
    if (recibiendo || estado.cargando) return;
    if (
      estado.tareas !== previo.tareas ||
      estado.listas !== previo.listas ||
      estado.etiquetas !== previo.etiquetas ||
      estado.habitos !== previo.habitos ||
      estado.registros !== previo.registros ||
      estado.columnas !== previo.columnas ||
      estado.carpetas !== previo.carpetas
    )
      canal.postMessage("cambio");
  });

  // Al volver a ver una ventana (por ejemplo un widget tapado), se relee por si acaso.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !useTienda.getState().cargando) void useTienda.getState().cargar();
  });
}
