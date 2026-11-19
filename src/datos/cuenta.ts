import Dexie from "dexie";
import { create } from "zustand";
import { anotarBaseActiva } from "../logica/pwa";
import { BaseAndamia, baseDeCuenta, BASE_LOCAL, bd, usarBase } from "./bd";
import { contarDatos, copiarDatos, iniciarEspejo, type ConteoLocal } from "./espejo";
import { hayFirebase } from "./firebase/config";
import type { UsuarioCuenta } from "./firebase/servicio";
import { useTienda, type Tema } from "./tienda";

type Servicio = typeof import("./firebase/servicio");

const TIEMPO_MAXIMO_INICIO_MS = 5000;
const marcaMigracion = (uid: string) => `andamia-migracion-${uid}`;

interface EstadoCuenta {
  configurada: boolean;
  usuario: UsuarioCuenta | null;
  /** Datos locales que se pueden copiar a la cuenta. */
  migracion: ConteoLocal | null;
  sinConfirmar: boolean;
  enLinea: boolean;
  error: string | null;
  ocupada: boolean;
  registrar: (email: string, clave: string) => Promise<void>;
  entrar: (email: string, clave: string) => Promise<void>;
  entrarConGoogle: () => Promise<void>;
  recuperarClave: (email: string) => Promise<boolean>;
  salir: (borrarCopia: boolean) => Promise<void>;
  borrarCuenta: (clave: string | null) => Promise<boolean>;
  responderMigracion: (copiar: boolean) => Promise<void>;
  revisarMigracion: () => Promise<boolean>;
  limpiarError: () => void;
}

let servicio: Servicio | null = null;
let detener: (() => void)[] = [];

const detenerTodo = () => {
  detener.forEach((d) => d());
  detener = [];
};

export const useCuenta = create<EstadoCuenta>((set, get) => {
  const accion = async <T,>(fn: (s: Servicio) => Promise<T>): Promise<T | null> => {
    if (!servicio) return null;
    set({ ocupada: true, error: null });
    try {
      return await fn(servicio);
    } catch (e) {
      console.error(e);
      set({ error: servicio.mensajeDeError(e) });
      return null;
    } finally {
      set({ ocupada: false });
    }
  };

  return {
    configurada: hayFirebase,
    usuario: null,
    migracion: null,
    sinConfirmar: false,
    enLinea: typeof navigator === "undefined" ? true : navigator.onLine,
    error: null,
    ocupada: false,
    registrar: async (email, clave) => void (await accion((s) => s.registrar(email, clave))),
    entrar: async (email, clave) => void (await accion((s) => s.entrar(email, clave))),
    entrarConGoogle: async () => void (await accion((s) => s.entrarConGoogle())),
    recuperarClave: async (email) => (await accion(async (s) => (await s.recuperarClave(email), true))) ?? false,

    salir: async (borrarCopia) => {
      const uid = get().usuario?.uid;
      await accion(async (s) => {
        await s.salir();
        if (!borrarCopia || !uid) return;
        // La cuenta sigue en la nube; solo se quita de este navegador.
        detenerTodo();
        await usarBase(BASE_LOCAL);
        await Dexie.delete(baseDeCuenta(uid));
        localStorage.removeItem(marcaMigracion(uid));
        await s.limpiarCopiaLocal();
        window.location.reload();
      });
    },

    borrarCuenta: async (clave) => {
      const uid = get().usuario?.uid;
      const hecho = await accion(async (s) => {
        detenerTodo();
        await s.borrarCuenta(clave);
        return true;
      });
      if (hecho && uid) {
        await usarBase(BASE_LOCAL);
        await Dexie.delete(baseDeCuenta(uid));
        localStorage.removeItem(marcaMigracion(uid));
      } else if (get().usuario) {
        // Falló antes de terminar: la sesión sigue activa, y el espejo también.
        await activarCuenta(get().usuario as UsuarioCuenta);
      }
      return Boolean(hecho);
    },

    responderMigracion: async (copiar) => {
      const uid = get().usuario?.uid;
      if (!uid) return;
      if (copiar) {
        const local = new BaseAndamia(BASE_LOCAL);
        await local.open();
        try {
          await copiarDatos(local, bd);
        } finally {
          local.close();
        }
        await useTienda.getState().cargar();
      }
      localStorage.setItem(marcaMigracion(uid), copiar ? "copiada" : "omitida");
      set({ migracion: null });
    },

    revisarMigracion: async () => {
      const conteo = await contarLocal();
      if (conteo.total) set({ migracion: conteo });
      return conteo.total > 0;
    },

    limpiarError: () => set({ error: null }),
  };
});

async function contarLocal(): Promise<ConteoLocal> {
  if (!(await Dexie.exists(BASE_LOCAL))) return { total: 0, porTabla: {} };
  const local = new BaseAndamia(BASE_LOCAL);
  await local.open();
  try {
    return await contarDatos(local);
  } finally {
    local.close();
  }
}

function seguirEscritura(promesa: Promise<void>) {
  useCuenta.setState({ sinConfirmar: true });
  void promesa
    .then(() => servicio?.escriturasConfirmadas())
    .then(() => useCuenta.setState({ sinConfirmar: false }))
    .catch(() => undefined);
}

function sincronizarAjustes(s: Servicio, uid: string, datosListos: Promise<void>) {
  let aplicando = false;
  let sembrando = false;
  detener.push(
    s.escucharAjustes(uid, (a, desdeServidor) => {
      // Las etiquetas iniciales se agregan una sola vez por cuenta: si se borra una, no vuelve.
      if (desdeServidor && !a.etiquetasIniciales && !sembrando) {
        sembrando = true;
        // Espera a tener los datos de la nube para no pisar una etiqueta que ya exista allá.
        void datosListos
          .then(() => useTienda.getState().sembrarEtiquetas())
          .then(() => s.guardarAjustes(uid, { etiquetasIniciales: true }))
          .catch(console.error);
      }
      aplicando = true;
      const t = useTienda.getState();
      if ((a.tema === "claro" || a.tema === "oscuro") && a.tema !== t.tema) t.fijarTema(a.tema as Tema);
      aplicando = false;
    }),
    useTienda.subscribe((estado, previo) => {
      if (!aplicando && estado.tema !== previo.tema) void s.guardarAjustes(uid, { tema: estado.tema }).catch(console.error);
    }),
  );
}

async function activarCuenta(u: UsuarioCuenta) {
  const s = servicio as Servicio;
  detenerTodo();
  const db = await usarBase(baseDeCuenta(u.uid));
  void anotarBaseActiva(db.name);
  await useTienda.getState().cargar();

  let temporizador = 0;
  let avisarDatosListos = () => {};
  const datosListos = new Promise<void>((listo) => {
    avisarDatosListos = listo;
    window.setTimeout(listo, 8000);
  });
  const detenerEspejo = iniciarEspejo(db, s.almacenDe(u.uid), {
    alAplicar: () => {
      window.setTimeout(avisarDatosListos, 1500);
      // Varias fotos seguidas se leen una sola vez.
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(() => void useTienda.getState().cargar(), 120);
    },
    alEscribir: seguirEscritura,
    alFallar: (e) => {
      console.error(e);
      useCuenta.setState({ error: s.mensajeDeError(e) });
    },
  });
  detener.push(detenerEspejo, () => window.clearTimeout(temporizador));
  sincronizarAjustes(s, u.uid, datosListos);

  useCuenta.setState({ usuario: u, migracion: null });
  if (!localStorage.getItem(marcaMigracion(u.uid))) {
    const conteo = await contarLocal();
    if (conteo.total) useCuenta.setState({ migracion: conteo });
    else localStorage.setItem(marcaMigracion(u.uid), "sin-datos");
  }
}

async function desactivarCuenta() {
  detenerTodo();
  useCuenta.setState({ usuario: null, migracion: null, sinConfirmar: false });
  const db = await usarBase(BASE_LOCAL);
  void anotarBaseActiva(db.name);
  await useTienda.getState().cargar();
}

/** Resuelve cuando ya se sabe quién usa la app, para no mostrar por un instante los datos de otro. */
export async function iniciarCuenta(): Promise<void> {
  if (typeof window !== "undefined") {
    const alCambiarRed = () => useCuenta.setState({ enLinea: navigator.onLine });
    window.addEventListener("online", alCambiarRed);
    window.addEventListener("offline", alCambiarRed);
  }
  if (!hayFirebase) {
    void anotarBaseActiva(BASE_LOCAL);
    return;
  }
  try {
    servicio = await import("./firebase/servicio");
  } catch (e) {
    // Sin conexión y sin la app guardada todavía: sigue funcionando en local.
    console.error(e);
    return;
  }
  const s = servicio;
  await new Promise<void>((listo) => {
    const tope = window.setTimeout(listo, TIEMPO_MAXIMO_INICIO_MS);
    let cola = Promise.resolve();
    s.observarSesion((u) => {
      cola = cola
        .then(() => (u ? activarCuenta(u) : desactivarCuenta()))
        .catch((e) => {
          console.error(e);
          useCuenta.setState({ error: s.mensajeDeError(e) });
        })
        .finally(() => {
          window.clearTimeout(tope);
          listo();
        });
    });
  });
}

export const registrarDispositivoPush = (uid: string) => servicio?.registrarDispositivoPush(uid) ?? Promise.resolve(false);
