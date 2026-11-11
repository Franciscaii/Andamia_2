package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Semana" del celular en vista Día: arriba la tira con los 7 días de la semana
 * (parte en hoy) y abajo los eventos y tareas del día elegido. Tocar un día lo muestra.
 */
public class WidgetSemana extends AppWidgetProvider {
    static final String ACCION_DIA = "cl.andamia.app.SEMANA_DIA";
    static final String EXTRA_DIA = "cl.andamia.app.DIA";
    private static final String PREFS = "widget_semana";
    private static final int[] IDS_DIAS = {
        R.id.semana_d0, R.id.semana_d1, R.id.semana_d2, R.id.semana_d3, R.id.semana_d4, R.id.semana_d5, R.id.semana_d6,
    };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (ACCION_DIA.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int dia = intent.getIntExtra(EXTRA_DIA, -1);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID && dia >= 0 && dia < 7) {
                guardarDia(contexto, id, dia);
                AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
                dibujar(contexto, gestor, id);
                gestor.notifyAppWidgetViewDataChanged(new int[] { id }, R.id.lista_filas);
            }
            return;
        }
        super.onReceive(contexto, intent);
    }

    @Override
    public void onDeleted(Context contexto, int[] ids) {
        SharedPreferences.Editor e = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        for (int id : ids) e.remove("dia_" + id).remove("fecha_" + id);
        e.apply();
    }

    /** Redibuja todos los widgets Semana (cuando la app manda datos nuevos). */
    static void redibujarTodos(Context contexto) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        int[] ids = gestor.getAppWidgetIds(new ComponentName(contexto, WidgetSemana.class));
        for (int id : ids) dibujar(contexto, gestor, id);
        gestor.notifyAppWidgetViewDataChanged(ids, R.id.lista_filas);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static void guardarDia(Context contexto, int id, int dia) {
        contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("dia_" + id, dia).putString("fecha_" + id, hoy()).apply();
    }

    /** Día elegido (0 = lunes). Si se eligió otro día antes de hoy, vuelve a hoy. */
    static int diaElegido(Context contexto, int id, int indiceHoy) {
        SharedPreferences p = contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!hoy().equals(p.getString("fecha_" + id, ""))) return indiceHoy;
        int d = p.getInt("dia_" + id, indiceHoy);
        return d >= 0 && d < 7 ? d : indiceHoy;
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_semana);
        JSONObject datos = Widgets.datos(contexto);
        JSONArray lista = datos == null ? null : datos.optJSONArray("semana");

        // Las secciones de la semana, en orden (una por día).
        JSONObject[] dias = new JSONObject[7];
        int n = 0;
        int indiceHoy = 0;
        if (lista != null) {
            for (int i = 0; i < lista.length() && n < 7; i++) {
                JSONObject o = lista.optJSONObject(i);
                if (o == null || !"seccion".equals(o.optString("tipo"))) continue;
                if (o.optBoolean("hoy")) indiceHoy = n;
                dias[n++] = o;
            }
        }
        int elegido = Math.min(diaElegido(contexto, idWidget, indiceHoy), Math.max(0, n - 1));
        int acento = Widgets.acento(contexto, datos);
        int colorTexto = FabricaListaHoy.color(contexto, R.color.widget_texto);
        String[] nombres = { "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" };

        for (int k = 0; k < 7; k++) {
            JSONObject s = k < n ? dias[k] : null;
            String nombre = s != null && !s.optString("dia").isEmpty() ? s.optString("dia") : nombres[k];
            String numero = s != null ? s.optString("numero") : "";
            vista.setTextViewText(IDS_DIAS[k], numero.isEmpty() ? nombre : nombre + "\n" + numero);
            boolean esElegido = k == elegido;
            boolean esHoy = s != null && s.optBoolean("hoy");
            vista.setInt(IDS_DIAS[k], "setBackgroundResource", esElegido ? R.drawable.widget_dia_elegido : 0);
            vista.setTextColor(IDS_DIAS[k], esElegido ? 0xFFFFFFFF : esHoy ? acento : colorTexto);

            Intent tocar = new Intent(contexto, WidgetSemana.class);
            tocar.setAction(ACCION_DIA);
            tocar.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
            tocar.putExtra(EXTRA_DIA, k);
            tocar.setData(Uri.parse("andamia-widget://semana/" + idWidget + "/" + k));
            vista.setOnClickPendingIntent(IDS_DIAS[k], PendingIntent.getBroadcast(contexto, idWidget * 10 + k, tocar,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        }

        // Título: el día elegido, sin el avance (ese va en la lista).
        String titulo = "Semana";
        if (elegido < n && dias[elegido] != null) {
            JSONObject s = dias[elegido];
            titulo = s.optBoolean("hoy") ? "Hoy" : s.optString("dia") + " " + s.optString("numero");
        }
        vista.setTextViewText(R.id.semana_titulo, titulo.trim());

        // Lista del día elegido (la arma FabricaFilas solo con esa sección).
        Intent servicio = new Intent(contexto, ServicioFilas.class);
        servicio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        servicio.putExtra(ServicioFilas.EXTRA_CLAVE, "semana");
        servicio.putExtra(ServicioFilas.EXTRA_DIA, elegido);
        servicio.setData(Uri.parse(servicio.toUri(Intent.URI_INTENT_SCHEME)));
        vista.setRemoteAdapter(R.id.lista_filas, servicio);
        vista.setEmptyView(R.id.lista_filas, R.id.lista_vacio);

        Intent plantilla = new Intent(contexto, AccionWidgetActivity.class);
        plantilla.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT
                | (android.os.Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        vista.setPendingIntentTemplate(R.id.lista_filas, PendingIntent.getActivity(contexto, 20, plantilla, banderas));

        vista.setOnClickPendingIntent(R.id.semana_titulo, Widgets.abrirApp(contexto, "andamia://hoy", 21));
        vista.setOnClickPendingIntent(R.id.lista_vacio, Widgets.abrirApp(contexto, "andamia://hoy", 21));
        vista.setOnClickPendingIntent(R.id.semana_nueva, Widgets.abrirApp(contexto, "andamia://nueva", 2));
        gestor.updateAppWidget(idWidget, vista);
    }
}
