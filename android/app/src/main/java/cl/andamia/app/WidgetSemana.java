package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Semana" del celular, como la vista Día de la app: arriba el mes con flechas para
 * cambiar de semana, los filtros Tareas / Eventos / Todos y el "+"; luego la tira de 7 días
 * (el elegido en un círculo y un punto en los días con algo); abajo, los eventos y las tarjetas
 * "Tareas hoy" y "Completadas" del día elegido. Parte en hoy y vuelve a hoy al día siguiente.
 */
public class WidgetSemana extends AppWidgetProvider {
    private static final String ACCION = "cl.andamia.app.WIDGET_SEMANA";
    private static final String EXTRA_DIA = "cl.andamia.app.DIA";
    private static final String EXTRA_FILTRO = "cl.andamia.app.FILTRO";
    private static final int[] DIAS = {
        R.id.semana_dia_0, R.id.semana_dia_1, R.id.semana_dia_2, R.id.semana_dia_3,
        R.id.semana_dia_4, R.id.semana_dia_5, R.id.semana_dia_6,
    };
    private static final int[] NOMBRES = {
        R.id.semana_nom_0, R.id.semana_nom_1, R.id.semana_nom_2, R.id.semana_nom_3,
        R.id.semana_nom_4, R.id.semana_nom_5, R.id.semana_nom_6,
    };
    private static final int[] NUMEROS = {
        R.id.semana_num_0, R.id.semana_num_1, R.id.semana_num_2, R.id.semana_num_3,
        R.id.semana_num_4, R.id.semana_num_5, R.id.semana_num_6,
    };
    private static final int[] PUNTOS = {
        R.id.semana_pto_0, R.id.semana_pto_1, R.id.semana_pto_2, R.id.semana_pto_3,
        R.id.semana_pto_4, R.id.semana_pto_5, R.id.semana_pto_6,
    };
    private static final String[] FILTROS = { "tareas", "eventos", "todos" };
    private static final int[] BOTONES_FILTRO = { R.id.semana_f_tareas, R.id.semana_f_eventos, R.id.semana_f_todos };

    @Override
    public void onUpdate(Context contexto, AppWidgetManager gestor, int[] ids) {
        for (int id : ids) dibujar(contexto, gestor, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context contexto, AppWidgetManager gestor, int id, Bundle opciones) {
        dibujar(contexto, gestor, id);
    }

    @Override
    public void onReceive(Context contexto, Intent intent) {
        if (ACCION.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return;
            String dia = intent.getStringExtra(EXTRA_DIA);
            String filtro = intent.getStringExtra(EXTRA_FILTRO);
            if (dia != null) DatosWidget.elegirDia(contexto, id, dia + "|" + hoy());
            if (filtro != null) DatosWidget.elegirFiltro(contexto, id, filtro);
            AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
            dibujar(contexto, gestor, id);
            gestor.notifyAppWidgetViewDataChanged(new int[] { id }, R.id.semana_lista);
            return;
        }
        super.onReceive(contexto, intent);
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

    /** Los días que mandó la app (de la semana pasada a 4 semanas más), o null si aún no manda nada. */
    private static JSONArray dias(JSONObject datos) {
        return datos == null ? null : datos.optJSONArray("semanaDias");
    }

    /** Posición del día elegido: el que se tocó hoy; si no (o ya es otro día), hoy; si no, el primero. */
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

    private static PendingIntent accion(Context contexto, int idWidget, String clave, String valor, int codigo) {
        Intent intent = new Intent(contexto, WidgetSemana.class);
        intent.setAction(ACCION);
        intent.setData(Uri.parse("andamia://semana/" + idWidget + "/" + clave + "/" + valor));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        intent.putExtra("dia".equals(clave) ? EXTRA_DIA : EXTRA_FILTRO, valor);
        return PendingIntent.getBroadcast(contexto, idWidget * 100 + codigo, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** ¿El día tiene algo que mostrar con este filtro? (para el punto bajo el número) */
    private static boolean tieneAlgo(JSONObject d, String filtro) {
        JSONArray eventos = d.optJSONArray("eventos");
        JSONArray tareas = d.optJSONArray("tareas");
        boolean hayEventos = eventos != null && eventos.length() > 0;
        boolean hayTareas = tareas != null && tareas.length() > 0;
        if ("tareas".equals(filtro)) return hayTareas;
        if ("eventos".equals(filtro)) return hayEventos;
        return hayEventos || hayTareas;
    }

    private static String mayuscula(String s) {
        return s.isEmpty() ? s : s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget) {
        TemaWidget.usar(contexto, idWidget);
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_semana);
        TemaWidget.letra(vista, R.id.semana_mes, 16);
        TemaWidget.letra(vista, R.id.semana_f_tareas, 12);
        TemaWidget.letra(vista, R.id.semana_f_eventos, 12);
        TemaWidget.letra(vista, R.id.semana_f_todos, 12);
        TemaWidget.letra(vista, R.id.semana_vacio, 14);
        int[] nombres = { R.id.semana_nom_0, R.id.semana_nom_1, R.id.semana_nom_2, R.id.semana_nom_3, R.id.semana_nom_4, R.id.semana_nom_5, R.id.semana_nom_6 };
        int[] numeros = { R.id.semana_num_0, R.id.semana_num_1, R.id.semana_num_2, R.id.semana_num_3, R.id.semana_num_4, R.id.semana_num_5, R.id.semana_num_6 };
        for (int i = 0; i < 7; i++) {
            TemaWidget.letra(vista, nombres[i], 12);
            TemaWidget.letra(vista, numeros[i], 14);
        }
        int texto = FabricaListaHoy.color(contexto, R.color.widget_texto);
        int tenue = FabricaListaHoy.color(contexto, R.color.widget_texto_tenue);
        int acento = FabricaListaHoy.color(contexto, R.color.widget_acento);
        int sobreAcento = FabricaListaHoy.color(contexto, R.color.widget_boton_texto);
        int suave = FabricaListaHoy.color(contexto, R.color.widget_evento_suave);
        String filtro = DatosWidget.filtro(contexto, idWidget);
        String direccion = "andamia://hoy";

        // Mes y flechas.
        vista.setTextColor(R.id.semana_mes, texto);
        vista.setTextColor(R.id.semana_atras, texto);
        vista.setTextColor(R.id.semana_adelante, texto);

        // Filtros: el elegido con el acento del tema.
        TemaWidget.tenirFondo(vista, R.id.semana_filtros, suave);
        for (int i = 0; i < FILTROS.length; i++) {
            boolean elegido = FILTROS[i].equals(filtro);
            vista.setInt(BOTONES_FILTRO[i], "setBackgroundResource", elegido ? R.drawable.widget_filtro_elegido : R.drawable.widget_nada);
            if (elegido) TemaWidget.tenirFondo(vista, BOTONES_FILTRO[i], acento);
            vista.setTextColor(BOTONES_FILTRO[i], elegido ? sobreAcento : texto);
            vista.setOnClickPendingIntent(BOTONES_FILTRO[i], accion(contexto, idWidget, "filtro", FILTROS[i], 10 + i));
        }

        JSONArray dias = dias(Widgets.datos(contexto));
        if (dias != null && dias.length() > 0) {
            int elegida = posicionElegida(contexto, idWidget, dias);
            int inicio = elegida - elegida % 7;
            String hoy = hoy();
            for (int i = 0; i < DIAS.length; i++) {
                JSONObject d = dias.optJSONObject(inicio + i);
                if (d == null) {
                    vista.setViewVisibility(DIAS[i], View.INVISIBLE);
                    continue;
                }
                vista.setViewVisibility(DIAS[i], View.VISIBLE);
                String fecha = d.optString("fecha");
                boolean esElegido = inicio + i == elegida;
                boolean esHoy = hoy.equals(fecha);
                vista.setTextViewText(NOMBRES[i], d.optString("nombre"));
                vista.setTextColor(NOMBRES[i], esHoy ? acento : tenue);
                vista.setTextViewText(NUMEROS[i], String.valueOf(d.optInt("numero")));
                vista.setInt(NUMEROS[i], "setBackgroundResource", esElegido ? R.drawable.widget_circulo_dia : R.drawable.widget_nada);
                if (esElegido) TemaWidget.tenirFondo(vista, NUMEROS[i], acento);
                vista.setTextColor(NUMEROS[i], esElegido ? sobreAcento : esHoy ? acento : texto);
                vista.setTextColor(PUNTOS[i], tenue);
                vista.setViewVisibility(PUNTOS[i], tieneAlgo(d, filtro) ? View.VISIBLE : View.INVISIBLE);
                vista.setOnClickPendingIntent(DIAS[i], accion(contexto, idWidget, "dia", fecha, i));
            }
            JSONObject dia = dias.optJSONObject(elegida);
            if (dia != null) {
                vista.setTextViewText(R.id.semana_mes, mayuscula(dia.optString("mes")));
                direccion = "andamia://dia/" + dia.optString("fecha");
            }
            // Flechas: mismo día de la semana anterior o siguiente, si la app la mandó.
            JSONObject antes = elegida >= 7 ? dias.optJSONObject(elegida - 7) : null;
            JSONObject despues = elegida + 7 < dias.length() ? dias.optJSONObject(elegida + 7) : null;
            vista.setViewVisibility(R.id.semana_atras, antes == null ? View.INVISIBLE : View.VISIBLE);
            vista.setViewVisibility(R.id.semana_adelante, despues == null ? View.INVISIBLE : View.VISIBLE);
            if (antes != null) vista.setOnClickPendingIntent(R.id.semana_atras, accion(contexto, idWidget, "dia", antes.optString("fecha"), 20));
            if (despues != null) vista.setOnClickPendingIntent(R.id.semana_adelante, accion(contexto, idWidget, "dia", despues.optString("fecha"), 21));
        } else {
            vista.setTextViewText(R.id.semana_mes, "Abre Andamia");
            vista.setViewVisibility(R.id.semana_atras, View.INVISIBLE);
            vista.setViewVisibility(R.id.semana_adelante, View.INVISIBLE);
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

        vista.setOnClickPendingIntent(R.id.semana_mes, Widgets.abrirApp(contexto, direccion, 21));
        vista.setOnClickPendingIntent(R.id.semana_vacio, Widgets.abrirApp(contexto, direccion, 21));
        vista.setOnClickPendingIntent(R.id.semana_nueva, TareaRapida.abrir(contexto, idWidget, "semana"));
        vista.setTextColor(R.id.semana_nueva, sobreAcento);
        TemaWidget.tenirFondo(vista, R.id.semana_nueva, acento);
        vista.setTextColor(R.id.semana_vacio, tenue);
        TemaWidget.fondo(contexto, gestor, idWidget, vista);
        gestor.updateAppWidget(idWidget, vista);
    }
}
