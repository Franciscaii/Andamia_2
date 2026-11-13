import { useEffect, useState } from "react";
import { Menu, PanelLeftOpen, X } from "lucide-react";
import { BarraLateral, Marca } from "./componentes/BarraLateral";
import { DetalleTarea } from "./componentes/DetalleTarea";
import { useTienda } from "./datos/tienda";
import { irA, useRuta } from "./logica/ruta";
import { WIDGET_ACTUAL } from "./logica/widgetEscritorio";
import { MarcoWidget } from "./componentes/MarcoWidget";
import { PanelAvisos } from "./componentes/Avisos";
import { DialogoMigracion } from "./componentes/DialogoMigracion";
import { iniciarCuenta, useCuenta } from "./datos/cuenta";

const MARCA_ETIQUETAS = "andamia-etiquetas-iniciales";
import { useMotorEnfoque } from "./datos/enfoque";
import { VistaAjustes, VistaTema } from "./vistas/VistaAjustes";
import { VistaWidgets } from "./vistas/VistaWidgets";
import { useBarraVentana } from "./logica/puenteEscritorio";
import { VistaBusqueda } from "./vistas/VistaBusqueda";
import { VistaCalendario } from "./vistas/VistaCalendario";
import { VistaEnfoque } from "./vistas/VistaEnfoque";
import { VistaHabitos } from "./vistas/VistaHabitos";
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
  // En el computador el menú se puede ocultar y volver a mostrar; se recuerda.
  const [menuOculto, setMenuOcultoEstado] = useState(() => {
    try {
      return localStorage.getItem("andamia-menu-oculto") === "si";
    } catch {
      return false;
    }
  });
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
      if (e.key === "Escape" && !document.querySelector("[role=dialog]") && ruta.tareaId) {
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

  if (WIDGET_ACTUAL) {
    return (
      <MarcoWidget id={WIDGET_ACTUAL.id} nombre={WIDGET_ACTUAL.nombre}>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Vista ruta={ruta} />
        </main>
        {ruta.tareaId && <DetalleTarea key={ruta.tareaId} tareaId={ruta.tareaId} seccion={ruta.seccion} />}
      </MarcoWidget>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {lateralAbierta && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setLateralAbierta(false)} />}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 shrink-0 transition-transform lg:static lg:translate-x-0 ${lateralAbierta ? "translate-x-0" : "-translate-x-full"} ${menuOculto ? "lg:hidden" : ""}`}>
        <BarraLateral seccion={ruta.seccion} alOcultar={() => setMenuOculto(true)} />
      </div>
      {menuOculto && (
        <div className="barra-lateral hidden shrink-0 border-r border-borde px-1.5 pt-4 lg:block">
          <button type="button" aria-label="Mostrar menú" title="Mostrar menú" className="rounded-md p-1.5 text-tenue hover:bg-suave" onClick={() => setMenuOculto(false)}>
            <PanelLeftOpen size={18} />
          </button>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* App de PC: franja para mover la ventana; a la derecha quedan los botones de Windows. */}
        {altoBarra > 0 && <div data-testid="barra-ventana" aria-hidden className="shrink-0 [-webkit-app-region:drag]" style={{ height: altoBarra }} />}
        <div className="barra-lateral flex items-center gap-2 border-b border-borde px-3 py-2 lg:hidden">
          <button type="button" aria-label="Abrir menú" className="rounded-md p-1.5 hover:bg-suave" onClick={() => setLateralAbierta(true)}>
            <Menu size={20} />
          </button>
          <Marca clase="h-6 w-6" />
          <span className="font-semibold">Andamia</span>
        </div>
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 bg-peligro px-4 py-2 text-sm text-white">
            <span>{error}</span>
            <button type="button" aria-label="Cerrar aviso" onClick={cerrarError}>
              <X size={16} />
            </button>
          </div>
        )}
        <Vista ruta={ruta} />
      </main>

      {ruta.tareaId && <DetalleTarea key={ruta.tareaId} tareaId={ruta.tareaId} seccion={ruta.seccion} />}
      <PanelAvisos seccion={ruta.seccion} />
      <MotorEnfoque />
      <DialogoMigracion />
    </div>
  );
}
