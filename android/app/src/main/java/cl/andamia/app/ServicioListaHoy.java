package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.content.Intent;
import android.widget.RemoteViewsService;

/** Filas del widget "Hoy" y, con EXTRA_SEMANA, del día elegido en un widget "Semana". */
public class ServicioListaHoy extends RemoteViewsService {
    static final String EXTRA_SEMANA = "cl.andamia.app.SEMANA";

    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        int idWidget = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        return new FabricaListaHoy(getApplicationContext(), idWidget, intent.getBooleanExtra(EXTRA_SEMANA, false));
    }
}
