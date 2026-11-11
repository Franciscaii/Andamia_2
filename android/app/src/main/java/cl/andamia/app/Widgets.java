package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/**
 * Lo común de los widgets "Semana", "Matriz", "Calendario" y de estadísticas:
 * dibujarlos, abrir la vista correspondiente al tocarlos y redibujar todos a la vez.
 */
final class Widgets {
    private Widgets() {}

    /** Después de que la app manda datos nuevos o se marca una tarea desde un widget. */
    static void redibujarTodo(Context contexto) {
        HoyWidget.redibujarTodos(contexto);
        WidgetSemana.redibujarTodos(contexto);
        redibujarLista(contexto, WidgetMatriz.class, "matriz");
        redibujarImagen(contexto, WidgetCalendario.class, "calendario");
        redibujarImagen(contexto, WidgetEstadisticaTareas.class, "tareas");
        redibujarImagen(contexto, WidgetEstadisticaHabitos.class, "habitos");
    }

    static PendingIntent abrirApp(Context contexto, String direccion, int codigo) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(direccion), contexto, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(contexto, codigo, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static JSONObject datos(Context contexto) {
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (Exception e) {
            return null;
        }
    }

    static int acento(Context contexto, JSONObject datos) {
        try {
            String c = datos == null ? "" : datos.optString("acento");
            if (!c.isEmpty()) return Color.parseColor(c);
        } catch (IllegalArgumentException e) {
            // Color desconocido: el azul de los widgets.
        }
        return FabricaListaHoy.color(contexto, R.color.widget_acento);
    }

    // ---------- Widget de lista: Matriz ----------

    private static void redibujarLista(Context contexto, Class<?> clase, String clave) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        int[] ids = gestor.getAppWidgetIds(new ComponentName(contexto, clase));
        for (int id : ids) dibujarLista(contexto, gestor, id, clave);
        gestor.notifyAppWidgetViewDataChanged(ids, R.id.lista_filas);
    }

    static void dibujarLista(Context contexto, AppWidgetManager gestor, int idWidget, String clave) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_lista);
        vista.setTextViewText(R.id.lista_titulo, "Matriz");
        vista.setTextViewText(R.id.lista_vacio, "Sin tareas pendientes.\nToca aquí para abrir Andamia.");

        Intent servicio = new Intent(contexto, ServicioFilas.class);
        servicio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        servicio.putExtra(ServicioFilas.EXTRA_CLAVE, clave);
        servicio.setData(Uri.parse(servicio.toUri(Intent.URI_INTENT_SCHEME)));
        vista.setRemoteAdapter(R.id.lista_filas, servicio);
        vista.setEmptyView(R.id.lista_filas, R.id.lista_vacio);

        // Cada fila completa la plantilla con su acción (marcar o abrir).
        Intent plantilla = new Intent(contexto, AccionWidgetActivity.class);
        plantilla.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT
                | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        vista.setPendingIntentTemplate(R.id.lista_filas, PendingIntent.getActivity(contexto, 30, plantilla, banderas));

        vista.setOnClickPendingIntent(R.id.lista_titulo, abrirApp(contexto, "andamia://matriz", 31));
        vista.setOnClickPendingIntent(R.id.lista_vacio, abrirApp(contexto, "andamia://matriz", 31));
        vista.setOnClickPendingIntent(R.id.lista_nueva, abrirApp(contexto, "andamia://nueva", 2));
        gestor.updateAppWidget(idWidget, vista);
    }

    // ---------- Widgets de imagen: Calendario y estadísticas ----------

    private static void redibujarImagen(Context contexto, Class<?> clase, String tipo) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        for (int id : gestor.getAppWidgetIds(new ComponentName(contexto, clase))) dibujarImagen(contexto, gestor, id, tipo);
    }

    /** Tamaño del widget en píxeles, acotado para no pasar el límite de memoria de los widgets. */
    private static int[] tamano(Context contexto, AppWidgetManager gestor, int idWidget) {
        float densidad = contexto.getResources().getDisplayMetrics().density;
        Bundle opciones = gestor.getAppWidgetOptions(idWidget);
        int anchoDp = opciones.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int altoDp = opciones.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 250);
        if (anchoDp <= 0) anchoDp = 250;
        if (altoDp <= 0) altoDp = 250;
        float escala = Math.min(densidad, 900f / Math.max(anchoDp, altoDp));
        return new int[] { Math.max(1, Math.round(anchoDp * escala)), Math.max(1, Math.round(altoDp * escala)), Math.round(escala * 100) };
    }

    static void dibujarImagen(Context contexto, AppWidgetManager gestor, int idWidget, String tipo) {
        int[] t = tamano(contexto, gestor, idWidget);
        float escala = t[2] / 100f;
        JSONObject datos = datos(contexto);
        int acento = acento(contexto, datos);
        Bitmap imagen;
        String direccion;
        int codigo;
        if ("calendario".equals(tipo)) {
            imagen = Dibujos.calendario(contexto, datos == null ? null : datos.optJSONObject("mes"), t[0], t[1], escala, acento);
            direccion = "andamia://calendario";
            codigo = 40;
        } else {
            JSONObject est = datos == null ? null : datos.optJSONObject("estadisticas");
            boolean habitos = "habitos".equals(tipo);
            imagen = Dibujos.estadisticas(contexto, est == null ? null : est.optJSONObject(habitos ? "habitos" : "tareas"), habitos, t[0], t[1], escala, acento);
            direccion = habitos ? "andamia://estadisticas/habitos" : "andamia://estadisticas/tareas";
            codigo = habitos ? 60 : 50;
        }
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_imagen);
        vista.setImageViewBitmap(R.id.imagen_vista, imagen);
        vista.setOnClickPendingIntent(R.id.imagen_vista, abrirApp(contexto, direccion, codigo));
        gestor.updateAppWidget(idWidget, vista);
    }
}
