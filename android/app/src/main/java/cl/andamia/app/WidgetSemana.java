package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Widget de la pantalla de inicio con la lista de "semana" (ver Widgets y FabricaFilas). */
public class WidgetSemana extends AppWidgetProvider {
    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) Widgets.dibujarLista(contexto, gestor, id, "semana");
    }
}
