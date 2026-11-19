import { useEffect, useState, type CSSProperties, type PointerEvent as PunteroReact } from "react";
import { Menu, X } from "lucide-react";
import { BarraIconos } from "./componentes/BarraIconos";
import { BarraLateral, Marca } from "./componentes/BarraLateral";
import { DetalleTarea } from "./componentes/DetalleTarea";
import { useTienda } from "./datos/tienda";
import { irA, useRuta, type Seccion } from "./logica/ruta";
import { PREVIA_CELULAR, WIDGET_ACTUAL, WIDGETS } from "./logica/widgetEscritorio";
import { MarcoWidget } from "./componentes/MarcoWidget";
import { PanelAvisos } from "./componentes/Avisos";
import { DialogoMigracion } from "./componentes/DialogoMigracion";
import { iniciarCuenta, useCuenta } from "./datos/cuenta";

const MARCA_ETIQUETAS = "andamia-etiquetas-iniciales";
const ANCHO_MENU_MIN = 170;
const ANCHO_MENU_MAX = 420;
import { useMotorEnfoque } from "./datos/enfoque";
import { VistaAjustes, VistaTema } from "./vistas/VistaAjustes";
import { VistaWidgets } from "./vistas/VistaWidgets";
import { VistaEtiquetas } from "./vistas/VistaEtiquetas";
import { VistaConfiguracion } from "./vistas/VistaConfiguracion";
import { BarraInferior } from "./componentes/BarraInferior";
import { puenteEscritorio, useBarraVentana } from "./logica/puenteEscritorio";
import { EnlaceAjustesWidget } from "./componentes/EnlaceAjustesWidget";
import { esAppNativa } from "./logica/plataforma";
import { VistaBusqueda } from "./vistas/VistaBusqueda";
import { VistaCalendario } from "./vistas/VistaCalendario";
import { VistaEnfoque } from "./vistas/VistaEnfoque";
import { DetalleHabito, VistaHabitos } from "./vistas/VistaHabitos";
import { VistaMatriz } from "./vistas/VistaMatriz";
import { VistaEstadisticas } from "./vistas/VistaEstadisticas";
import { VistaSemana } from "./vistas/VistaSemana";
import { VistaTareas } from "./vistas/VistaTareas";
import { sincronizarVentanas } from "./datos/entreVentanas";

function MotorEnfoque() {
  // Espera a que los datos carguen para no perder la sesión al registrarla.
  useMotorEnfoque();
  return null;
}

/** El widget que muestra lo mismo que esta sección. La Semana pone su enlace ella misma, pegado a su contenido. */
function widgetDeSeccion(seccion: Seccion): string | null {
  if (seccion.tipo === "vista") return null;
  const w = WIDGETS.find((x) => x.seccion.tipo === seccion.tipo && (x.seccion.tipo !== "estadisticas" || (seccion.tipo === "estadisticas" && seccion.de === x.seccion.de)));
  // En el celular no hay widget de Matriz.
  if (!w || (esAppNativa() && w.id === "matriz")) return null;
  return w.id;
}

/** La vista de la sección actual. */
function Vista({ ruta }: { ruta: ReturnType<typeof useRuta> }) {
  return (
    <>
      {ruta.seccion.tipo === "buscar" ? (
        <VistaBusqueda />
      ) : ruta.seccion.tipo === "calendario" ? (
        <VistaCalendario modo={ruta.seccion.modo} tareaAbierta={ruta.tareaId} />
      ) : ruta.seccion.tipo === "matriz" ? (
        <VistaMatriz tareaAbierta={ruta.tareaId} />
      ) : ruta.seccion.tipo === "enfoque" ? (
        <VistaEnfoque />
      ) : ruta.seccion.tipo === "habitos" ? (
        <VistaHabitos />
      ) : ruta.seccion.tipo === "estadisticas" ? (
        <VistaEstadisticas key={ruta.seccion.de} tipo={ruta.seccion.de} />
      ) : ruta.seccion.tipo === "ajustes" ? (
        <VistaAjustes />
      ) : ruta.seccion.tipo === "tema" ? (
        <VistaTema />
      ) : ruta.seccion.tipo === "widgets" ? (
        <VistaWidgets />
      ) : ruta.seccion.tipo === "configuracion" ? (
        <VistaConfiguracion />
      ) : ruta.seccion.tipo === "etiquetas" ? (
        <VistaEtiquetas />
      ) : ruta.seccion.tipo === "vista" && ruta.seccion.vista === "semana" ? (
        <VistaSemana tareaAbierta={ruta.tareaId} />
      ) : (
        <VistaTareas seccion={ruta.seccion} tareaAbierta={ruta.tareaId} />
      )}
    </>
  );
}

function esCampoDeTexto(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
}

export default function App() {
  const ruta = useRuta();
  const cargando = useTienda((s) => s.cargando);
  const error = useTienda((s) => s.error);
  const cargar = useTienda((s) => s.cargar);
  const cerrarError = useTienda((s) => s.cerrarError);
  const [lateralAbierta, setLateralAbierta] = useState(false);
  const altoBarra = useBarraVentana();
  // En el celular el menú va abajo, con iconos; el cajón lateral queda solo para la app de PC angosta.
  const menuAbajo = !puenteEscritorio();
  // En el computador el menú se puede ocultar y volver a mostrar; se recuerda.
  const [menuOculto, setMenuOcultoEstado] = useState(() => {
    try {
      return localStorage.getItem("andamia-menu-oculto") === "si";
    } catch {
      return false;
    }
  });
  // En el computador el menú se puede angostar o ensanchar arrastrando su borde derecho; se recuerda.
  const [anchoMenu, setAnchoMenu] = useState(() => {
    try {
      const n = Number(localStorage.getItem("andamia-menu-ancho"));
      return n >= ANCHO_MENU_MIN && n <= ANCHO_MENU_MAX ? n : 288;
    } catch {
      return 288;
    }
  });
  const ajustarMenu = (e: PunteroReact<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const ancho = Math.round(Math.min(ANCHO_MENU_MAX, Math.max(ANCHO_MENU_MIN, e.clientX)));
    setAnchoMenu(ancho);
    try {
      localStorage.setItem("andamia-menu-ancho", String(ancho));
    } catch {
      // Sin almacenamiento: se recuerda mientras la página siga abierta.
    }
  };
  const setMenuOculto = (oculto: boolean) => {
    setMenuOcultoEstado(oculto);
    try {
      localStorage.setItem("andamia-menu-oculto", oculto ? "si" : "no");
    } catch {
      // Sin almacenamiento: se recuerda mientras la página siga abierta.
    }
  };

  useEffect(() => {
    // Primero se sabe quién usa la app; así no se ven por un instante datos de otra sesión.
    void iniciarCuenta()
      .then(cargar)
      // La app del PC y sus widgets (u otras pestañas) se avisan cuando cambian los datos.
      .then(sincronizarVentanas)
      .then(() => {
        // Sin Firebase, las etiquetas iniciales se agregan una vez en este equipo.
        // Con Firebase se agregan al entrar a la cuenta (ver sincronizarAjustes); así
        // no aparecen como "datos sin cuenta" que haya que copiar.
        if (useCuenta.getState().configurada) return;
        try {
          if (localStorage.getItem(MARCA_ETIQUETAS)) return;
          localStorage.setItem(MARCA_ETIQUETAS, "si");
        } catch {
          return;
        }
        void useTienda.getState().sembrarEtiquetas();
      });
  }, [cargar]);

  // Al navegar en pantallas angostas la barra lateral se cierra sola.
  useEffect(() => {
    setLateralAbierta(false);
  }, [ruta.seccion]);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]") && (ruta.tareaId || ruta.habitoId)) {
        irA(ruta.seccion);
        return;
      }
      if (esCampoDeTexto(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        irA({ tipo: "buscar" });
      } else if (e.key.toLowerCase() === "n") {
        const campo = document.getElementById("entrada-rapida");
        if (campo) {
          e.preventDefault();
          campo.focus();
        } else {
          // En la semana, la N abre el menú del + (tarea, evento o hábito).
          const boton = document.querySelector<HTMLButtonElement>("[data-nueva-tarea]");
          if (boton) {
            e.preventDefault();
            boton.click();
          }
        }
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [ruta]);

  if (cargando) {
    return <div className="flex h-full items-center justify-center text-tenue">Cargando…</div>;
  }

  if (PREVIA_CELULAR) {
    return (
      <MarcoWidget id={PREVIA_CELULAR.id} nombre={PREVIA_CELULAR.nombre} previa>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Vista ruta={ruta} />
        </main>
      </MarcoWidget>
    );
  }

  if (WIDGET_ACTUAL) {
    return (
      <MarcoWidget id={WIDGET_ACTUAL.id} nombre={WIDGET_ACTUAL.nombre}>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Vista ruta={ruta} />
        </main>
        {ruta.tareaId && <DetalleTarea key={ruta.tareaId} tareaId={ruta.tareaId} seccion={ruta.seccion} />}
      {ruta.habitoId && <DetalleHabito key={ruta.habitoId} habitoId={ruta.habitoId} seccion={ruta.seccion} />}
      </MarcoWidget>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {lateralAbierta && !menuAbajo && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setLateralAbierta(false)} />}
      <div style={{ "--ancho-menu": `${anchoMenu}px` } as CSSProperties} className={`cajon-menu fixed inset-y-0 left-0 z-30 w-72 shrink-0 transition-transform lg:relative lg:w-[var(--ancho-menu)] lg:translate-x-0 ${lateralAbierta ? "translate-x-0" : "-translate-x-full"} ${menuOculto ? "lg:hidden" : ""} ${menuAbajo ? "max-lg:hidden" : ""}`}>
        <BarraLateral seccion={ruta.seccion} alOcultar={() => {
            // En el celular el menú es un cajón: se guarda; en el computador se oculta.
            if (window.matchMedia("(min-width: 1024px)").matches) setMenuOculto(true);
            else setLateralAbierta(false);
          }} />
        {/* Borde derecho: se arrastra para achicar o agrandar el menú. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ajustar el ancho del menú"
          title="Arrastra para achicar o agrandar el menú"
          data-testid="ancho-menu"
          className="absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none [-webkit-app-region:no-drag] hover:bg-acento/40 lg:block"
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={ajustarMenu}
        />
      </div>
      {menuOculto && <BarraIconos seccion={ruta.seccion} alMostrar={() => setMenuOculto(false)} />}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* App de PC: franja para mover la ventana; a la derecha quedan los botones de Windows. */}
        {altoBarra > 0 && (
          <div data-testid="barra-ventana" className="flex shrink-0 items-start px-6 pt-[12px] [-webkit-app-region:drag]" style={{ height: altoBarra }}>
            <button type="button" aria-label="Abrir menú" className="mr-2 mt-0.5 rounded-md p-1.5 hover:bg-white/20 lg:hidden [-webkit-app-region:no-drag]" onClick={() => setLateralAbierta(true)}>
              <Menu size={22} />
            </button>
            <span className="flex items-center gap-2.5">
              <Marca clase="h-8 w-8" />
              <span className="contorno-blanco text-xl font-semibold">Andamia</span>
            </span>
          </div>
        )}
        {!menuAbajo && altoBarra === 0 && (
          <div className="barra-lateral flex items-center gap-2 border-b border-borde px-3 py-2 lg:hidden">
            <button type="button" aria-label="Abrir menú" className="rounded-md p-1.5 hover:bg-suave" onClick={() => setLateralAbierta(true)}>
              <Menu size={20} />
            </button>
            <Marca clase="h-6 w-6" />
            <span className="font-semibold">Andamia</span>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-peligro px-4 py-2 text-sm text-white">
            <span>{error}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={cerrarError}>
              <X size={16} />
            </button>
          </div>
        )}
        <Vista ruta={ruta} />
        {widgetDeSeccion(ruta.seccion) && <EnlaceAjustesWidget id={widgetDeSeccion(ruta.seccion)!} clase="shrink-0 px-6 pt-1 pb-3 lg:hidden" />}
        {menuAbajo && <BarraInferior seccion={ruta.seccion} />}
      </main>

      {ruta.tareaId && <DetalleTarea key={ruta.tareaId} tareaId={ruta.tareaId} seccion={ruta.seccion} />}
      {ruta.habitoId && <DetalleHabito key={ruta.habitoId} habitoId={ruta.habitoId} seccion={ruta.seccion} />}
      <PanelAvisos seccion={ruta.seccion} />
      <MotorEnfoque />
      <DialogoMigracion />
    </div>
  );
}
