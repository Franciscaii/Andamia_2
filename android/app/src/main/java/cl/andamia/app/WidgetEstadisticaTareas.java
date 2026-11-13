package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** Widget de estadísticas de la pantalla de inicio (ver EstadisticaWidget y Dibujos). */
public class WidgetEstadisticaTareas extends AppWidgetProvider {
    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) EstadisticaWidget.dibujar(contexto, gestor, id, "tareas");
    }

    /** Tocar un período, una flecha o una etiqueta de la leyenda (ver EstadisticaWidget.alRecibir). */
    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (!EstadisticaWidget.alRecibir(contexto, intent, "tareas")) super.onReceive(contexto, intent);
    }

    /** Al cambiarle el tamaño se vuelve a dibujar con las medidas nuevas. */
    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, Bundle opciones) {
        EstadisticaWidget.dibujar(contexto, gestor, id, "tareas");
    }
}
