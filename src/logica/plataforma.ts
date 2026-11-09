import { Capacitor } from "@capacitor/core";

/** true dentro de la app de Android (Capacitor); false en el navegador y en la app de PC. */
export const esAppNativa = (): boolean => Capacitor.isNativePlatform();

/** En Android, el botón "atrás" del teléfono vuelve a la pantalla anterior o deja la app en segundo plano. */
export async function prepararAppNativa(): Promise<void> {
  if (!esAppNativa()) return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) window.history.back();
    else void App.minimizeApp();
  });
  const { iniciarWidgetAndroid } = await import("./widgetAndroid");
  await iniciarWidgetAndroid();
}
