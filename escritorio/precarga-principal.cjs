// Puente mínimo para la ventana principal de Andamia en el PC: la página solo puede
// ver qué widgets están en el escritorio, ponerlos o quitarlos, y enterarse si cambian.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("andamiaEscritorio", {
  widgetsAbiertos: () => ipcRenderer.invoke("widgets-abiertos"),
  abrirWidget: (id) => ipcRenderer.send("widget-abrir", String(id)),
  cerrarWidget: (id) => ipcRenderer.send("widget-cerrar", String(id)),
  // Ventana sin barra de título: alto de la zona de los botones de Windows y sus colores según el tema.
  altoBarra: 32,
  colorBarra: (colores) => ipcRenderer.send("ventana-colores", { fondo: String(colores?.fondo ?? ""), simbolos: String(colores?.simbolos ?? "") }),
  alCambiarWidgets: (fn) => {
    const oyente = (_e, abiertos) => fn(Array.isArray(abiertos) ? abiertos.map(String) : []);
    ipcRenderer.on("widgets-cambiaron", oyente);
    return () => ipcRenderer.removeListener("widgets-cambiaron", oyente);
  },
});
