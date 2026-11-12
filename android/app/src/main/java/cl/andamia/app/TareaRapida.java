package cl.andamia.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Tareas y eventos escritos desde el "+" de los widgets sin abrir la app. Quedan en una cola
 * hasta que Andamia los crea de verdad (al abrirse o, si ya está abierta, al instante), y
 * mientras tanto se muestran en los widgets como si ya existieran.
 */
final class TareaRapida {
    static final String EXTRA_TIPO = "tipo";
    static final String PREFIJO = "rapida-";
    private static final String CLAVE = "rapidas";

    private TareaRapida() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("andamia_widget", Context.MODE_PRIVATE);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Lo que abre el "+" de un widget: el cuadro rápido, con la fecha que ese widget está mostrando. */
    static PendingIntent abrir(Context c, int idWidget, String tipo) {
        Intent intent = new Intent(c, NuevaRapidaActivity.class);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, idWidget);
        intent.putExtra(EXTRA_TIPO, tipo);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(c, 7000 + idWidget, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Día con que parte el cuadro: el elegido en Semana, o hoy (o el 1 del mes que se ve) en Calendario. */
    static String diaInicial(Context c, int idWidget, String tipo) {
        String hoy = hoy();
        JSONObject datos = Widgets.datos(c);
        if (datos == null || idWidget == AppWidgetManager.INVALID_APPWIDGET_ID) return hoy;
        try {
            if ("semana".equals(tipo)) {
                JSONObject dia = WidgetSemana.dia(c, idWidget, datos);
                String f = dia == null ? "" : dia.optString("fecha");
                return f.isEmpty() ? hoy : f;
            }
            if ("calendario".equals(tipo)) {
                JSONArray meses = datos.optJSONArray("meses");
                if (meses == null || meses.length() == 0) return hoy;
                JSONObject mes = meses.optJSONObject(WidgetCalendario.posicionElegida(c, idWidget, meses));
                if (mes == null || mes.optBoolean("actual")) return hoy;
                JSONArray celdas = mes.optJSONArray("celdas");
                for (int i = 0; celdas != null && i < celdas.length(); i++) {
                    JSONObject celda = celdas.optJSONObject(i);
                    if (celda != null && celda.optBoolean("delMes") && !celda.optString("fecha").isEmpty()) return celda.optString("fecha");
                }
            }
        } catch (Exception e) {
            // Datos de otra versión: hoy.
        }
        return hoy;
    }

    private static synchronized JSONArray cola(Context c) {
        try {
            return new JSONArray(prefs(c).getString(CLAVE, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Anota la nueva, la muestra en los widgets y avisa a la app si está abierta. */
    static void guardar(Context c, String titulo, String fecha, boolean evento) {
        JSONObject nueva = new JSONObject();
        try {
            nueva.put("id", PREFIJO + UUID.randomUUID());
            nueva.put("titulo", titulo);
            nueva.put("fecha", fecha);
            nueva.put("evento", evento);
        } catch (Exception e) {
            return;
        }
        synchronized (TareaRapida.class) {
            JSONArray lista = cola(c);
            lista.put(nueva);
            prefs(c).edit().putString(CLAVE, lista.toString()).commit();
        }
        String datos = DatosWidget.leerTareas(c);
        if (datos != null) {
            try {
                JSONObject o = new JSONObject(datos);
                inyectar(o, nueva);
                DatosWidget.guardarTareas(c, o.toString());
            } catch (Exception e) {
                // Si no se puede mostrar ahora, aparece cuando la app la cree.
            }
        }
        Widgets.redibujarTodo(c);
        WidgetPlugin.avisarRapida();
    }

    /** Devuelve (y olvida) las que esperan ser creadas en la app. */
    static synchronized String tomar(Context c) {
        String s = cola(c).toString();
        prefs(c).edit().remove(CLAVE).commit();
        return s;
    }

    /** Los datos que manda la app, más las que aún esperan en la cola (para que no desaparezcan). */
    static String conPendientes(Context c, String datos) {
        JSONArray lista = cola(c);
        if (lista.length() == 0) return datos;
        try {
            JSONObject o = new JSONObject(datos);
            for (int i = 0; i < lista.length(); i++) {
                JSONObject n = lista.optJSONObject(i);
                if (n != null) inyectar(o, n);
            }
            return o.toString();
        } catch (Exception e) {
            return datos;
        }
    }

    /** Pone una nueva en el día que le toca de Semana, de Hoy y de cada mes del Calendario. */
    private static void inyectar(JSONObject datos, JSONObject n) throws Exception {
        String fecha = n.optString("fecha");
        boolean evento = n.optBoolean("evento");
        String titulo = n.optString("titulo");
        String id = n.optString("id");

        JSONObject fila = new JSONObject();
        fila.put("id", id);
        fila.put("titulo", titulo);
        if (evento) {
            fila.put("hora", "");
            fila.put("color", "");
        } else {
            fila.put("detalle", "");
            fila.put("atrasada", false);
            fila.put("hecha", false);
            fila.put("prioridad", 0);
            fila.put("dificultad", 0);
            fila.put("etiqueta", "");
            fila.put("colorEtiqueta", "");
        }

        JSONArray dias = datos.optJSONArray("semanaDias");
        for (int i = 0; dias != null && i < dias.length(); i++) {
            JSONObject d = dias.optJSONObject(i);
            if (d != null && fecha.equals(d.optString("fecha"))) agregarFila(d, fila, evento);
        }
        if (fecha.equals(datos.optString("fecha"))) agregarFila(datos, fila, evento);

        JSONObject entrada = new JSONObject();
        entrada.put("titulo", titulo);
        entrada.put("color", "");
        entrada.put("evento", evento);
        entrada.put("hecha", false);
        entrada.put("nivel", 0);
        JSONArray meses = datos.optJSONArray("meses");
        for (int i = 0; meses != null && i < meses.length(); i++) agregarAlMes(meses.optJSONObject(i), fecha, entrada, evento);
        agregarAlMes(datos.optJSONObject("mes"), fecha, entrada, evento);
    }

    /** Eventos al final; tareas antes de las ya hechas, que van abajo. */
    private static void agregarFila(JSONObject dia, JSONObject fila, boolean evento) throws Exception {
        String clave = evento ? "eventos" : "tareas";
        JSONArray antes = dia.optJSONArray(clave);
        if (antes == null) antes = new JSONArray();
        for (int i = 0; i < antes.length(); i++) {
            JSONObject f = antes.optJSONObject(i);
            if (f != null && fila.optString("id").equals(f.optString("id"))) return;
        }
        JSONArray nuevas = new JSONArray();
        boolean puesta = false;
        for (int i = 0; i < antes.length(); i++) {
            JSONObject f = antes.optJSONObject(i);
            if (!evento && !puesta && f != null && f.optBoolean("hecha")) {
                nuevas.put(fila);
                puesta = true;
            }
            nuevas.put(antes.opt(i));
        }
        if (!puesta) nuevas.put(fila);
        dia.put(clave, nuevas);
    }

    private static void agregarAlMes(JSONObject mes, String fecha, JSONObject entrada, boolean evento) throws Exception {
        if (mes == null) return;
        JSONArray celdas = mes.optJSONArray("celdas");
        for (int i = 0; celdas != null && i < celdas.length(); i++) {
            JSONObject celda = celdas.optJSONObject(i);
            if (celda == null || !fecha.equals(celda.optString("fecha"))) continue;
            JSONArray entradas = celda.optJSONArray("entradas");
            if (entradas == null) entradas = new JSONArray();
            entradas.put(entrada);
            celda.put("entradas", entradas);
            celda.put("total", celda.optInt("total", 0) + 1);
            if (evento) celda.put("eventos", celda.optInt("eventos", 0) + 1);
        }
    }
}
