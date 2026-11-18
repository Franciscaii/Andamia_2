import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { prepararAppNativa } from "./logica/plataforma";
import { registrarPwa } from "./logica/pwa";
import { aplicarTema, leerEleccion } from "./logica/temas";
import { hashDe } from "./logica/ruta";
import { PREVIA_CELULAR, WIDGET_ACTUAL } from "./logica/widgetEscritorio";
import "./estilos.css";

aplicarTema(leerEleccion());
// Un widget del escritorio abre en su vista.
const ventana = WIDGET_ACTUAL ?? PREVIA_CELULAR;
if (ventana && !window.location.hash) window.location.hash = hashDe(ventana.seccion);
registrarPwa();
void prepararAppNativa();

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
