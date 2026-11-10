import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { prepararAppNativa } from "./logica/plataforma";
import { registrarPwa } from "./logica/pwa";
import { aplicarTema, leerEleccion } from "./logica/temas";
import { hashDe } from "./logica/ruta";
import { WIDGET_ACTUAL } from "./logica/widgetEscritorio";
import "./estilos.css";

aplicarTema(leerEleccion());
// Un widget del escritorio abre en su vista.
if (WIDGET_ACTUAL && !window.location.hash) window.location.hash = hashDe(WIDGET_ACTUAL.seccion);
registrarPwa();
void prepararAppNativa();

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
