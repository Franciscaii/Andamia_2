import * as chrono from "chrono-node";
import { addDays, format, set } from "date-fns";
import type { Prioridad } from "../modelos/tipos";
import { normalizar } from "./texto";

export interface ListaConocida {
  id: string;
  nombre: string;
}

export interface EntradaInterpretada {
  titulo: string;
  /** "AAAA-MM-DD" si es de todo el día; ISO si lleva hora; null sin fecha. */
  vence: string | null;
  todoElDia: boolean;
  prioridad: Prioridad | null;
  etiquetas: string[];
  listaId: string | null;
  listaNombre: string | null;
}

// Límites de palabra con soporte para letras acentuadas y ñ.
const INI = "(?<![\\p{L}\\p{N}_])";
const FIN = "(?![\\p{L}\\p{N}_])";

const PRIORIDADES: Record<string, Prioridad> = {
  alta: "alta",
  media: "media",
  baja: "baja",
  ninguna: "ninguna",
};

const DIAS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const PREFIJO_FECHA = `(?:\\*?(?:para\\s+(?:el\\s+)?|del?\\s+|el\\s+|este\\s+|pr[oó]ximo\\s+)*)`;

function quitar(texto: string, inicio: number, largo: number): string {
  return texto.slice(0, inicio) + " " + texto.slice(inicio + largo);
}

function extraerPrioridad(texto: string) {
  const re = new RegExp(`${INI}!(alta|media|baja|ninguna)${FIN}`, "iu");
  const m = re.exec(texto);
  if (!m) return { texto, prioridad: null as Prioridad | null };
  return {
    texto: quitar(texto, m.index, m[0].length),
    prioridad: PRIORIDADES[m[1].toLowerCase()],
  };
}

function extraerEtiquetas(texto: string) {
  const etiquetas: string[] = [];
  const re = new RegExp(`${INI}#([\\p{L}\\p{N}_-]+)`, "gu");
  const limpio = texto.replace(re, (_c, nombre: string) => {
    if (!etiquetas.includes(nombre)) etiquetas.push(nombre);
    return " ";
  });
  return { texto: limpio, etiquetas };
}

function extraerLista(texto: string, listas: ListaConocida[]) {
  // Se prueba primero el nombre más largo para admitir nombres con espacios.
  const ordenadas = [...listas].sort((a, b) => b.nombre.length - a.nombre.length);
  const inicio = texto.search(/(^|\s)~/);
  if (inicio < 0) return { texto, lista: null as ListaConocida | null };
  const posicion = texto.indexOf("~", inicio);
  const resto = normalizar(texto.slice(posicion + 1));
  for (const lista of ordenadas) {
    const nombre = normalizar(lista.nombre);
    if (resto.startsWith(nombre) && !/[\p{L}\p{N}_]/u.test(resto.charAt(nombre.length))) {
      return {
        texto: quitar(texto, posicion, lista.nombre.length + 1),
        lista,
      };
    }
  }
  return { texto, lista: null };
}

interface Hora {
  horas: number;
  minutos: number;
}

function extraerHora(texto: string) {
  const patrones: { re: RegExp; leer: (m: RegExpExecArray) => Hora | null }[] = [
    {
      // 9am, 9:30 pm, a las 9 pm
      re: new RegExp(`${INI}(?:a\\s+las?\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)(?![\\p{L}\\p{N}_])`, "iu"),
      leer: (m) => {
        let h = Number(m[1]);
        const min = Number(m[2] ?? 0);
        if (h < 1 || h > 12 || min > 59) return null;
        const pm = m[3].toLowerCase().startsWith("p");
        if (pm && h < 12) h += 12;
        if (!pm && h === 12) h = 0;
        return { horas: h, minutos: min };
      },
    },
    {
      // a las 6 de la tarde, 7 de la mañana, a las 9:30 de la noche
      re: new RegExp(`${INI}(?:a\\s+las?\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s+de\\s+la\\s+(mañana|manana|tarde|noche)${FIN}`, "iu"),
      leer: (m) => {
        let h = Number(m[1]);
        const min = Number(m[2] ?? 0);
        if (h < 1 || h > 12 || min > 59) return null;
        const parte = normalizar(m[3]);
        if ((parte === "tarde" || parte === "noche") && h < 12) h += 12;
        if ((parte === "mañana" || parte === "manana") && h === 12) h = 0;
        return { horas: h, minutos: min };
      },
    },
    {
      // a las 10, a las 10:30, a la 1
      re: new RegExp(`${INI}a\\s+las?\\s+(\\d{1,2})(?::(\\d{2}))?(?:\\s*h(?:s|oras)?)?${FIN}`, "iu"),
      leer: (m) => {
        const h = Number(m[1]);
        const min = Number(m[2] ?? 0);
        return h > 23 || min > 59 ? null : { horas: h, minutos: min };
      },
    },
    {
      // 18:30
      re: new RegExp(`${INI}(\\d{1,2}):(\\d{2})(?:\\s*h(?:s|oras)?)?${FIN}`, "iu"),
      leer: (m) => {
        const h = Number(m[1]);
        const min = Number(m[2]);
        return h > 23 || min > 59 ? null : { horas: h, minutos: min };
      },
    },
  ];
  for (const { re, leer } of patrones) {
    const m = re.exec(texto);
    if (!m) continue;
    const hora = leer(m);
    if (hora) return { texto: quitar(texto, m.index, m[0].length), hora };
  }
  return { texto, hora: null as Hora | null };
}

function extraerDia(texto: string, ahora: Date) {
  const relativas: { patron: string; dias: number }[] = [
    { patron: "pasado\\s+ma(?:ñ|n)ana", dias: 2 },
    // "por la mañana" no es una fecha: ver negativa más abajo.
    { patron: "ma(?:ñ|n)ana", dias: 1 },
    { patron: "hoy", dias: 0 },
  ];
  for (const { patron, dias } of relativas) {
    const re = new RegExp(`(?<!(?:la|esta)\\s)${INI}${PREFIJO_FECHA}${patron}${FIN}`, "iu");
    const m = re.exec(texto);
    if (m) return { texto: quitar(texto, m.index, m[0].length), dia: addDays(ahora, dias) };
  }

  const reEnDias = new RegExp(`${INI}en\\s+(\\d{1,3})\\s+(d[ií]as?|semanas?)${FIN}`, "iu");
  const enDias = reEnDias.exec(texto);
  if (enDias) {
    const n = Number(enDias[1]) * (normalizar(enDias[2]).startsWith("semana") ? 7 : 1);
    return { texto: quitar(texto, enDias.index, enDias[0].length), dia: addDays(ahora, n) };
  }

  const reDia = new RegExp(`${INI}${PREFIJO_FECHA}(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(\\s+que\\s+viene|\\s+pr[oó]ximo)?${FIN}`, "iu");
  const m = reDia.exec(texto);
  if (m) {
    const objetivo = DIAS[normalizar(m[1])];
    // Siempre la próxima ocurrencia: "lunes" dicho en lunes es dentro de 7 días.
    let delta = (objetivo - ahora.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return { texto: quitar(texto, m.index, m[0].length), dia: addDays(ahora, delta) };
  }
  return { texto, dia: null as Date | null };
}

const MES = "ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t(?:iembre)?)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?";
const FECHA_EXPLICITA = new RegExp(`\\d.*${INI}(?:${MES})${FIN}|${INI}(?:${MES})${FIN}.*\\d|\\d{1,2}/\\d{1,2}`, "iu");

/**
 * Fechas explícitas ("20 de diciembre", "25/12"). Se exige un número para no
 * confundir nombres ("Abril", "Julio") con meses, y límites de palabra porque
 * chrono puede leer "Mar" dentro de "María".
 */
function extraerConChrono(texto: string, ahora: Date) {
  const resultado = chrono.es.parse(texto, ahora, { forwardDate: true }).find((r) => {
    const fin = r.index + r.text.length;
    const entero = !/[\p{L}\p{N}_]/u.test(texto.charAt(r.index - 1)) && !/[\p{L}\p{N}_]/u.test(texto.charAt(fin));
    return entero && FECHA_EXPLICITA.test(r.text);
  });
  if (!resultado) return { texto, dia: null as Date | null, hora: null as Hora | null };
  const fecha = resultado.start.date();
  const hora = resultado.start.isCertain("hour") ? { horas: fecha.getHours(), minutos: fecha.getMinutes() } : null;
  let inicio = resultado.index;
  let largo = resultado.text.length;
  const previo = /(?:\b(?:para\s+el|el|del?)\s+)$/i.exec(texto.slice(0, inicio));
  if (previo) {
    inicio -= previo[0].length;
    largo += previo[0].length;
  }
  return { texto: quitar(texto, inicio, largo), dia: fecha, hora };
}

function limpiar(texto: string): string {
  return texto.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").replace(/^[\s,.;:-]+|[\s,;:-]+$/g, "");
}

export function interpretarEntrada(original: string, ahora: Date = new Date(), listas: ListaConocida[] = []): EntradaInterpretada {
  const conPrioridad = extraerPrioridad(original);
  const conEtiquetas = extraerEtiquetas(conPrioridad.texto);
  const conLista = extraerLista(conEtiquetas.texto, listas);

  const conHora = extraerHora(conLista.texto);
  const conDia = extraerDia(conHora.texto, ahora);
  let texto = conDia.texto;
  let dia = conDia.dia;
  let hora = conHora.hora;

  if (!dia) {
    const conChrono = extraerConChrono(texto, ahora);
    texto = conChrono.texto;
    dia = conChrono.dia;
    hora = hora ?? conChrono.hora;
  }

  // Solo una hora: hoy si aún no pasa; si ya pasó, mañana.
  if (!dia && hora) {
    const hoyConHora = set(ahora, { hours: hora.horas, minutes: hora.minutos, seconds: 0, milliseconds: 0 });
    dia = hoyConHora > ahora ? ahora : addDays(ahora, 1);
  }

  let titulo = limpiar(texto);
  // Sin título no hay nada que recordar: el texto de fecha pasa a ser el título.
  if (!titulo) {
    titulo = limpiar(conLista.texto);
    dia = null;
    hora = null;
  }

  let vence: string | null = null;
  if (dia) {
    vence = hora
      ? set(dia, { hours: hora.horas, minutes: hora.minutos, seconds: 0, milliseconds: 0 }).toISOString()
      : format(dia, "yyyy-MM-dd");
  }

  return {
    titulo,
    vence,
    todoElDia: vence !== null && !hora,
    prioridad: conPrioridad.prioridad,
    etiquetas: conEtiquetas.etiquetas,
    listaId: conLista.lista?.id ?? null,
    listaNombre: conLista.lista?.nombre ?? null,
  };
}
