package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONObject;

/** Widget "Hoy": las tareas de hoy, con círculo para marcarlas y un botón "+". */
public class HoyWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    static void redibujarTodos(Context contexto) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        int[] ids = gestor.getAppWidgetIds(new ComponentName(contexto, HoyWidget.class));
        for (int id : ids) dibujar(contexto, gestor, id);
        gestor.notifyAppWidgetViewDataChanged(ids, R.id.widget_lista);
    }

    private static PendingIntent abrirApp(Context contexto, String direccion, int codigo) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(direccion), contexto, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(contexto, codigo, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String titulo(Context contexto) {
        String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return "Hoy";
        try {
            JSONObject datos = new JSONObject(json);
            if (!hoy.equals(datos.optString("fecha"))) return "Hoy · abre Andamia";
        } catch (Exception e) {
            return "Hoy";
        }
        int cantidad = new FabricaListaHoy(contexto).cantidadVisible();
        return cantidad == 0 ? "Hoy" : "Hoy · " + cantidad;
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_hoy);
        vista.setTextViewText(R.id.widget_titulo, titulo(contexto));

        // La lista se llena desde ServicioListaHoy.
        Intent servicio = new Intent(contexto, ServicioListaHoy.class);
        servicio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        servicio.setData(Uri.parse(servicio.toUri(Intent.URI_INTENT_SCHEME)));
        vista.setRemoteAdapter(R.id.widget_lista, servicio);
        vista.setEmptyView(R.id.widget_lista, R.id.widget_vacio);

        // Cada fila completa la plantilla con su acción (marcar o abrir).
        Intent plantilla = new Intent(contexto, AccionWidgetActivity.class);
        plantilla.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT
                | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        vista.setPendingIntentTemplate(R.id.widget_lista, PendingIntent.getActivity(contexto, 10, plantilla, banderas));

        vista.setOnClickPendingIntent(R.id.widget_titulo, abrirApp(contexto, "andamia://hoy", 1));
        vista.setOnClickPendingIntent(R.id.widget_vacio, abrirApp(contexto, "andamia://hoy", 1));
        vista.setOnClickPendingIntent(R.id.widget_nueva, abrirApp(contexto, "andamia://nueva", 2));
        gestor.updateAppWidget(idWidget, vista);
    }
}
