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
        // El tamaño de letra elegido para el widget en el apartado Widgets.
        p.setTextSize(tamano * TemaWidget.letra());
        p.setTypeface(negrita ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
        return p;
    }

    private static void escribir(Canvas lienzo, String s, float x, float y, float ancho, TextPaint p) {
        if (ancho <= 0) return;
        CharSequence corto = TextUtils.ellipsize(s, p, ancho, TextUtils.TruncateAt.END);
        lienzo.drawText(corto, 0, corto.length(), x, y, p);
    }

    // ---------- Interruptor de un hábito ----------

    /**
     * Perilla del interruptor de un hábito (30×30 dp): un círculo blanco con sombra suave y el ✓
     * trazado, del color del hábito cuando está hecho y gris tenue si no. El riel largo lo pone el diseño.
     */
    static Bitmap perilla(float d, boolean hecho, int color) {
        int lado = Math.round(30 * d);
        Bitmap imagen = Bitmap.createBitmap(lado, lado, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(imagen);
        float cx = lado / 2f, cy = lado / 2f;
        float r = lado / 2f - 4 * d;

        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(Color.WHITE);
        p.setShadowLayer(2.4f * d, 0, 1.1f * d, Color.argb(hecho ? 90 : 60, 0, 0, 0));
        lienzo.drawCircle(cx, cy, r, p);
        p.clearShadowLayer();

        Paint tick = new Paint(Paint.ANTI_ALIAS_FLAG);
        tick.setStyle(Paint.Style.STROKE);
        tick.setStrokeWidth(2.1f * d);
        tick.setStrokeCap(Paint.Cap.ROUND);
        tick.setStrokeJoin(Paint.Join.ROUND);
        tick.setColor(hecho ? color : Color.argb(70, 110, 116, 128));
        Path trazo = new Path();
        trazo.moveTo(cx - r * 0.42f, cy + r * 0.02f);
        trazo.lineTo(cx - r * 0.10f, cy + r * 0.34f);
        trazo.lineTo(cx + r * 0.44f, cy - r * 0.30f);
        lienzo.drawPath(trazo, tick);
        return imagen;
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
        boolean soloHabitos = "habitos".equals(filtro);
        boolean conHabitos = soloHabitos || "todos".equals(filtro);
        JSONArray habitosMes = mes.optJSONArray("habitos");

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
            if (soloHabitos) total = 0;
            JSONArray entradas = new JSONArray();
            for (int k = 0; !soloHabitos && todas != null && k < todas.length(); k++) {
                JSONObject e = todas.optJSONObject(k);
                if (e == null) continue;
                boolean esEvento = e.optBoolean("evento");
                if ((soloTareas && esEvento) || (soloEventos && !esEvento)) continue;
                entradas.put(e);
            }
            // Los hábitos del día, después de eventos y tareas (con "Hábitos" o "Todos").
            JSONArray delDia = conHabitos && habitosMes != null ? celda.optJSONArray("habitos") : null;
            for (int k = 0; delDia != null && k < delDia.length(); k++) {
                int codigo = delDia.optInt(k, -1);
                JSONObject h = codigo < 0 ? null : habitosMes.optJSONObject(codigo / 2);
                // Solo los hábitos que sí se cumplieron ese día.
                if (h == null || codigo % 2 == 0) continue;
                try {
                    JSONObject e = new JSONObject();
                    e.put("titulo", h.optString("titulo"));
                    e.put("color", h.optString("color"));
                    e.put("habito", true);
                    entradas.put(e);
                    total++;
                } catch (org.json.JSONException ex) {
                    // Sin este hábito.
                }
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
                boolean esHabito = e.optBoolean("habito");
                int ce = esEvento ? colorSeguro(e.optString("color"), colorEvento) : esHabito ? colorSeguro(e.optString("color"), acento) : FabricaListaHoy.colorNivel(c, e.optInt("nivel"));
                if (hecha) ce = colorTenue;
                float alto0 = lineas * altoLinea;
                if (esEvento || esHabito) {
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

    /**
     * Tarjeta de un widget de estadísticas: arriba a la izquierda un anillo chico con el total al
     * centro y, a su lado, cada etiqueta (o hábito) como píldora con su cantidad y porcentaje;
     * abajo, ocupando el resto, las ondas en el tiempo. Si hay una etiqueta elegida (tocada en
     * el widget), las demás se atenúan como en la app. En "zonas" deja dónde quedó cada etiqueta,
     * para poder tocarlas: zonas[0] = cantidad, y luego x, y, ancho y alto de cada una, en píxeles.
     */
    static Bitmap estadisticas(Context c, JSONObject r, boolean habitos, int ancho, int alto, float d, int acento, int elegido, float[] zonas, String vacio) {
        Bitmap imagen = Bitmap.createBitmap(ancho, alto, Bitmap.Config.ARGB_8888);
        Canvas lienzo = new Canvas(imagen);
        int colorTexto = color(c, R.color.widget_texto);
        int colorTenue = color(c, R.color.widget_texto_tenue);
        int colorLinea = color(c, R.color.widget_barra_fondo);
        if (zonas != null) zonas[0] = 0;

        // La tarjeta, con el color suave del tema y la transparencia de tarjetas del widget.
        Paint tarjeta = new Paint(Paint.ANTI_ALIAS_FLAG);
        tarjeta.setColor(color(c, R.color.widget_evento_suave));
        float radioTarjeta = Math.min(16 * d, Math.min(ancho, alto) / 2f);
        lienzo.drawRoundRect(new RectF(0, 0, ancho, alto), radioTarjeta, radioTarjeta, tarjeta);

        int total = r == null ? 0 : r.optInt("total");
        JSONArray filas = r == null ? null : r.optJSONArray("filas");
        if (total == 0 || filas == null || filas.length() == 0) {
            TextPaint p = texto(colorTenue, 12.5f * d, false);
            p.setTextAlign(Paint.Align.CENTER);
            CharSequence corto = TextUtils.ellipsize(vacio, p, ancho - 16 * d, TextUtils.TruncateAt.END);
            lienzo.drawText(corto, 0, corto.length(), ancho / 2f, alto / 2f + p.getTextSize() * 0.35f, p);
            return imagen;
        }
        float m = 10 * d;
        int n = filas.length();
        if (elegido >= n) elegido = -1;
        int[] colores = new int[n];
        for (int i = 0; i < n; i++) colores[i] = colorSeguro(filas.optJSONObject(i).optString("color"), acento);
        // Atenuado de lo que no está elegido, como al tocar una etiqueta en la app.
        int[] visibles = new int[n];
        for (int i = 0; i < n; i++) visibles[i] = elegido < 0 || elegido == i ? colores[i] : conAlfa(colores[i], 60);

        // Arriba: anillo y etiquetas, siempre del mismo alto (haya pocas o muchas etiquetas), para que
        // el anillo y las ondas midan lo mismo en Día, Semana, Mes y Año. Las ondas ocupan el resto.
        JSONArray serie = r.optJSONArray("serie");
        float filaNormal = 21 * d * Math.max(1f, TemaWidget.letra());
        boolean conOndas = serie != null && serie.length() > 0 && alto > 150 * d;
        // En cuadrados: arriba, el anillo (izquierda) y las etiquetas (derecha), cada uno en su mitad;
        // abajo, las ondas a todo el ancho con la otra mitad del alto.
        float altoArriba = conOndas ? (alto - 2 * m) * 0.5f - 6 * d : alto - 2 * m;
        // Si hay muchas etiquetas, sus filas se aprietan un poco para que entren todas sin agrandar el bloque.
        float filaAlto = Math.min(filaNormal, Math.max(15 * d, altoArriba / n));
        float aprieta = filaAlto / filaNormal;
        int caben = Math.max(1, Math.min(n, (int) (altoArriba / filaAlto + 0.01f)));
        float mitad = ancho / 2f;
        float diametro = Math.min(altoArriba, mitad - m - 4 * d);

        float cx = m + (mitad - m - 4 * d) / 2f;
        float cy = m + altoArriba / 2f;
        RectF caja = new RectF(cx - diametro / 2f, cy - diametro / 2f, cx + diametro / 2f, cy + diametro / 2f);
        Paint arco = new Paint(Paint.ANTI_ALIAS_FLAG);
        arco.setStyle(Paint.Style.STROKE);
        float grosor = Math.max(5 * d, diametro * 0.14f);
        arco.setStrokeWidth(grosor);
        caja.inset(grosor / 2f, grosor / 2f);
        arco.setColor(colorLinea);
        lienzo.drawArc(caja, 0, 360, false, arco);
        float radio = caja.width() / 2f;
        // Grados que ocupa la punta redondeada, para dejar un respiro entre segmentos.
        float punta = n > 1 ? (float) Math.toDegrees(grosor / 2f / Math.max(1, radio)) : 0;
        arco.setStrokeCap(n > 1 ? Paint.Cap.ROUND : Paint.Cap.BUTT);
        float inicio = -90;
        for (int i = 0; i < n; i++) {
            float barrido = 360f * filas.optJSONObject(i).optInt("cantidad") / total;
            arco.setColor(visibles[i]);
            float dibujado = barrido - 2 * punta - (n > 1 ? 3 : 0);
            if (dibujado > 0.5f) lienzo.drawArc(caja, inicio + punta + (n > 1 ? 1.5f : 0), dibujado, false, arco);
            else lienzo.drawArc(caja, inicio + barrido / 2f, 0.5f, false, arco);
            inicio += barrido;
        }
        JSONObject fe = elegido >= 0 ? filas.optJSONObject(elegido) : null;
        float tamGrande = Math.max(11 * d, diametro * 0.26f);
        TextPaint grande = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        grande.setColor(fe != null ? colores[elegido] : colorTexto);
        grande.setTextSize(tamGrande);
        grande.setTypeface(Typeface.DEFAULT_BOLD);
        grande.setTextAlign(Paint.Align.CENTER);
        lienzo.drawText(String.valueOf(fe != null ? fe.optInt("cantidad") : total), cx, cy + tamGrande * 0.12f, grande);
        TextPaint bajo = new TextPaint(Paint.ANTI_ALIAS_FLAG);
        bajo.setColor(colorTenue);
        bajo.setTextSize(Math.max(7 * d, diametro * 0.13f));
        bajo.setTextAlign(Paint.Align.CENTER);
        String rotulo = fe != null ? fe.optInt("porcentaje") + "%" : (habitos ? "hechos" : "tareas");
        lienzo.drawText(rotulo, cx, cy + tamGrande * 0.12f + bajo.getTextSize() * 1.15f, bajo);

        // Etiquetas: cada una es una píldora con su punto de color; a la derecha, cantidad y porcentaje.
        float lx = mitad + 4 * d;
        float ly = cy - caben * filaAlto / 2f;
        TextPaint leyenda = texto(colorTexto, 11f * d * Math.max(0.8f, aprieta), false);
        TextPaint cifra = texto(colorTenue, 10.5f * d * Math.max(0.8f, aprieta), false);
        cifra.setTextAlign(Paint.Align.RIGHT);
        Paint punto = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint borde = new Paint(Paint.ANTI_ALIAS_FLAG);
        borde.setStyle(Paint.Style.STROKE);
        borde.setStrokeWidth(Math.max(1, d));
        Paint resalte = new Paint(Paint.ANTI_ALIAS_FLAG);
        float anchoCifras = 0;
        String[] datos = new String[caben];
        for (int i = 0; i < caben; i++) {
            JSONObject f = filas.optJSONObject(i);
            datos[i] = f.optInt("cantidad") + " · " + f.optInt("porcentaje") + "%";
            anchoCifras = Math.max(anchoCifras, cifra.measureText(datos[i]));
        }
        float anchoPildoraMax = ancho - m - lx - anchoCifras - 8 * d;
        for (int i = 0; i < caben; i++) {
            JSONObject f = filas.optJSONObject(i);
            boolean apagada = elegido >= 0 && elegido != i;
            leyenda.setColor(apagada ? conAlfa(colorTexto, 90) : colorTexto);
            leyenda.setFakeBoldText(elegido == i);
            cifra.setColor(apagada ? conAlfa(colorTenue, 90) : colorTenue);
            String nombre = f.optString("nombre");
            float anchoNombre = Math.max(0, Math.min(leyenda.measureText(nombre), anchoPildoraMax - 24 * d));
            RectF pildora = new RectF(lx, ly + 2 * d, lx + anchoNombre + 24 * d, ly + filaAlto - 2 * d);
            if (elegido == i) {
                resalte.setColor(conAlfa(colores[i], 50));
                lienzo.drawRoundRect(pildora, pildora.height() / 2f, pildora.height() / 2f, resalte);
            }
            borde.setColor(conAlfa(visibles[i], apagada ? 60 : 170));
            lienzo.drawRoundRect(pildora, pildora.height() / 2f, pildora.height() / 2f, borde);
            punto.setColor(visibles[i]);
            lienzo.drawCircle(lx + 9 * d, ly + filaAlto / 2f, 3.5f * d, punto);
            float base = ly + filaAlto / 2f + leyenda.getTextSize() * 0.35f;
            escribir(lienzo, nombre, lx + 17 * d, base, anchoNombre + d, leyenda);
            lienzo.drawText(datos[i], ancho - m, base, cifra);
            if (zonas != null && 1 + 4 * (i + 1) <= zonas.length) {
                int k = 1 + 4 * i;
                zonas[k] = lx;
                zonas[k + 1] = ly;
                zonas[k + 2] = ancho - m - lx;
                zonas[k + 3] = filaAlto;
                zonas[0] = i + 1;
            }
            ly += filaAlto;
        }

        if (!conOndas) return imagen;

        // Ondas suaves superpuestas en el tiempo, como el gráfico "En el tiempo" de la app, con sus ejes.
        TextPaint dia = texto(colorTenue, 9f * d, false);
        float base = alto - m - dia.getTextSize() * 1.25f;
        float tope = m + altoArriba + 12 * d;
        if (base - tope < 24 * d) return imagen;
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
        float izq = m + 2 * d, der = ancho - m;
        Paint eje = new Paint(Paint.ANTI_ALIAS_FLAG);
        eje.setColor(conAlfa(colorTenue, 150));
        eje.setStrokeWidth(Math.max(1, d));
        eje.setStrokeCap(Paint.Cap.ROUND);
        lienzo.drawLine(izq, tope - 4 * d, izq, base, eje);
        lienzo.drawLine(izq, base, der, base, eje);
        // Las ondas parten pegadas al eje, sin espacio entre medio.
        float x0 = izq;
        float paso = dias > 1 ? (der - x0) / (dias - 1) : 0;
        // Los grupos más grandes van detrás; la etiqueta elegida, siempre delante.
        Integer[] orden = new Integer[n];
        for (int k = 0; k < n; k++) orden[k] = k;
        final int elegida = elegido;
        java.util.Arrays.sort(orden, (a, b) -> a == elegida ? 1 : b == elegida ? -1 : sumas[b] - sumas[a]);
        Paint area = new Paint(Paint.ANTI_ALIAS_FLAG);
        area.setStyle(Paint.Style.FILL);
        Paint trazo = new Paint(Paint.ANTI_ALIAS_FLAG);
        trazo.setStyle(Paint.Style.STROKE);
        trazo.setStrokeWidth(2 * d);
        trazo.setStrokeJoin(Paint.Join.ROUND);
        trazo.setStrokeCap(Paint.Cap.ROUND);
        lienzo.save();
        lienzo.clipRect(izq, 0, ancho, base);
        for (int o = 0; o < n; o++) {
            int k = orden[o];
            if (sumas[k] == 0) continue;
            boolean apagada = elegido >= 0 && elegido != k;
            float[] xs = new float[dias];
            float[] ys = new float[dias];
            for (int i = 0; i < dias; i++) {
                JSONArray v = serie.optJSONObject(i).optJSONArray("valores");
                int valor = v == null ? 0 : v.optInt(k);
                xs[i] = dias > 1 ? x0 + paso * i : (x0 + der) / 2f;
                ys[i] = base - (base - tope) * valor / maximo;
            }
            Path linea = curvaSuave(xs, ys);
            Path relleno = new Path(linea);
            relleno.lineTo(xs[dias - 1], base);
            relleno.lineTo(xs[0], base);
            relleno.close();
            area.setShader(new LinearGradient(0, tope, 0, base, conAlfa(colores[k], apagada ? 40 : 190), conAlfa(colores[k], apagada ? 5 : 30), Shader.TileMode.CLAMP));
            lienzo.drawPath(relleno, area);
            trazo.setColor(apagada ? conAlfa(colores[k], 70) : colores[k]);
            lienzo.drawPath(linea, trazo);
        }
        lienzo.restore();
        // Rótulos del eje: todos si caben; si no, uno cada tantos.
        float anchoRotulo = 0;
        for (int i = 0; i < dias; i++) anchoRotulo = Math.max(anchoRotulo, dia.measureText(serie.optJSONObject(i).optString("etiqueta")));
        int cada = Math.max(1, (int) Math.ceil(dias * (anchoRotulo + 5 * d) / Math.max(1, der - x0)));
        for (int i = 0; i < dias; i += cada) {
            float bx = dias > 1 ? x0 + paso * i : (x0 + der) / 2f;
            dia.setTextAlign(i == 0 && dias > 1 ? Paint.Align.LEFT : i == dias - 1 && dias > 1 ? Paint.Align.RIGHT : Paint.Align.CENTER);
            lienzo.drawText(serie.optJSONObject(i).optString("etiqueta"), bx, base + dia.getTextSize() * 1.15f, dia);
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
