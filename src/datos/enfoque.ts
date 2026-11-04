import { useEffect, useState } from "react";
import { create } from "zustand";
import { CONFIG_INICIAL, detener, formatoTiempo, iniciar, leerTemporizador, pausar, ponerAlDia, reanudar, restanteMs, saltar, temporizadorListo, transcurridoMs, type ConfigEnfoque, type Fase, type SesionNueva, type Temporizador } from "../logica/enfoque";
import { reproducirFin } from "../logica/sonido";
import type { TipoSesion } from "../modelos/tipos";
import { useTienda } from "./tienda";

const CLAVE_TEMPORIZADOR = "andamia-temporizador";
const CLAVE_CONFIG = "andamia-enfoque-config";

export interface MensajeEnfoque {
  id: string;
  titulo: string;
  detalle: string;
}

interface EstadoEnfoque {
  config: ConfigEnfoque;
  temporizador: Temporizador;
  mensajes: MensajeEnfoque[];
  empezar: () => void;
  pausar: () => void;
  reanudar: () => void;
  abandonar: () => void;
  saltar: () => void;
  detener: () => void;
  cambiarModo: (modo: TipoSesion) => void;
  elegirTarea: (tareaId: string | null) => void;
  enfocarEnTarea: (tareaId: string) => void;
  guardarConfig: (config: ConfigEnfoque) => void;
  ponerAlDia: (conAviso?: boolean) => void;
  cerrarMensaje: (id: string) => void;
}

function leerJson(clave: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(clave) ?? "null");
  } catch {
    return null;
  }
}

function leerConfig(): ConfigEnfoque {
  const c = leerJson(CLAVE_CONFIG) as Partial<ConfigEnfoque> | null;
  const n = (v: unknown, d: number) => (typeof v === "number" && v >= 1 ? v : d);
  return {
    enfoqueMin: n(c?.enfoqueMin, CONFIG_INICIAL.enfoqueMin),
    descansoMin: n(c?.descansoMin, CONFIG_INICIAL.descansoMin),
    descansoLargoMin: n(c?.descansoLargoMin, CONFIG_INICIAL.descansoLargoMin),
    cadaN: n(c?.cadaN, CONFIG_INICIAL.cadaN),
  };
}

function guardarTemporizador(t: Temporizador): void {
  try {
    localStorage.setItem(CLAVE_TEMPORIZADOR, JSON.stringify(t));
  } catch {
    // Sin almacenamiento el temporizador sigue funcionando, pero no sobrevive a recargar.
  }
}

function registrar(s: SesionNueva | null): void {
  if (s) void useTienda.getState().guardarSesion({ ...s, nota: "", manual: false });
}

const TEXTO_FIN: Record<Fase, MensajeEnfoque["titulo"]> = {
  enfoque: "¡Enfoque terminado!",
  descanso: "Descanso terminado",
  "descanso-largo": "Descanso largo terminado",
};

function notificarNavegador(titulo: string, cuerpo: string, clave: string): void {
  if ("Notification" in window && Notification.permission === "granted") {
    const n = new Notification(titulo, { body: cuerpo, tag: clave });
    n.onclick = () => {
      window.focus();
      window.location.hash = "#/enfoque";
      n.close();
    };
  }
}

export const useEnfoque = create<EstadoEnfoque>((set, get) => {
  const config = leerConfig();
  const fijar = (temporizador: Temporizador) => {
    guardarTemporizador(temporizador);
    set({ temporizador });
  };

  return {
    config,
    temporizador: leerTemporizador(leerJson(CLAVE_TEMPORIZADOR)) ?? temporizadorListo(config),
    mensajes: [],

    empezar: () => fijar(iniciar(get().temporizador, Date.now())),
    pausar: () => fijar(pausar(get().temporizador, Date.now())),
    reanudar: () => fijar(reanudar(get().temporizador, Date.now())),

    abandonar: () => {
      const { temporizador: t, config: c } = get();
      fijar(temporizadorListo(c, t.modo, t.tareaId, t.ciclos));
    },

    saltar: () => {
      const r = saltar(get().temporizador, get().config, Date.now());
      registrar(r.sesion);
      fijar(r.temporizador);
    },

    detener: () => {
      const r = detener(get().temporizador, get().config, Date.now());
      registrar(r.sesion);
      fijar(r.temporizador);
    },

    cambiarModo: (modo) => {
      const { temporizador: t, config: c } = get();
      fijar(temporizadorListo(c, modo, t.tareaId, t.ciclos));
    },

    elegirTarea: (tareaId) => fijar({ ...get().temporizador, tareaId }),

    enfocarEnTarea: (tareaId) => {
      const t = get().temporizador;
      // No interrumpe una sesión en curso: solo cambia a qué tarea se le suma.
      fijar(t.estado === "listo" ? iniciar({ ...t, tareaId }, Date.now()) : { ...t, tareaId });
    },

    guardarConfig: (nueva) => {
      localStorage.setItem(CLAVE_CONFIG, JSON.stringify(nueva));
      const t = get().temporizador;
      set({ config: nueva });
      // Lo que ya corre mantiene su duración; lo que está listo toma la nueva.
      if (t.estado === "listo") fijar(temporizadorListo(nueva, t.modo, t.tareaId, t.ciclos));
    },

    ponerAlDia: (conAviso = true) => {
      const r = ponerAlDia(get().temporizador, get().config, Date.now());
      if (r.temporizador === get().temporizador) return;
      r.sesiones.forEach(registrar);
      fijar(r.temporizador);
      if (!conAviso || !r.terminadas.length) return;
      const ultima = r.terminadas[r.terminadas.length - 1];
      const detalle = ultima === "enfoque" ? "Tómate un descanso." : "¿Empezamos otro?";
      const id = `${Date.now()}-${ultima}`;
      set((s) => ({ mensajes: [...s.mensajes, { id, titulo: TEXTO_FIN[ultima], detalle }] }));
      reproducirFin();
      notificarNavegador(TEXTO_FIN[ultima], detalle, id);
    },

    cerrarMensaje: (id) => set((s) => ({ mensajes: s.mensajes.filter((m) => m.id !== id) })),
  };
});

/** Vuelve a dibujar cada segundo mientras el temporizador corre. */
export function useAhora(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    setAhora(Date.now());
    if (!activo) return;
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [activo]);
  return ahora;
}

export function textoTemporizador(t: Temporizador, ahora: number): string {
  return formatoTiempo(t.modo === "cronometro" ? transcurridoMs(t, ahora) : restanteMs(t, ahora));
}

/** Mantiene el temporizador al día en toda la app, en cualquier pantalla. */
export function useMotorEnfoque(): void {
  const temporizador = useEnfoque((s) => s.temporizador);
  const activo = temporizador.estado === "corriendo";
  const ahora = useAhora(activo);

  useEffect(() => {
    useEnfoque.getState().ponerAlDia();
    const alVolver = () => useEnfoque.getState().ponerAlDia();
    // Otra pestaña cambió el temporizador: se adopta su estado.
    const alCambiarOtra = (e: StorageEvent) => {
      if (e.key !== CLAVE_TEMPORIZADOR || !e.newValue) return;
      try {
        const t = leerTemporizador(JSON.parse(e.newValue));
        if (t) useEnfoque.setState({ temporizador: t });
      } catch {
        // Un valor dañado se ignora.
      }
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("storage", alCambiarOtra);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("storage", alCambiarOtra);
    };
  }, []);

  useEffect(() => {
    if (activo) useEnfoque.getState().ponerAlDia();
    document.title = activo || temporizador.estado === "pausado" ? `${textoTemporizador(temporizador, ahora)} · Andamia` : "Andamia";
  }, [activo, ahora, temporizador]);
}
