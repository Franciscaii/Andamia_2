import { enTransaccion, type Base } from "./bd.ts";

export const TABLAS_SINCRONIZADAS = ["tareas", "listas", "carpetas", "etiquetas", "columnas", "sesiones", "habitos", "registrosHabito"] as const;

export interface CambioEntrante {
  tabla: string;
  id: string;
  /** null significa que el registro se borró. */
  datos: Record<string, unknown> | null;
  modificadoEn: number;
}

export interface CambioSaliente {
  tabla: string;
  id: string;
  datos: Record<string, unknown> | null;
  modificadoEn: number;
}

interface Fila {
  tabla: string;
  id: string;
  datos: string | null;
  modificado_en: number;
  revision: number;
}

const aSaliente = (f: Fila): CambioSaliente => ({
  tabla: f.tabla,
  id: f.id,
  datos: f.datos === null ? null : (JSON.parse(f.datos) as Record<string, unknown>),
  modificadoEn: f.modificado_en,
});

/**
 * Aplica los cambios de un dispositivo y devuelve lo que le falta.
 * Por registro gana la última modificación. Un reloj adelantado no puede
 * ganar para siempre: las fechas futuras se limitan a la hora del servidor.
 */
export function sincronizar(db: Base, usuarioId: string, desde: number, cambios: CambioEntrante[], ahora: number, limite = 1000) {
  return enTransaccion(db, () => {
    const leer = db.prepare("SELECT tabla, id, datos, modificado_en, revision FROM registros WHERE usuario_id = ? AND tabla = ? AND id = ?");
    const guardar = db.prepare(`
      INSERT INTO registros (usuario_id, tabla, id, datos, modificado_en, revision) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (usuario_id, tabla, id) DO UPDATE SET datos = excluded.datos, modificado_en = excluded.modificado_en, revision = excluded.revision
    `);
    let revision = (db.prepare("SELECT revision FROM usuarios WHERE id = ?").get(usuarioId) as { revision: number }).revision;

    const aceptados = new Set<string>();
    const rechazados = new Map<string, CambioSaliente>();
    const clave = (tabla: string, id: string) => `${tabla}|${id}`;

    for (const c of cambios) {
      const modificadoEn = Math.min(c.modificadoEn, ahora);
      const existente = leer.get(usuarioId, c.tabla, c.id) as Fila | undefined;
      if (existente && existente.modificado_en >= modificadoEn) {
        // El dispositivo tiene una versión más vieja: debe recibir la vigente.
        rechazados.set(clave(c.tabla, c.id), aSaliente(existente));
        continue;
      }
      revision += 1;
      guardar.run(usuarioId, c.tabla, c.id, c.datos === null ? null : JSON.stringify(c.datos), modificadoEn, revision);
      aceptados.add(clave(c.tabla, c.id));
      rechazados.delete(clave(c.tabla, c.id));
    }
    db.prepare("UPDATE usuarios SET revision = ? WHERE id = ?").run(revision, usuarioId);

    const filas = db
      .prepare("SELECT tabla, id, datos, modificado_en, revision FROM registros WHERE usuario_id = ? AND revision > ? ORDER BY revision LIMIT ?")
      .all(usuarioId, desde, limite + 1) as unknown as Fila[];
    const mas = filas.length > limite;
    const pagina = mas ? filas.slice(0, limite) : filas;

    const salida = new Map<string, CambioSaliente>();
    for (const f of pagina) {
      // Lo que este dispositivo acaba de enviar no hace falta devolverlo.
      if (!aceptados.has(clave(f.tabla, f.id))) salida.set(clave(f.tabla, f.id), aSaliente(f));
    }
    for (const [k, c] of rechazados) salida.set(k, c);

    return {
      revision: mas ? pagina[pagina.length - 1].revision : revision,
      mas,
      cambios: [...salida.values()],
      // Permite al dispositivo guardar la fecha que realmente quedó.
      aceptados: [...aceptados],
    };
  });
}
