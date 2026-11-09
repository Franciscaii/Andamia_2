import { expect, test, type Page } from "@playwright/test";

async function crearLista(page: Page, nombre: string) {
  await page.getByRole("button", { name: "Nueva lista" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva lista" });
  await dialogo.getByLabel("Nombre").fill(nombre);
  await dialogo.getByRole("button", { name: "Crear lista" }).click();
  await expect(page.getByRole("heading", { level: 1, name: nombre })).toBeVisible();
}

const entrada = (page: Page) => page.getByRole("textbox", { name: "Añadir tarea" });
/** En la semana: + → Tarea o Evento, llenar la ventana y crear. */
async function crearEnSemana(page: Page, tipo: "Tarea" | "Evento", texto: string, opciones: { importancia?: string; dificultad?: string; indole?: string } = {}) {
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: tipo }).click();
  const dialogo = page.getByRole("dialog");
  const campo = dialogo.getByRole("textbox", { name: tipo === "Tarea" ? "Añadir tarea" : "Añadir evento" });
  await campo.fill(texto);
  if (opciones.importancia) await dialogo.getByRole("group", { name: "Importancia" }).getByRole("button", { name: opciones.importancia }).click();
  if (opciones.dificultad) await dialogo.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: opciones.dificultad }).click();
  if (opciones.indole) await dialogo.getByRole("group", { name: "Índole" }).getByRole("button", { name: opciones.indole, exact: true }).click();
  await campo.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

const navegar = (page: Page, nombre: string) => page.getByRole("navigation").getByRole("link", { name: new RegExp(`^${nombre}`) }).click();

test("crear lista, añadir tarea en lenguaje natural, verla en Mañana y completarla", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Proyecto");

  await entrada(page).fill("Enviar propuesta mañana 9am #trabajo");
  await expect(page.getByTestId("datos-reconocidos")).toContainText("Mañana 09:00");
  await expect(page.getByTestId("datos-reconocidos")).toContainText("trabajo");
  await entrada(page).press("Enter");

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" });
  await expect(fila).toContainText("Mañana 09:00");
  await expect(fila).toContainText("trabajo");
  await expect(fila).not.toContainText("#trabajo");
  await expect(fila).not.toContainText("propuesta mañana");
  await expect(page.getByRole("navigation").getByRole("link", { name: /^trabajo/ })).toBeVisible();

  // Mañana ya no está en el menú, pero su dirección sigue funcionando.
  await page.goto("/#/tareas/manana");
  await expect(page.getByRole("heading", { level: 1, name: "Mañana" })).toBeVisible();
  const enManana = page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" });
  await expect(enManana).toContainText("Proyecto");

  await enManana.getByRole("checkbox", { name: "Completar: Enviar propuesta" }).click();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toHaveCount(0);

  await navegar(page, "Completadas");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();

  // Los datos deben seguir ahí después de recargar: viven en IndexedDB.
  await page.reload();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Enviar propuesta" })).toBeVisible();
});

test("el menú no muestra Todas, Hoy, Mañana, Bandeja de entrada ni Enfoque", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tareas hoy" })).toBeVisible();
  await expect(page.getByTestId("progreso-dia")).toBeVisible();
  // Ya no hay campo para añadir tareas a la vista: se usa el +.
  await expect(page.getByRole("textbox", { name: "Añadir tarea" })).toHaveCount(0);
  const menu = page.getByRole("navigation");
  for (const nombre of ["Todas", "Hoy", "Mañana", "Bandeja de entrada", "Enfoque"]) {
    await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}`) })).toHaveCount(0);
  }
  await expect(menu.getByRole("link", { name: /^Semana/ })).toBeVisible();
});

test("semana: eventos arriba, progreso del día y tareas con dificultad e importancia", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Leer paper", { importancia: "Alta", indole: "Universidad" });
  await crearEnSemana(page, "Tarea", "Comprar pan");
  await expect(page.getByTestId("progreso-dia")).toContainText("0/2 (0%)");

  await page.getByRole("checkbox", { name: "Completar: Comprar pan" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");
  // Lo completado baja a la tarjeta "Completada", y el día queda marcado con un punto.
  await expect(page.getByTestId("tarjeta-completada")).toContainText("Comprar pan");
  await expect(page.getByRole("list", { name: "Tareas" })).not.toContainText("Comprar pan");
  await expect(page.getByRole("button", { name: /^lunes|^martes|^miércoles|^jueves|^viernes|^sábado|^domingo/, pressed: true }).getByTestId("punto-dia")).toHaveCount(1);

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Leer paper" });
  // La casilla lleva el color de la importancia; la insignia de abajo es la dificultad.
  await expect(page.getByRole("checkbox", { name: "Completar: Leer paper" })).toHaveAttribute("title", "Importancia alta");
  await expect(fila.getByTestId("dificultad")).toHaveCount(0);
  await expect(fila).toContainText("Universidad");
  await fila.getByRole("button", { name: /^Leer paper/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  // El detalle no muestra hora, repetir, tipo ni enfocar.
  for (const oculto of ["Hora", "Repetir"]) await expect(detalle.getByLabel(oculto, { exact: true })).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Enfocar" })).toHaveCount(0);
  await expect(detalle.getByRole("button", { name: "Evento" })).toHaveCount(0);
  await detalle.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: "Media" }).click();
  await expect(fila.getByTestId("dificultad")).toHaveText("Media");
  await page.keyboard.press("Escape");

  // Un evento va arriba y no cuenta en el progreso.
  await crearEnSemana(page, "Evento", "Cumpleaños de Ana");
  await expect(page.getByTestId("fila-evento")).toContainText("Cumpleaños de Ana");
  await expect(page.getByTestId("progreso-dia")).toContainText("1/2 (50%)");

  // Otro día de la semana.
  await page.getByRole("button", { name: "Semana siguiente" }).click();
  await expect(page.getByTestId("progreso-dia")).toContainText("0/0 (0%)");
  await expect(page.getByRole("heading", { name: "Tareas del día" })).toBeVisible();

  // Desde el + también se crea un hábito.
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Hábito" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo hábito" })).toBeVisible();
});

test("detalle, papelera y restaurar", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Revisar contrato !alta");
  await entrada(page).press("Enter");
  await page.getByRole("button", { name: /^Revisar contrato/ }).click();

  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Título")).toHaveValue("Revisar contrato");
  await expect(detalle.getByRole("group", { name: "Importancia" }).getByRole("button", { name: "Alta" })).toHaveAttribute("aria-pressed", "true");

  await detalle.getByLabel("Notas").fill("Pedir la versión firmada");
  await detalle.getByLabel("Nueva subtarea").fill("Leer cláusulas");
  await detalle.getByLabel("Nueva subtarea").press("Enter");
  await detalle.getByRole("group", { name: "Índole" }).getByRole("button", { name: "Vinculos" }).click();
  await expect(page.getByTestId("fila-tarea")).toContainText("0/1");
  await expect(page.getByTestId("fila-tarea")).toContainText("Vinculos");

  await detalle.getByRole("button", { name: "Enviar a la papelera" }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(0);

  await navegar(page, "Papelera");
  await page.getByRole("button", { name: "Restaurar Revisar contrato" }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(0);

  await page.goto("/#/tareas/bandeja");
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Revisar contrato" })).toBeVisible();
});

test("búsqueda sin acentos, filtros y tema oscuro", async ({ page }) => {
  await page.goto("/#/tareas/bandeja");
  await entrada(page).fill("Reunión con María #trabajo");
  await entrada(page).press("Enter");
  await entrada(page).fill("Comprar pan");
  await entrada(page).press("Enter");

  await navegar(page, "Buscar");
  await page.getByLabel("Buscar tareas").fill("maria");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
  await expect(page.locator("mark")).toHaveText("María");

  await page.getByLabel("Buscar tareas").fill("");
  await page.getByLabel("Filtrar por etiqueta").selectOption("trabajo");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);

  await page.getByRole("button", { name: "Usar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("reordenar con el teclado y borrar una lista con sus tareas", async ({ page }) => {
  await page.goto("/");
  await crearLista(page, "Compras");
  for (const t of ["Tercera", "Segunda", "Primera"]) {
    await entrada(page).fill(t);
    await entrada(page).press("Enter");
    await expect(page.getByTestId("fila-tarea").first()).toContainText(t);
  }
  const textos = () => page.getByTestId("fila-tarea").allInnerTexts();
  expect((await textos()).map((x) => x.trim())).toEqual(["Primera", "Segunda", "Tercera"]);

  const asa = page.getByRole("button", { name: "Mover Primera" });
  await asa.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  // dnd-kit anima el movimiento; soltar antes lo cancela.
  await page.waitForTimeout(600);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await textos()).map((x) => x.trim())).toEqual(["Segunda", "Primera", "Tercera"]);

  await page.reload();
  await expect.poll(async () => (await textos()).map((x) => x.trim())).toEqual(["Segunda", "Primera", "Tercera"]);

  await page.getByRole("link", { name: /^Compras/ }).hover();
  await page.getByRole("button", { name: "Borrar Compras" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar lista" }).click();
  await expect(page.getByRole("navigation").getByRole("link", { name: /^Compras/ })).toHaveCount(0);

  await navegar(page, "Papelera");
  await expect(page.getByTestId("fila-tarea")).toHaveCount(3);
});

test("etiquetas iniciales del ámbito: vienen por defecto y se pueden crear, editar y borrar", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation");
  for (const nombre of ["Otro", "Vinculos", "Universidad", "NecesidadBiologica", "CuidadoPersonal", "DisfrutePersonal", "VidaCotidiana", "DesarrolloProfesional"]) {
    await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}`) })).toBeVisible();
  }

  await page.getByRole("button", { name: "Nueva etiqueta" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva etiqueta" });
  await dialogo.getByLabel("Nombre").fill("Deporte");
  await dialogo.getByRole("button", { name: "Crear etiqueta" }).click();
  await expect(menu.getByRole("link", { name: /^Deporte/ })).toBeVisible();

  // Renombrar mantiene la etiqueta en las tareas.
  await crearEnSemana(page, "Tarea", "Correr", { indole: "Deporte" });
  await menu.getByRole("link", { name: /^Deporte/ }).hover();
  await page.getByRole("button", { name: "Editar etiqueta Deporte" }).click();
  const edicion = page.getByRole("dialog", { name: "Editar etiqueta" });
  await edicion.getByLabel("Nombre").fill("Universidad");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(edicion.getByRole("alert")).toContainText("Ya existe");
  await edicion.getByLabel("Nombre").fill("Ejercicio");
  await edicion.getByRole("button", { name: "Guardar" }).click();
  await expect(menu.getByRole("link", { name: /^Ejercicio/ })).toBeVisible();
  await expect(page.getByTestId("fila-tarea").filter({ hasText: "Correr" })).toContainText("Ejercicio");

  await menu.getByRole("link", { name: /^Otro/ }).hover();
  await page.getByRole("button", { name: "Borrar etiqueta Otro" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar etiqueta" }).click();
  await expect(menu.getByRole("link", { name: /^Otro/ })).toHaveCount(0);
  // Al recargar no vuelve.
  await page.reload();
  await expect(menu.getByRole("link", { name: /^Universidad/ })).toBeVisible();
  await expect(menu.getByRole("link", { name: /^Otro/ })).toHaveCount(0);
});

test("estadística de tareas: por etiqueta, circular y en el tiempo; tocar una etiqueta atenúa las demás", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Leer paper", { indole: "Universidad" });
  await crearEnSemana(page, "Tarea", "Cocinar", { indole: "VidaCotidiana" });
  await crearEnSemana(page, "Tarea", "Lavar ropa", { indole: "VidaCotidiana" });
  for (const t of ["Leer paper", "Cocinar", "Lavar ropa"]) await page.getByRole("checkbox", { name: `Completar: ${t}` }).click();

  await page.getByRole("navigation").getByRole("link", { name: "Estadística Tareas" }).click();
  await expect(page.getByRole("heading", { name: "Mis tareas completadas" })).toBeVisible();
  const filas = page.getByTestId("fila-grupo");
  await expect(filas).toHaveCount(2);
  await expect(filas.first()).toContainText("VidaCotidiana");
  await expect(filas.first()).toContainText("2 • 67%");
  await expect(page.getByTestId("grafico-circular")).toContainText("3");

  await filas.nth(1).click();
  await expect(filas.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("grafico-circular")).toContainText("33%");
  await expect(page.getByTestId("lista-hechos")).toHaveCount(0);
  await expect(page.locator('[data-testid="grafico-circular"] path[data-clave="vidacotidiana"]')).toHaveAttribute("opacity", "0.22");
  await expect(page.locator('[data-testid="grafico-areas"] path[data-clave="universidad"]')).toHaveAttribute("fill-opacity", "0.85");

  // Otro período sin datos.
  await page.getByRole("button", { name: "Período anterior" }).click();
  await expect(page.getByText("No completaste tareas en este período.")).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Estadística Hábitos" }).click();
  await expect(page.getByRole("heading", { name: "Mis hábitos cumplidos" })).toBeVisible();
});

test("calendario mes: eventos y tareas con casilla en cada día, filtros y +", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Estudiar cálculo");
  await crearEnSemana(page, "Evento", "Doctor");
  await page.getByRole("navigation").getByRole("link", { name: "Calendario" }).click();

  const hoy = page.locator(`[data-zona="dia:${new Date().toLocaleDateString("sv-SE")}"]`);
  await expect(hoy).toContainText("Estudiar cálculo");
  await expect(hoy).toContainText("Doctor");
  // El evento va primero y no tiene casilla.
  await expect(hoy.getByTestId("chip-tarea").first()).toContainText("Doctor");
  await expect(hoy.getByRole("checkbox", { name: "Completar: Doctor" })).toHaveCount(0);

  await hoy.getByRole("checkbox", { name: "Completar: Estudiar cálculo" }).click();
  await expect(hoy.getByRole("checkbox", { name: /Estudiar cálculo/ })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Eventos" }).click();
  await expect(hoy).not.toContainText("Estudiar cálculo");
  await expect(hoy).toContainText("Doctor");
  await page.getByRole("button", { name: "Tareas" }).click();
  await expect(hoy).not.toContainText("Doctor");

  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await page.getByRole("textbox", { name: "Añadir evento" }).fill("Cumpleaños");
  await page.getByRole("textbox", { name: "Añadir evento" }).press("Enter");
  await page.getByRole("button", { name: "Todos" }).click();
  await expect(hoy).toContainText("Cumpleaños");
});

test("nueva tarea en ventana: fecha, importancia, dificultad, índole, notas y subtareas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tarea" }).click();
  const dialogo = page.getByRole("dialog", { name: "Nueva tarea" });
  await dialogo.getByRole("textbox", { name: "Añadir tarea" }).fill("Preparar informe");
  await expect(dialogo.getByLabel("Fecha", { exact: true })).toHaveValue(new Date().toLocaleDateString("sv-SE"));
  await dialogo.getByRole("group", { name: "Importancia" }).getByRole("button", { name: "Media" }).click();
  await dialogo.getByRole("group", { name: "Dificultad" }).getByRole("button", { name: "Alta" }).click();
  await dialogo.getByRole("group", { name: "Índole" }).getByRole("button", { name: "Universidad" }).click();
  await dialogo.getByLabel("Notas").fill("Con gráficos");
  await dialogo.getByLabel("Nueva subtarea").fill("Buscar datos");
  // Enter en la subtarea la añade sin crear la tarea todavía.
  await dialogo.getByLabel("Nueva subtarea").press("Enter");
  await expect(dialogo.getByLabel("Título de la subtarea")).toHaveValue("Buscar datos");
  await dialogo.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const fila = page.getByTestId("fila-tarea").filter({ hasText: "Preparar informe" });
  await expect(fila.getByTestId("dificultad")).toHaveText("Alta");
  await expect(fila).toContainText("Universidad");
  await expect(page.getByRole("checkbox", { name: "Completar: Preparar informe" })).toHaveAttribute("title", "Importancia media");
  await fila.getByRole("button", { name: /^Preparar informe/ }).click();
  const detalle = page.getByRole("complementary", { name: "Detalle de la tarea" });
  await expect(detalle.getByLabel("Notas")).toHaveValue("Con gráficos");
  await expect(detalle.getByLabel("Título de la subtarea")).toHaveValue("Buscar datos");

  // Un evento no pide importancia ni dificultad.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Evento" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo evento" }).getByRole("group", { name: "Importancia" })).toHaveCount(0);
});

test("tareas hoy: subir o bajar una tarea arrastrando su asa", async ({ page }) => {
  await page.goto("/");
  for (const t of ["Tercera", "Segunda", "Primera"]) await crearEnSemana(page, "Tarea", t);
  const lista = page.getByRole("list", { name: "Tareas" });
  const titulos = async () => (await lista.getByTestId("fila-tarea").allInnerTexts()).map((x) => x.trim().split("\n")[0].trim());
  await expect.poll(titulos).toEqual(["Primera", "Segunda", "Tercera"]);

  // Con el teclado: Espacio toma, flecha baja, Espacio suelta.
  await page.getByRole("button", { name: "Mover Primera" }).focus();
  await page.keyboard.press("Space");
  // dnd-kit mide las filas al tomar la tarea; moverla antes no la mueve.
  await expect(page.getByRole("list", { name: "Tareas" }).getByTestId("fila-tarea").first()).toHaveClass(/shadow-lg/);
  await page.keyboard.press("ArrowDown");
  // Soltar solo cuando la fila ya bajó; antes, dnd-kit la deja donde estaba.
  await expect(lista.getByTestId("fila-tarea").first()).toHaveAttribute("style", /translate3d\(0px, [1-9]/);
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect.poll(titulos).toEqual(["Segunda", "Primera", "Tercera"]);

  // Con el ratón: Tercera sube arriba de todo.
  const asa = page.getByRole("button", { name: "Mover Tercera" });
  const destino = lista.getByTestId("fila-tarea").first();
  const a = (await asa.boundingBox())!;
  const d = (await destino.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2, a.y - 10, { steps: 5 });
  await page.mouse.move(a.x + a.width / 2, d.y + 4, { steps: 10 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await expect.poll(titulos).toEqual(["Tercera", "Segunda", "Primera"]);

  await page.reload();
  await expect.poll(titulos).toEqual(["Tercera", "Segunda", "Primera"]);
});

test("semana: ver un día o los 7 días de una vez", async ({ page }) => {
  await page.goto("/");
  await crearEnSemana(page, "Tarea", "Tarea de hoy");
  // Una tarea para otro día de la semana.
  const hoy = new Date();
  const otro = new Date(hoy);
  otro.setDate(hoy.getDate() + (hoy.getDay() === 0 ? -1 : 1));
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await page.getByRole("menuitem", { name: "Tarea" }).click();
  const dialogo = page.getByRole("dialog");
  await dialogo.getByRole("textbox", { name: "Añadir tarea" }).fill("Tarea de otro día");
  await dialogo.getByLabel("Fecha", { exact: true }).fill(otro.toLocaleDateString("sv-SE"));
  await dialogo.getByRole("button", { name: "Crear tarea" }).click();

  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "7 días" }).click();
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
  await expect(page.getByTestId("fila-tarea")).toHaveCount(2);
  await expect(page.getByTestId("dia-semana").filter({ hasText: "Tarea de otro día" })).toHaveCount(1);
  // Se recuerda al volver.
  await page.reload();
  await expect(page.getByTestId("dia-semana")).toHaveCount(7);
  // En una pantalla de celular no se ofrece: siempre un día.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("group", { name: "Ver" })).toHaveCount(0);
  await expect(page.getByTestId("dia-semana")).toHaveCount(0);
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("group", { name: "Ver" }).getByRole("button", { name: "Día", exact: true }).click();
  await expect(page.getByTestId("fila-tarea")).toHaveCount(1);
});
