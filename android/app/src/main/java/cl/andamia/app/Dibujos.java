package cl.andamia.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.text.TextPaint;
import android.text.TextUtils;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Dibuja como imagen los widgets que no son listas: el calendario del mes y las
 * estadísticas de la semana (círculo por etiqueta o hábito y barras por día).
 * Los colores de fondo y texto siguen el modo claro u oscuro del celular.
 */
final class Dibujos {
    private Dibujos() {}

    private static int color(Context c, int recurso) {
        return FabricaListaHoy.color(c, recurso);
    }

    private static int colorSeguro(String texto, int otro) {
        try {
            return texto == null || texto.isEmpty() ? otro : Color.parseColor(texto);
        } catch (IllegalArgumentException e) {
            return otro;
        }
    }

    private static int conAlfa(int color, int alfa) {
        return Color.argb(alfa, Color.red(color), Color.green(color), Color.blue(color));
    }

    private static TextPaint texto(int color, float tamano, boolean negrita) {
        TextPaint p = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        p.setTextSize(tamano);
        p.setTypeface(negrita ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        return p;
    }

    private static void escribir(Canvas lienzo, String s, float x, float y, float ancho, TextPaint p) {
        if (ancho <= 0) return;
        CharSequence corto = TextUtils.ellipsize(s, p, ancho, TextUtils.TruncateAt.END);
        lienzo.drawText(corto, 0, corto.length(), x, y, p);
    }

    private static void mensaje(Canvas lienzo, String s, int ancho, int alto, TextPaint p) {
        p.setTextAlign(Paint.Align.CENTER);
        lienzo.drawText(s, ancho / 2f, alto / 2f, p);
        p.setTextAlign(Paint.Align.LEFT);
    }

    // ---------- Calendario ----------

    static Bitmap calendario(Context c, JSONObject mes, int ancho, int alto, float d, int acento, String filtro, boolean conTitulo) {
        Bitmap imagen = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(imagen);
        int colorTexto = color(c, R.color.widget_texto);
        int colorTenue = color(c, R.color.widget_texto_tenue);
        int colorLinea = color(c, R.color.widget_barra_fondo);
        int colorEvento = color(c, R.color.widget_evento);
        float m = 12 * d;

        TextPaint titulo = texto(colorTexto, 16 * d, true);
        if (mes == null) {
            mensaje(lienzo, "Abre Andamia para ver tu mes", ancho, alto, texto(colorTenue, 13 * d, false));
            return imagen;
        }
        // Con controles arriba (widget Calendario), el mes va sin márgenes y sin título propio.
        if (!conTitulo) m = 0;
        float y = conTitulo ? m + 16 * d : -8 * d;
        if (conTitulo) escribir(lienzo, mes.optString("titulo"), m, y, ancho - 2 * m, titulo);
        boolean soloTareas = "tareas".equals(filtro);
        boolean soloEventos = "eventos".equals(filtro);

        // Nombres de los días, en mayúsculas y grandes como el calendario del celular (sin domingo rojo).
        String[] dias = { "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM" };
        float anchoCelda = (ancho - 2 * m) / 7f;
        JSONArray celdas = mes.optJSONArray("celdas");
        if (celdas == null || celdas.length() == 0) return imagen;
        int filas = (celdas.length() + 6) / 7;
        float tamCabecera = Math.min(13.5f * d, anchoCelda * 0.3f);
        TextPaint cabecera = texto(conAlfa(colorTexto, 210), tamCabecera, false);
        cabecera.setTextAlign(Paint.Align.CENTER);
        y += 8 * d + tamCabecera * 1.4f;
        for (int i = 0; i < 7; i++) {
            lienzo.drawText(dias[i], m + anchoCelda * (i + 0.5f), y, cabecera);
        }
        y += 7 * d;
        Paint linea = new Paint(Paint.ANTI_ALIAS_FLAG);
        linea.setColor(colorLinea);
        linea.setStrokeWidth(Math.max(1, d));
        lienzo.drawLine(m, y, ancho - m, y, linea);

        float altoCelda = (alto - y - Math.max(m, 2 * d)) / filas;
        Paint relleno = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);

        float tamNumero = Math.max(10 * d, Math.min(16.5f * d, Math.min(altoCelda * 0.26f, anchoCelda * 0.38f)));
        TextPaint numero = texto(colorTexto, tamNumero, false);
        numero.setTextAlign(Paint.Align.CENTER);
        float tamEntrada = Math.max(8.5f * d, Math.min(12f * d, anchoCelda * 0.26f));
        TextPaint entrada = texto(colorTexto, tamEntrada, false);
        TextPaint mas = texto(colorTenue, tamEntrada * 0.9f, false);
        float altoLinea = tamEntrada * 1.22f;
        float arribaEntradas = tamNumero * 1.7f;

        for (int i = 0; i < celdas.length(); i++) {
            JSONObject celda = celdas.optJSONObject(i);
            if (celda == null) continue;
            int col = i % 7;
            float x0 = m + anchoCelda * col;
            float y0 = y + altoCelda * (i / 7);
            if (col == 0 && i > 0) lienzo.drawLine(m, y0, ancho - m, y0, linea);
            boolean hoy = celda.optBoolean("hoy");
            boolean delMes = celda.optBoolean("delMes", true);
            int alfa = delMes ? 255 : 110;

            // Hoy: recuadro redondeado alrededor de toda la celda y el número resaltado.
            float cx = x0 + anchoCelda / 2f;
            float base = y0 + 4 * d + tamNumero;
            if (hoy) {
                borde.setColor(conAlfa(colorTexto, 200));
                borde.setStrokeWidth(1.5f * d);
                lienzo.drawRoundRect(new RectF(x0 + 1.5f * d, y0 + 1.5f * d, x0 + anchoCelda - 1.5f * d, y0 + altoCelda - 1.5f * d), 7 * d, 7 * d, borde);
                float lado = tamNumero * 1.45f;
                relleno.setColor(acento);
                lienzo.drawRoundRect(new RectF(cx - lado / 2f, base - tamNumero * 0.36f - lado / 2f, cx + lado / 2f, base - tamNumero * 0.36f + lado / 2f), 5 * d, 5 * d, relleno);
                numero.setColor(Color.WHITE);
                numero.setFakeBoldText(true);
            } else {
                numero.setColor(conAlfa(colorTexto, alfa));
                numero.setFakeBoldText(false);
            }
            lienzo.drawText(String.valueOf(celda.optInt("dia")), cx, base, numero);

            // Entradas del filtro elegido (Tareas, Eventos o Todos).
            JSONArray todas = celda.optJSONArray("entradas");
            int total = celda.optInt("total", todas == null ? 0 : todas.length());
            int eventos = celda.optInt("eventos", 0);
            if (soloTareas) total -= eventos;
            if (soloEventos) total = eventos;
            JSONArray entradas = new JSONArray();
            for (int k = 0; todas != null && k < todas.length(); k++) {
                JSONObject e = todas.optJSONObject(k);
                if (e == null) continue;
                boolean esEvento = e.optBoolean("evento");
                if ((soloTareas && esEvento) || (soloEventos && !esEvento)) continue;
                entradas.put(e);
            }
            if (total <= 0 || entradas.length() == 0) continue;

            // Cada entrada en un bloque con barra de color; dos líneas si caben todas así.
            float libre = altoCelda - arribaEntradas - 2 * d;
            float hueco = 2 * d;
            int lineas = libre >= Math.min(total, entradas.length()) * (2 * altoLinea + hueco) ? 2 : 1;
            float altoBloque = lineas * altoLinea + hueco;
            int caben = (int) Math.floor(libre / altoBloque);
            if (caben < total) {
                lineas = 1;
                altoBloque = altoLinea + hueco;
                caben = (int) Math.floor(libre / altoBloque);
                if (caben < total) caben = Math.max(0, (int) Math.floor((libre - altoLinea) / altoBloque));
            }
            int mostradas = Math.min(caben, entradas.length());
            float ey = y0 + arribaEntradas;
            float ix = x0 + 2 * d;
            float fx = x0 + anchoCelda - 2 * d;
            for (int k = 0; k < mostradas; k++) {
                JSONObject e = entradas.optJSONObject(k);
                if (e == null) continue;
                boolean esEvento = e.optBoolean("evento");
                boolean hecha = e.optBoolean("hecha");
                int ce = esEvento ? colorSeguro(e.optString("color"), colorEvento) : FabricaListaHoy.colorNivel(c, e.optInt("nivel"));
                if (hecha) ce = colorTenue;
                float alto0 = lineas * altoLinea;
                if (esEvento) {
                    relleno.setColor(conAlfa(ce, delMes ? 70 : 35));
                    lienzo.drawRoundRect(new RectF(ix, ey, fx, ey + alto0), 3 * d, 3 * d, relleno);
                }
                relleno.setColor(conAlfa(ce, alfa));
                lienzo.drawRoundRect(new RectF(ix, ey, ix + 2.5f * d, ey + alto0), 1.2f * d, 1.2f * d, relleno);
                entrada.setStrikeThruText(hecha);
                entrada.setColor(conAlfa(hecha ? colorTenue : colorTexto, alfa));
                partido(lienzo, e.optString("titulo"), ix + 4.5f * d, ey, fx - ix - 5 * d, lineas, altoLinea, entrada);
                ey += altoBloque;
            }
            if (total > mostradas) {
                mas.setColor(conAlfa(colorTenue, alfa));
                lienzo.drawText("+" + (total - mostradas), ix + 2 * d, ey + tamEntrada * 0.95f, mas);
            }
        }
        return imagen;
    }

    /** Escribe el texto cortado por letras en hasta "lineas" renglones, como el calendario del celular. */
    private static void partido(Canvas lienzo, String s, float x, float y, float ancho, int lineas, float altoLinea, TextPaint p) {
        if (ancho <= 0 || s == null) return;
        int desde = 0;
        for (int l = 0; l < lineas && desde < s.length(); l++) {
            int n = p.breakText(s, desde, s.length(), true, ancho, null);
            if (n <= 0) break;
            lienzo.drawText(s, desde, desde + n, x, y + altoLinea * (l + 1) - altoLinea * 0.25f, p);
            desde += n;
            while (desde < s.length() && s.charAt(desde) == ' ') desde++;
        }
    }

    // ---------- Estadísticas ----------

    static Bitmap estadisticas(Context c, JSONObject r, boolean habitos, int ancho, int alto, float d, int acento) {
        Bitmap imagen = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(imagen);
        int colorTexto = color(c, R.color.widget_texto);
        int colorTenue = color(c, R.color.widget_texto_tenue);
        int colorLinea = color(c, R.color.widget_barra_fondo);
        float m = 12 * d;

        String nombre = habitos ? "Hábitos cumplidos" : "Tareas completadas";
        if (r == null) {
            mensaje(lienzo, "Abre Andamia para ver tus estadísticas", ancho, alto, texto(colorTenue, 13 * d, false));
            return imagen;
        }
        float y = m + 16 * d;
        escribir(lienzo, nombre, m, y, ancho - 2 * m, texto(colorTexto, 16 * d, true));
        y += 16 * d;
        escribir(lienzo, "Semana · " + r.optString("periodo"), m, y, ancho - 2 * m, texto(colorTenue, 11 * d, false));
        y += 10 * d;

        int total = r.optInt("total");
        JSONArray filas = r.optJSONArray("filas");
        if (total == 0 || filas == null || filas.length() == 0) {
            TextPaint p = texto(colorTenue, 13 * d, false);
            p.setTextAlign(Paint.Align.CENTER);
            lienzo.drawText(habitos ? "Aún no cumples hábitos esta semana." : "Aún no completas tareas esta semana.", ancho / 2f, (y + alto) / 2f, p);
            return imagen;
        }
        int n = filas.length();
        int[] colores = new int[n];
        for (int i = 0; i < n; i++) colores[i] = colorSeguro(filas.optJSONObject(i).optString("color"), acento);

        // Barras por día solo si hay alto para ellas.
        JSONArray serie = r.optJSONArray("serie");
        boolean conBarras = serie != null && serie.length() > 0 && (alto - y) > 190 * d;
        float altoBarras = conBarras ? Math.min(110 * d, (alto - y) * 0.42f) : 0;

        // Círculo con el total al centro y la leyenda al lado.
        float zona = alto - y - m - (conBarras ? altoBarras + 10 * d : 0);
        float diametro = Math.min(zona - 8 * d, (ancho - 2 * m) * 0.45f);
        float cx = m + diametro / 2f;
        float cy = y + 6 * d + zona / 2f;
        RectF caja = new RectF(cx - diametro / 2f, cy - diametro / 2f, cx + diametro / 2f, cy + diametro / 2f);
        Paint arco = new Paint(Paint.ANTI_ALIAS_FLAG);
        arco.setStyle(Paint.Style.STROKE);
        float grosor = Math.max(6 * d, diametro * 0.16f);
        arco.setStrokeWidth(grosor);
        caja.inset(grosor / 2f, grosor / 2f);
        float inicio = -90;
        for (int i = 0; i < n; i++) {
            float barrido = 360f * filas.optJSONObject(i).optInt("cantidad") / total;
            arco.setColor(colores[i]);
            lienzo.drawArc(caja, inicio, Math.max(0.5f, barrido - (n > 1 ? 1.5f : 0)), false, arco);
            inicio += barrido;
        }
        TextPaint grande = texto(colorTexto, Math.max(14 * d, diametro * 0.2f), true);
        grande.setTextAlign(Paint.Align.CENTER);
        lienzo.drawText(String.valueOf(total), cx, cy + grande.getTextSize() * 0.35f, grande);

        float lx = m + diametro + 14 * d;
        float anchoLeyenda = ancho - m - lx;
        float filaAlto = 18 * d;
        float ly = cy - Math.min(n, (int) (zona / filaAlto)) * filaAlto / 2f + 12 * d;
        TextPaint leyenda = texto(colorTexto, 11.5f * d, false);
        TextPaint cifra = texto(colorTenue, 11 * d, false);
        cifra.setTextAlign(Paint.Align.RIGHT);
        Paint punto = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < n && ly < y + zona + 6 * d; i++) {
            JSONObject f = filas.optJSONObject(i);
            punto.setColor(colores[i]);
            lienzo.drawCircle(lx + 4 * d, ly - 4 * d, 4 * d, punto);
            String dato = f.optInt("cantidad") + " · " + f.optInt("porcentaje") + "%";
            float anchoDato = cifra.measureText(dato);
            escribir(lienzo, f.optString("nombre"), lx + 12 * d, ly, anchoLeyenda - 16 * d - anchoDato, leyenda);
            lienzo.drawText(dato, ancho - m, ly, cifra);
            ly += filaAlto;
        }

        if (!conBarras) return imagen;

        // Ondas suaves superpuestas por día, como el gráfico "En el tiempo" de la app.
        float base = alto - m - 12 * d;
        float tope = base - altoBarras + 14 * d;
        int dias = serie.length();
        int maximo = 1;
        int[] sumas = new int[n];
        for (int i = 0; i < dias; i++) {
            JSONArray v = serie.optJSONObject(i).optJSONArray("valores");
            for (int k = 0; v != null && k < v.length() && k < n; k++) {
                maximo = Math.max(maximo, v.optInt(k));
                sumas[k] += v.optInt(k);
            }
        }
        Paint lineaBase = new Paint();
        lineaBase.setColor(colorLinea);
        lineaBase.setStrokeWidth(Math.max(1, d));
        lienzo.drawLine(m, base, ancho - m, base, lineaBase);
        float paso = dias > 1 ? (ancho - 2 * m) / (dias - 1) : 0;
        // Los grupos más grandes van detrás para que los chicos se vean.
        Integer[] orden = new Integer[n];
        for (int k = 0; k < n; k++) orden[k] = k;
        java.util.Arrays.sort(orden, (a, b) -> sumas[b] - sumas[a]);
        Paint area = new Paint(Paint.ANTI_ALIAS_FLAG);
        area.setStyle(Paint.Style.FILL);
        Paint trazo = new Paint(Paint.ANTI_ALIAS_FLAG);
        trazo.setStyle(Paint.Style.STROKE);
        trazo.setStrokeWidth(2 * d);
        trazo.setStrokeJoin(Paint.Join.ROUND);
        trazo.setStrokeCap(Paint.Cap.ROUND);
        for (int o = 0; o < n; o++) {
            int k = orden[o];
            if (sumas[k] == 0) continue;
            float[] xs = new float[dias];
            float[] ys = new float[dias];
            for (int i = 0; i < dias; i++) {
                JSONArray v = serie.optJSONObject(i).optJSONArray("valores");
                int valor = v == null ? 0 : v.optInt(k);
                xs[i] = dias > 1 ? m + paso * i : ancho / 2f;
                ys[i] = base - (base - tope) * valor / maximo;
            }
            Path linea = curvaSuave(xs, ys);
            Path relleno = new Path(linea);
            relleno.lineTo(xs[dias - 1], base);
            relleno.lineTo(xs[0], base);
            relleno.close();
            area.setShader(new LinearGradient(0, tope, 0, base, conAlfa(colores[k], 190), conAlfa(colores[k], 20), Shader.TileMode.CLAMP));
            lienzo.drawPath(relleno, area);
            trazo.setColor(colores[k]);
            lienzo.drawPath(linea, trazo);
        }
        TextPaint dia = texto(colorTenue, 9.5f * d, false);
        for (int i = 0; i < dias; i++) {
            float bx = dias > 1 ? m + paso * i : ancho / 2f;
            dia.setTextAlign(i == 0 && dias > 1 ? Paint.Align.LEFT : i == dias - 1 && dias > 1 ? Paint.Align.RIGHT : Paint.Align.CENTER);
            lienzo.drawText(serie.optJSONObject(i).optString("etiqueta"), bx, base + 11 * d, dia);
        }
        return imagen;
    }

    /** Curva B-spline como curveBasis de d3, la misma que usa el gráfico de la app. */
    private static Path curvaSuave(float[] xs, float[] ys) {
        Path p = new Path();
        int n = xs.length;
        p.moveTo(xs[0], ys[0]);
        if (n == 1) return p;
        if (n == 2) { p.lineTo(xs[1], ys[1]); return p; }
        p.lineTo((5 * xs[0] + xs[1]) / 6, (5 * ys[0] + ys[1]) / 6);
        for (int i = 2; i <= n; i++) {
            float x0 = xs[i - 2], y0 = ys[i - 2], x1 = xs[i - 1], y1 = ys[i - 1];
            float x = i < n ? xs[i] : x1, y = i < n ? ys[i] : y1;
            p.cubicTo((2 * x0 + x1) / 3, (2 * y0 + y1) / 3, (x0 + 2 * x1) / 3, (y0 + 2 * y1) / 3, (x0 + 4 * x1 + x) / 6, (y0 + 4 * y1 + y) / 6);
        }
        p.lineTo(xs[n - 1], ys[n - 1]);
        return p;
    }
}
