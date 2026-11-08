import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { prepararAppNativa } from "./logica/plataforma";
import { registrarPwa } from "./logica/pwa";
import "./estilos.css";

registrarPwa();
void prepararAppNativa();

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
