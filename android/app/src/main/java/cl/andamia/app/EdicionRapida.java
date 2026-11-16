package cl.andamia.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cambios y borrados de tareas, eventos y hábitos hechos en la ventana que abre el widget Semana
 * al tocarlos, sin abrir Andamia. Quedan en una cola hasta que la app los aplica de verdad y, mientras
 * tanto, se reflejan al tiro en los datos que dibujan los widgets.
 */
final class EdicionRapida {
    private static final String CLAVE = "ediciones";

    private EdicionRapida() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("andamia_widget", Context.MODE_PRIVATE);
    }

    private static String hoy() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    private static synchronized JSONArray cola(Context c) {
        try {
            return new JSONArray(prefs(c).getString(CLAVE, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Devuelve (y olvida) las ediciones que esperan ser aplicadas en la app. */
    static synchronized String tomar(Context c) {
        String s = cola(c).toString();
        prefs(c).edit().remove(CLAVE).commit();
        return s;
    }

    /** Anota el cambio (o borrado), lo muestra en los widgets y avisa a la app si está abierta. */
    static void guardar(Context c, JSONObject edicion) {
        String id = edicion.optString("id");
        if (id.startsWith(TareaRapida.PREFIJO)) {
            // Aún no existe en la app: se cambia (o se quita) directo en la cola de creaciones.
            TareaRapida.editarEnCola(c, edicion);
        } else {
            synchronized (EdicionRapida.class) {
                JSONArray lista = cola(c);
                lista.put(edicion);
                prefs(c).edit().putString(CLAVE, lista.toString()).commit();
            }
        }
        String datos = DatosWidget.leerTareas(c);
        if (datos != null) {
            try {
                JSONObject o = new JSONObject(datos);
                aplicar(o, edicion);
                DatosWidget.guardarTareas(c, o.toString());
            } catch (Exception e) {
                // Si no se puede mostrar ahora, aparece cuando la app lo aplique.
            }
        }
        Widgets.redibujarTodo(c);
        WidgetPlugin.avisarRapida();
    }

    /** Los datos que manda la app, más los cambios que aún esperan en la cola (para que no se pierdan de vista). */
    static String conPendientes(Context c, String datos) {
        JSONArray lista = cola(c);
        if (lista.length() == 0) return datos;
        try {
            JSONObject o = new JSONObject(datos);
            for (int i = 0; i < lista.length(); i++) {
                JSONObject e = lista.optJSONObject(i);
                if (e != null) aplicar(o, e);
            }
            return o.toString();
        } catch (Exception e) {
            return datos;
        }
    }

    // ---------- Lo que muestra la ventana ----------

    /**
     * Lo que se sabe de una tarea, evento o hábito, sacado de los datos del widget:
     * tipo, titulo, fecha, prioridad, dificultad (0 a 3), indole, color y, en un hábito, icono, frecuencia, fin y meta.
     */
    static JSONObject buscar(Context c, String tipo, String id) {
        JSONObject datos = Widgets.datos(c);
        if (datos == null || id == null || id.isEmpty()) return null;
        try {
            JSONObject info = new JSONObject();
            info.put("tipo", tipo);
            if ("habito".equals(tipo)) {
                JSONArray defs = datos.optJSONArray("habitosDef");
                for (int i = 0; defs != null && i < defs.length(); i++) {
                    JSONObject h = defs.optJSONObject(i);
                    if (h == null || !id.equals(h.optString("id"))) continue;
                    info.put("titulo", h.optString("nombre"));
                    info.put("icono", h.optString("icono"));
                    info.put("color", h.optString("color"));
                    info.put("frecuencia", h.optJSONObject("frecuencia"));
                    info.put("fecha", h.optString("inicio"));
                    info.put("fin", h.optString("fin"));
                    info.put("meta", h.optInt("meta", 1));
                    return info;
                }
                return null;
            }
            String clave = "evento".equals(tipo) ? "eventos" : "tareas";
            for (JSONObject dia : diasDe(datos)) {
                JSONArray lista = dia.optJSONArray(clave);
                for (int i = 0; lista != null && i < lista.length(); i++) {
                    JSONObject f = lista.optJSONObject(i);
                    if (f == null || !id.equals(f.optString("id"))) continue;
                    String vence = f.optString("vence");
                    info.put("titulo", f.optString("titulo"));
                    info.put("fecha", vence.isEmpty() ? dia.optString("fecha") : vence);
                    info.put("prioridad", f.optInt("prioridad"));
                    info.put("dificultad", f.optInt("dificultad"));
                    info.put("indole", f.optString("indole"));
                    info.put("color", f.optString("color"));
                    return info;
                }
            }
        } catch (Exception e) {
            // Datos de otra versión: no se puede editar desde el widget.
        }
        return null;
    }

    // ---------- Reflejar un cambio en los datos de los widgets ----------

    /** Los días con eventos y tareas: los de la semana y el de hoy (que es el propio dato raíz). */
    private static List<JSONObject> diasDe(JSONObject datos) {
        List<JSONObject> dias = new ArrayList<>();
        JSONArray semana = datos.optJSONArray("semanaDias");
        for (int i = 0; semana != null && i < semana.length(); i++) {
            JSONObject d = semana.optJSONObject(i);
            if (d != null) dias.add(d);
        }
        dias.add(datos);
        return dias;
    }

    static void aplicar(JSONObject datos, JSONObject e) throws Exception {
        if ("habito".equals(e.optString("tipo"))) aplicarHabito(datos, e);
        else aplicarTarea(datos, e);
    }

    private static void aplicarTarea(JSONObject datos, JSONObject e) throws Exception {
        String id = e.optString("id");
        boolean eliminar = "eliminar".equals(e.optString("accion"));
        boolean evento = "evento".equals(e.optString("tipo"));
        String nuevaFecha = e.optString("fecha");
        JSONObject etiqueta = TareaRapida.etiqueta(datos, e.optString("indole"));
        String clave = evento ? "eventos" : "tareas";

        // Semana y hoy: se cambia en su sitio, o se saca para ponerla en el día nuevo.
        JSONObject movida = null;
        List<JSONObject> dias = diasDe(datos);
        for (JSONObject dia : dias) {
            JSONArray lista = dia.optJSONArray(clave);
            if (lista == null) continue;
            JSONArray nueva = new JSONArray();
            for (int i = 0; i < lista.length(); i++) {
                JSONObject f = lista.optJSONObject(i);
                if (f == null || !id.equals(f.optString("id"))) {
                    nueva.put(lista.opt(i));
                    continue;
                }
                if (eliminar) continue;
                String antes = f.optString("vence");
                if (antes.isEmpty()) antes = dia.optString("fecha");
                poner(f, e, evento, etiqueta);
                if (!nuevaFecha.isEmpty() && !nuevaFecha.equals(antes)) {
                    f.put("vence", nuevaFecha);
                    if (!evento) f.put("atrasada", !f.optBoolean("hecha") && nuevaFecha.compareTo(hoy()) < 0);
                    if (movida == null) movida = f;
                    continue;
                }
                nueva.put(f);
            }
            dia.put(clave, nueva);
        }
        if (movida != null) {
            for (JSONObject dia : dias) if (nuevaFecha.equals(dia.optString("fecha"))) TareaRapida.agregarFila(dia, movida, evento);
        }

        // Calendario: sus entradas llevan el id desde la 1.29.
        List<JSONObject> meses = new ArrayList<>();
        JSONArray lista = datos.optJSONArray("meses");
        for (int i = 0; lista != null && i < lista.length(); i++) if (lista.optJSONObject(i) != null) meses.add(lista.optJSONObject(i));
        if (datos.optJSONObject("mes") != null) meses.add(datos.optJSONObject("mes"));
        JSONObject entradaMovida = null;
        for (JSONObject mes : meses) {
            JSONArray celdas = mes.optJSONArray("celdas");
            for (int i = 0; celdas != null && i < celdas.length(); i++) {
                JSONObject celda = celdas.optJSONObject(i);
                JSONArray entradas = celda == null ? null : celda.optJSONArray("entradas");
                if (entradas == null) continue;
                JSONArray nuevas = new JSONArray();
                boolean quitada = false;
                for (int k = 0; k < entradas.length(); k++) {
                    JSONObject en = entradas.optJSONObject(k);
                    if (en == null || !id.equals(en.optString("id"))) {
                        nuevas.put(entradas.opt(k));
                        continue;
                    }
                    if (!eliminar) {
                        if (!e.optString("titulo").isEmpty()) en.put("titulo", e.optString("titulo"));
                        if (evento) en.put("color", e.optString("color"));
                        else en.put("nivel", TareaRapida.nivel(e.optString("prioridad")));
                        if (nuevaFecha.isEmpty() || nuevaFecha.equals(celda.optString("fecha"))) {
                            nuevas.put(en);
                            continue;
                        }
                        if (entradaMovida == null) entradaMovida = en;
                    }
                    quitada = true;
                }
                if (quitada) {
                    celda.put("entradas", nuevas);
                    celda.put("total", Math.max(0, celda.optInt("total", 0) - 1));
                    if (evento) celda.put("eventos", Math.max(0, celda.optInt("eventos", 0) - 1));
                }
            }
        }
        if (entradaMovida != null) {
            for (JSONObject mes : meses) TareaRapida.agregarAlMes(mes, nuevaFecha, entradaMovida, evento);
        }
    }

    /** Pone en una fila del widget lo que se cambió en la ventana. */
    private static void poner(JSONObject f, JSONObject e, boolean evento, JSONObject etiqueta) throws Exception {
        if (!e.optString("titulo").isEmpty()) f.put("titulo", e.optString("titulo"));
        if (evento) {
            f.put("color", e.optString("color"));
            return;
        }
        String indole = e.optString("indole");
        f.put("prioridad", TareaRapida.nivel(e.optString("prioridad")));
        f.put("dificultad", TareaRapida.nivel(e.optString("dificultad")));
        f.put("indole", indole);
        f.put("etiqueta", etiqueta == null ? indole : etiqueta.optString("nombre"));
        f.put("colorEtiqueta", etiqueta == null ? "" : etiqueta.optString("color"));
    }

    private static void aplicarHabito(JSONObject datos, JSONObject e) throws Exception {
        String id = e.optString("id");
        boolean eliminar = "eliminar".equals(e.optString("accion"));
        JSONArray semana = datos.optJSONArray("semanaDias");
        for (int i = 0; semana != null && i < semana.length(); i++) {
            JSONObject dia = semana.optJSONObject(i);
            JSONArray habitos = dia == null ? null : dia.optJSONArray("habitos");
            if (habitos == null) continue;
            JSONArray nuevos = new JSONArray();
            for (int k = 0; k < habitos.length(); k++) {
                JSONObject h = habitos.optJSONObject(k);
                if (h == null || !id.equals(h.optString("id"))) {
                    nuevos.put(habitos.opt(k));
                    continue;
                }
                if (eliminar) continue;
                if (!e.optString("titulo").isEmpty()) h.put("nombre", e.optString("titulo"));
                if (!e.optString("color").isEmpty()) h.put("color", e.optString("color"));
                nuevos.put(h);
            }
            dia.put("habitos", nuevos);
        }
        JSONArray defs = datos.optJSONArray("habitosDef");
        JSONArray nuevas = new JSONArray();
        for (int i = 0; defs != null && i < defs.length(); i++) {
            JSONObject h = defs.optJSONObject(i);
            if (h == null || !id.equals(h.optString("id"))) {
                nuevas.put(defs.opt(i));
                continue;
            }
            if (eliminar) continue;
            if (!e.optString("titulo").isEmpty()) h.put("nombre", e.optString("titulo"));
            if (!e.optString("icono").isEmpty()) h.put("icono", e.optString("icono"));
            if (!e.optString("color").isEmpty()) h.put("color", e.optString("color"));
            if (e.optJSONObject("frecuencia") != null) h.put("frecuencia", e.optJSONObject("frecuencia"));
            if (!e.optString("fecha").isEmpty()) h.put("inicio", e.optString("fecha"));
            h.put("fin", e.optString("fin"));
            if (e.has("meta")) h.put("meta", e.optInt("meta", 1));
            nuevas.put(h);
        }
        if (defs != null) datos.put("habitosDef", nuevas);
    }
}
