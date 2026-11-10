// Puente mínimo para los widgets del escritorio: la página solo puede pedir
// "empieza a cambiar el tamaño desde este borde" y "ya terminé".
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("andamiaWidget", {
  empezarAjuste: (borde) => ipcRenderer.send("widget-ajuste-inicio", String(borde)),
  terminarAjuste: () => ipcRenderer.send("widget-ajuste-fin"),
});
