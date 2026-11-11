// Andamia para Windows: abre la Andamia publicada en su propia ventana y agrega
// lo que una app web no puede hacer sola: bandeja, atajo global, modo mini
// siempre visible, modo escritorio (tipo widget), widgets sueltos en el escritorio
// (Semana, Calendario, Matriz, Estadística Tareas y Estadística Hábitos) y abrir al iniciar Windows.
const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage, screen, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// ANDAMIA_URL solo sirve para probar la app contra una copia local.
const URL_ANDAMIA = process.env.ANDAMIA_URL || "https://andamia-85eab.web.app/";
const ORIGEN = new URL(URL_ANDAMIA).origin;
const ATAJO_NUEVA_TAREA = "Control+Alt+N";
const RECURSOS = path.join(__dirname, "recursos");

/** Alto de la zona de los botones de Windows en la ventana principal (la página deja ese espacio arriba). */
const ALTO_BARRA = 32;

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
    // Sin la barra de título blanca de Windows: los botones de minimizar, maximizar y cerrar
    // quedan sobre el contenido (fondo transparente); la página pone una franja para mover la ventana.
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#00000000", symbolColor: "#374151", height: ALTO_BARRA },
    webPreferences: {
      // La página no tiene acceso a los archivos del PC.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // Solo para el apartado "Widgets" del menú: ver, poner y quitar widgets del escritorio.
      preload: path.join(__dirname, "precarga-principal.cjs"),
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

// ---------- Widgets sueltos en el escritorio ----------
// Cada uno es una ventana chica sin bordes que abre Andamia con ?widget=<tipo>.
// Quedan detrás de las demás ventanas, recuerdan dónde los dejaste y vuelven al iniciar.
const WIDGETS = [
  { id: "semana", nombre: "Semana", ancho: 1040, alto: 620 },
  { id: "calendario", nombre: "Calendario", ancho: 520, alto: 520 },
  { id: "matriz", nombre: "Matriz", ancho: 560, alto: 560 },
  { id: "estadistica-tareas", nombre: "Estadística Tareas", ancho: 380, alto: 560 },
  { id: "estadistica-habitos", nombre: "Estadística Hábitos", ancho: 380, alto: 560 },
];
const ventanasWidget = new Map();

function prefsWidgets() {
  return leerPrefs().widgets ?? {};
}
function guardarPrefsWidget(id, cambios) {
  const todos = prefsWidgets();
  guardarPrefs({ widgets: { ...todos, [id]: { ...todos[id], ...cambios } } });
}

/** Lugar inicial: en la esquina, uno al lado del otro. */
function rectanguloInicialWidget(w) {
  const { workArea: a } = screen.getPrimaryDisplay();
  const antes = WIDGETS.slice(0, WIDGETS.indexOf(w) + 1).reduce((suma, x) => suma + x.ancho + 16, 0);
  const x = Math.max(a.x, a.x + a.width - antes);
  return { x, y: a.y + 16, width: w.ancho, height: Math.min(w.alto, a.height - 32) };
}

/** Abre la ventana principal en la vista que pidió un widget (botón "Abrir en Andamia"). */
function abrirDesdeWidget(url) {
  const hash = new URL(url).hash || "";
  mostrarVentana();
  if (ventana) void ventana.loadURL(URL_ANDAMIA + hash);
}

function abrirWidget(id, { guardar = true } = {}) {
  const w = WIDGETS.find((x) => x.id === id);
  if (!w) return;
  const existente = ventanasWidget.get(id);
  if (existente) {
    existente.showInactive();
    return;
  }
  const r = rectanguloVisible(prefsWidgets()[id]?.rect) ?? rectanguloInicialWidget(w);
  const v = new BrowserWindow({
    ...r,
    minWidth: MINIMO_WIDGET.ancho,
    minHeight: MINIMO_WIDGET.alto,
    frame: false,
    // Transparente para que el widget deje ver el escritorio (la transparencia la elige ella en el widget).
    // Las ventanas transparentes no se pueden estirar desde el sistema: los bordes los dibuja la página.
    transparent: true,
    resizable: false,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: `Andamia · ${w.nombre}`,
    icon: path.join(RECURSOS, "icono.ico"),
    backgroundColor: "#00000000",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true, preload: path.join(__dirname, "precarga-widget.cjs") },
  });
  ventanasWidget.set(id, v);
  if (guardar) guardarPrefsWidget(id, { abierto: true });

  v.once("ready-to-show", () => v.showInactive());
  const recordar = () => {
    if (!v.isDestroyed()) guardarPrefsWidget(id, { rect: v.getBounds() });
  };
  v.on("move", recordar);
  v.on("resize", recordar);
  // "Mostrar escritorio" (Windows + D) los esconde: vuelven solos.
  v.on("minimize", () => setTimeout(() => !v.isDestroyed() && (v.restore(), v.showInactive()), 250));
  v.on("close", (e) => {
    // Al salir de la app quedan anotados como abiertos, para volver al iniciar.
    if (saliendo) return;
    e.preventDefault();
    cerrarWidget(id);
  });

  v.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("mailto:")) void shell.openExternal(url);
    return { action: "deny" };
  });
  v.webContents.on("will-navigate", (e, url) => {
    if (url.startsWith(ORIGEN) && new URL(url).searchParams.has("abrir")) {
      e.preventDefault();
      abrirDesdeWidget(url);
    } else if (!url.startsWith(ORIGEN)) {
      e.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });
  v.webContents.on("did-fail-load", (_e, codigo, _desc, url, esPrincipal) => {
    if (!esPrincipal || codigo === -3 || !url.startsWith(ORIGEN)) return;
    void v.loadFile(path.join(RECURSOS, "sin-conexion.html"));
  });
  // Clic derecho fuera de los campos de texto: opciones del widget.
  v.webContents.on("context-menu", (_e, info) => {
    if (info.isEditable) return;
    Menu.buildFromTemplate([
      { label: "Abrir Andamia", click: mostrarVentana },
      { label: "Recargar", click: () => v.loadURL(`${URL_ANDAMIA}?widget=${id}`) },
      { type: "separator" },
      { label: `Quitar el widget ${w.nombre}`, click: () => cerrarWidget(id) },
    ]).popup({ window: v });
  });

  void v.loadURL(`${URL_ANDAMIA}?widget=${id}`);
  actualizarMenuBandeja();
}

// ---------- Cambiar el tamaño de un widget desde sus bordes ----------
const MINIMO_WIDGET = { ancho: 260, alto: 220 };
const ajustes = new Map(); // webContents.id -> { ventana, borde, inicio, cursor, reloj }

/** Nuevo rectángulo al mover el borde (n, s, e, o o una esquina) según cuánto se movió el mouse. */
function rectanguloAjustado(inicio, borde, dx, dy) {
  let { x, y, width, height } = inicio;
  if (borde.includes("e")) width = Math.max(MINIMO_WIDGET.ancho, inicio.width + dx);
  if (borde.includes("s")) height = Math.max(MINIMO_WIDGET.alto, inicio.height + dy);
  if (borde.includes("o")) {
    width = Math.max(MINIMO_WIDGET.ancho, inicio.width - dx);
    x = inicio.x + inicio.width - width;
  }
  if (borde.includes("n")) {
    height = Math.max(MINIMO_WIDGET.alto, inicio.height - dy);
    y = inicio.y + inicio.height - height;
  }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function terminarAjuste(idContenido) {
  const a = ajustes.get(idContenido);
  if (!a) return;
  clearInterval(a.reloj);
  clearTimeout(a.limite);
  ajustes.delete(idContenido);
}

ipcMain.on("widget-ajuste-inicio", (evento, borde) => {
  const v = BrowserWindow.fromWebContents(evento.sender);
  if (!v || ![...ventanasWidget.values()].includes(v) || !/^(n|s|e|o|no|ne|so|se)$/.test(borde)) return;
  terminarAjuste(evento.sender.id);
  const inicio = v.getBounds();
  const cursor = screen.getCursorScreenPoint();
  // Mientras se arrastra, se sigue al mouse unas 60 veces por segundo.
  const reloj = setInterval(() => {
    if (v.isDestroyed()) return terminarAjuste(evento.sender.id);
    const p = screen.getCursorScreenPoint();
    v.setBounds(rectanguloAjustado(inicio, borde, p.x - cursor.x, p.y - cursor.y));
  }, 16);
  // Por si nunca llega el aviso de que se soltó.
  const limite = setTimeout(() => terminarAjuste(evento.sender.id), 60_000);
  ajustes.set(evento.sender.id, { reloj, limite });
});
ipcMain.on("widget-ajuste-fin", (evento) => terminarAjuste(evento.sender.id));

// El widget pide el alto justo de su contenido; nunca más alto que la pantalla ni más bajo que el mínimo.
ipcMain.on("widget-alto", (evento, alto) => {
  const v = BrowserWindow.fromWebContents(evento.sender);
  if (!v || v.isDestroyed() || ![...ventanasWidget.values()].includes(v) || ajustes.has(evento.sender.id)) return;
  if (typeof alto !== "number" || !Number.isFinite(alto)) return;
  const b = v.getBounds();
  const area = screen.getDisplayMatching(b).workArea;
  const maximo = Math.max(MINIMO_WIDGET.alto, area.y + area.height - b.y);
  const nuevo = Math.round(Math.min(maximo, Math.max(MINIMO_WIDGET.alto, alto)));
  if (Math.abs(nuevo - b.height) < 2) return;
  v.setBounds({ ...b, height: nuevo });
});

function cerrarWidget(id) {
  const v = ventanasWidget.get(id);
  ventanasWidget.delete(id);
  guardarPrefsWidget(id, { abierto: false });
  if (v && !v.isDestroyed()) v.destroy();
  actualizarMenuBandeja();
}

function abrirWidgetsGuardados() {
  const prefs = prefsWidgets();
  for (const w of WIDGETS) if (prefs[w.id]?.abierto) abrirWidget(w.id, { guardar: false });
}

// ---------- Bandeja junto al reloj ----------
function abreAlIniciar() {
  return app.getLoginItemSettings({ args: ["--oculta"] }).openAtLogin;
}

// ---------- Apartado "Widgets" de la ventana principal ----------
const idsWidgetsAbiertos = () => [...ventanasWidget.keys()];
const desdeVentanaPrincipal = (evento) => ventana && !ventana.isDestroyed() && evento.sender === ventana.webContents;
ipcMain.handle("widgets-abiertos", (evento) => (desdeVentanaPrincipal(evento) ? idsWidgetsAbiertos() : []));
ipcMain.on("widget-abrir", (evento, id) => {
  if (desdeVentanaPrincipal(evento) && WIDGETS.some((w) => w.id === id)) abrirWidget(id);
});
ipcMain.on("widget-cerrar", (evento, id) => {
  if (desdeVentanaPrincipal(evento) && WIDGETS.some((w) => w.id === id)) cerrarWidget(id);
});
// La página avisa los colores del tema para que los botones de Windows se vean (claro u oscuro).
const COLOR_VALIDO = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
ipcMain.on("ventana-colores", (evento, colores) => {
  if (!desdeVentanaPrincipal(evento) || !colores || typeof colores !== "object") return;
  const { fondo, simbolos } = colores;
  if (!COLOR_VALIDO.test(String(fondo)) || !COLOR_VALIDO.test(String(simbolos))) return;
  try {
    ventana.setTitleBarOverlay({ color: fondo, symbolColor: simbolos, height: ALTO_BARRA });
  } catch {
    // Si el sistema no lo permite, quedan los colores iniciales.
  }
});

/** Avisa a la ventana principal qué widgets están puestos (para el botón Añadir / Quitar). */
function avisarWidgets() {
  if (ventana && !ventana.isDestroyed()) ventana.webContents.send("widgets-cambiaron", idsWidgetsAbiertos());
}

function actualizarMenuBandeja() {
  avisarWidgets();
  if (!bandeja) return;
  const modo = modoActual();
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir Andamia", click: mostrarVentana },
      { label: "Nueva tarea", accelerator: ATAJO_NUEVA_TAREA, click: nuevaTarea },
      { type: "separator" },
      {
        label: "Widgets en el escritorio",
        submenu: WIDGETS.map((w) => ({
          label: w.nombre,
          type: "checkbox",
          checked: ventanasWidget.has(w.id),
          click: (item) => (item.checked ? abrirWidget(w.id) : cerrarWidget(w.id)),
        })),
      },
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
        // El modo escritorio es el widget Semana: sin barra de título ni menú.
        label: "Modo escritorio (widget Semana)",
        click: () => {
          if (modoActual() !== "normal") aplicarModo("normal");
          ventana?.hide();
          abrirWidget("semana");
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

  app.whenReady().then(async () => {
    // Siempre la versión publicada más nueva: se borra la copia guardada de la página
    // (service worker, su caché y la caché del navegador). Las tareas, la sesión y los ajustes no se tocan.
    try {
      await session.defaultSession.clearStorageData({ storages: ["serviceworkers", "cachestorage"] });
      // También la caché normal del navegador: así un cambio publicado se ve apenas se abre la app.
      await session.defaultSession.clearCache();
    } catch {
      // Si no se puede, la app abre igual.
    }
    // La página no necesita cámara, micrófono ni ubicación.
    session.defaultSession.setPermissionRequestHandler((_wc, permiso, responder) => responder(permiso === "clipboard-sanitized-write"));

    // Quien usaba el modo escritorio antiguo (ventana con barra de título) pasa al widget Semana.
    let oculta = process.argv.includes("--oculta");
    if (leerPrefs().modo === "escritorio") {
      guardarPrefs({ modo: "normal" });
      guardarPrefsWidget("semana", { abierto: true });
      oculta = true;
    }
    crearVentana({ oculta });
    crearBandeja();
    abrirWidgetsGuardados();
    globalShortcut.register(ATAJO_NUEVA_TAREA, nuevaTarea);
  });

  app.on("before-quit", () => {
    saliendo = true;
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  // Con la ventana escondida, la app sigue viva en la bandeja.
  app.on("window-all-closed", () => {});
}
