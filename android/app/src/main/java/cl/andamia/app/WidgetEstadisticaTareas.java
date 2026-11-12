package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** Widget de la pantalla de inicio que se dibuja como imagen (ver Widgets y Dibujos). */
public class WidgetEstadisticaTareas extends AppWidgetProvider {
    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) Widgets.dibujarImagen(contexto, gestor, id, "tareas");
    }

    /** Tocar una fila de la leyenda destaca esa etiqueta (ver Widgets.alTocarEtiqueta). */
    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (!Widgets.alTocarEtiqueta(contexto, intent, "tareas")) super.onReceive(contexto, intent);
    }

    /** Al cambiarle el tamaño se vuelve a dibujar con las medidas nuevas. */
    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, Bundle opciones) {
        Widgets.dibujarImagen(contexto, gestor, id, "tareas");
    }
}
