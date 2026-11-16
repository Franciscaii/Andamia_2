package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProviderInfo;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;

/** Puente entre la app (JavaScript) y el widget "Hoy" de la pantalla de inicio. */
@CapacitorPlugin(name = "AndamiaWidget")
public class WidgetPlugin extends Plugin {
    /** La app abierta (o en segundo plano), para avisarle de lo escrito en un widget. */
    private static volatile WidgetPlugin instancia;

    @Override
    public void load() {
        instancia = this;
    }

    /** Si Andamia está viva, crea al tiro lo escrito en el "+" de un widget. */
    static void avisarRapida() {
        WidgetPlugin p = instancia;
        if (p != null) p.notifyListeners("rapida", new JSObject());
    }

    /** Devuelve (y olvida) las tareas y eventos escritos desde los widgets, como JSON. */
    @PluginMethod
    public void rapidas(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("items", TareaRapida.tomar(getContext()));
        call.resolve(respuesta);
    }

    /** Pinta la barra de estado y la de navegación del color de la app, con iconos claros u oscuros. */
    @PluginMethod
    public void barraSistema(PluginCall call) {
        final String texto = call.getString("color", "");
        final boolean oscuro = Boolean.TRUE.equals(call.getBoolean("oscuro", false));
        final String textoAbajo = call.getString("colorAbajo", texto);
        final boolean oscuroAbajo = Boolean.TRUE.equals(call.getBoolean("oscuroAbajo", oscuro));
        if (getActivity() == null) {
            call.resolve();
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                int color = Color.parseColor(texto);
                Window ventana = getActivity().getWindow();
                // Con la pantalla de borde a borde, lo que asoma bajo la barra es el fondo de la ventana.
                int abajo = Color.parseColor(textoAbajo);
                // Arriba el color del inicio del fondo y abajo el del final, como el degradado de la página.
                ventana.getDecorView().setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM, new int[] { color, abajo }));
                ventana.setStatusBarColor(color);
                ventana.setNavigationBarColor(abajo);
                WindowInsetsControllerCompat control = WindowCompat.getInsetsController(ventana, ventana.getDecorView());
                control.setAppearanceLightStatusBars(!oscuro);
                control.setAppearanceLightNavigationBars(!oscuroAbajo);
            } catch (Exception e) {
                // Color que no se entiende: la barra queda como estaba.
            }
            call.resolve();
        });
    }

    /** Devuelve (y olvida) los cambios y borrados hechos en la ventana del widget Semana, como JSON. */
    @PluginMethod
    public void ediciones(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("items", EdicionRapida.tomar(getContext()));
        call.resolve(respuesta);
    }

    /** Guarda las tareas de hoy que mostrará el widget y lo redibuja. */
    @PluginMethod
    public void actualizar(PluginCall call) {
        String datos = call.getString("datos");
        if (datos == null) {
            call.reject("Faltan los datos del widget");
            return;
        }
        Context contexto = getContext();
        // Lo escrito en los widgets que la app aún no crea sigue a la vista.
        DatosWidget.guardarTareas(contexto, EdicionRapida.conPendientes(contexto, TareaRapida.conPendientes(contexto, datos)));
        try {
            // Tema y aspecto aparte, para leerlos rápido en cada dibujo.
            org.json.JSONObject todo = new org.json.JSONObject(datos);
            org.json.JSONObject tema = new org.json.JSONObject();
            tema.put("tema", todo.optJSONObject("tema"));
            DatosWidget.guardarTema(contexto, tema.toString());
        } catch (Exception e) {
            // Sin tema: los widgets usan sus colores de siempre.
        }
        TemaWidget.olvidar();
        Widgets.redibujarTodo(contexto);
        call.resolve();
    }

    /** ¿Este celular deja poner widgets en la pantalla de inicio desde la app? */
    @PluginMethod
    public void puedeAnclar(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("puede", Build.VERSION.SDK_INT >= 26
                && AppWidgetManager.getInstance(getContext()).isRequestPinAppWidgetSupported());
        call.resolve(respuesta);
    }

    private static final String[] TIPOS = { "semana", "hoy", "calendario", "matriz", "estadistica-tareas", "estadistica-habitos" };
    private static final Class<?>[] CLASES = {
        WidgetSemana.class, HoyWidget.class, WidgetCalendario.class, WidgetMatriz.class,
        WidgetEstadisticaTareas.class, WidgetEstadisticaHabitos.class,
    };

    /** Los widgets puestos en la pantalla de inicio, con su tipo y su configuración. */
    @PluginMethod
    public void listar(PluginCall call) {
        Context contexto = getContext();
        AppWidgetManager gestor = AppWidgetManager.getInstance(contexto);
        JSArray lista = new JSArray();
        for (int i = 0; i < TIPOS.length; i++) {
            for (int id : gestor.getAppWidgetIds(new ComponentName(contexto, CLASES[i]))) {
                JSObject w = new JSObject();
                w.put("id", id);
                w.put("tipo", TIPOS[i]);
                String config = DatosWidget.leerConfig(contexto, id);
                w.put("config", config == null ? "" : config);
                lista.put(w);
            }
        }
        JSObject tipos = new JSObject();
        for (String tipo : TIPOS) {
            String config = DatosWidget.leerConfigTipo(contexto, tipo);
            if (config != null) tipos.put(tipo, config);
        }
        JSObject respuesta = new JSObject();
        respuesta.put("widgets", lista);
        respuesta.put("tipos", tipos);
        call.resolve(respuesta);
    }

    /** Guarda el tema, la transparencia y las esquinas de un widget, y lo redibuja. */
    @PluginMethod
    public void configurar(PluginCall call) {
        Integer id = call.getInt("id");
        String config = call.getString("config");
        if (id == null || config == null) {
            call.reject("Faltan el widget o su configuración");
            return;
        }
        Context contexto = getContext();
        DatosWidget.guardarConfig(contexto, id, config);
        TemaWidget.olvidar();
        Widgets.redibujarTodo(contexto);
        call.resolve();
    }

    /** Guarda los ajustes de un tipo de widget y los aplica a todos los de ese tipo ya puestos. */
    @PluginMethod
    public void configurarTipo(PluginCall call) {
        String tipo = call.getString("tipo");
        String config = call.getString("config");
        Class<?> clase = claseDe(tipo);
        if (clase == null || config == null) {
            call.reject("Falta el tipo de widget o su configuración");
            return;
        }
        Context contexto = getContext();
        DatosWidget.guardarConfigTipo(contexto, tipo, config);
        for (int id : AppWidgetManager.getInstance(contexto).getAppWidgetIds(new ComponentName(contexto, clase))) {
            DatosWidget.guardarConfig(contexto, id, config);
        }
        TemaWidget.olvidar();
        Widgets.redibujarTodo(contexto);
        call.resolve();
    }

    private static Class<?> claseDe(String tipo) {
        for (int i = 0; i < TIPOS.length; i++) if (TIPOS[i].equals(tipo)) return CLASES[i];
        return null;
    }

    /** El tipo ("semana", "calendario"...) de un widget puesto, o null si no se sabe. */
    static String tipoDe(Context contexto, int idWidget) {
        AppWidgetProviderInfo info = AppWidgetManager.getInstance(contexto).getAppWidgetInfo(idWidget);
        if (info == null || info.provider == null) return null;
        String clase = info.provider.getClassName();
        for (int i = 0; i < TIPOS.length; i++) if (CLASES[i].getName().equals(clase)) return TIPOS[i];
        return null;
    }

    /** Pide al celular poner un widget en la pantalla de inicio (el celular muestra su propio aviso). */
    @PluginMethod
    public void anclar(PluginCall call) {
        String tipo = call.getString("tipo", "");
        Class<?> clase = null;
        for (int i = 0; i < TIPOS.length; i++) if (TIPOS[i].equals(tipo)) clase = CLASES[i];
        if (clase == null) {
            call.reject("Widget desconocido: " + tipo);
            return;
        }
        JSObject respuesta = new JSObject();
        boolean pedido = false;
        if (Build.VERSION.SDK_INT >= 26) {
            AppWidgetManager gestor = AppWidgetManager.getInstance(getContext());
            if (gestor.isRequestPinAppWidgetSupported()) {
                pedido = gestor.requestPinAppWidget(new ComponentName(getContext(), clase), null, null);
            }
        }
        respuesta.put("pedido", pedido);
        call.resolve(respuesta);
    }

    /** Devuelve (y olvida) las tareas marcadas como hechas desde el widget. */
    /** Hábitos marcados desde el widget Semana que la app aún no anota (y los olvida). */
    @PluginMethod
    public void habitosMarcados(PluginCall call) {
        JSObject respuesta = new JSObject();
        respuesta.put("marcas", DatosWidget.tomarHabitosMarcados(getContext()));
        call.resolve(respuesta);
    }

    @PluginMethod
    public void pendientes(PluginCall call) {
        Set<String> ids = DatosWidget.tomarCompletadas(getContext());
        JSArray lista = new JSArray();
        for (String id : ids) lista.put(id);
        JSObject respuesta = new JSObject();
        respuesta.put("ids", lista);
        call.resolve(respuesta);
    }
}
