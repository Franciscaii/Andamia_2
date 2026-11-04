import { useState } from "react";
import { useCuenta } from "../datos/cuenta";
import { cantidadDe } from "../logica/copia";
import type { NombreTabla } from "../datos/bd";
import { claseBoton, claseBotonPrincipal, Modal } from "./Modal";

/** Pregunta una sola vez qué hacer con lo que había antes de iniciar sesión. */
export function DialogoMigracion() {
  const migracion = useCuenta((s) => s.migracion);
  const responderMigracion = useCuenta((s) => s.responderMigracion);
  const [copiando, setCopiando] = useState(false);
  if (!migracion) return null;

  const responder = async (copiar: boolean) => {
    setCopiando(true);
    await responderMigracion(copiar);
    setCopiando(false);
  };

  return (
    <Modal titulo="¿Copiar tus datos a esta cuenta?" alCerrar={() => void responder(false)}>
      <p className="mb-3 text-sm text-tenue">Este navegador tiene datos guardados sin cuenta:</p>
      <ul className="mb-3 list-inside list-disc text-sm">
        {Object.entries(migracion.porTabla).map(([tabla, n]) => (
          <li key={tabla}>{cantidadDe(tabla as NombreTabla, n)}</li>
        ))}
      </ul>
      <p className="mb-5 text-sm text-tenue">Si los copias, se sincronizan con tu cuenta. La copia original sigue en este navegador para cuando uses la app sin sesión. También podrás copiarlos más tarde desde Cuenta y ajustes.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className={claseBoton} disabled={copiando} onClick={() => void responder(false)}>
          Ahora no
        </button>
        <button type="button" className={claseBotonPrincipal} disabled={copiando} onClick={() => void responder(true)}>
          {copiando ? "Copiando…" : "Copiar a mi cuenta"}
        </button>
      </div>
    </Modal>
  );
}
