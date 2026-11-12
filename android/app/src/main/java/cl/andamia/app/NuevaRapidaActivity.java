package cl.andamia.app;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Cuadro que se abre sobre la pantalla de inicio al tocar el "+" de los widgets Semana y
 * Calendario. Como el "+" de la app: primero Tarea, Evento o Hábito, y luego sus campos.
 * Se guarda sin abrir Andamia (ver TareaRapida).
 */
public class NuevaRapidaActivity extends Activity {
    private static final Locale ES = new Locale("es", "CL");
    /** Valor, nombre y nivel (para el color) de importancia y dificultad, como en la app. */
    private static final String[] NIVELES = { "alta", "media", "baja", "ninguna" };
    private static final String[] NOMBRES_NIVEL = { "Alta", "Media", "Baja", "Ninguna" };
    private static final int[] NUM_NIVEL = { 3, 2, 1, 0 };
    /** Íconos de hábito de la app (IconoHabito.tsx), dibujados con un emoji parecido. */
    private static final String[] ICONOS = { "estrella", "agua", "libro", "pesas", "pasos", "bici", "sueno", "fruta", "ensalada", "mente", "pastilla", "musica", "escritura", "hoja", "sol", "corazon" };
    private static final String[] EMOJIS = { "⭐", "💧", "📖", "🏋️", "👣", "🚲", "🛏️", "🍎", "🥗", "🧠", "💊", "🎵", "✏️", "🍃", "☀️", "❤️" };
    private static final String[] COLORES_HABITO = { "#c2553d", "#d48a2c", "#b7a42e", "#4f8a4c", "#2f8f83", "#3f74b5", "#7a5fb0", "#b65583" };
    private static final String MORADO_EVENTO = "#9b5cd6";
    private static final String[] DIAS = { "L", "M", "M", "J", "V", "S", "D" };

    private int idWidget;
    private String tipoWidget;
    private int fondo, texto, tenue, suave, acento, sobreAcento;
    private float d;
    private JSONObject formulario;

    private LinearLayout tarjeta;
    private EditText campo;
    private TextView boton;

    // Lo elegido en el formulario.
    private String tipo;
    private final Calendar fecha = Calendar.getInstance();
    private String prioridad = "ninguna", dificultad = "ninguna";
    private String indole = null;
    private String colorEvento = null;
    private String icono = "estrella";
    private String colorHabito = COLORES_HABITO[4];
    private String frecuencia = "diaria";
    private final boolean[] diasHabito = new boolean[7];
    private int veces = 3;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        d = getResources().getDisplayMetrics().density;
        idWidget = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        tipoWidget = getIntent().getStringExtra(TareaRapida.EXTRA_TIPO);
        leerColores();
        JSONObject datos = Widgets.datos(this);
        formulario = datos == null ? null : datos.optJSONObject("formulario");
        try {
            fecha.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(TareaRapida.diaInicial(this, idWidget, tipoWidget)));
        } catch (Exception e) {
            // Queda hoy.
        }

        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Fondo oscurecido: tocar fuera cierra sin guardar.
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.argb(110, 0, 0, 0));
        raiz.setOnClickListener(v -> cerrar());

        tarjeta = new LinearLayout(this);
        tarjeta.setOrientation(LinearLayout.VERTICAL);
        tarjeta.setClickable(true);
        tarjeta.setPadding(px(16), px(14), px(16), px(12));
        tarjeta.setBackground(redondo(fondo, 0, 20));
        tarjeta.setElevation(px(8));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        lp.setMargins(px(12), px(48), px(12), px(12));
        raiz.addView(tarjeta, lp);
        setContentView(raiz);
        mostrarMenu();
    }

    // ---------- Paso 1: qué crear ----------

    private void mostrarMenu() {
        tarjeta.removeAllViews();
        tarjeta.addView(titulo("¿Qué quieres añadir?"));
        tarjeta.addView(opcion("☑️", "Tarea", () -> mostrarFormulario("tarea")));
        tarjeta.addView(opcion("📅", "Evento", () -> mostrarFormulario("evento")));
        tarjeta.addView(opcion("🔥", "Hábito", () -> mostrarFormulario("habito")));
    }

    private View opcion(String emoji, String nombre, Runnable alTocar) {
        TextView t = new TextView(this);
        t.setText(emoji + "   " + nombre);
        t.setTextColor(texto);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(px(14), px(13), px(14), px(13));
        t.setBackground(redondo(Color.TRANSPARENT, suave, 14));
        t.setOnClickListener(v -> alTocar.run());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = px(8);
        t.setLayoutParams(lp);
        return t;
    }

    // ---------- Paso 2: sus campos ----------

    private void mostrarFormulario(String elegido) {
        tipo = elegido;
        tarjeta.removeAllViews();
        boolean esTarea = "tarea".equals(tipo), esEvento = "evento".equals(tipo), esHabito = "habito".equals(tipo);
        tarjeta.addView(titulo(esTarea ? "Nueva tarea" : esEvento ? "Nuevo evento" : "Nuevo hábito"));

        // El formulario se desplaza si el teclado deja poco espacio; los botones quedan a la vista.
        ScrollView desplazable = new ScrollView(this);
        LinearLayout campos = new LinearLayout(this);
        campos.setOrientation(LinearLayout.VERTICAL);
        desplazable.addView(campos);
        tarjeta.addView(desplazable, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        campo = new EditText(this);
        campo.setHint(esTarea ? "Leer paper" : esEvento ? "Entrevista de trabajo" : "Tomar agua");
        campo.setHintTextColor(tenue);
        campo.setTextColor(texto);
        campo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        campo.setBackground(redondo(Color.TRANSPARENT, suave, 10));
        campo.setPadding(px(12), px(10), px(12), px(10));
        campo.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        campo.setImeOptions(EditorInfo.IME_ACTION_DONE);
        campo.setOnEditorActionListener((v, accion, ev) -> {
            ocultarTeclado();
            return true;
        });
        campos.addView(seccion(esHabito ? "Nombre" : esEvento ? "Evento" : "Tarea"));
        campos.addView(campo, ancho());

        if (!esHabito) {
            campos.addView(seccion("Fecha"));
            TextView chipFecha = chip("");
            pintarFecha(chipFecha);
            chipFecha.setOnClickListener(v -> elegirFecha(chipFecha));
            campos.addView(fila(chipFecha));
        }
        if (esTarea) {
            campos.addView(seccion("Importancia · urgencia y valor"));
            campos.addView(niveles(true));
            campos.addView(seccion("Dificultad · tiempo y esfuerzo"));
            campos.addView(niveles(false));
        }
        if (esEvento) {
            campos.addView(seccion("Color"));
            campos.addView(coloresEvento());
        }
        if (!esHabito) {
            campos.addView(seccion("Índole"));
            campos.addView(indoles());
        }
        if (esHabito) {
            campos.addView(seccion("Ícono"));
            campos.addView(iconos());
            campos.addView(seccion("Color"));
            campos.addView(coloresHabito());
            campos.addView(seccion("Frecuencia"));
            LinearLayout zonaFrecuencia = new LinearLayout(this);
            zonaFrecuencia.setOrientation(LinearLayout.VERTICAL);
            campos.addView(zonaFrecuencia);
            pintarFrecuencia(zonaFrecuencia);
        }

        // Cancelar y Añadir.
        LinearLayout botones = new LinearLayout(this);
        botones.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        TextView cancelar = new TextView(this);
        cancelar.setText("Cancelar");
        cancelar.setTextColor(texto);
        cancelar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancelar.setPadding(px(14), px(8), px(14), px(8));
        cancelar.setOnClickListener(v -> cerrar());
        botones.addView(cancelar);
        boton = new TextView(this);
        boton.setText(esTarea ? "Crear tarea" : esEvento ? "Crear evento" : "Crear hábito");
        boton.setTextColor(sobreAcento);
        boton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        boton.setTypeface(Typeface.DEFAULT_BOLD);
        boton.setPadding(px(16), px(8), px(16), px(8));
        boton.setBackground(redondo(acento, 0, 18));
        boton.setOnClickListener(v -> guardar());
        botones.addView(boton);
        LinearLayout.LayoutParams lb = ancho();
        lb.topMargin = px(12);
        tarjeta.addView(botones, lb);

        campo.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { pintarBoton(); }
        });
        pintarBoton();
        campo.requestFocus();
        campo.postDelayed(() -> {
            InputMethodManager teclado = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (teclado != null) teclado.showSoftInput(campo, InputMethodManager.SHOW_IMPLICIT);
        }, 150);
    }

    private View niveles(boolean importancia) {
        LinearLayout f = new LinearLayout(this);
        List<TextView> chips = new ArrayList<>();
        for (int i = 0; i < NIVELES.length; i++) {
            final String valor = NIVELES[i];
            TextView c = chip((importancia ? "⚑ " : "● ") + NOMBRES_NIVEL[i]);
            c.setTag(valor);
            chips.add(c);
            c.setOnClickListener(v -> {
                if (importancia) prioridad = valor;
                else dificultad = valor;
                for (TextView o : chips) pintarChip(o, valor.equals(o.getTag()));
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
            lp.rightMargin = px(4);
            f.addView(c, lp);
        }
        String actual = importancia ? prioridad : dificultad;
        for (int i = 0; i < chips.size(); i++) {
            TextView c = chips.get(i);
            pintarChip(c, actual.equals(c.getTag()));
            // La bandera o el punto van del color del nivel, como en la app.
            if (NUM_NIVEL[i] > 0) {
                String s = c.getText().toString();
                android.text.SpannableString sp = new android.text.SpannableString(s);
                sp.setSpan(new android.text.style.ForegroundColorSpan(FabricaListaHoy.colorNivel(this, NUM_NIVEL[i])), 0, 1, 0);
                c.setText(sp);
            }
        }
        return f;
    }

    private View indoles() {
        JSONArray lista = formulario == null ? null : formulario.optJSONArray("indoles");
        if (lista == null || lista.length() == 0) {
            TextView t = new TextView(this);
            t.setText("Abre Andamia una vez para ver tus etiquetas.");
            t.setTextColor(tenue);
            t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            return t;
        }
        LinearLayout f = new LinearLayout(this);
        List<TextView> chips = new ArrayList<>();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject e = lista.optJSONObject(i);
            if (e == null) continue;
            final String clave = e.optString("clave");
            final int color = colorSeguro(e.optString("color"), acento);
            TextView c = chip(e.optString("nombre"));
            c.setTag(clave);
            chips.add(c);
            c.setOnClickListener(v -> {
                indole = clave.equals(indole) ? null : clave;
                for (TextView o : chips) pintarIndole(o, (int) o.getTag(R.id.fondo_widget), o.getTag().equals(indole));
            });
            c.setTag(R.id.fondo_widget, color);
            pintarIndole(c, color, false);
            f.addView(c);
        }
        return desplazarHorizontal(f);
    }

    private void pintarIndole(TextView c, int color, boolean elegida) {
        c.setTextColor(color);
        c.setTypeface(Typeface.DEFAULT_BOLD);
        c.setBackground(redondo(elegida ? conAlfa(color, 46) : Color.TRANSPARENT, elegida ? color : conAlfa(color, 90), 16));
    }

    private View coloresEvento() {
        List<String> colores = new ArrayList<>();
        colores.add(null);
        JSONArray lista = formulario == null ? null : formulario.optJSONArray("coloresEvento");
        for (int i = 0; lista != null && i < lista.length(); i++) colores.add(lista.optString(i));
        if (lista == null) for (String c : COLORES_HABITO) colores.add(c);
        return circulos(colores, true);
    }

    private View coloresHabito() {
        List<String> colores = new ArrayList<>();
        JSONArray lista = formulario == null ? null : formulario.optJSONArray("coloresHabito");
        for (int i = 0; lista != null && i < lista.length(); i++) colores.add(lista.optString(i));
        if (colores.isEmpty()) for (String c : COLORES_HABITO) colores.add(c);
        if (!colores.contains(colorHabito)) colorHabito = colores.get(0);
        return circulos(colores, false);
    }

    /** Círculos de color; en eventos el primero es el morado por defecto (sin color propio). */
    private View circulos(List<String> colores, boolean deEvento) {
        LinearLayout f = new LinearLayout(this);
        List<TextView> todos = new ArrayList<>();
        for (String c : colores) {
            final String valor = c;
            TextView punto = new TextView(this);
            punto.setGravity(Gravity.CENTER);
            punto.setTextColor(Color.WHITE);
            punto.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            punto.setTag(valor == null ? "" : valor);
            todos.add(punto);
            punto.setOnClickListener(v -> {
                if (deEvento) colorEvento = valor;
                else colorHabito = valor;
                for (TextView o : todos) pintarCirculo(o, deEvento);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(px(30), px(30));
            lp.rightMargin = px(8);
            f.addView(punto, lp);
        }
        for (TextView o : todos) pintarCirculo(o, deEvento);
        return desplazarHorizontal(f);
    }

    private void pintarCirculo(TextView punto, boolean deEvento) {
        String valor = (String) punto.getTag();
        String elegido = deEvento ? (colorEvento == null ? "" : colorEvento) : colorHabito;
        boolean es = valor.equals(elegido);
        int color = colorSeguro(valor.isEmpty() ? MORADO_EVENTO : valor, acento);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(color);
        if (es) g.setStroke(px(2.5f), texto);
        punto.setBackground(g);
        punto.setText(es ? "✓" : "");
    }

    private View iconos() {
        LinearLayout f = new LinearLayout(this);
        List<TextView> todos = new ArrayList<>();
        for (int i = 0; i < ICONOS.length; i++) {
            final String clave = ICONOS[i];
            TextView t = new TextView(this);
            t.setText(EMOJIS[i]);
            t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
            t.setGravity(Gravity.CENTER);
            t.setTag(clave);
            todos.add(t);
            t.setOnClickListener(v -> {
                icono = clave;
                for (TextView o : todos) o.setBackground(redondo(o.getTag().equals(icono) ? conAlfa(acento, 60) : Color.TRANSPARENT, o.getTag().equals(icono) ? acento : suave, 10));
            });
            t.setBackground(redondo(clave.equals(icono) ? conAlfa(acento, 60) : Color.TRANSPARENT, clave.equals(icono) ? acento : suave, 10));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(px(38), px(38));
            lp.rightMargin = px(6);
            f.addView(t, lp);
        }
        return desplazarHorizontal(f);
    }

    /** Diaria, ciertos días o veces por semana, como en la app. */
    private void pintarFrecuencia(LinearLayout zona) {
        zona.removeAllViews();
        TextView diaria = chip("Diaria");
        TextView dias = chip("Algunos días");
        TextView semanal = chip("Veces por semana");
        pintarChip(diaria, "diaria".equals(frecuencia));
        pintarChip(dias, "dias".equals(frecuencia));
        pintarChip(semanal, "semanal".equals(frecuencia));
        diaria.setOnClickListener(v -> { frecuencia = "diaria"; pintarFrecuencia(zona); pintarBoton(); });
        dias.setOnClickListener(v -> { frecuencia = "dias"; pintarFrecuencia(zona); pintarBoton(); });
        semanal.setOnClickListener(v -> { frecuencia = "semanal"; pintarFrecuencia(zona); pintarBoton(); });
        LinearLayout f = new LinearLayout(this);
        f.addView(diaria);
        f.addView(dias);
        f.addView(semanal);
        zona.addView(desplazarHorizontal(f));

        if ("dias".equals(frecuencia)) {
            LinearLayout fd = new LinearLayout(this);
            for (int i = 0; i < 7; i++) {
                final int dia = i;
                TextView t = new TextView(this);
                t.setText(DIAS[i]);
                t.setGravity(Gravity.CENTER);
                t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                t.setTextColor(diasHabito[i] ? sobreAcento : texto);
                GradientDrawable g = new GradientDrawable();
                g.setShape(GradientDrawable.OVAL);
                g.setColor(diasHabito[i] ? acento : Color.TRANSPARENT);
                g.setStroke(Math.max(1, px(1)), diasHabito[i] ? acento : suave);
                t.setBackground(g);
                t.setOnClickListener(v -> { diasHabito[dia] = !diasHabito[dia]; pintarFrecuencia(zona); pintarBoton(); });
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(px(34), px(34));
                lp.rightMargin = px(5);
                fd.addView(t, lp);
            }
            LinearLayout.LayoutParams lp = ancho();
            lp.topMargin = px(8);
            zona.addView(fd, lp);
        } else if ("semanal".equals(frecuencia)) {
            LinearLayout fv = new LinearLayout(this);
            fv.setGravity(Gravity.CENTER_VERTICAL);
            TextView menos = chip("−");
            TextView cifra = new TextView(this);
            cifra.setText(veces + (veces == 1 ? " vez por semana" : " veces por semana"));
            cifra.setTextColor(texto);
            cifra.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            cifra.setPadding(px(4), 0, px(10), 0);
            TextView mas = chip("+");
            pintarChip(menos, false);
            pintarChip(mas, false);
            menos.setOnClickListener(v -> { veces = Math.max(1, veces - 1); pintarFrecuencia(zona); });
            mas.setOnClickListener(v -> { veces = Math.min(7, veces + 1); pintarFrecuencia(zona); });
            fv.addView(menos);
            fv.addView(cifra);
            fv.addView(mas);
            LinearLayout.LayoutParams lp = ancho();
            lp.topMargin = px(8);
            zona.addView(fv, lp);
        }
    }

    // ---------- Piezas ----------

    /** Los colores del tema elegido para ese widget (fondo opaco, para que se lea bien). */
    private void leerColores() {
        TemaWidget.usar(this, idWidget);
        fondo = FabricaListaHoy.color(this, R.color.widget_fondo) | 0xFF000000;
        texto = FabricaListaHoy.color(this, R.color.widget_texto);
        tenue = FabricaListaHoy.color(this, R.color.widget_texto_tenue);
        suave = FabricaListaHoy.color(this, R.color.widget_barra_fondo);
        acento = FabricaListaHoy.color(this, R.color.widget_acento);
        sobreAcento = FabricaListaHoy.color(this, R.color.widget_boton_texto);
    }

    private int px(float dp) {
        return Math.round(dp * d);
    }

    private static int conAlfa(int color, int alfa) {
        return Color.argb(alfa, Color.red(color), Color.green(color), Color.blue(color));
    }

    private static int colorSeguro(String s, int otro) {
        try {
            return s == null || s.isEmpty() ? otro : Color.parseColor(s);
        } catch (IllegalArgumentException e) {
            return otro;
        }
    }

    private LinearLayout.LayoutParams ancho() {
        return new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    }

    private GradientDrawable redondo(int relleno, int borde, float radioDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(relleno);
        g.setCornerRadius(radioDp * d);
        if (borde != 0) g.setStroke(Math.max(1, px(1)), borde);
        return g;
    }

    private TextView titulo(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextColor(texto);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, 0, 0, px(4));
        return t;
    }

    private TextView seccion(String s) {
        TextView t = new TextView(this);
        t.setText(s.toUpperCase(ES));
        t.setTextColor(tenue);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setPadding(0, px(12), 0, px(5));
        return t;
    }

    private TextView chip(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setGravity(Gravity.CENTER);
        t.setMaxLines(1);
        t.setPadding(px(10), px(7), px(10), px(7));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.rightMargin = px(6);
        t.setLayoutParams(lp);
        pintarChip(t, false);
        return t;
    }

    private void pintarChip(TextView t, boolean elegido) {
        t.setTextColor(texto);
        t.setTypeface(elegido ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        t.setBackground(elegido ? redondo(conAlfa(acento, 60), acento, 16) : redondo(Color.TRANSPARENT, suave, 16));
    }

    private View fila(View v) {
        LinearLayout f = new LinearLayout(this);
        f.addView(v);
        return f;
    }

    private View desplazarHorizontal(View contenido) {
        HorizontalScrollView h = new HorizontalScrollView(this);
        h.setHorizontalScrollBarEnabled(false);
        h.addView(contenido);
        return h;
    }

    private void pintarFecha(TextView chip) {
        Calendar hoy = Calendar.getInstance();
        Calendar manana = Calendar.getInstance();
        manana.add(Calendar.DAY_OF_YEAR, 1);
        String s;
        if (mismoDia(fecha, hoy)) s = "Hoy";
        else if (mismoDia(fecha, manana)) s = "Mañana";
        else s = new SimpleDateFormat("EEE d MMM", ES).format(fecha.getTime()).replace(".", "");
        chip.setText("📅  " + s);
    }

    private static boolean mismoDia(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    private void elegirFecha(TextView chip) {
        boolean oscuro = (Color.red(fondo) * 299 + Color.green(fondo) * 587 + Color.blue(fondo) * 114) / 1000 < 128;
        int tema = oscuro ? android.R.style.Theme_DeviceDefault_Dialog_Alert : android.R.style.Theme_DeviceDefault_Light_Dialog_Alert;
        new DatePickerDialog(this, tema, (v, a, m, dia) -> {
            fecha.set(a, m, dia);
            pintarFecha(chip);
        }, fecha.get(Calendar.YEAR), fecha.get(Calendar.MONTH), fecha.get(Calendar.DAY_OF_MONTH)).show();
    }

    private boolean valido() {
        if (campo == null || campo.getText().toString().trim().isEmpty()) return false;
        if ("habito".equals(tipo) && "dias".equals(frecuencia)) {
            for (boolean b : diasHabito) if (b) return true;
            return false;
        }
        return true;
    }

    private void pintarBoton() {
        if (boton != null) boton.setAlpha(valido() ? 1f : 0.45f);
    }

    private void guardar() {
        if (!valido()) return;
        JSONObject n = new JSONObject();
        try {
            n.put("tipo", tipo);
            n.put("titulo", campo.getText().toString().trim());
            n.put("fecha", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(("habito".equals(tipo) ? Calendar.getInstance() : fecha).getTime()));
            n.put("evento", "evento".equals(tipo));
            if ("tarea".equals(tipo)) {
                n.put("prioridad", prioridad);
                n.put("dificultad", dificultad);
            }
            if (!"habito".equals(tipo) && indole != null) n.put("indole", indole);
            if ("evento".equals(tipo) && colorEvento != null) n.put("color", colorEvento);
            if ("habito".equals(tipo)) {
                n.put("icono", icono);
                n.put("color", colorHabito);
                JSONObject f = new JSONObject();
                f.put("tipo", frecuencia);
                if ("dias".equals(frecuencia)) {
                    JSONArray dias = new JSONArray();
                    for (int i = 0; i < 7; i++) if (diasHabito[i]) dias.put(i);
                    f.put("dias", dias);
                }
                if ("semanal".equals(frecuencia)) f.put("veces", veces);
                n.put("frecuencia", f);
            }
        } catch (Exception e) {
            return;
        }
        TareaRapida.guardar(this, n);
        String aviso = "tarea".equals(tipo) ? "Tarea añadida a Andamia" : "evento".equals(tipo) ? "Evento añadido a Andamia" : "Hábito añadido a Andamia";
        Toast.makeText(getApplicationContext(), aviso, Toast.LENGTH_SHORT).show();
        cerrar();
    }

    private void ocultarTeclado() {
        InputMethodManager teclado = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (teclado != null && campo != null) teclado.hideSoftInputFromWindow(campo.getWindowToken(), 0);
    }

    private void cerrar() {
        ocultarTeclado();
        finish();
        overridePendingTransition(0, 0);
    }
}
