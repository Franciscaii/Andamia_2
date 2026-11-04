import Dexie from "dexie";
import { TABLAS, type BaseAndamia, type NombreTabla } from "./bd";

export interface CambioLocal {
  tabla: NombreTabla;
  id: string;
  /** null significa que el registro se borró. */
  datos: Record<string, unknown> | null;
}

export interface CambioRemoto {
  tipo: "guardado" | "borrado";
  datos: Record<string, unknown>;
  /** Escritura de este mismo dispositivo que aún no confirma el servidor. */
  pendiente: boolean;
}

export interface FotoRemota {
  cambios: CambioRemoto[];
  /** Si viene del servidor y no de la caché, también trae el conjunto completo. */
  completa: Record<string, unknown>[] | null;
}

/** Lo único que el espejo necesita de la nube. Firestore lo implementa; las pruebas usan un doble. */
export interface AlmacenRemoto {
  escribir(cambios: CambioLocal[]): Promise<void>;
  escuchar(tabla: NombreTabla, alCambiar: (foto: FotoRemota) => void, alFallar: (e: unknown) => void): () => void;
}

/** Orden estable de claves: dos versiones iguales deben compararse como iguales. */
export function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]));
    }
    return v;
  });
}

interface OpcionesEspejo {
  /** Hubo cambios remotos: hay que volver a leer los datos. */
  alAplicar: () => void;
  alEscribir: (promesa: Promise<void>) => void;
  alFallar: (e: unknown) => void;
}

/**
 * Mantiene una base local igual a la nube, en ambos sentidos. La nube manda:
 * lo que llega de ella siempre se aplica, y gana la última escritura que recibe
 * el servidor para cada registro completo. Sin conexión, Firestore guarda las
 * escrituras en su cola y las envía al reconectar.
 */
export function iniciarEspejo(db: BaseAndamia, remoto: AlmacenRemoto, opciones: OpcionesEspejo): () => void {
  // Transacciones de datos que vienen de la nube: no se deben devolver a ella.
  const remotas = new WeakSet<object>();
  const pendientes = new WeakMap<object, Map<string, { tabla: NombreTabla; id: string }>>();
  const desuscribir: (() => void)[] = [];
  let activo = true;

  const raiz = (tx: { parent?: unknown }): object => {
    let r = tx as { parent?: unknown };
    while (r.parent) r = r.parent as { parent?: unknown };
    return r;
  };

  const anotar = (tabla: NombreTabla, id: unknown, tx: unknown) => {
    const r = raiz(tx as { parent?: unknown });
    if (remotas.has(r)) return;
    let mapa = pendientes.get(r);
    if (!mapa) {
      mapa = new Map();
      pendientes.set(r, mapa);
      const lote = mapa;
      (r as { on: (e: string, f: () => void) => void }).on("complete", () => void enviar(lote));
    }
    mapa.set(`${tabla}|${String(id)}`, { tabla, id: String(id) });
  };

  const enviar = async (lote: Map<string, { tabla: NombreTabla; id: string }>) => {
    if (!activo) return;
    try {
      const cambios: CambioLocal[] = [];
      for (const { tabla, id } of lote.values()) {
        // Se envía la versión vigente: varias ediciones seguidas salen como una.
        const datos = (await db.table(tabla).get(id)) as Record<string, unknown> | undefined;
        cambios.push({ tabla, id, datos: datos ?? null });
      }
      const promesa = remoto.escribir(cambios);
      opciones.alEscribir(promesa);
      await promesa;
    } catch (e) {
      opciones.alFallar(e);
    }
  };

  const claveDe = (tabla: NombreTabla, d: Record<string, unknown>) => String(d[db.table(tabla).schema.primKey.keyPath as string]);

  const aplicar = async (tabla: NombreTabla, foto: FotoRemota) => {
    if (!activo) return;
    let hubo = false;
    const t = db.table(tabla);
    await db.transaction("rw", t, async () => {
      remotas.add(raiz(Dexie.currentTransaction as unknown as { parent?: unknown }));
      for (const c of foto.cambios) {
        // Lo propio sin confirmar ya está aquí y puede ser más nuevo que esta foto.
        if (c.pendiente) continue;
        const id = claveDe(tabla, c.datos);
        const actual = await t.get(id);
        if (c.tipo === "borrado") {
          if (actual) {
            await t.delete(id);
            hubo = true;
          }
        } else if (!actual || canonico(actual) !== canonico(c.datos)) {
          await t.put(c.datos);
          hubo = true;
        }
      }
      if (foto.completa) {
        // Quita lo que la nube ya no tiene y aquí sigue, por ejemplo si se borró con este dispositivo sin conexión larga.
        const enNube = new Set(foto.completa.map((d) => claveDe(tabla, d)));
        const sobran = (await t.toCollection().primaryKeys()).filter((k) => !enNube.has(String(k)));
        if (sobran.length) {
          await t.bulkDelete(sobran);
          hubo = true;
        }
      }
    });
    if (hubo && activo) opciones.alAplicar();
  };

  const ganchos: { tabla: NombreTabla; creando: (...a: never[]) => void; actualizando: (...a: never[]) => void; borrando: (...a: never[]) => void }[] = [];

  for (const tabla of TABLAS) {
    const t = db.table(tabla);
    const creando = (id: unknown, _o: unknown, tx: unknown) => anotar(tabla, id, tx);
    const actualizando = (_m: unknown, id: unknown, _o: unknown, tx: unknown) => anotar(tabla, id, tx);
    const borrando = (id: unknown, _o: unknown, tx: unknown) => anotar(tabla, id, tx);
    t.hook("creating", creando as never);
    t.hook("updating", actualizando as never);
    t.hook("deleting", borrando as never);
    ganchos.push({ tabla, creando: creando as never, actualizando: actualizando as never, borrando: borrando as never });

    // Una sola foto a la vez por tabla, en orden.
    let cola = Promise.resolve();
    desuscribir.push(
      remoto.escuchar(
        tabla,
        (foto) => {
          cola = cola.then(() => aplicar(tabla, foto)).catch(opciones.alFallar);
        },
        opciones.alFallar,
      ),
    );
  }

  return () => {
    activo = false;
    desuscribir.forEach((d) => d());
    for (const g of ganchos) {
      const t = db.table(g.tabla);
      t.hook("creating").unsubscribe(g.creando as never);
      t.hook("updating").unsubscribe(g.actualizando as never);
      t.hook("deleting").unsubscribe(g.borrando as never);
    }
  };
}

export interface ConteoLocal {
  total: number;
  porTabla: Partial<Record<NombreTabla, number>>;
}

export async function contarDatos(db: BaseAndamia): Promise<ConteoLocal> {
  const porTabla: Partial<Record<NombreTabla, number>> = {};
  let total = 0;
  for (const t of TABLAS) {
    const n = await db.table(t).count();
    if (n) porTabla[t] = n;
    total += n;
  }
  return { total, porTabla };
}

/**
 * Copia datos de otra base a la activa. Pasa por los ganchos del espejo, así
 * llega a la nube también sin conexión. Si un id ya existe, se conserva el de la cuenta.
 */
export async function copiarDatos(origen: BaseAndamia, destino: BaseAndamia): Promise<number> {
  let copiados = 0;
  for (const nombre of TABLAS) {
    const filas = await origen.table(nombre).toArray();
    if (!filas.length) continue;
    const t = destino.table(nombre);
    const clave = t.schema.primKey.keyPath as string;
    const existentes = new Set((await t.toCollection().primaryKeys()).map(String));
    const nuevas = filas.filter((f) => !existentes.has(String((f as Record<string, unknown>)[clave])));
    if (nuevas.length) {
      await t.bulkPut(nuevas);
      copiados += nuevas.length;
    }
  }
  return copiados;
}
