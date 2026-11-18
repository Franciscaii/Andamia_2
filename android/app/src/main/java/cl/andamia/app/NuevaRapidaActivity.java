package cl.andamia.app;

import android.app.Activity;
import android.app.DatePickerDialog;
import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
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
    /** Marca del círculo "otro color" de los hábitos. */
    private static final String PERSONALIZADO = "*";
    private static final String[] COLORES_HABITO = { "#c2553d", "#d48a2c", "#b7a42e", "#4f8a4c", "#2f8f83", "#3f74b5", "#7a5fb0", "#b65583" };
    private static final String MORADO_EVENTO = "#9b5cd6";
    private static final int ROJO = 0xFFD64545;
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
    private final Calendar inicioHabito = Calendar.getInstance();
    /** Último día del hábito; null = no termina. */
    private Calendar finHabito = null;
    private int metaHabito = 1;
    /** Si el hábito lanza confeti al completarlo (por defecto sí). */
    private boolean confetiHabito = true;
    /** Si viene, la ventana edita (o borra) esta tarea, evento o hábito en vez de crear uno nuevo. */
    private String editarId;
    private String textoInicial = "";
    private TextView botonEliminar;
    private boolean confirmandoEliminar;

    /** Interruptor dibujado a mano: el Switch del sistema salía casi invisible sobre este fondo. */
    private View interruptorConfeti() {
        final FrameLayout pista = new FrameLayout(this);
        final View bola = new View(this);
        int ancho = (int) (48 * d), alto = (int) (28 * d), diametro = (int) (22 * d), margen = (int) (3 * d);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ancho, alto);
        lp.topMargin = (int) (4 * d);
        pista.setLayoutParams(lp);
        FrameLayout.LayoutParams lb = new FrameLayout.LayoutParams(diametro, diametro);
        lb.topMargin = margen;
        bola.setLayoutParams(lb);
        android.graphics.drawable.GradientDrawable circulo = new android.graphics.drawable.GradientDrawable();
        circulo.setShape(android.graphics.drawable.GradientDrawable.OVAL);
        circulo.setColor(Color.WHITE);
        bola.setBackground(circulo);
        pista.addView(bola);
        pista.setContentDescription("Confeti al completarlo");
        final Runnable pintar = () -> {
            android.graphics.drawable.GradientDrawable fondo = new android.graphics.drawable.GradientDrawable();
            fondo.setCornerRadius(alto / 2f);
            fondo.setColor(confetiHabito ? acento : Color.rgb(190, 194, 200));
            pista.setBackground(fondo);
            FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) bola.getLayoutParams();
            p.leftMargin = confetiHabito ? ancho - diametro - margen : margen;
            bola.setLayoutParams(p);
        };
        pintar.run();
        pista.setOnClickListener(v -> {
            confetiHabito = !confetiHabito;
            pintar.run();
        });
        return pista;
    }

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        // La barra de navegación se veía blanca bajo la ventana: transparente y sin aviso de contraste.
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (android.os.Build.VERSION.SDK_INT >= 29) getWindow().setNavigationBarContrastEnforced(false);
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

        editarId = getIntent().getStringExtra("editar_id");
        String tipoEditar = getIntent().getStringExtra("editar_tipo");
        if (editarId != null) {
            JSONObject info = EdicionRapida.buscar(this, tipoEditar, editarId);
            if (info == null) {
                Toast.makeText(getApplicationContext(), "Abre Andamia una vez para poder editar esto desde el widget", Toast.LENGTH_LONG).show();
                finish();
                return;
            }
            precargar(info);
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
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER_VERTICAL);
        // Al medio de la pantalla, no pegada arriba.
        lp.setMargins(px(12), px(24), px(12), px(24));
        raiz.addView(tarjeta, lp);
        setContentView(raiz);
        // Con un filtro puesto en el widget (Tareas, Eventos o Hábitos), el "+" abre directo ese formulario;
        // con "Todos" se pregunta qué añadir.
        String filtro = idWidget == AppWidgetManager.INVALID_APPWIDGET_ID ? "todos" : DatosWidget.filtro(this, idWidget);
        if (editarId != null) mostrarFormulario(tipoEditar);
        else if ("tareas".equals(filtro)) mostrarFormulario("tarea");
        else if ("eventos".equals(filtro)) mostrarFormulario("evento");
        else if ("habitos".equals(filtro)) mostrarFormulario("habito");
        else mostrarMenu();
    }

    /** Pone en el formulario lo que ya tiene la tarea, el evento o el hábito que se edita. */
    private void precargar(JSONObject info) {
        textoInicial = info.optString("titulo");
        SimpleDateFormat formato = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        boolean habito = "habito".equals(info.optString("tipo"));
        try {
            Calendar dia = habito ? inicioHabito : fecha;
            if (!info.optString("fecha").isEmpty()) dia.setTime(formato.parse(info.optString("fecha")));
            if (habito && !info.optString("fin").isEmpty()) {
                finHabito = Calendar.getInstance();
                finHabito.setTime(formato.parse(info.optString("fin")));
            }
        } catch (Exception e) {
            // Queda la fecha de hoy.
        }
        for (int i = 0; i < NUM_NIVEL.length; i++) {
            if (NUM_NIVEL[i] == info.optInt("prioridad")) prioridad = NIVELES[i];
            if (NUM_NIVEL[i] == info.optInt("dificultad")) dificultad = NIVELES[i];
        }
        indole = info.optString("indole").isEmpty() ? null : info.optString("indole");
        if (habito) {
            if (!info.optString("icono").isEmpty()) icono = info.optString("icono");
            if (!info.optString("color").isEmpty()) colorHabito = info.optString("color");
            metaHabito = Math.max(1, Math.min(99, info.optInt("meta", 1)));
            confetiHabito = info.optBoolean("confeti", true);
            JSONObject f = info.optJSONObject("frecuencia");
            if (f != null) {
                frecuencia = f.optString("tipo", "diaria");
                JSONArray dias = f.optJSONArray("dias");
                for (int i = 0; dias != null && i < dias.length(); i++) {
                    int n = dias.optInt(i, -1);
                    if (n >= 0 && n < 7) diasHabito[n] = true;
                }
                veces = Math.max(1, Math.min(7, f.optInt("veces", 3)));
            }
        } else {
            colorEvento = info.optString("color").isEmpty() ? null : info.optString("color");
        }
    }

    // ---------- Paso 1: qué crear ----------

    private void mostrarMenu() {
        tarjeta.removeAllViews();
        tarjeta.addView(titulo("¿Qué quieres añadir?"));
        tarjeta.addView(opcion("✅", "Tarea", () -> mostrarFormulario("tarea")));
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
        if (editarId != null) tarjeta.addView(titulo(esTarea ? "Editar tarea" : esEvento ? "Editar evento" : "Editar hábito"));
        else tarjeta.addView(titulo(esTarea ? "Nueva tarea" : esEvento ? "Nuevo evento" : "Nuevo hábito"));

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
        if (editarId != null) {
            campo.setText(textoInicial);
            campo.setSelection(campo.getText().length());
        }
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
            // Igual que en la app: bajo el nombre, la fecha de inicio y la de fin (opcional).
            campos.addView(seccion("Fecha de inicio · Fecha de fin (opcional)"));
            LinearLayout zonaFechas = new LinearLayout(this);
            campos.addView(zonaFechas);
            pintarFechasHabito(zonaFechas);
            campos.addView(seccion("Ícono"));
            campos.addView(iconos());
            campos.addView(seccion("Color"));
            campos.addView(coloresHabito());
            campos.addView(seccion("Frecuencia"));
            LinearLayout zonaFrecuencia = new LinearLayout(this);
            zonaFrecuencia.setOrientation(LinearLayout.VERTICAL);
            campos.addView(zonaFrecuencia);
            pintarFrecuencia(zonaFrecuencia);
            campos.addView(seccion("Objetivo por día"));
            LinearLayout zonaMeta = new LinearLayout(this);
            zonaMeta.setGravity(Gravity.CENTER_VERTICAL);
            campos.addView(zonaMeta);
            pintarMeta(zonaMeta);
            campos.addView(seccion("Confeti al completarlo"));
            campos.addView(interruptorConfeti());
        }

        // Eliminar (solo al editar), Cancelar y Añadir o Guardar.
        LinearLayout botones = new LinearLayout(this);
        botones.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        if (editarId != null) {
            botonEliminar = new TextView(this);
            botonEliminar.setText("Eliminar");
            botonEliminar.setTextColor(ROJO);
            botonEliminar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            botonEliminar.setTypeface(Typeface.DEFAULT_BOLD);
            botonEliminar.setPadding(px(12), px(8), px(12), px(8));
            botonEliminar.setOnClickListener(v -> eliminar());
            botones.addView(botonEliminar);
            // Empuja Cancelar y Guardar a la derecha.
            botones.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1));
        }
        TextView cancelar = new TextView(this);
        cancelar.setText("Cancelar");
        cancelar.setTextColor(texto);
        cancelar.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cancelar.setPadding(px(14), px(8), px(14), px(8));
        cancelar.setOnClickListener(v -> cerrar());
        botones.addView(cancelar);
        boton = new TextView(this);
        boton.setText(editarId != null ? "Guardar" : esTarea ? "Crear tarea" : esEvento ? "Crear evento" : "Crear hábito");
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
        // El teclado no se abre solo: así la tarjeta se ve completa; aparece al tocar el nombre.
    }

    /** Chips de fecha de inicio y de fin del hábito; la de fin se puede quitar. */
    private void pintarFechasHabito(LinearLayout zona) {
        zona.removeAllViews();
        SimpleDateFormat formato = new SimpleDateFormat("d MMM yyyy", ES);
        boolean oscuro = (Color.red(fondo) * 299 + Color.green(fondo) * 587 + Color.blue(fondo) * 114) / 1000 < 128;
        int tema = oscuro ? android.R.style.Theme_DeviceDefault_Dialog_Alert : android.R.style.Theme_DeviceDefault_Light_Dialog_Alert;

        TextView inicio = chip("📅  " + (mismoDia(inicioHabito, Calendar.getInstance()) ? "Hoy" : formato.format(inicioHabito.getTime()).replace(".", "")));
        pintarChip(inicio, false);
        inicio.setOnClickListener(v -> new DatePickerDialog(this, tema, (x, a, m, dia) -> {
            inicioHabito.set(a, m, dia);
            // La fecha de fin nunca queda antes del inicio.
            if (finHabito != null && finHabito.before(inicioHabito)) finHabito = (Calendar) inicioHabito.clone();
            pintarFechasHabito(zona);
        }, inicioHabito.get(Calendar.YEAR), inicioHabito.get(Calendar.MONTH), inicioHabito.get(Calendar.DAY_OF_MONTH)).show());
        zona.addView(inicio);

        TextView fin = chip(finHabito == null ? "🏁  Sin fin" : "🏁  " + formato.format(finHabito.getTime()).replace(".", ""));
        pintarChip(fin, finHabito != null);
        fin.setOnClickListener(v -> {
            Calendar base = finHabito != null ? finHabito : inicioHabito;
            DatePickerDialog dialogo = new DatePickerDialog(this, tema, (x, a, m, dia) -> {
                Calendar elegida = (Calendar) inicioHabito.clone();
                elegida.set(a, m, dia);
                finHabito = elegida.before(inicioHabito) ? (Calendar) inicioHabito.clone() : elegida;
                pintarFechasHabito(zona);
            }, base.get(Calendar.YEAR), base.get(Calendar.MONTH), base.get(Calendar.DAY_OF_MONTH));
            dialogo.getDatePicker().setMinDate(inicioHabito.getTimeInMillis());
            dialogo.show();
        });
        zona.addView(fin);

        if (finHabito != null) {
            TextView quitar = chip("✕");
            pintarChip(quitar, false);
            quitar.setContentDescription("Quitar la fecha de fin");
            quitar.setOnClickListener(v -> { finHabito = null; pintarFechasHabito(zona); });
            zona.addView(quitar);
        }
    }

    /** Objetivo por día del hábito: menos, la cifra y más. */
    private void pintarMeta(LinearLayout zona) {
        zona.removeAllViews();
        TextView menos = chip("−");
        TextView cifra = new TextView(this);
        cifra.setText(metaHabito + (metaHabito == 1 ? " vez al día" : " veces al día"));
        cifra.setTextColor(texto);
        cifra.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        cifra.setPadding(px(4), 0, px(10), 0);
        TextView mas = chip("+");
        pintarChip(menos, false);
        pintarChip(mas, false);
        menos.setOnClickListener(v -> { metaHabito = Math.max(1, metaHabito - 1); pintarMeta(zona); });
        mas.setOnClickListener(v -> { metaHabito = Math.min(99, metaHabito + 1); pintarMeta(zona); });
        zona.addView(menos);
        zona.addView(cifra);
        zona.addView(mas);
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
        // Igual que en el hábito: el último círculo abre el selector de un color a elección.
        final List<String> fijos = new ArrayList<>();
        for (String c : colores) fijos.add(c == null ? "" : c);
        colores.add(PERSONALIZADO);
        return conSelector(colores, true, fijos);
    }

    private View coloresHabito() {
        List<String> colores = new ArrayList<>();
        JSONArray lista = formulario == null ? null : formulario.optJSONArray("coloresHabito");
        for (int i = 0; lista != null && i < lista.length(); i++) colores.add(lista.optString(i));
        if (colores.isEmpty()) for (String c : COLORES_HABITO) colores.add(c);
        // Al editar, un color a elección se queda como está.
        if (editarId == null && !colores.contains(colorHabito)) colorHabito = colores.get(0);
        // Además de los colores fijos, uno a elección: el último círculo abre el selector
        // (barra de tonos a la izquierda y cuadro de intensidad y brillo a la derecha).
        final List<String> fijos = new ArrayList<>(colores);
        colores.add(PERSONALIZADO);
        return conSelector(colores, false, fijos);
    }

    /** El color elegido del evento ("" si es el morado por defecto) o del hábito. */
    private String elegido(boolean deEvento) {
        return deEvento ? (colorEvento == null ? "" : colorEvento) : colorHabito;
    }

    private void elegir(boolean deEvento, String valor) {
        if (deEvento) colorEvento = valor == null || valor.isEmpty() ? null : valor;
        else colorHabito = valor;
    }

    /** La fila de círculos y, debajo, el selector de color a elección (oculto hasta tocar el último círculo). */
    private View conSelector(List<String> colores, final boolean deEvento, final List<String> fijos) {
        LinearLayout zona = new LinearLayout(this);
        zona.setOrientation(LinearLayout.VERTICAL);
        final SelectorColor selector = new SelectorColor(this);
        selector.setVisibility(View.GONE);
        final View fila = circulos(colores, deEvento, fijos, () -> {
            selector.poner(colorSeguro(elegido(deEvento), acento));
            selector.setVisibility(View.VISIBLE);
        });
        selector.alCambiar = color -> {
            elegir(deEvento, String.format(Locale.US, "#%06x", 0xFFFFFF & color));
            repintarCirculos(fila, deEvento, fijos);
        };
        zona.addView(fila, ancho());
        LinearLayout.LayoutParams ls = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, px(150));
        ls.topMargin = px(10);
        zona.addView(selector, ls);
        return zona;
    }

    /** Recibe el color que se va eligiendo en el selector. */
    private interface AlCambiarColor {
        void cambio(int color);
    }

    /**
     * Selector de color a elección: a la izquierda una barra vertical con todos los tonos y a la
     * derecha un cuadro donde se elige qué tan intenso (hacia la izquierda) y qué tan claro
     * (hacia arriba) es ese tono. Los dos se manejan arrastrando su círculo.
     */
    private static final class SelectorColor extends View {
        AlCambiarColor alCambiar;
        private final float[] hsv = { 200f, 0.62f, 0.8f };
        private final float d;
        private final Paint pintura = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF barra = new RectF();
        private final RectF cuadro = new RectF();
        private Shader tonos;
        private Shader sombra;
        /** 1 = se arrastra la barra de tonos; 2 = el cuadro; 0 = nada. */
        private int arrastrando;

        SelectorColor(Context c) {
            super(c);
            d = c.getResources().getDisplayMetrics().density;
            borde.setStyle(Paint.Style.STROKE);
        }

        void poner(int color) {
            Color.colorToHSV(color, hsv);
            invalidate();
        }

        @Override
        protected void onSizeChanged(int ancho, int alto, int anchoAntes, int altoAntes) {
            float margen = 10 * d;
            barra.set(margen, margen, margen + 8 * d, alto - margen);
            cuadro.set(barra.right + 22 * d, margen, ancho - margen, alto - margen);
            // De arriba hacia abajo: del rojo, pasando por morado, azul, verde y amarillo, de vuelta al rojo.
            int[] colores = new int[7];
            for (int i = 0; i < 7; i++) colores[i] = Color.HSVToColor(new float[] { 360f - i * 60f, 1f, 1f });
            tonos = new LinearGradient(0, barra.top, 0, barra.bottom, colores, null, Shader.TileMode.CLAMP);
            sombra = new LinearGradient(0, cuadro.top, 0, cuadro.bottom, Color.TRANSPARENT, Color.BLACK, Shader.TileMode.CLAMP);
        }

        @Override
        protected void onDraw(Canvas lienzo) {
            if (tonos == null) return;
            // Barra de tonos.
            pintura.setStyle(Paint.Style.FILL);
            pintura.setShader(tonos);
            lienzo.drawRoundRect(barra, barra.width() / 2f, barra.width() / 2f, pintura);
            // Cuadro: a la izquierda el tono puro, a la derecha blanco; hacia abajo se oscurece.
            int puro = Color.HSVToColor(new float[] { hsv[0], 1f, 1f });
            pintura.setShader(new LinearGradient(cuadro.left, 0, cuadro.right, 0, puro, Color.WHITE, Shader.TileMode.CLAMP));
            lienzo.drawRoundRect(cuadro, 4 * d, 4 * d, pintura);
            pintura.setShader(sombra);
            lienzo.drawRoundRect(cuadro, 4 * d, 4 * d, pintura);
            pintura.setShader(null);
            borde.setStrokeWidth(Math.max(1, d));
            borde.setColor(0x33000000);
            lienzo.drawRoundRect(cuadro, 4 * d, 4 * d, borde);

            // Círculo de la barra: relleno con el tono elegido.
            float yTono = barra.top + (1f - hsv[0] / 360f) * barra.height();
            circulo(lienzo, barra.centerX(), yTono, 9 * d, puro);
            // Círculo del cuadro: relleno con el color final.
            float x = cuadro.left + (1f - hsv[1]) * cuadro.width();
            float y = cuadro.top + (1f - hsv[2]) * cuadro.height();
            circulo(lienzo, x, y, 9 * d, Color.HSVToColor(hsv));
        }

        private void circulo(Canvas lienzo, float x, float y, float radio, int color) {
            pintura.setStyle(Paint.Style.FILL);
            pintura.setColor(color);
            lienzo.drawCircle(x, y, radio, pintura);
            borde.setStrokeWidth(2.5f * d);
            borde.setColor(Color.WHITE);
            lienzo.drawCircle(x, y, radio, borde);
            borde.setStrokeWidth(Math.max(1, d));
            borde.setColor(0x66000000);
            lienzo.drawCircle(x, y, radio + 1.5f * d, borde);
        }

        @Override
        public boolean onTouchEvent(MotionEvent e) {
            switch (e.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    // Lo que quede a la izquierda del cuadro mueve la barra de tonos.
                    arrastrando = e.getX() < cuadro.left - 8 * d ? 1 : 2;
                    // Mientras se arrastra, el formulario no se desplaza.
                    if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(true);
                    mover(e);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    mover(e);
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    arrastrando = 0;
                    if (getParent() != null) getParent().requestDisallowInterceptTouchEvent(false);
                    return true;
                default:
                    return super.onTouchEvent(e);
            }
        }

        private void mover(MotionEvent e) {
            if (arrastrando == 1) {
                float t = Math.min(1f, Math.max(0f, (e.getY() - barra.top) / Math.max(1f, barra.height())));
                // 359.9 y no 360: así arriba y abajo son rojo sin que el círculo salte de un extremo al otro.
                hsv[0] = Math.min(359.9f, (1f - t) * 360f);
            } else if (arrastrando == 2) {
                hsv[1] = 1f - Math.min(1f, Math.max(0f, (e.getX() - cuadro.left) / Math.max(1f, cuadro.width())));
                hsv[2] = 1f - Math.min(1f, Math.max(0f, (e.getY() - cuadro.top) / Math.max(1f, cuadro.height())));
            } else return;
            invalidate();
            if (alCambiar != null) alCambiar.cambio(Color.HSVToColor(hsv));
        }
    }

    /** Vuelve a pintar los círculos de una fila (están dentro de su desplazamiento horizontal). */
    private void repintarCirculos(View fila, boolean deEvento, List<String> fijos) {
        if (!(fila instanceof ViewGroup)) return;
        ViewGroup g = (ViewGroup) fila;
        for (int i = 0; i < g.getChildCount(); i++) {
            View v = g.getChildAt(i);
            if (v instanceof TextView && v.getTag() instanceof String) pintarCirculo((TextView) v, deEvento, fijos);
            else repintarCirculos(v, deEvento, fijos);
        }
    }

    /** Círculos de color; en eventos el primero es el morado por defecto (sin color propio). */
    private View circulos(List<String> colores, boolean deEvento, List<String> fijos, Runnable alPersonalizar) {
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
                if (PERSONALIZADO.equals(valor)) {
                    // Parte de un tono propio y muestra la barra para cambiarlo.
                    if (fijos != null && fijos.contains(elegido(deEvento))) elegir(deEvento, "#3d94cc");
                    if (alPersonalizar != null) alPersonalizar.run();
                } else elegir(deEvento, valor);
                for (TextView o : todos) pintarCirculo(o, deEvento, fijos);
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(px(30), px(30));
            lp.rightMargin = px(8);
            f.addView(punto, lp);
        }
        for (TextView o : todos) pintarCirculo(o, deEvento, fijos);
        return desplazarHorizontal(f);
    }

    private void pintarCirculo(TextView punto, boolean deEvento, List<String> fijos) {
        String valor = (String) punto.getTag();
        String elegido = elegido(deEvento);
        boolean propio = PERSONALIZADO.equals(valor);
        boolean es = propio ? fijos != null && !fijos.contains(elegido) : valor.equals(elegido);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        if (propio && !es) {
            // Sin elegir: un arcoíris, para que se entienda que es "otro color".
            g.setGradientType(GradientDrawable.SWEEP_GRADIENT);
            g.setColors(new int[] { 0xFFE5484D, 0xFFF5D90A, 0xFF30A46C, 0xFF00A2C7, 0xFF3E63DD, 0xFFD6409F, 0xFFE5484D });
        } else {
            g.setColor(colorSeguro(propio ? elegido : valor.isEmpty() ? MORADO_EVENTO : valor, acento));
        }
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
            n.put("fecha", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(("habito".equals(tipo) ? inicioHabito : fecha).getTime()));
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
                if (finHabito != null) n.put("fin", new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(finHabito.getTime()));
                n.put("meta", metaHabito);
                n.put("confeti", confetiHabito);
            }
        } catch (Exception e) {
            return;
        }
        if (editarId != null) {
            try {
                n.put("id", editarId);
                n.put("accion", "editar");
            } catch (Exception e) {
                return;
            }
            EdicionRapida.guardar(this, n);
            Toast.makeText(getApplicationContext(), "Cambios guardados", Toast.LENGTH_SHORT).show();
            cerrar();
            return;
        }
        TareaRapida.guardar(this, n);
        String aviso = "tarea".equals(tipo) ? "Tarea añadida a Andamia" : "evento".equals(tipo) ? "Evento añadido a Andamia" : "Hábito añadido a Andamia";
        Toast.makeText(getApplicationContext(), aviso, Toast.LENGTH_SHORT).show();
        cerrar();
    }

    /** Borra lo que se está editando; pide tocar dos veces para no borrar sin querer. */
    private void eliminar() {
        if (!confirmandoEliminar) {
            confirmandoEliminar = true;
            botonEliminar.setText("¿Seguro?");
            botonEliminar.setTextColor(Color.WHITE);
            botonEliminar.setBackground(redondo(ROJO, 0, 18));
            if ("habito".equals(tipo)) Toast.makeText(getApplicationContext(), "Se borra también su historial. Toca Eliminar otra vez para confirmar.", Toast.LENGTH_LONG).show();
            return;
        }
        JSONObject e = new JSONObject();
        try {
            e.put("id", editarId);
            e.put("accion", "eliminar");
            e.put("tipo", tipo);
        } catch (Exception ex) {
            return;
        }
        EdicionRapida.guardar(this, e);
        Toast.makeText(getApplicationContext(), "habito".equals(tipo) ? "Hábito eliminado" : "Enviado a la papelera de Andamia", Toast.LENGTH_SHORT).show();
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
