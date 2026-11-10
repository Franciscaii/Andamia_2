package cl.andamia.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
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

    static Bitmap calendario(Context c, JSONObject mes, int ancho, int alto, float d, int acento) {
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
        float y = m + 16 * d;
        escribir(lienzo, mes.optString("titulo"), m, y, ancho - 2 * m, titulo);

        // Nombres de los días.
        String[] dias = { "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom" };
        float anchoCelda = (ancho - 2 * m) / 7f;
        TextPaint cabecera = texto(colorTenue, 10.5f * d, false);
        cabecera.setTextAlign(Paint.Align.CENTER);
        y += 18 * d;
        for (int i = 0; i < 7; i++) lienzo.drawText(dias[i], m + anchoCelda * (i + 0.5f), y, cabecera);
        y += 6 * d;

        JSONArray celdas = mes.optJSONArray("celdas");
        if (celdas == null || celdas.length() == 0) return imagen;
        int filas = (celdas.length() + 6) / 7;
        float altoCelda = (alto - y - m) / filas;
        Paint linea = new Paint(Paint.ANTI_ALIAS_FLAG);
        linea.setColor(colorLinea);
        linea.setStrokeWidth(Math.max(1, d));
        Paint relleno = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(1.4f * d);

        TextPaint numero = texto(colorTexto, 11 * d, false);
        TextPaint entrada = texto(colorTexto, 9.5f * d, false);
        TextPaint mas = texto(colorTenue, 9 * d, false);
        float altoEntrada = 13 * d;

        for (int i = 0; i < celdas.length(); i++) {
            JSONObject celda = celdas.optJSONObject(i);
            if (celda == null) continue;
            float x0 = m + anchoCelda * (i % 7);
            float y0 = y + altoCelda * (i / 7);
            if (i % 7 == 0) lienzo.drawLine(m, y0, ancho - m, y0, linea);

            // Número del día; hoy va en un círculo del color del tema.
            boolean hoy = celda.optBoolean("hoy");
            boolean delMes = celda.optBoolean("delMes", true);
            String n = String.valueOf(celda.optInt("dia"));
            float cx = x0 + 9 * d;
            float cy = y0 + 9 * d;
            if (hoy) {
                relleno.setColor(acento);
                lienzo.drawCircle(cx, cy, 8 * d, relleno);
                numero.setColor(Color.WHITE);
                numero.setFakeBoldText(true);
            } else {
                numero.setColor(delMes ? colorTexto : conAlfa(colorTenue, 140));
                numero.setFakeBoldText(false);
            }
            numero.setTextAlign(Paint.Align.CENTER);
            lienzo.drawText(n, cx, cy + 4 * d, numero);

            // Entradas que caben; el resto como "+n".
            JSONArray entradas = celda.optJSONArray("entradas");
            int total = celda.optInt("total", entradas == null ? 0 : entradas.length());
            if (entradas == null || total == 0) continue;
            float libre = altoCelda - 20 * d;
            int caben = (int) Math.floor(libre / altoEntrada);
            if (caben < total) caben = Math.max(0, (int) Math.floor((libre - 10 * d) / altoEntrada));
            int mostradas = Math.min(caben, entradas.length());
            float ey = y0 + 20 * d;
            for (int k = 0; k < mostradas; k++) {
                JSONObject e = entradas.optJSONObject(k);
                if (e == null) continue;
                float ix = x0 + 2 * d;
                float anchoTexto = anchoCelda - 4 * d;
                if (e.optBoolean("evento")) {
                    int ce = colorSeguro(e.optString("color"), colorEvento);
                    relleno.setColor(conAlfa(ce, 60));
                    lienzo.drawRoundRect(new RectF(ix, ey, x0 + anchoCelda - 2 * d, ey + altoEntrada - 2 * d), 3 * d, 3 * d, relleno);
                    relleno.setColor(ce);
                    lienzo.drawRect(ix, ey, ix + 2 * d, ey + altoEntrada - 2 * d, relleno);
                    entrada.setStrikeThruText(false);
                    entrada.setColor(colorTexto);
                    escribir(lienzo, e.optString("titulo"), ix + 4 * d, ey + 8.5f * d, anchoTexto - 5 * d, entrada);
                } else {
                    boolean hecha = e.optBoolean("hecha");
                    borde.setColor(hecha ? colorTenue : FabricaListaHoy.colorNivel(c, e.optInt("nivel")));
                    float lado = 7 * d;
                    lienzo.drawRect(ix + 0.5f * d, ey + 1.5f * d, ix + 0.5f * d + lado, ey + 1.5f * d + lado, borde);
                    entrada.setStrikeThruText(hecha);
                    entrada.setColor(hecha ? colorTenue : colorTexto);
                    escribir(lienzo, e.optString("titulo"), ix + lado + 3 * d, ey + 8.5f * d, anchoTexto - lado - 3 * d, entrada);
                }
                ey += altoEntrada;
            }
            if (total > mostradas && libre >= 10 * d) lienzo.drawText("+" + (total - mostradas), x0 + 3 * d, ey + 7 * d, mas);
        }
        return imagen;
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

        // Barras apiladas por día de la semana.
        float base = alto - m - 12 * d;
        float tope = base - altoBarras + 14 * d;
        int maximo = 1;
        for (int i = 0; i < serie.length(); i++) {
            JSONArray v = serie.optJSONObject(i).optJSONArray("valores");
            int suma = 0;
            for (int k = 0; v != null && k < v.length(); k++) suma += v.optInt(k);
            maximo = Math.max(maximo, suma);
        }
        Paint lineaBase = new Paint();
        lineaBase.setColor(colorLinea);
        lineaBase.setStrokeWidth(Math.max(1, d));
        lienzo.drawLine(m, base, ancho - m, base, lineaBase);
        float paso = (ancho - 2 * m) / serie.length();
        float anchoBarra = Math.min(22 * d, paso * 0.6f);
        TextPaint dia = texto(colorTenue, 9.5f * d, false);
        dia.setTextAlign(Paint.Align.CENTER);
        Paint barra = new Paint(Paint.ANTI_ALIAS_FLAG);
        for (int i = 0; i < serie.length(); i++) {
            JSONObject s = serie.optJSONObject(i);
            float bx = m + paso * (i + 0.5f);
            float by = base;
            JSONArray v = s.optJSONArray("valores");
            for (int k = 0; v != null && k < v.length() && k < n; k++) {
                float h = (base - tope) * v.optInt(k) / maximo;
                if (h <= 0) continue;
                barra.setColor(colores[k]);
                lienzo.drawRect(bx - anchoBarra / 2f, by - h, bx + anchoBarra / 2f, by, barra);
                by -= h;
            }
            lienzo.drawText(s.optString("etiqueta"), bx, base + 11 * d, dia);
        }
        return imagen;
    }
}
