import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BarraLateral } from "./componentes/BarraLateral";
import { DetalleTarea } from "./componentes/DetalleTarea";
import { useTienda } from "./datos/tienda";
import { irA, useRuta } from "./logica/ruta";
import { PanelAvisos } from "./componentes/Avisos";
import { VistaBusqueda } from "./vistas/VistaBusqueda";
import { VistaCalendario } from "./vistas/VistaCalendario";
import { VistaTareas } from "./vistas/VistaTareas";

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

  useEffect(() => {
    void cargar();
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
        }
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [ruta]);

  if (cargando) {
    return <div className="flex h-full items-center justify-center text-tenue">Cargando…</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {lateralAbierta && <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setLateralAbierta(false)} />}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 shrink-0 transition-transform lg:static lg:translate-x-0 ${lateralAbierta ? "translate-x-0" : "-translate-x-full"}`}>
        <BarraLateral seccion={ruta.seccion} />
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-borde px-3 py-2 lg:hidden">
          <button type="button" aria-label="Abrir menú" className="rounded-md p-1.5 hover:bg-suave" onClick={() => setLateralAbierta(true)}>
            <Menu size={20} />
          </button>
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
        {ruta.seccion.tipo === "buscar" ? (
          <VistaBusqueda />
        ) : ruta.seccion.tipo === "calendario" ? (
          <VistaCalendario modo={ruta.seccion.modo} tareaAbierta={ruta.tareaId} />
        ) : (
          <VistaTareas seccion={ruta.seccion} tareaAbierta={ruta.tareaId} />
        )}
      </main>

      {ruta.tareaId && <DetalleTarea key={ruta.tareaId} tareaId={ruta.tareaId} seccion={ruta.seccion} />}
      <PanelAvisos seccion={ruta.seccion} />
    </div>
  );
}
