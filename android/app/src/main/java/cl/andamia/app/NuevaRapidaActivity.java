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
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Cuadro pequeño que se abre sobre la pantalla de inicio al tocar el "+" de los widgets Semana
 * y Calendario: se escribe la tarea o el evento y se guarda sin abrir Andamia (ver TareaRapida).
 */
public class NuevaRapidaActivity extends Activity {
    private static final Locale ES = new Locale("es", "CL");

    private EditText campo;
    private TextView chipTarea, chipEvento, chipFecha, boton;
    private boolean evento;
    private final Calendar fecha = Calendar.getInstance();
    private int fondo, texto, tenue, suave, acento, sobreAcento;
    private float d;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        d = getResources().getDisplayMetrics().density;
        int idWidget = getIntent().getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
        leerColores(idWidget);
        String inicial = TareaRapida.diaInicial(this, idWidget, getIntent().getStringExtra(TareaRapida.EXTRA_TIPO));
        try {
            fecha.setTime(new SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(inicial));
        } catch (Exception e) {
            // Queda hoy.
        }

        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
                | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        // Fondo oscurecido: tocar fuera cierra sin guardar.
        FrameLayout raiz = new FrameLayout(this);
        raiz.setBackgroundColor(Color.argb(110, 0, 0, 0));
        raiz.setOnClickListener(v -> cerrar());

        LinearLayout tarjeta = new LinearLayout(this);
        tarjeta.setOrientation(LinearLayout.VERTICAL);
        tarjeta.setClickable(true);
        tarjeta.setPadding(px(16), px(14), px(14), px(12));
        tarjeta.setBackground(redondo(fondo, 0, 20));
        tarjeta.setElevation(px(8));
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        lp.setMargins(px(12), px(56), px(12), 0);
        raiz.addView(tarjeta, lp);

        campo = new EditText(this);
        campo.setHint("¿Qué necesitas hacer?");
        campo.setHintTextColor(tenue);
        campo.setTextColor(texto);
        campo.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        campo.setBackground(null);
        campo.setPadding(0, 0, 0, 0);
        campo.setMinLines(2);
        campo.setGravity(Gravity.TOP | Gravity.START);
        campo.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        campo.setImeOptions(EditorInfo.IME_ACTION_DONE);
        campo.setOnEditorActionListener((v, accion, ev) -> {
            guardar();
            return true;
        });
        tarjeta.addView(campo, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout fila = new LinearLayout(this);
        fila.setOrientation(LinearLayout.HORIZONTAL);
        fila.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams lf = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lf.topMargin = px(12);
        tarjeta.addView(fila, lf);

        chipTarea = chip("Tarea");
        chipTarea.setOnClickListener(v -> elegirTipo(false));
        chipEvento = chip("Evento");
        chipEvento.setOnClickListener(v -> elegirTipo(true));
        chipFecha = chip("");
        chipFecha.setOnClickListener(v -> elegirFecha());
        fila.addView(chipTarea);
        fila.addView(chipEvento);
        fila.addView(chipFecha);
        View hueco = new View(this);
        fila.addView(hueco, new LinearLayout.LayoutParams(0, 1, 1));

        boton = new TextView(this);
        boton.setText("Añadir");
        boton.setTextColor(sobreAcento);
        boton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        boton.setTypeface(Typeface.DEFAULT_BOLD);
        boton.setGravity(Gravity.CENTER);
        boton.setPadding(px(14), px(7), px(14), px(7));
        boton.setBackground(redondo(acento, 0, 18));
        boton.setOnClickListener(v -> guardar());
        fila.addView(boton);

        campo.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) { pintarBoton(); }
        });

        setContentView(raiz);
        elegirTipo(false);
        pintarFecha();
        pintarBoton();
        campo.requestFocus();
        campo.postDelayed(() -> {
            InputMethodManager teclado = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
            if (teclado != null) teclado.showSoftInput(campo, InputMethodManager.SHOW_IMPLICIT);
        }, 150);
    }

    /** Los colores del tema elegido para ese widget (fondo opaco, para que se lea bien). */
    private void leerColores(int idWidget) {
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

    private GradientDrawable redondo(int relleno, int borde, float radioDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(relleno);
        g.setCornerRadius(radioDp * d);
        if (borde != 0) g.setStroke(Math.max(1, px(1)), borde);
        return g;
    }

    private TextView chip(String s) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        t.setGravity(Gravity.CENTER);
        t.setMaxLines(1);
        t.setPadding(px(10), px(6), px(10), px(6));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.rightMargin = px(6);
        t.setLayoutParams(lp);
        return t;
    }

    private void pintarChip(TextView t, boolean elegido) {
        t.setTextColor(elegido ? sobreAcento : texto);
        t.setBackground(elegido ? redondo(acento, 0, 16) : redondo(Color.TRANSPARENT, suave, 16));
    }

    private void elegirTipo(boolean esEvento) {
        evento = esEvento;
        pintarChip(chipTarea, !esEvento);
        pintarChip(chipEvento, esEvento);
        campo.setHint(esEvento ? "¿Qué evento tienes?" : "¿Qué necesitas hacer?");
    }

    private void pintarFecha() {
        Calendar hoy = Calendar.getInstance();
        Calendar manana = Calendar.getInstance();
        manana.add(Calendar.DAY_OF_YEAR, 1);
        String s;
        if (mismoDia(fecha, hoy)) s = "Hoy";
        else if (mismoDia(fecha, manana)) s = "Mañana";
        else s = new SimpleDateFormat("EEE d MMM", ES).format(fecha.getTime()).replace(".", "");
        chipFecha.setText("📅 " + s);
        pintarChip(chipFecha, false);
    }

    private static boolean mismoDia(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR) && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }

    private void elegirFecha() {
        boolean oscuro = (Color.red(fondo) * 299 + Color.green(fondo) * 587 + Color.blue(fondo) * 114) / 1000 < 128;
        int tema = oscuro ? android.R.style.Theme_DeviceDefault_Dialog_Alert : android.R.style.Theme_DeviceDefault_Light_Dialog_Alert;
        new DatePickerDialog(this, tema, (v, a, m, dia) -> {
            fecha.set(a, m, dia);
            pintarFecha();
        }, fecha.get(Calendar.YEAR), fecha.get(Calendar.MONTH), fecha.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void pintarBoton() {
        boolean hay = campo.getText().toString().trim().length() > 0;
        boton.setAlpha(hay ? 1f : 0.45f);
    }

    private void guardar() {
        String titulo = campo.getText().toString().trim();
        if (titulo.isEmpty()) return;
        String dia = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(fecha.getTime());
        TareaRapida.guardar(this, titulo, dia, evento);
        Toast.makeText(getApplicationContext(), evento ? "Evento añadido a Andamia" : "Tarea añadida a Andamia", Toast.LENGTH_SHORT).show();
        cerrar();
    }

    private void cerrar() {
        InputMethodManager teclado = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
        if (teclado != null && campo != null) teclado.hideSoftInputFromWindow(campo.getWindowToken(), 0);
        finish();
        overridePendingTransition(0, 0);
    }
}
