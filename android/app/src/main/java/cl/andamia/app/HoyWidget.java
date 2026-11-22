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

/** Widget "Hoy": eventos, progreso del día y tareas de hoy, con casilla para marcarlas y un botón "+". */
public class HoyWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, android.os.Bundle opciones) {
        dibujar(contexto, gestor, id);
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

    /** "Hoy, lun 9 de noviembre", como en la semana de la app. */
    private static String titulo(Context contexto) {
        String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return Tr.t(contexto, "Hoy");
        try {
            JSONObject datos = new JSONObject(json);
            if (!hoy.equals(datos.optString("fecha"))) return Tr.t(contexto, "Hoy · abre Andamia");
            String titulo = datos.optString("titulo");
            return titulo.isEmpty() ? Tr.t(contexto, "Hoy") : titulo;
        } catch (Exception e) {
            return Tr.t(contexto, "Hoy");
        }
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        TemaWidget.usar(contexto, idWidget);
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_hoy);
        Tr.iniciar(contexto);
        Tr.texto(vista, R.id.widget_vacio, "Nada para hoy.\nToca aquí para abrir Andamia.");
        vista.setTextViewText(R.id.widget_titulo, titulo(contexto));

        // La lista se llena desde ServicioListaHoy.
        Intent servicio = new Intent(contexto, ServicioListaHoy.class);
        servicio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        servicio.putExtra(ServicioListaHoy.EXTRA_SEMANA, false);
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
        TemaWidget.cabecera(contexto, vista, R.id.widget_titulo, R.id.widget_nueva, R.id.widget_vacio);
        TemaWidget.fondo(contexto, gestor, idWidget, vista);
        gestor.updateAppWidget(idWidget, vista);
    }
}
