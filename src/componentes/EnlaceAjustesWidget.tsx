import { puenteEscritorio } from "../logica/puenteEscritorio";
import { esAppNativa } from "../logica/plataforma";

/** Hay apartado Widgets en este dispositivo (app de PC o del celular). */
export const hayWidgets = (): boolean => Boolean(puenteEscritorio()) || esAppNativa();

/** Lleva al apartado Widgets con los ajustes de ese widget desplegados. */
export function EnlaceAjustesWidget({ id, clase = "" }: { id: string; clase?: string }) {
  if (!hayWidgets()) return null;
  return (
    <div className={clase}>
      <a href={`#/widgets/${encodeURIComponent(id)}`} className="text-sm font-medium text-texto underline-offset-2 hover:underline">
        Ajustes del Widget
      </a>
    </div>
  );
}
