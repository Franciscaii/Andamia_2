package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Calendario" del celular, como la vista Calendario de la app: arriba "‹ Nov ›" para
 * cambiar de mes, los filtros Tareas / Eventos / Todos y el "+"; abajo el mes dibujado como
 * imagen. Vuelve al mes actual cuando cambia el mes.
 */
public class WidgetCalendario extends AppWidgetProvider {
    private static final String ACCION = "cl.andamia.app.WIDGET_CALENDARIO";
    private static final String EXTRA_MES = "cl.andamia.app.MES";
    private static final String EXTRA_FILTRO = "cl.andamia.app.FILTRO";
    private static final String[] FILTROS = { "tareas", "eventos", "todos" };
    private static final int[] BOTONES_FILTRO = { R.id.cal_f_tareas, R.id.cal_f_eventos, R.id.cal_f_todos };
    /** Alto aproximado de la fila de arriba (dp), para dibujar el mes con su proporción real. */
    private static final int ALTO_CABECERA_DP = 66;

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    /** Al cambiarle el tamaño se vuelve a dibujar con las medidas nuevas. */
    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, Bundle opciones) {
        dibujar(contexto, gestor, id);
    }

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (ACCION.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            String mes = intent.getStringExtra(EXTRA_MES);
            String filtro = intent.getStringExtra(EXTRA_FILTRO);
            if (mes != null) DatosWidget.elegirDia(contexto, id, mes + "|" + mesActual());
            if (filtro != null) DatosWidget.elegirFiltro(contexto, id, filtro);
            dibujar(contexto, AppWidgetManager.getInstance(contexto), id);
            return;
        }
        super.onReceive(contexto, intent);
    }

    static void redibujarTodos(Context contexto) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        for (int id : gestor.getAppWidgetIds(new ComponentName(contexto, WidgetCalendario.class))) dibujar(contexto, gestor, id);
    }

    private static String mesActual() {
        return new SimpleDateFormat("yyyy-MM", Locale.US).format(new Date());
    }

    /** Posición del mes elegido en la lista que manda la app; si se eligió otro mes antes, vuelve al actual. */
    static int posicionElegida(Context contexto, int idWidget, JSONArray meses) {
        int actual = 0;
        for (int i = 0; i < meses.length(); i++) {
            JSONObject m = meses.optJSONObject(i);
            if (m != null && m.optBoolean("actual")) actual = i;
        }
        String[] guardado = DatosWidget.diaElegido(contexto, idWidget).split("\\|");
        if (guardado.length == 2 && mesActual().equals(guardado[1])) {
            try {
                int i = Integer.parseInt(guardado[0]);
                if (i >= 0 && i < meses.length()) return i;
            } catch (NumberFormatException e) {
                // Guardado de otra versión: queda el mes actual.
            }
        }
        return actual;
    }

    private static PendingIntent accion(Context contexto, int idWidget, String clave, String valor, int codigo) {
        Intent intent = new Intent(contexto, WidgetCalendario.class);
        intent.setAction(ACCION);
        intent.setData(Uri.parse("andamia://calendario/" + idWidget + "/" + clave + "/" + valor));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        intent.putExtra("mes".equals(clave) ? EXTRA_MES : EXTRA_FILTRO, valor);
        return PendingIntent.getBroadcast(contexto, idWidget * 100 + codigo, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        TemaWidget.usar(contexto, idWidget);
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_calendario);
        TemaWidget.letra(vista, R.id.cal_mes, 19);
        TemaWidget.letra(vista, R.id.cal_f_tareas, 12);
        TemaWidget.letra(vista, R.id.cal_f_eventos, 12);
        TemaWidget.letra(vista, R.id.cal_f_todos, 12);
        int texto = FabricaListaHoy.color(contexto, R.color.widget_texto);
        int acento = FabricaListaHoy.color(contexto, R.color.widget_acento);
        int sobreAcento = FabricaListaHoy.color(contexto, R.color.widget_boton_texto);
        int suave = FabricaListaHoy.color(contexto, R.color.widget_evento_suave);
        String filtro = DatosWidget.filtro(contexto, idWidget);

        vista.setTextColor(R.id.cal_mes, texto);
        vista.setTextColor(R.id.cal_atras, texto);
        vista.setTextColor(R.id.cal_adelante, texto);

        TemaWidget.tenirFondo(vista, R.id.cal_filtros, suave);
        for (int i = 0; i < FILTROS.length; i++) {
            boolean elegido = FILTROS[i].equals(filtro);
            vista.setInt(BOTONES_FILTRO[i], "setBackgroundResource", elegido ? R.drawable.widget_filtro_elegido : R.drawable.widget_nada);
            if (elegido) TemaWidget.tenirFondo(vista, BOTONES_FILTRO[i], acento);
            vista.setTextColor(BOTONES_FILTRO[i], elegido ? sobreAcento : texto);
            vista.setOnClickPendingIntent(BOTONES_FILTRO[i], accion(contexto, idWidget, "filtro", FILTROS[i], 10 + i));
        }

        JSONObject datos = Widgets.datos(contexto);
        JSONArray meses = datos == null ? null : datos.optJSONArray("meses");
        JSONObject mes = null;
        if (meses != null && meses.length() > 0) {
            int elegido = posicionElegida(contexto, idWidget, meses);
            mes = meses.optJSONObject(elegido);
            vista.setTextViewText(R.id.cal_mes, mes == null ? "" : mes.optString("corto").toUpperCase(java.util.Locale.ROOT));
            vista.setViewVisibility(R.id.cal_atras, elegido > 0 ? View.VISIBLE : View.INVISIBLE);
            vista.setViewVisibility(R.id.cal_adelante, elegido < meses.length() - 1 ? View.VISIBLE : View.INVISIBLE);
            if (elegido > 0) vista.setOnClickPendingIntent(R.id.cal_atras, accion(contexto, idWidget, "mes", String.valueOf(elegido - 1), 20));
            if (elegido < meses.length() - 1) vista.setOnClickPendingIntent(R.id.cal_adelante, accion(contexto, idWidget, "mes", String.valueOf(elegido + 1), 21));
        } else {
            // App de una versión anterior: solo el mes actual.
            mes = datos == null ? null : datos.optJSONObject("mes");
            vista.setTextViewText(R.id.cal_mes, mes == null ? "Abre Andamia" : mes.optString("titulo"));
            vista.setViewVisibility(R.id.cal_atras, View.INVISIBLE);
            vista.setViewVisibility(R.id.cal_adelante, View.INVISIBLE);
        }

        int[] t = Widgets.tamano(contexto, gestor, idWidget, ALTO_CABECERA_DP);
        Bitmap imagen = Dibujos.calendario(contexto, mes, t[0], t[1], t[2] / 100f, acento, filtro, false);
        vista.setImageViewBitmap(R.id.cal_imagen, imagen);
        vista.setOnClickPendingIntent(R.id.cal_imagen, Widgets.abrirApp(contexto, "andamia://calendario", 40));
        vista.setOnClickPendingIntent(R.id.cal_nueva, TareaRapida.abrir(contexto, idWidget, "calendario"));
        vista.setTextColor(R.id.cal_nueva, sobreAcento);
        TemaWidget.tenirFondo(vista, R.id.cal_nueva, acento);
        TemaWidget.fondo(contexto, gestor, idWidget, vista);
        gestor.updateAppWidget(idWidget, vista);
    }
}
