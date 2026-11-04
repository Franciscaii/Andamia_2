import { useState, type FormEvent } from "react";
import { Check, Slash } from "lucide-react";
import { useTienda } from "../datos/tienda";
import { irA } from "../logica/ruta";
import { COLORES_LISTA, type Carpeta, type Lista } from "../modelos/tipos";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "./Modal";

export function DialogoLista({ lista, alCerrar }: { lista: Lista | null; alCerrar: () => void }) {
  const carpetas = useTienda((s) => s.carpetas);
  const guardarLista = useTienda((s) => s.guardarLista);
  const [nombre, setNombre] = useState(lista?.nombre ?? "");
  const [color, setColor] = useState<string | null>(lista?.color ?? null);
  const [carpetaId, setCarpetaId] = useState(lista?.carpetaId ?? "");
  const [incluir, setIncluir] = useState(lista?.incluirEnTodas ?? true);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    const guardada = await guardarLista(lista?.id ?? null, { nombre: nombre.trim(), color, carpetaId: carpetaId || null, incluirEnTodas: incluir });
    alCerrar();
    if (guardada && !lista) irA({ tipo: "lista", id: guardada.id });
  };

  return (
    <Modal titulo={lista ? "Editar lista" : "Nueva lista"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Nombre</span>
          <input autoFocus maxLength={64} className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-tenue">Color</span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" aria-label="Sin color" aria-pressed={color === null} onClick={() => setColor(null)} className={`flex h-7 w-7 items-center justify-center rounded-full border border-borde ${color === null ? "ring-2 ring-acento ring-offset-1 ring-offset-panel" : ""}`}>
              <Slash size={14} className="text-tenue" />
            </button>
            {COLORES_LISTA.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} style={{ background: c }} className={`flex h-7 w-7 items-center justify-center rounded-full ${color === c ? "ring-2 ring-acento ring-offset-1 ring-offset-panel" : ""}`}>
                {color === c && <Check size={14} className="text-white" />}
              </button>
            ))}
          </div>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Carpeta</span>
          <select className={claseCampo} value={carpetaId} onChange={(e) => setCarpetaId(e.target.value)}>
            <option value="">Sin carpeta</option>
            {carpetas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={incluir} onChange={(e) => setIncluir(e.target.checked)} />
          Mostrar en las vistas inteligentes
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!nombre.trim()}>
            {lista ? "Guardar" : "Crear lista"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DialogoCarpeta({ carpeta, alCerrar }: { carpeta: Carpeta | null; alCerrar: () => void }) {
  const crearCarpeta = useTienda((s) => s.crearCarpeta);
  const renombrarCarpeta = useTienda((s) => s.renombrarCarpeta);
  const [nombre, setNombre] = useState(carpeta?.nombre ?? "");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    if (carpeta) await renombrarCarpeta(carpeta.id, nombre);
    else await crearCarpeta(nombre);
    alCerrar();
  };

  return (
    <Modal titulo={carpeta ? "Renombrar carpeta" : "Nueva carpeta"} alCerrar={alCerrar}>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Nombre</span>
          <input autoFocus maxLength={64} className={claseCampo} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className={claseBoton} onClick={alCerrar}>
            Cancelar
          </button>
          <button type="submit" className={claseBotonPrincipal} disabled={!nombre.trim()}>
            {carpeta ? "Guardar" : "Crear carpeta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
