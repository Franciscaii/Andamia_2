package cl.andamia.app;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.StrikethroughSpan;
import android.view.View;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Arma las filas del widget a partir de lo que guardó la app, igual que la semana:
 * primero los eventos, luego la barra de progreso del día y después las tareas.
 */
class FabricaListaHoy implements RemoteViewsService.RemoteViewsFactory {
    private static final int TIPO_EVENTO = 0;
    private static final int TIPO_PROGRESO = 1;
    private static final int TIPO_TAREA = 2;
    private static final int TIPO_SECCION = 3;
    private static final int TIPO_ESPACIO = 4;

    /** Lugar de una fila dentro de su tarjeta (solo en el widget Semana). */
    private static final int SIN_TARJETA = 0, ARRIBA = 1, MEDIO = 2, ABAJO = 3, SOLA = 4;

    static final class Fila {
        int tipo;
        String id = "";
        String titulo = "";
        String detalle = "";
        boolean atrasada;
        boolean hecha;
        int prioridad;
        int dificultad;
        String etiqueta = "";
        String colorEtiqueta = "";
        String color = "";
        /** Tarjeta a la que pertenece (0 = ninguna) y su lugar en ella. */
        int grupo;
        int tarjeta;
    }

    private final Context contexto;
    private final int idWidget;
    /** Lista del widget "Semana" (día elegido, filtros y tarjetas) en vez del widget "Hoy". */
    private final boolean semana;
    private final List<Fila> filas = new ArrayList<>();
    private int hechas;
    private int total;
    private String fechaDia = "";
    private boolean diaEsHoy = true;

    FabricaListaHoy(Context contexto, int idWidget, boolean semana) {
        this.contexto = contexto;
        this.idWidget = idWidget;
        this.semana = semana;
    }

    private void cargar() {
        TemaWidget.usar(contexto, idWidget);
        filas.clear();
        hechas = 0;
        total = 0;
        String json = DatosWidget.leerTareas(contexto);
        if (json == null) return;
        Set<String> marcadas = DatosWidget.leerCompletadas(contexto);
        try {
            JSONObject datos = new JSONObject(json);
            String hoy = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
            boolean deOtroDia = !hoy.equals(datos.optString("fecha"));
            String filtro = semana ? DatosWidget.filtro(contexto, idWidget) : "todos";
            boolean conEventos = !"tareas".equals(filtro);
            boolean conTareas = !"eventos".equals(filtro);
            if (semana) {
                // Widget "Semana": solo el día elegido, con sus propios eventos y tareas.
                datos = WidgetSemana.dia(contexto, idWidget, datos);
                if (datos == null) return;
                deOtroDia = false;
            }
            fechaDia = datos.optString("fecha");
            diaEsHoy = hoy.equals(fechaDia);

            JSONArray eventos = datos.optJSONArray("eventos");
            // Los eventos de otro día ya pasaron.
            if (eventos != null && !deOtroDia && conEventos) {
                for (int i = 0; i < eventos.length(); i++) {
                    JSONObject e = eventos.getJSONObject(i);
                    Fila f = new Fila();
                    f.tipo = TIPO_EVENTO;
                    f.id = e.optString("id");
                    f.titulo = e.optString("titulo");
                    f.detalle = e.optString("hora");
                    f.color = e.optString("color");
                    filas.add(f);
                }
            }

            List<Fila> deTareas = new ArrayList<>();
            JSONArray tareas = conTareas ? datos.optJSONArray("tareas") : null;
            if (tareas != null) {
                for (int i = 0; i < tareas.length(); i++) {
                    JSONObject t = tareas.getJSONObject(i);
                    String id = t.optString("id");
                    if (id.isEmpty()) continue;
                    boolean hecha = t.optBoolean("hecha") || marcadas.contains(id);
                    // De un día anterior solo queda lo pendiente, que ya está atrasado.
                    if (deOtroDia && hecha) continue;
                    Fila f = new Fila();
                    f.tipo = TIPO_TAREA;
                    f.id = id;
                    f.titulo = t.optString("titulo");
                    f.detalle = t.optString("detalle");
                    f.hecha = hecha;
                    f.atrasada = !hecha && (t.optBoolean("atrasada") || deOtroDia);
                    f.prioridad = t.optInt("prioridad");
                    f.dificultad = t.optInt("dificultad");
                    f.etiqueta = t.optString("etiqueta");
                    f.colorEtiqueta = t.optString("colorEtiqueta");
                    deTareas.add(f);
                    total++;
                    if (hecha) hechas++;
                }
            }

            boolean hayEventos = !filas.isEmpty();
            if (total > 0) {
                // En la Semana: un espacio después de los eventos y la tarjeta "Tareas hoy".
                if (semana && hayEventos) agregarEspacio();
                Fila progreso = new Fila();
                progreso.tipo = TIPO_PROGRESO;
                progreso.grupo = 1;
                filas.add(progreso);
            }
            // Pendientes primero; las completadas abajo, bajo "Completadas" (en la Semana, en su propia tarjeta).
            boolean conSeccion = false;
            for (Fila f : deTareas) if (!f.hecha) {
                f.grupo = 1;
                filas.add(f);
            }
            for (Fila f : deTareas) {
                if (!f.hecha) continue;
                if (!conSeccion) {
                    if (semana) agregarEspacio();
                    Fila seccion = new Fila();
                    seccion.tipo = TIPO_SECCION;
                    seccion.grupo = 2;
                    filas.add(seccion);
                    conSeccion = true;
                }
                f.grupo = 2;
                filas.add(f);
            }
            if (semana) ubicarEnTarjetas();
        } catch (Exception e) {
            filas.clear();
            hechas = 0;
            total = 0;
        }
    }

    private void agregarEspacio() {
        Fila espacio = new Fila();
        espacio.tipo = TIPO_ESPACIO;
        filas.add(espacio);
    }

    /** Marca cada fila como primera, del medio, última o única de su tarjeta. */
    private void ubicarEnTarjetas() {
        for (int i = 0; i < filas.size(); i++) {
            Fila f = filas.get(i);
            if (f.grupo == 0) continue;
            boolean primera = i == 0 || filas.get(i - 1).grupo != f.grupo;
            boolean ultima = i == filas.size() - 1 || filas.get(i + 1).grupo != f.grupo;
            f.tarjeta = primera && ultima ? SOLA : primera ? ARRIBA : ultima ? ABAJO : MEDIO;
        }
    }

    /** Pone el fondo de tarjeta que le toca a la fila, con el color suave del tema. */
    private void enTarjeta(RemoteViews vista, int raiz, Fila f) {
        if (f.tarjeta == SIN_TARJETA) return;
        int fondo = f.tarjeta == ARRIBA ? R.drawable.widget_tarjeta_arriba
                : f.tarjeta == ABAJO ? R.drawable.widget_tarjeta_abajo
                : f.tarjeta == SOLA ? R.drawable.widget_tarjeta_sola
                : R.drawable.widget_tarjeta_medio;
        vista.setInt(raiz, "setBackgroundResource", fondo);
        TemaWidget.tenirFondo(vista, raiz, color(contexto, R.color.widget_evento_suave));
    }

    @Override public void onCreate() { cargar(); }
    @Override public void onDataSetChanged() { cargar(); }
    @Override public void onDestroy() { filas.clear(); }
    @Override public int getCount() { return filas.size(); }
    @Override public RemoteViews getLoadingView() { return null; }
    @Override public int getViewTypeCount() { return 5; }
    @Override public long getItemId(int posicion) { return posicion; }
    @Override public boolean hasStableIds() { return false; }

    static int color(Context contexto, int recurso) {
        Integer delTema = TemaWidget.color(contexto, recurso);
        if (delTema != null) return delTema;
        return contexto.getResources().getColor(recurso, contexto.getTheme());
    }

    /** Rojo, amarillo o azul según el nivel (3 alta, 2 media, 1 baja). */
    static int colorNivel(Context contexto, int nivel) {
        switch (nivel) {
            case 3: return color(contexto, R.color.widget_nivel_alta);
            case 2: return color(contexto, R.color.widget_nivel_media);
            case 1: return color(contexto, R.color.widget_nivel_baja);
            default: return color(contexto, R.color.widget_texto_tenue);
        }
    }

    static String nombreNivel(int nivel) {
        switch (nivel) {
            case 3: return "Alta";
            case 2: return "Media";
            case 1: return "Baja";
            default: return "";
        }
    }

    static RemoteViews filaEvento(Context contexto, Fila f) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_evento);
        TemaWidget.letra(vista, R.id.evento_titulo, 14);
        TemaWidget.letra(vista, R.id.evento_hora, 12);
        vista.setTextViewText(R.id.evento_titulo, f.titulo);
        vista.setTextViewText(R.id.evento_hora, f.detalle);
        vista.setViewVisibility(R.id.evento_hora, f.detalle.isEmpty() ? View.GONE : View.VISIBLE);
        int colorEvento = color(contexto, R.color.widget_evento);
        try {
            if (!f.color.isEmpty()) colorEvento = Color.parseColor(f.color);
        } catch (IllegalArgumentException e) {
            // Color desconocido: se queda el morado.
        }
        vista.setInt(R.id.evento_color, "setBackgroundColor", colorEvento);
        vista.setTextColor(R.id.evento_titulo, color(contexto, R.color.widget_texto));
        vista.setTextColor(R.id.evento_hora, color(contexto, R.color.widget_texto_tenue));
        TemaWidget.tenirFondo(vista, R.id.evento_fila, color(contexto, R.color.widget_evento_suave));
        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://tarea/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.evento_fila, abrir);
        return vista;
    }

    /** Abre Andamia en el día que muestra el widget (o en Hoy). */
    private Intent abrirDia() {
        Intent abrir = new Intent();
        abrir.setData(Uri.parse(semana && !fechaDia.isEmpty() ? "andamia://dia/" + fechaDia : "andamia://hoy"));
        return abrir;
    }

    private RemoteViews filaProgreso() {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_progreso);
        TemaWidget.letra(vista, R.id.progreso_titulo, 13);
        TemaWidget.letra(vista, R.id.progreso_texto, 13);
        int porcentaje = total == 0 ? 0 : Math.round(hechas * 100f / total);
        vista.setProgressBar(R.id.progreso_barra, 100, porcentaje, false);
        TemaWidget.barra(contexto, vista, R.id.progreso_barra);
        vista.setTextColor(R.id.progreso_titulo, color(contexto, R.color.widget_texto));
        vista.setTextColor(R.id.progreso_texto, color(contexto, R.color.widget_texto_tenue));
        vista.setTextViewText(R.id.progreso_texto, hechas + "/" + total + " (" + porcentaje + "%)");
        vista.setTextViewText(R.id.progreso_titulo, !semana || diaEsHoy ? "Tareas hoy" : "Tareas del día");
        Intent abrir = new Intent();
        abrir.setData(Uri.parse(semana && !fechaDia.isEmpty() ? "andamia://dia/" + fechaDia : "andamia://hoy"));
        vista.setOnClickFillInIntent(R.id.progreso_fila, abrir);
        return vista;
    }

    static RemoteViews filaTarea(Context contexto, Fila f) {
        RemoteViews vista = new RemoteViews(contexto.getPackageName(), R.layout.widget_fila);
        TemaWidget.letra(vista, R.id.fila_titulo, 15);
        TemaWidget.letra(vista, R.id.fila_importancia, 11);
        TemaWidget.letra(vista, R.id.fila_detalle, 12);
        TemaWidget.letra(vista, R.id.fila_etiqueta, 12);

        if (f.hecha) {
            SpannableString tachado = new SpannableString(f.titulo);
            tachado.setSpan(new StrikethroughSpan(), 0, tachado.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            vista.setTextViewText(R.id.fila_titulo, tachado);
            vista.setTextColor(R.id.fila_titulo, color(contexto, R.color.widget_texto_tenue));
        } else {
            vista.setTextViewText(R.id.fila_titulo, f.titulo);
            vista.setTextColor(R.id.fila_titulo, color(contexto, R.color.widget_texto));
        }

        // Casilla: color de la importancia; plomo si ya está hecha.
        vista.setTextViewText(R.id.fila_circulo, f.hecha ? "☑" : "☐");
        vista.setTextColor(R.id.fila_circulo, f.hecha ? color(contexto, R.color.widget_texto_tenue) : colorNivel(contexto, f.prioridad));

        // Insignia bajo el título: dificultad.
        String dificultad = nombreNivel(f.dificultad);
        vista.setTextViewText(R.id.fila_importancia, dificultad);
        vista.setTextColor(R.id.fila_importancia, colorNivel(contexto, f.dificultad));
        vista.setViewVisibility(R.id.fila_importancia, dificultad.isEmpty() ? View.GONE : View.VISIBLE);
        TemaWidget.tenirFondo(vista, R.id.fila_importancia, colorNivel(contexto, f.dificultad));

        String detalle = f.atrasada ? (f.detalle.isEmpty() ? "Atrasada" : "Atrasada · " + f.detalle) : f.detalle;
        vista.setTextViewText(R.id.fila_detalle, detalle);
        vista.setViewVisibility(R.id.fila_detalle, detalle.isEmpty() ? View.GONE : View.VISIBLE);
        vista.setTextColor(R.id.fila_detalle, color(contexto, f.atrasada ? R.color.widget_atrasada : R.color.widget_texto_tenue));

        // Etiqueta del ámbito, con su color.
        vista.setTextViewText(R.id.fila_etiqueta, f.etiqueta);
        vista.setViewVisibility(R.id.fila_etiqueta, f.etiqueta.isEmpty() ? View.GONE : View.VISIBLE);
        int colorEtiqueta = color(contexto, R.color.widget_texto_tenue);
        try {
            if (!f.colorEtiqueta.isEmpty()) colorEtiqueta = Color.parseColor(f.colorEtiqueta);
        } catch (IllegalArgumentException e) {
            // Color desconocido: se queda el gris.
        }
        vista.setTextColor(R.id.fila_etiqueta, colorEtiqueta);
        TemaWidget.tenirFondo(vista, R.id.fila_etiqueta, colorEtiqueta);

        if (!f.hecha) {
            Intent marcar = new Intent();
            marcar.setData(Uri.parse("andamia://completar/" + Uri.encode(f.id)));
            vista.setOnClickFillInIntent(R.id.fila_circulo, marcar);
        }

        Intent abrir = new Intent();
        abrir.setData(Uri.parse("andamia://tarea/" + Uri.encode(f.id)));
        vista.setOnClickFillInIntent(R.id.fila_texto, abrir);
        return vista;
    }

    @Override
    public RemoteViews getViewAt(int posicion) {
        TemaWidget.usar(contexto, idWidget);
        if (posicion >= filas.size()) return new RemoteViews(contexto.getPackageName(), R.layout.widget_fila);
        Fila f = filas.get(posicion);
        switch (f.tipo) {
            case TIPO_EVENTO: return filaEvento(contexto, f);
            case TIPO_ESPACIO: {
                RemoteViews espacio = new RemoteViews(contexto.getPackageName(), R.layout.widget_espacio);
                espacio.setOnClickFillInIntent(R.id.espacio_fila, abrirDia());
                return espacio;
            }
            case TIPO_PROGRESO: {
                RemoteViews vista = filaProgreso();
                enTarjeta(vista, R.id.progreso_fila, f);
                return vista;
            }
            case TIPO_SECCION: {
                RemoteViews seccion = new RemoteViews(contexto.getPackageName(), R.layout.widget_seccion);
                TemaWidget.letra(seccion, R.id.seccion_titulo, 13);
                seccion.setTextColor(R.id.seccion_titulo, color(contexto, semana ? R.color.widget_texto : R.color.widget_texto_tenue));
                enTarjeta(seccion, R.id.seccion_titulo, f);
                seccion.setOnClickFillInIntent(R.id.seccion_titulo, abrirDia());
                return seccion;
            }
            default: {
                RemoteViews vista = filaTarea(contexto, f);
                enTarjeta(vista, R.id.fila_raiz, f);
                // Los bordes de la fila (fuera de la casilla y del texto) abren el día en Andamia.
                vista.setOnClickFillInIntent(R.id.fila_raiz, abrirDia());
                return vista;
            }
        }
    }
}
