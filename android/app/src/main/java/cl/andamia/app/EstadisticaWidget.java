package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widgets de estadísticas (tareas completadas y hábitos cumplidos): título, períodos
 * Día / Semana / Mes / Año, "‹ período ›" para moverse y una tarjeta con el anillo del total,
 * las etiquetas con su porcentaje y las ondas en el tiempo. El resumen de cada período se arma
 * aquí, con los hechos sueltos que manda la app, para poder cambiar de período sin abrirla.
 */
final class EstadisticaWidget {
    private EstadisticaWidget() {}

    static final String ACCION = "cl.andamia.app.WIDGET_ESTADISTICA";
    private static final String EXTRA_PERIODO = "cl.andamia.app.PERIODO";
    private static final String EXTRA_PASO = "cl.andamia.app.PASO";
    private static final String EXTRA_ETIQUETA = "cl.andamia.app.ETIQUETA";
    private static final String[] PERIODOS = { "dia", "semana", "mes", "anio" };
    private static final int[] BOTONES = { R.id.est_p_dia, R.id.est_p_semana, R.id.est_p_mes, R.id.est_p_anio };
    private static final int[] ZONAS = { R.id.est_zona_0, R.id.est_zona_1, R.id.est_zona_2, R.id.est_zona_3, R.id.est_zona_4, R.id.est_zona_5, R.id.est_zona_6, R.id.est_zona_7 };
        private static final String[] MESES_LARGOS = { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
    private static final int MAX_FILAS = 8;

    private static Class<?> clase(String tipo) {
        return "habitos".equals(tipo) ? WidgetEstadisticaHabitos.class : WidgetEstadisticaTareas.class;
    }

    static void redibujarTodos(Context contexto, String tipo) {
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        for (int id : gestor.getAppWidgetIds(new ComponentName(contexto, clase(tipo)))) dibujar(contexto, gestor, id, tipo);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Cuántos períodos hacia atrás (negativo) se movió este widget; vuelve a 0 al día siguiente. */
    private static int paso(Context c, int idWidget) {
        String[] g = DatosWidget.pasoEstadistica(c, idWidget).split("\\|");
        if (g.length == 2 && hoy().equals(g[1])) {
            try {
                return Math.min(0, Integer.parseInt(g[0]));
            } catch (NumberFormatException e) {
                // Guardado de otra versión.
            }
        }
        return 0;
    }

    /** Se tocó un período, una flecha o una etiqueta de la leyenda. */
    static boolean alRecibir(Context contexto, Intent intent, String tipo) {
        if (!ACCION.equals(intent.getAction())) return false;
        int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        if (id == AppWidgetManager.INVALID_APPWIDGET_ID) return true;
        String periodo = intent.getStringExtra(EXTRA_PERIODO);
        if (periodo != null) {
            DatosWidget.elegirPeriodo(contexto, id, periodo);
            DatosWidget.guardarPasoEstadistica(contexto, id, "0|" + hoy());
            DatosWidget.elegirEtiqueta(contexto, id, -1);
        } else if (intent.hasExtra(EXTRA_PASO)) {
            DatosWidget.guardarPasoEstadistica(contexto, id, intent.getIntExtra(EXTRA_PASO, 0) + "|" + hoy());
            DatosWidget.elegirEtiqueta(contexto, id, -1);
        } else if (intent.hasExtra(EXTRA_ETIQUETA)) {
            int indice = intent.getIntExtra(EXTRA_ETIQUETA, -1);
            DatosWidget.elegirEtiqueta(contexto, id, DatosWidget.etiquetaElegida(contexto, id) == indice ? -1 : indice);
        }
        dibujar(contexto, AppWidgetManager.getInstance(contexto), id, tipo);
        return true;
    }

    private static PendingIntent accion(Context contexto, String tipo, int idWidget, String clave, String valor, int codigo) {
        Intent intent = new Intent(contexto, clase(tipo));
        intent.setAction(ACCION);
        intent.setData(Uri.parse("andamia://estadistica/" + idWidget + "/" + clave + "/" + valor));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        if ("periodo".equals(clave)) intent.putExtra(EXTRA_PERIODO, valor);
        else if ("paso".equals(clave)) intent.putExtra(EXTRA_PASO, Integer.parseInt(valor));
        else intent.putExtra(EXTRA_ETIQUETA, Integer.parseInt(valor));
        return PendingIntent.getBroadcast(contexto, idWidget * 100 + codigo, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    // ---------- Resumen de un período ----------

    private static Calendar inicioDe(String periodo, int paso) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        switch (periodo) {
            case "dia":
                c.add(Calendar.DAY_OF_MONTH, paso);
                break;
            case "mes":
                c.set(Calendar.DAY_OF_MONTH, 1);
                c.add(Calendar.MONTH, paso);
                break;
            case "anio":
                c.set(Calendar.DAY_OF_YEAR, 1);
                c.add(Calendar.YEAR, paso);
                break;
            default:
                // La semana parte el lunes.
                c.add(Calendar.DAY_OF_MONTH, -((c.get(Calendar.DAY_OF_WEEK) + 5) % 7));
                c.add(Calendar.DAY_OF_MONTH, 7 * paso);
        }
        return c;
    }

    private static Calendar finDe(String periodo, Calendar inicio) {
        Calendar f = (Calendar) inicio.clone();
        switch (periodo) {
            case "dia": f.add(Calendar.DAY_OF_MONTH, 1); break;
            case "mes": f.add(Calendar.MONTH, 1); break;
            case "anio": f.add(Calendar.YEAR, 1); break;
            default: f.add(Calendar.DAY_OF_MONTH, 7);
        }
        return f;
    }

    /** AAAAMMDD de una fecha, para comparar días sin líos de horario. */
    private static int clave(Calendar c) {
        return c.get(Calendar.YEAR) * 10000 + (c.get(Calendar.MONTH) + 1) * 100 + c.get(Calendar.DAY_OF_MONTH);
    }

    /** Lo que se lee bajo los filtros, igual que en la app: 17/11/2026, 16/11 - 22/11, Nov 2026 o 2026. */
    static String titulo(String periodo, Calendar inicio, Calendar fin) {
        switch (periodo) {
            case "dia":
                return String.format(Locale.ROOT, "%02d/%02d/%d", inicio.get(Calendar.DAY_OF_MONTH), inicio.get(Calendar.MONTH) + 1, inicio.get(Calendar.YEAR));
            case "mes":
                return Tr.meses()[inicio.get(Calendar.MONTH)] + " " + inicio.get(Calendar.YEAR);
            case "anio":
                return String.valueOf(inicio.get(Calendar.YEAR));
            default: {
                Calendar ultimo = (Calendar) fin.clone();
                ultimo.add(Calendar.DAY_OF_MONTH, -1);
                return String.format(Locale.ROOT, "%02d/%02d - %02d/%02d", inicio.get(Calendar.DAY_OF_MONTH), inicio.get(Calendar.MONTH) + 1, ultimo.get(Calendar.DAY_OF_MONTH), ultimo.get(Calendar.MONTH) + 1);
            }
        }
    }

    /**
     * Arma el resumen (total, filas por etiqueta y serie por tramo) de un período a partir de los
     * hechos sueltos "AAAA-MM-DDTHH|grupo". Devuelve null si la app aún no los manda.
     */
    static JSONObject resumir(JSONObject crudo, String periodo, Calendar inicio, Calendar fin) throws Exception {
        JSONArray grupos = crudo.optJSONArray("grupos");
        JSONArray hechos = crudo.optJSONArray("hechos");
        if (grupos == null || hechos == null) return null;
        int desde = clave(inicio), hasta = clave(fin);
        int tramos = "dia".equals(periodo) ? 12 : "anio".equals(periodo) ? 12 : "mes".equals(periodo) ? inicio.getActualMaximum(Calendar.DAY_OF_MONTH) : 7;
        int g = grupos.length();
        int[] cantidad = new int[g];
        int[][] porTramo = new int[tramos][g];
        int total = 0;
        long inicioMs = inicio.getTimeInMillis();
        Calendar dia = Calendar.getInstance();
        for (int i = 0; i < hechos.length(); i++) {
            String h = hechos.optString(i);
            int barra = h.indexOf('|');
            if (h.length() < 13 || barra < 13) continue;
            int anio, mes, d, hora, grupo;
            try {
                anio = Integer.parseInt(h.substring(0, 4));
                mes = Integer.parseInt(h.substring(5, 7));
                d = Integer.parseInt(h.substring(8, 10));
                hora = Integer.parseInt(h.substring(11, 13));
                grupo = Integer.parseInt(h.substring(barra + 1));
            } catch (NumberFormatException e) {
                continue;
            }
            int k = anio * 10000 + mes * 100 + d;
            if (k < desde || k >= hasta || grupo < 0 || grupo >= g) continue;
            int tramo;
            if ("dia".equals(periodo)) tramo = hora / 2;
            else if ("anio".equals(periodo)) tramo = mes - 1;
            else if ("mes".equals(periodo)) tramo = d - 1;
            else {
                dia.clear();
                dia.set(anio, mes - 1, d, 12, 0, 0);
                tramo = (int) ((dia.getTimeInMillis() - inicioMs) / 86400000L);
            }
            if (tramo < 0 || tramo >= tramos) continue;
            cantidad[grupo]++;
            porTramo[tramo][grupo]++;
            total++;
        }
        // Más hechos primero; en los empates, el orden de los grupos.
        List<Integer> orden = new ArrayList<>();
        for (int i = 0; i < g; i++) if (cantidad[i] > 0) orden.add(i);
        orden.sort((a, b) -> cantidad[b] != cantidad[a] ? cantidad[b] - cantidad[a] : a - b);
        if (orden.size() > MAX_FILAS) orden = orden.subList(0, MAX_FILAS);

        JSONArray filas = new JSONArray();
        for (int i : orden) {
            JSONObject grupo = grupos.optJSONObject(i);
            JSONObject f = new JSONObject();
            f.put("nombre", grupo == null ? "" : grupo.optString("nombre"));
            f.put("color", grupo == null ? "" : grupo.optString("color"));
            f.put("cantidad", cantidad[i]);
            f.put("porcentaje", total == 0 ? 0 : Math.round(cantidad[i] * 100f / total));
            filas.put(f);
        }
        JSONArray serie = new JSONArray();
        for (int t = 0; t < tramos; t++) {
            JSONObject s = new JSONObject();
            String etiqueta = "dia".equals(periodo) ? (t * 2 < 10 ? "0" : "") + (t * 2) + "h" : "anio".equals(periodo) ? Tr.meses()[t] : "mes".equals(periodo) ? String.valueOf(t + 1) : Tr.dias()[t];
            s.put("etiqueta", etiqueta);
            JSONArray valores = new JSONArray();
            for (int i : orden) valores.put(porTramo[t][i]);
            s.put("valores", valores);
            serie.put(s);
        }
        JSONObject r = new JSONObject();
        r.put("total", total);
        r.put("filas", filas);
        r.put("serie", serie);
        return r;
    }

    // ---------- Dibujo ----------

    static void dibujar(Context contexto, AppWidgetManager gestor, int idWidget, String tipo) {
        Tr.iniciar(contexto);
        TemaWidget.usar(contexto, idWidget);
        boolean habitos = "habitos".equals(tipo);
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_estadistica);
        Tr.texto(vista, R.id.est_p_dia, "Día");
        Tr.texto(vista, R.id.est_p_semana, "Semana");
        Tr.texto(vista, R.id.est_p_mes, "Mes");
        Tr.texto(vista, R.id.est_p_anio, "Año");
        int texto = FabricaListaHoy.color(contexto, R.color.widget_texto);
        int tenue = FabricaListaHoy.color(contexto, R.color.widget_texto_tenue);
        int acento = FabricaListaHoy.color(contexto, R.color.widget_acento);
        int sobreAcento = FabricaListaHoy.color(contexto, R.color.widget_boton_texto);
        int suave = FabricaListaHoy.color(contexto, R.color.widget_evento_suave);

        Bundle opciones = gestor.getAppWidgetOptions(idWidget);
        int altoDp = opciones.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 250);
        // En un widget bajo se saca el título para dejarle el espacio a la tarjeta.
        boolean conTitulo = altoDp <= 0 || altoDp >= 230;
        vista.setViewVisibility(R.id.est_titulo, conTitulo ? View.VISIBLE : View.GONE);
        vista.setTextViewText(R.id.est_titulo, Tr.t(contexto, habitos ? "Mis hábitos cumplidos" : "Mis tareas completadas"));
        vista.setTextColor(R.id.est_titulo, texto);
        TemaWidget.letra(vista, R.id.est_titulo, 16);
        TemaWidget.letra(vista, R.id.est_periodo, 13);

        String periodo = DatosWidget.periodo(contexto, idWidget);
        int paso = paso(contexto, idWidget);
        TemaWidget.tenirFondo(vista, R.id.est_periodos, suave);
        for (int i = 0; i < PERIODOS.length; i++) {
            boolean elegido = PERIODOS[i].equals(periodo);
            vista.setInt(BOTONES[i], "setBackgroundResource", elegido ? R.drawable.widget_filtro_elegido : R.drawable.widget_nada);
            if (elegido) TemaWidget.tenirFondo(vista, BOTONES[i], acento);
            vista.setTextColor(BOTONES[i], elegido ? sobreAcento : texto);
            TemaWidget.letra(vista, BOTONES[i], 12);
            vista.setOnClickPendingIntent(BOTONES[i], accion(contexto, tipo, idWidget, "periodo", PERIODOS[i], 10 + i));
        }

        Calendar inicio = inicioDe(periodo, paso);
        Calendar fin = finDe(periodo, inicio);
        JSONObject datos = Widgets.datos(contexto);
        JSONObject est = datos == null ? null : datos.optJSONObject("estadisticas");
        JSONObject crudo = est == null ? null : est.optJSONObject(habitos ? "habitos" : "tareas");
        JSONObject resumen = null;
        boolean navegable = false;
        if (crudo != null) {
            try {
                resumen = resumir(crudo, periodo, inicio, fin);
                navegable = resumen != null;
            } catch (Exception e) {
                resumen = null;
            }
            // App de una versión anterior: solo trae armada la semana actual.
            if (resumen == null && "semana".equals(periodo) && paso == 0) resumen = crudo;
        }
        vista.setTextViewText(R.id.est_periodo, titulo(periodo, inicio, fin));
        vista.setTextColor(R.id.est_periodo, texto);
        vista.setTextColor(R.id.est_atras, texto);
        vista.setTextColor(R.id.est_adelante, paso < 0 ? texto : tenue);
        vista.setViewVisibility(R.id.est_atras, navegable ? View.VISIBLE : View.INVISIBLE);
        // La flecha › se ve siempre; en el período actual queda apagada porque no hay nada más adelante.
        vista.setViewVisibility(R.id.est_adelante, navegable ? View.VISIBLE : View.INVISIBLE);
        if (navegable) {
            vista.setOnClickPendingIntent(R.id.est_atras, accion(contexto, tipo, idWidget, "paso", String.valueOf(paso - 1), 20));
            if (paso < 0) vista.setOnClickPendingIntent(R.id.est_adelante, accion(contexto, tipo, idWidget, "paso", String.valueOf(paso + 1), 21));
        }

        // Alto de lo que va sobre la tarjeta (dp): relleno, título, períodos y la fila de las flechas.
        int[] t = Widgets.tamano(contexto, gestor, idWidget, 22 + (conTitulo ? 24 : 0) + 36 + 30);
        float escala = t[2] / 100f;
        float[] zonas = new float[1 + 4 * ZONAS.length];
        String vacio = Tr.t(contexto, crudo == null ? "Abre Andamia para ver tus estadísticas" : habitos ? "Sin hábitos cumplidos en este período." : "Sin tareas completadas en este período.");
        Bitmap imagen = Dibujos.estadisticas(contexto, resumen, habitos, t[0], t[1], escala, acento, DatosWidget.etiquetaElegida(contexto, idWidget), zonas, vacio);
        vista.setImageViewBitmap(R.id.est_imagen, imagen);
        PendingIntent abrir = Widgets.abrirApp(contexto, habitos ? "andamia://estadisticas/habitos" : "andamia://estadisticas/tareas", habitos ? 60 : 50);
        vista.setOnClickPendingIntent(R.id.est_imagen, abrir);
        vista.setOnClickPendingIntent(R.id.est_titulo, abrir);

        // Zonas tocables sobre las etiquetas (Android 12 o más nuevo, que deja mover vistas de un widget).
        int cuantas = android.os.Build.VERSION.SDK_INT >= 31 ? (int) zonas[0] : 0;
        for (int i = 0; i < ZONAS.length; i++) {
            if (i >= cuantas) {
                vista.setViewVisibility(ZONAS[i], View.GONE);
                continue;
            }
            int k = 1 + 4 * i;
            vista.setViewLayoutMargin(ZONAS[i], RemoteViews.MARGIN_LEFT, zonas[k] / escala, TypedValue.COMPLEX_UNIT_DIP);
            vista.setViewLayoutMargin(ZONAS[i], RemoteViews.MARGIN_TOP, zonas[k + 1] / escala, TypedValue.COMPLEX_UNIT_DIP);
            vista.setViewLayoutWidth(ZONAS[i], zonas[k + 2] / escala, TypedValue.COMPLEX_UNIT_DIP);
            vista.setViewLayoutHeight(ZONAS[i], zonas[k + 3] / escala, TypedValue.COMPLEX_UNIT_DIP);
            vista.setViewVisibility(ZONAS[i], View.VISIBLE);
            vista.setOnClickPendingIntent(ZONAS[i], accion(contexto, tipo, idWidget, "etiqueta", String.valueOf(i), 30 + i));
        }
        TemaWidget.fondo(contexto, gestor, idWidget, vista);
        gestor.updateAppWidget(idWidget, vista);
    }
}
