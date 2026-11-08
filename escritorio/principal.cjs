// Andamia para Windows: abre la Andamia publicada en su propia ventana y agrega
// lo que una app web no puede hacer sola: bandeja, atajo global, modo mini
// siempre visible, modo escritorio (tipo widget) y abrir al iniciar Windows.
const { app, BrowserWindow, Tray, Menu, globalShortcut, shell, nativeImage, screen, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// ANDAMIA_URL solo sirve para probar la app contra una copia local.
const URL_ANDAMIA = process.env.ANDAMIA_URL || "https://andamia-85eab.web.app/";
const ORIGEN = new URL(URL_ANDAMIA).origin;
const ATAJO_NUEVA_TAREA = "Control+Alt+N";
const RECURSOS = path.join(__dirname, "recursos");

let ventana = null;
let bandeja = null;
let saliendo = false;
let avisoBandejaMostrado = false;

// ---------- Preferencias guardadas (tamaño de ventana y modo) ----------
const archivoPrefs = () => path.join(app.getPath("userData"), "preferencias.json");
function leerPrefs() {
  try {
    return JSON.parse(fs.readFileSync(archivoPrefs(), "utf8"));
  } catch {
    return {};
  }
}
function guardarPrefs(cambios) {
  const prefs = { ...leerPrefs(), ...cambios };
  try {
    fs.writeFileSync(archivoPrefs(), JSON.stringify(prefs, null, 2));
  } catch {
    // Si no se puede guardar, la app sigue funcionando con los valores por defecto.
  }
  return prefs;
}

/** "normal", "mini" (chica y encima de todo) o "escritorio" (chica, detrás de las demás ventanas). */
function modoActual() {
  const prefs = leerPrefs();
  if (prefs.modo === "mini" || prefs.modo === "escritorio") return prefs.modo;
  return prefs.mini ? "mini" : "normal";
}

/** Devuelve el rectángulo solo si todavía cae dentro de alguna pantalla. */
function rectanguloVisible(r) {
  if (!r) return undefined;
  const visible = screen.getAllDisplays().some(({ workArea: a }) => r.x < a.x + a.width && r.x + r.width > a.x && r.y < a.y + a.height && r.y + r.height > a.y);
  return visible ? r : undefined;
}

// ---------- Ventana principal ----------
function crearVentana({ oculta }) {
  const prefs = leerPrefs();
  const r = rectanguloVisible(prefs.ventana);
  ventana = new BrowserWindow({
    width: r?.width ?? 1200,
    height: r?.height ?? 800,
    x: r?.x,
    y: r?.y,
    minWidth: 340,
    minHeight: 420,
    show: false,
    title: "Andamia",
    icon: path.join(RECURSOS, "icono.ico"),
    backgroundColor: "#faf8f4",
    autoHideMenuBar: true,
    webPreferences: {
      // La página no tiene acceso a los archivos del PC.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  ventana.setMenuBarVisibility(false);
  if (modoActual() !== "normal") aplicarModo(modoActual(), { guardar: false });

  ventana.once("ready-to-show", () => {
    // Al iniciar Windows, el widget del modo escritorio aparece igual (sin robar el foco).
    if (!oculta) ventana.show();
    else if (modoActual() === "escritorio") ventana.showInactive();
  });

  // Enlaces a otros sitios se abren en el navegador normal.
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("mailto:")) void shell.openExternal(url);
    return { action: "deny" };
  });
  ventana.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGEN) && !url.startsWith("data:")) {
      e.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });

  // Primera apertura sin internet: página propia con botón para reintentar.
  ventana.webContents.on("did-fail-load", (_e, codigo, _desc, url, esPrincipal) => {
    if (!esPrincipal || codigo === -3 || !url.startsWith(ORIGEN)) return;
    void ventana.loadFile(path.join(RECURSOS, "sin-conexion.html"));
  });

  const guardarTamano = () => {
    if (!ventana || ventana.isMinimized() || ventana.isMaximized()) return;
    const modo = modoActual();
    if (modo === "normal") guardarPrefs({ ventana: ventana.getBounds() });
    // En modo escritorio se recuerda dónde dejaste el widget.
    else if (modo === "escritorio") guardarPrefs({ widget: ventana.getBounds() });
  };
  ventana.on("resize", guardarTamano);
  ventana.on("move", guardarTamano);

  // En modo escritorio, "Mostrar escritorio" (Windows + D) minimiza todo:
  // el widget vuelve a aparecer solo, sin quitarle el foco a nadie.
  ventana.on("minimize", () => {
    if (modoActual() !== "escritorio") return;
    setTimeout(() => {
      if (!ventana || modoActual() !== "escritorio") return;
      ventana.restore();
      ventana.showInactive();
    }, 250);
  });

  // Cerrar la ventana la esconde en la bandeja; "Salir" la cierra de verdad.
  ventana.on("close", (e) => {
    if (saliendo) return;
    e.preventDefault();
    ventana.hide();
    if (!avisoBandejaMostrado && bandeja) {
      avisoBandejaMostrado = true;
      bandeja.displayBalloon({
        iconType: "info",
        title: "Andamia sigue abierta",
        content: "Está junto al reloj. Para cerrarla del todo, haz clic derecho en su ícono y elige Salir.",
      });
    }
  });

  // En los modos chicos se abre directo en "Hoy".
  void ventana.loadURL(modoActual() === "normal" ? URL_ANDAMIA : `${URL_ANDAMIA}#/tareas/hoy`);
}

function mostrarVentana() {
  if (!ventana) return;
  if (ventana.isMinimized()) ventana.restore();
  ventana.show();
  ventana.focus();
}

/** Abre la vista Hoy y pone el cursor en "Agregar tarea". */
function nuevaTarea() {
  mostrarVentana();
  const wc = ventana.webContents;
  if (!wc.getURL().startsWith(ORIGEN)) {
    void ventana.loadURL(`${URL_ANDAMIA}#/tareas/hoy`);
    return;
  }
  void wc.executeJavaScript(`(() => {
    if (!document.getElementById("entrada-rapida")) location.hash = "#/tareas/hoy";
    let intentos = 0;
    const enfocar = () => {
      const campo = document.getElementById("entrada-rapida");
      if (campo) { campo.focus(); return; }
      if (++intentos < 20) setTimeout(enfocar, 100);
    };
    enfocar();
  })()`);
}

// ---------- Modos: normal, mini (encima de todo) y escritorio (widget) ----------
function rectanguloEsquina() {
  const { workArea: a } = screen.getDisplayMatching(ventana.getBounds());
  const ancho = 380;
  const alto = Math.min(640, a.height - 40);
  return { x: a.x + a.width - ancho - 16, y: a.y + a.height - alto - 16, width: ancho, height: alto };
}

function aplicarModo(modo, { guardar = true } = {}) {
  if (!ventana) return;
  const anterior = modoActual();
  if (guardar && anterior === "normal" && modo !== "normal") guardarPrefs({ ventana: ventana.getBounds() });
  if (ventana.isMaximized()) ventana.unmaximize();

  if (modo === "normal") {
    ventana.setAlwaysOnTop(false);
    ventana.setSkipTaskbar(false);
    const r = rectanguloVisible(leerPrefs().ventana);
    ventana.setBounds(r ?? { width: 1200, height: 800 });
    if (!r) ventana.center();
  } else {
    // Mini queda encima de todo; escritorio queda detrás de las demás ventanas.
    ventana.setAlwaysOnTop(modo === "mini", "floating");
    ventana.setSkipTaskbar(true);
    const guardado = modo === "escritorio" ? rectanguloVisible(leerPrefs().widget) : undefined;
    ventana.setBounds(guardado ?? rectanguloEsquina());
    if (ventana.webContents.getURL().startsWith(ORIGEN)) {
      void ventana.webContents.executeJavaScript(`location.hash = "#/tareas/hoy"`);
    }
  }
  if (guardar) guardarPrefs({ modo, mini: undefined });
  actualizarMenuBandeja();
}

// ---------- Bandeja junto al reloj ----------
function abreAlIniciar() {
  return app.getLoginItemSettings({ args: ["--oculta"] }).openAtLogin;
}

function actualizarMenuBandeja() {
  if (!bandeja) return;
  const modo = modoActual();
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir Andamia", click: mostrarVentana },
      { label: "Nueva tarea", accelerator: ATAJO_NUEVA_TAREA, click: nuevaTarea },
      { type: "separator" },
      {
        label: "Ventana normal",
        type: "radio",
        checked: modo === "normal",
        click: () => {
          aplicarModo("normal");
          mostrarVentana();
        },
      },
      {
        label: "Modo escritorio (widget detrás de las ventanas)",
        type: "radio",
        checked: modo === "escritorio",
        click: () => {
          aplicarModo("escritorio");
          mostrarVentana();
        },
      },
      {
        label: "Modo mini (siempre encima)",
        type: "radio",
        checked: modo === "mini",
        click: () => {
          aplicarModo("mini");
          mostrarVentana();
        },
      },
      { type: "separator" },
      {
        label: "Abrir al iniciar Windows",
        type: "checkbox",
        checked: abreAlIniciar(),
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ["--oculta"] }),
      },
      { label: "Recargar", click: () => ventana?.loadURL(URL_ANDAMIA) },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          saliendo = true;
          app.quit();
        },
      },
    ]),
  );
}

function crearBandeja() {
  bandeja = new Tray(nativeImage.createFromPath(path.join(RECURSOS, "bandeja.png")));
  bandeja.setToolTip("Andamia");
  bandeja.on("click", () => (ventana?.isVisible() && ventana.isFocused() ? ventana.hide() : mostrarVentana()));
  actualizarMenuBandeja();
}

// ---------- Arranque ----------
if (!app.requestSingleInstanceLock()) {
  // Ya hay una Andamia abierta: esa se muestra y esta se cierra.
  app.quit();
} else {
  app.setAppUserModelId("cl.andamia.escritorio");
  app.on("second-instance", mostrarVentana);

  app.whenReady().then(() => {
    // La página no necesita cámara, micrófono ni ubicación.
    session.defaultSession.setPermissionRequestHandler((_wc, permiso, responder) => responder(permiso === "clipboard-sanitized-write"));

    crearVentana({ oculta: process.argv.includes("--oculta") });
    crearBandeja();
    globalShortcut.register(ATAJO_NUEVA_TAREA, nuevaTarea);
  });

  app.on("before-quit", () => {
    saliendo = true;
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  // Con la ventana escondida, la app sigue viva en la bandeja.
  app.on("window-all-closed", () => {});
}
