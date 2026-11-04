import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registrarPwa } from "./logica/pwa";
import "./estilos.css";

registrarPwa();

createRoot(document.getElementById("raiz") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
