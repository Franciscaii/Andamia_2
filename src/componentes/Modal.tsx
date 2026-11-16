import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
}

export function Modal({ titulo, alCerrar, children }: Props) {
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [alCerrar]);

  // Va colgada del cuerpo de la página: así queda al medio de la pantalla aunque se abra desde el menú lateral.
  return createPortal(
    <div className="ventana fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && alCerrar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="sin-barra max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-borde bg-panel p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold">{titulo}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export const claseBoton = "rounded-md border border-borde px-3 py-1.5 text-sm hover:bg-suave";
export const claseBotonPrincipal = "rounded-md bg-acento px-3 py-1.5 text-sm font-medium text-sobre-acento hover:opacity-90 disabled:opacity-50";
export const claseCampo = "w-full rounded-md border border-borde bg-campo px-2.5 py-1.5 text-sm outline-none focus:border-acento";

interface PropsConfirmar {
  titulo: string;
  mensaje: string;
  textoAccion: string;
  alConfirmar: () => void;
  alCerrar: () => void;
}

export function Confirmar({ titulo, mensaje, textoAccion, alConfirmar, alCerrar }: PropsConfirmar) {
  return (
    <Modal titulo={titulo} alCerrar={alCerrar}>
      <p className="mb-5 text-sm text-tenue">{mensaje}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={claseBoton} onClick={alCerrar}>
          Cancelar
        </button>
        <button
          type="button"
          className="rounded-md bg-peligro px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 dark:text-black"
          onClick={() => {
            alConfirmar();
            alCerrar();
          }}
        >
          {textoAccion}
        </button>
      </div>
    </Modal>
  );
}
