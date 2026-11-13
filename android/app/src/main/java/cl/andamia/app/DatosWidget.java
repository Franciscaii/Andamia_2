package cl.andamia.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.HashSet;
import java.util.Set;

/** Lo que el widget necesita guardar entre una apertura de la app y la siguiente. */
final class DatosWidget {
    private static final String ARCHIVO = "andamia_widget";
    private static final String CLAVE_TAREAS = "tareas";
    private static final String CLAVE_COMPLETADAS = "completadas";

    private DatosWidget() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE);
    }

    static void guardarTareas(Context c, String json) {
        prefs(c).edit().putString(CLAVE_TAREAS, json).apply();
    }

    static void guardarTema(Context c, String json) {
        prefs(c).edit().putString("tema", json).apply();
    }

    static String leerTema(Context c) {
        return prefs(c).getString("tema", null);
    }

    static String leerTareas(Context c) {
        return prefs(c).getString(CLAVE_TAREAS, null);
    }

    /** Tema, transparencia y esquinas propios de un widget (JSON que arma la app). */
    static void guardarConfig(Context c, int idWidget, String json) {
        prefs(c).edit().putString("config_" + idWidget, json).apply();
    }

    static String leerConfig(Context c, int idWidget) {
        return prefs(c).getString("config_" + idWidget, null);
    }

    /** Ajustes de un tipo de widget (Semana, Calendario...): valen para todos los de ese tipo. */
    static void guardarConfigTipo(Context c, String tipo, String json) {
        prefs(c).edit().putString("config_tipo_" + tipo, json).apply();
    }

    static String leerConfigTipo(Context c, String tipo) {
        return prefs(c).getString("config_tipo_" + tipo, null);
    }

    /** Filtro del widget Semana: "tareas", "eventos" o "todos". */
    static void elegirFiltro(Context c, int idWidget, String filtro) {
        prefs(c).edit().putString("filtro_" + idWidget, filtro).apply();
    }

    static String filtro(Context c, int idWidget) {
        return prefs(c).getString("filtro_" + idWidget, "todos");
    }

    /** Día (AAAA-MM-DD) que se eligió en un widget Semana. */
    static void elegirDia(Context c, int idWidget, String fecha) {
        prefs(c).edit().putString("dia_" + idWidget, fecha).apply();
    }

    static String diaElegido(Context c, int idWidget) {
        return prefs(c).getString("dia_" + idWidget, "");
    }

    /** Etiqueta (o hábito) destacada en un widget de estadísticas; -1 si ninguna. */
    static void elegirEtiqueta(Context c, int idWidget, int indice) {
        prefs(c).edit().putInt("etiqueta_" + idWidget, indice).apply();
    }

    static int etiquetaElegida(Context c, int idWidget) {
        return prefs(c).getInt("etiqueta_" + idWidget, -1);
    }

    /** Período de un widget de estadísticas: "dia", "semana", "mes" o "anio". */
    static void elegirPeriodo(Context c, int idWidget, String periodo) {
        prefs(c).edit().putString("periodo_" + idWidget, periodo).apply();
    }

    static String periodo(Context c, int idWidget) {
        return prefs(c).getString("periodo_" + idWidget, "semana");
    }

    /** Cuánto se movió con las flechas un widget de estadísticas: "pasos|día en que se movió". */
    static void guardarPasoEstadistica(Context c, int idWidget, String paso) {
        prefs(c).edit().putString("paso_est_" + idWidget, paso).apply();
    }

    static String pasoEstadistica(Context c, int idWidget) {
        return prefs(c).getString("paso_est_" + idWidget, "");
    }

    static synchronized void marcarCompletada(Context c, String id) {
        Set<String> ids = new HashSet<>(prefs(c).getStringSet(CLAVE_COMPLETADAS, new HashSet<>()));
        ids.add(id);
        prefs(c).edit().putStringSet(CLAVE_COMPLETADAS, ids).apply();
    }

    static synchronized Set<String> leerCompletadas(Context c) {
        return new HashSet<>(prefs(c).getStringSet(CLAVE_COMPLETADAS, new HashSet<>()));
    }

    static synchronized Set<String> tomarCompletadas(Context c) {
        Set<String> ids = leerCompletadas(c);
        prefs(c).edit().remove(CLAVE_COMPLETADAS).apply();
        return ids;
    }
}
