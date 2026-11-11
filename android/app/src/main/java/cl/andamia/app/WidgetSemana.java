package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Semana" del celular: arriba la tira con los 7 días de esta semana y abajo
 * solo el día elegido (eventos, progreso y tareas), como "Día" en la app.
 * Al tocar un día de la tira se muestra ese día; parte en hoy.
 */
public class WidgetSemana extends AppWidgetProvider {
    private static final String ELEGIR_DIA = "cl.andamia.app.ELEGIR_DIA";
    private static final String EXTRA_FECHA = "cl.andamia.app.FECHA";
    private static final int[] DIAS = {
        R.id.semana_dia_0, R.id.semana_dia_1, R.id.semana_dia_2, R.id.semana_dia_3,
        R.id.semana_dia_4, R.id.semana_dia_5, R.id.semana_dia_6,
    };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (ELEGIR_DIA.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            String fecha = intent.getStringExtra(EXTRA_FECHA);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID && fecha != null) {
                DatosWidget.elegirDia(contexto, id, fecha + "|" + hoy());
                AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
                dibujar(contexto, gestor, id);
                gestor.notifyAppWidgetViewDataChanged(new int[] { id }, R.id.semana_lista);
            }
            return;
        }
        super.onReceive(contexto, intent);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, android.os.Bundle opciones) {
        dibujar(contexto, gestor, id);
    }

    static void redibujarTodos(Context contexto) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        int[] ids = gestor.getAppWidgetIds(new ComponentName(contexto, WidgetSemana.class));
        for (int id : ids) dibujar(contexto, gestor, id);
        gestor.notifyAppWidgetViewDataChanged(ids, R.id.semana_lista);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Los 7 días que mandó la app, o null si todavía no manda nada. */
    private static JSONArray dias(JSONObject datos) {
        return datos == null ? null : datos.optJSONArray("semanaDias");
    }

    /** Posición del día elegido: el que se tocó hoy; si no (o ya es otro día), hoy; si no, el lunes. */
    private static int posicionElegida(Context contexto, int idWidget, JSONArray dias) {
        String hoy = hoy();
        // Se guarda "día elegido|día en que se eligió": al día siguiente vuelve solo a hoy.
        String[] guardado = DatosWidget.diaElegido(contexto, idWidget).split("\\|");
        String elegido = guardado.length == 2 && hoy.equals(guardado[1]) ? guardado[0] : "";
        int deHoy = -1;
        for (int i = 0; i < dias.length(); i++) {
            JSONObject d = dias.optJSONObject(i);
            if (d == null) continue;
            String fecha = d.optString("fecha");
            if (!elegido.isEmpty() && elegido.equals(fecha)) return i;
            if (hoy.equals(fecha)) deHoy = i;
        }
        return Math.max(deHoy, 0);
    }

    /** El día que muestra la lista de este widget (lo usa FabricaListaHoy). */
    static JSONObject dia(Context contexto, int idWidget, JSONObject datos) {
        JSONArray dias = dias(datos);
        if (dias == null || dias.length() == 0) return null;
        return dias.optJSONObject(posicionElegida(contexto, idWidget, dias));
    }

    private static PendingIntent elegir(Context contexto, int idWidget, String fecha, int posicion) {
        Intent intent = new Intent(contexto, WidgetSemana.class);
        intent.setAction(ELEGIR_DIA);
        intent.setData(Uri.parse("andamia://semana/" + idWidget + "/" + posicion));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        intent.putExtra(EXTRA_FECHA, fecha);
        return PendingIntent.getBroadcast(contexto, idWidget * 10 + posicion, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** "Lun" arriba y el número abajo, más grande. */
    private static CharSequence textoDia(String nombre, int numero) {
        String linea2 = String.valueOf(numero);
        SpannableString texto = new SpannableString(nombre + "\n" + linea2);
        int inicio = nombre.length() + 1;
        texto.setSpan(new RelativeSizeSpan(1.35f), inicio, texto.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        texto.setSpan(new StyleSpan(Typeface.BOLD), inicio, texto.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        return texto;
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_semana);
        JSONObject datos = Widgets.datos(contexto);
        int acento = Widgets.acento(contexto, datos);
        JSONArray dias = dias(datos);
        String direccion = "andamia://hoy";

        if (dias != null && dias.length() > 0) {
            int elegida = posicionElegida(contexto, idWidget, dias);
            String hoy = hoy();
            for (int i = 0; i < DIAS.length; i++) {
                JSONObject d = i < dias.length() ? dias.optJSONObject(i) : null;
                if (d == null) {
                    vista.setTextViewText(DIAS[i], "");
                    continue;
                }
                String fecha = d.optString("fecha");
                vista.setTextViewText(DIAS[i], textoDia(d.optString("nombre"), d.optInt("numero")));
                boolean esElegido = i == elegida;
                boolean esHoy = hoy.equals(fecha);
                vista.setInt(DIAS[i], "setBackgroundResource", esElegido ? R.drawable.widget_dia_elegido : R.drawable.widget_dia);
                // El día elegido toma el acento del tema; los demás, el gris suave del tema.
                TemaWidget.tenirFondo(vista, DIAS[i], esElegido ? acento : FabricaListaHoy.color(contexto, R.color.widget_evento_suave));
                vista.setTextColor(DIAS[i], esElegido ? FabricaListaHoy.color(contexto, R.color.widget_boton_texto)
                        : esHoy ? acento
                        : FabricaListaHoy.color(contexto, R.color.widget_texto));
                vista.setOnClickPendingIntent(DIAS[i], elegir(contexto, idWidget, fecha, i));
            }
            JSONObject dia = dias.optJSONObject(elegida);
            if (dia != null) {
                String titulo = dia.optString("titulo");
                vista.setTextViewText(R.id.semana_titulo, titulo.isEmpty() ? "Semana" : titulo);
                direccion = "andamia://dia/" + dia.optString("fecha");
            }
        } else {
            vista.setTextViewText(R.id.semana_titulo, "Semana · abre Andamia");
        }

        // La lista del día elegido se llena desde ServicioListaHoy.
        Intent servicio = new Intent(contexto, ServicioListaHoy.class);
        servicio.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        servicio.putExtra(ServicioListaHoy.EXTRA_SEMANA, true);
        servicio.setData(Uri.parse(servicio.toUri(Intent.URI_INTENT_SCHEME)));
        vista.setRemoteAdapter(R.id.semana_lista, servicio);
        vista.setEmptyView(R.id.semana_lista, R.id.semana_vacio);

        // Cada fila completa la plantilla con su acción (marcar o abrir).
        Intent plantilla = new Intent(contexto, AccionWidgetActivity.class);
        plantilla.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        int banderas = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        vista.setPendingIntentTemplate(R.id.semana_lista, PendingIntent.getActivity(contexto, 20, plantilla, banderas));

        vista.setOnClickPendingIntent(R.id.semana_titulo, Widgets.abrirApp(contexto, direccion, 21));
        vista.setOnClickPendingIntent(R.id.semana_vacio, Widgets.abrirApp(contexto, direccion, 21));
        vista.setOnClickPendingIntent(R.id.semana_nueva, Widgets.abrirApp(contexto, "andamia://nueva", 2));
        TemaWidget.cabecera(contexto, vista, R.id.semana_titulo, R.id.semana_nueva, R.id.semana_vacio);
        TemaWidget.fondo(contexto, gestor, idWidget, vista);
        gestor.updateAppWidget(idWidget, vista);
    }
}
