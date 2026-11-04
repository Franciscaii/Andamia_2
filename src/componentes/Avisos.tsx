import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useEnfoque } from "../datos/enfoque";
import { useTienda } from "../datos/tienda";
import { etiquetaFecha } from "../logica/fechas";
import { avisosDeHabitos } from "../logica/habitos";
import { avisosPendientes } from "../logica/recordatorios";
import { mostrarNotificacion, programarAvisos } from "../logica/pwa";
import { hashDe, irA, type Seccion } from "../logica/ruta";

const INTERVALO_COMPROBACION_MS = 20_000;

interface AvisoVisible {
  clave: string;
  /** null en los avisos de hábitos, que abren su pantalla. */
  tareaId: string | null;
  titulo: string;
  fecha: string;
}

const hayNotificaciones = () => typeof window !== "undefined" && "Notification" in window;

function notificar(titulo: string, cuerpo: string, clave: string, seccion: Seccion, tareaId: string | null) {
  void mostrarNotificacion(titulo, cuerpo, clave, `/${hashDe(seccion, tareaId)}`, () => irA(seccion, tareaId));
}

/** Comprueba los recordatorios mientras la app está abierta y los muestra dentro de ella. */
export function PanelAvisos({ seccion }: { seccion: Seccion }) {
  const tareas = useTienda((s) => s.tareas);
  const habitos = useTienda((s) => s.habitos);
  const marcarAviso = useTienda((s) => s.marcarAviso);
  const marcarAvisoHabito = useTienda((s) => s.marcarAvisoHabito);
  const mensajes = useEnfoque((s) => s.mensajes);
  const cerrarMensaje = useEnfoque((s) => s.cerrarMensaje);
  const [avisos, setAvisos] = useState<AvisoVisible[]>([]);
  const comprobando = useRef(false);
  const seccionActual = useRef(seccion);
  seccionActual.current = seccion;

  const comprobar = useCallback(async () => {
    if (comprobando.current) return;
    comprobando.current = true;
    try {
      const estado = useTienda.getState();
      const ahora = new Date();
      for (const aviso of avisosPendientes(estado.tareas, ahora)) {
        // Si otra pestaña ya lo envió, aquí no se repite.
        if (!(await marcarAviso(aviso.tarea.id, aviso.clave))) continue;
        const fecha = etiquetaFecha(aviso.tarea);
        const { id, titulo } = aviso.tarea;
        setAvisos((a) => [...a, { clave: aviso.clave, tareaId: id, titulo, fecha }]);
        notificar(titulo, `Recordatorio: ${fecha}`, aviso.clave, seccionActual.current, id);
      }
      for (const { habito, clave } of avisosDeHabitos(estado.habitos, estado.registros, ahora)) {
        if (!(await marcarAvisoHabito(habito.id, clave))) continue;
        setAvisos((a) => [...a, { clave, tareaId: null, titulo: habito.nombre, fecha: "Hábito de hoy" }]);
        notificar(habito.nombre, "Hábito pendiente de hoy", clave, { tipo: "habitos" }, null);
      }
    } finally {
      comprobando.current = false;
    }
  }, [marcarAviso, marcarAvisoHabito]);

  useEffect(() => {
    void comprobar();
    const temporizador = window.setInterval(() => void comprobar(), INTERVALO_COMPROBACION_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void comprobar();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [comprobar]);

  // También al cambiar los datos: un recordatorio nuevo puede vencer de inmediato.
  useEffect(() => {
    void comprobar();
    // Donde el navegador lo permita, deja los avisos programados por si se cierra la app.
    void programarAvisos(tareas);
  }, [tareas, habitos, comprobar]);

  if (!avisos.length && !mensajes.length) return null;
  const cerrar = (clave: string) => setAvisos((a) => a.filter((x) => x.clave !== clave));
  const abrir = (a: AvisoVisible) => {
    if (a.tareaId === null) irA({ tipo: "habitos" });
    else irA(seccion.tipo === "buscar" ? { tipo: "vista", vista: "hoy" } : seccion, a.tareaId);
    cerrar(a.clave);
  };

  return (
    <div role="status" aria-label="Recordatorios" className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {mensajes.map((m) => (
        <div key={m.id} data-testid="aviso-enfoque" className="flex items-start gap-2 rounded-lg border border-borde bg-panel p-3 shadow-lg">
          <Bell size={16} className="mt-0.5 shrink-0 text-acento" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{m.titulo}</p>
            <p className="text-xs text-tenue">{m.detalle}</p>
          </div>
          <button type="button" aria-label={`Cerrar aviso: ${m.titulo}`} className="text-tenue hover:text-texto" onClick={() => cerrarMensaje(m.id)}>
            <X size={15} />
          </button>
        </div>
      ))}
      {avisos.map((a) => (
        <div key={a.clave} data-testid="aviso" className="rounded-lg border border-borde bg-panel p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <Bell size={16} className="mt-0.5 shrink-0 text-acento" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium break-words">{a.titulo}</p>
              <p className="text-xs text-tenue">{a.fecha}</p>
            </div>
            <button type="button" aria-label={`Cerrar aviso de ${a.titulo}`} className="text-tenue hover:text-texto" onClick={() => cerrar(a.clave)}>
              <X size={15} />
            </button>
          </div>
          <button type="button" className="mt-2 text-xs font-medium text-acento hover:underline" onClick={() => abrir(a)}>
            {a.tareaId === null ? "Abrir hábitos" : "Abrir tarea"}
          </button>
        </div>
      ))}
    </div>
  );
}

/** El permiso se pide solo al pulsar el botón, nunca al cargar. */
export function BotonAvisos() {
  const [permiso, setPermiso] = useState<NotificationPermission | null>(hayNotificaciones() ? Notification.permission : null);

  if (permiso === null) return null;
  if (permiso === "granted") {
    return (
      <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-tenue">
        <Bell size={15} /> Avisos del navegador activados
      </p>
    );
  }
  if (permiso === "denied") {
    return (
      <p className="flex items-center gap-2 px-2 py-1.5 text-xs text-tenue" title="Puedes cambiarlo en los permisos del sitio de tu navegador.">
        <BellOff size={15} className="shrink-0" /> Avisos bloqueados en el navegador; se muestran dentro de la app
      </p>
    );
  }
  return (
    <button type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-suave" onClick={() => void Notification.requestPermission().then(setPermiso)}>
      <Bell size={17} className="text-tenue" /> Activar avisos del navegador
    </button>
  );
}
