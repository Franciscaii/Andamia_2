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

    /** Anota la nueva (tarea, evento o hábito), la muestra en los widgets y avisa a la app si está abierta. */
    static void guardar(Context c, JSONObject nueva) {
        try {
            nueva.put("id", PREFIJO + UUID.randomUUID());
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

    /** Cambia (o quita) una de las que aún esperan en la cola, según lo hecho en la ventana del widget. */
    static void editarEnCola(Context c, JSONObject e) {
        String id = e.optString("id");
        boolean eliminar = "eliminar".equals(e.optString("accion"));
        synchronized (TareaRapida.class) {
            JSONArray lista = cola(c);
            JSONArray nueva = new JSONArray();
            for (int i = 0; i < lista.length(); i++) {
                JSONObject n = lista.optJSONObject(i);
                if (n == null || !id.equals(n.optString("id"))) {
                    nueva.put(lista.opt(i));
                    continue;
                }
                if (eliminar) continue;
                try {
                    for (String k : new String[] { "titulo", "fecha", "prioridad", "dificultad", "indole", "color", "icono", "frecuencia", "fin", "meta" }) {
                        if (e.has(k)) n.put(k, e.get(k));
                        else n.remove(k);
                    }
                } catch (Exception ex) {
                    // Queda como estaba.
                }
                nueva.put(n);
            }
            prefs(c).edit().putString(CLAVE, nueva.toString()).commit();
        }
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
        if ("habito".equals(n.optString("tipo"))) {
            inyectarHabito(datos, n);
            return;
        }
        String fecha = n.optString("fecha");
        boolean evento = n.optBoolean("evento");
        int prioridad = nivel(n.optString("prioridad"));
        String color = n.optString("color");
        String indole = n.optString("indole");
        JSONObject etiqueta = etiqueta(datos, indole);
        String titulo = n.optString("titulo");
        String id = n.optString("id");

        JSONObject fila = new JSONObject();
        fila.put("id", id);
        fila.put("titulo", titulo);
        // Lo que necesita la ventana de edición del widget.
        fila.put("vence", fecha);
        if (evento) {
            fila.put("hora", "");
            fila.put("color", color);
        } else {
            fila.put("detalle", "");
            fila.put("atrasada", false);
            fila.put("hecha", false);
            fila.put("prioridad", prioridad);
            fila.put("dificultad", nivel(n.optString("dificultad")));
            fila.put("indole", indole);
            fila.put("etiqueta", etiqueta == null ? indole : etiqueta.optString("nombre"));
            fila.put("colorEtiqueta", etiqueta == null ? "" : etiqueta.optString("color"));
        }

        JSONArray dias = datos.optJSONArray("semanaDias");
        for (int i = 0; dias != null && i < dias.length(); i++) {
            JSONObject d = dias.optJSONObject(i);
            if (d != null && fecha.equals(d.optString("fecha"))) agregarFila(d, fila, evento);
        }
        if (fecha.equals(datos.optString("fecha"))) agregarFila(datos, fila, evento);

        JSONObject entrada = new JSONObject();
        entrada.put("id", id);
        entrada.put("titulo", titulo);
        entrada.put("color", evento ? color : "");
        entrada.put("evento", evento);
        entrada.put("hecha", false);
        entrada.put("nivel", evento ? 0 : prioridad);
        JSONArray meses = datos.optJSONArray("meses");
        for (int i = 0; meses != null && i < meses.length(); i++) agregarAlMes(meses.optJSONObject(i), fecha, entrada, evento);
        agregarAlMes(datos.optJSONObject("mes"), fecha, entrada, evento);
    }

    /**
     * Un hábito recién creado en el widget sale al tiro en Semana, en hoy y en los días siguientes
     * que le tocan (todos, o solo los días de la semana elegidos). Se puede marcar hoy mismo.
     */
    private static void inyectarHabito(JSONObject datos, JSONObject n) throws Exception {
        String inicio = n.optString("fecha");
        String hoy = hoy();
        JSONObject frecuencia = n.optJSONObject("frecuencia");
        JSONArray elegidos = frecuencia != null && "dias".equals(frecuencia.optString("tipo")) ? frecuencia.optJSONArray("dias") : null;
        SimpleDateFormat formato = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        // Su definición, para poder editarlo desde el widget antes de que la app lo cree.
        JSONArray defs = datos.optJSONArray("habitosDef");
        if (defs == null) defs = new JSONArray();
        boolean definido = false;
        for (int i = 0; i < defs.length(); i++) {
            JSONObject h = defs.optJSONObject(i);
            if (h != null && n.optString("id").equals(h.optString("id"))) definido = true;
        }
        if (!definido) {
            JSONObject def = new JSONObject();
            def.put("id", n.optString("id"));
            def.put("nombre", n.optString("titulo"));
            def.put("icono", n.optString("icono", "estrella"));
            def.put("color", n.optString("color"));
            def.put("frecuencia", frecuencia != null ? frecuencia : new JSONObject().put("tipo", "diaria"));
            def.put("inicio", inicio);
            def.put("fin", n.optString("fin"));
            def.put("meta", n.optInt("meta", 1));
            defs.put(def);
            datos.put("habitosDef", defs);
        }
        JSONArray dias = datos.optJSONArray("semanaDias");
        for (int i = 0; dias != null && i < dias.length(); i++) {
            JSONObject d = dias.optJSONObject(i);
            String fecha = d == null ? "" : d.optString("fecha");
            // Las fechas AAAA-MM-DD se ordenan como texto.
            if (fecha.isEmpty() || fecha.compareTo(inicio) < 0) continue;
            if (elegidos != null) {
                java.util.Calendar cal = java.util.Calendar.getInstance();
                Date dia = formato.parse(fecha);
                if (dia == null) continue;
                cal.setTime(dia);
                // 0 = lunes ... 6 = domingo, como en la app.
                int deLaSemana = (cal.get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7;
                boolean toca = false;
                for (int k = 0; k < elegidos.length(); k++) if (elegidos.optInt(k, -1) == deLaSemana) toca = true;
                if (!toca) continue;
            }
            JSONArray habitos = d.optJSONArray("habitos");
            if (habitos == null) habitos = new JSONArray();
            boolean esta = false;
            for (int k = 0; k < habitos.length(); k++) {
                JSONObject h = habitos.optJSONObject(k);
                if (h != null && n.optString("id").equals(h.optString("id"))) esta = true;
            }
            if (esta) continue;
            JSONObject fila = new JSONObject();
            fila.put("id", n.optString("id"));
            fila.put("nombre", n.optString("titulo"));
            fila.put("color", n.optString("color"));
            fila.put("hecho", false);
            fila.put("marcable", fecha.compareTo(hoy) <= 0);
            habitos.put(fila);
            d.put("habitos", habitos);
        }
    }

    static int nivel(String s) {
        return "alta".equals(s) ? 3 : "media".equals(s) ? 2 : "baja".equals(s) ? 1 : 0;
    }

    /** Nombre visible y color de la índole elegida, de la lista que manda la app. */
    static JSONObject etiqueta(JSONObject datos, String clave) {
        if (clave == null || clave.isEmpty()) return null;
        JSONObject f = datos.optJSONObject("formulario");
        JSONArray lista = f == null ? null : f.optJSONArray("indoles");
        for (int i = 0; lista != null && i < lista.length(); i++) {
            JSONObject e = lista.optJSONObject(i);
            if (e != null && clave.equals(e.optString("clave"))) return e;
        }
        return null;
    }

    /** Eventos al final; tareas antes de las ya hechas, que van abajo. */
    static void agregarFila(JSONObject dia, JSONObject fila, boolean evento) throws Exception {
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

    static void agregarAlMes(JSONObject mes, String fecha, JSONObject entrada, boolean evento) throws Exception {
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
