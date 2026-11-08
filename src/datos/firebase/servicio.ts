import { getApps, initializeApp } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  terminate,
  waitForPendingWrites,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { TABLAS, type NombreTabla } from "../bd";
import type { AlmacenRemoto, CambioRemoto } from "../espejo";
import { esAppNativa } from "../../logica/plataforma";
import { claveVapid, configFirebase, usarEmuladores } from "./config";

const COLECCIONES: Record<NombreTabla, string> = {
  tareas: "tasks",
  listas: "lists",
  carpetas: "folders",
  etiquetas: "tags",
  columnas: "columns",
  habitos: "habits",
  registrosHabito: "habitLogs",
  sesiones: "focusSessions",
};

/** Firestore limita cada lote a 500 operaciones. */
const TAMANO_LOTE = 400;

let conexion: { auth: Auth; db: Firestore } | null = null;

function conectar() {
  if (conexion) return conexion;
  const app = getApps()[0] ?? initializeApp(configFirebase);
  // En la app de Android la sesión se guarda directo en IndexedDB, sin el
  // mecanismo de ventanas emergentes que usa la web (allí no existe).
  const auth = esAppNativa() ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) : getAuth(app);
  auth.languageCode = "es";
  const db = initializeFirestore(app, {
    // Guarda en el navegador y sigue funcionando sin conexión, en varias pestañas.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
  if (usarEmuladores) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8181);
  }
  conexion = { auth, db };
  return conexion;
}

/** Un nombre de etiqueta puede tener caracteres que Firestore no admite como id. */
const idDocumento = (id: string) => `k_${encodeURIComponent(id).replace(/\./g, "%2E")}`;

export interface UsuarioCuenta {
  uid: string;
  email: string | null;
  usaClave: boolean;
}

const aUsuario = (u: User): UsuarioCuenta => ({ uid: u.uid, email: u.email, usaClave: u.providerData.some((p) => p.providerId === "password") });

export function observarSesion(alCambiar: (u: UsuarioCuenta | null) => void): () => void {
  return onAuthStateChanged(conectar().auth, (u) => alCambiar(u ? aUsuario(u) : null));
}

export async function registrar(email: string, clave: string) {
  await createUserWithEmailAndPassword(conectar().auth, email, clave);
}

export async function entrar(email: string, clave: string) {
  await signInWithEmailAndPassword(conectar().auth, email, clave);
}

export async function entrarConGoogle() {
  await signInWithPopup(conectar().auth, new GoogleAuthProvider());
}

export async function recuperarClave(email: string) {
  await sendPasswordResetEmail(conectar().auth, email);
}

export async function salir() {
  await signOut(conectar().auth);
}

export function almacenDe(uid: string): AlmacenRemoto {
  const { db } = conectar();
  return {
    async escribir(cambios) {
      const envios: Promise<void>[] = [];
      for (let i = 0; i < cambios.length; i += TAMANO_LOTE) {
        const lote = writeBatch(db);
        for (const c of cambios.slice(i, i + TAMANO_LOTE)) {
          const ref = doc(db, "users", uid, COLECCIONES[c.tabla], idDocumento(c.id));
          if (c.datos) lote.set(ref, c.datos);
          else lote.delete(ref);
        }
        // Sin conexión queda en la cola de Firestore; se confirma al reconectar.
        envios.push(lote.commit());
      }
      await Promise.all(envios);
    },
    escuchar(tabla, alCambiar, alFallar) {
      let primeraDelServidor = true;
      return onSnapshot(
        collection(db, "users", uid, COLECCIONES[tabla]),
        // Con metadatos se sabe cuándo la foto ya viene del servidor, aunque no cambie nada.
        { includeMetadataChanges: true },
        (foto) => {
          const cambios: CambioRemoto[] = foto.docChanges().map((c) => ({
            tipo: c.type === "removed" ? "borrado" : "guardado",
            datos: c.doc.data(),
            pendiente: c.doc.metadata.hasPendingWrites,
          }));
          const delServidor = !foto.metadata.fromCache && !foto.metadata.hasPendingWrites;
          const completa = delServidor && primeraDelServidor ? foto.docs.map((d) => d.data()) : null;
          if (delServidor) primeraDelServidor = false;
          if (cambios.length || completa) alCambiar({ cambios, completa });
        },
        alFallar,
      );
    },
  };
}

export interface Ajustes {
  tema?: string;
  enfoque?: Record<string, number>;
}

export function escucharAjustes(uid: string, alCambiar: (a: Ajustes) => void): () => void {
  return onSnapshot(doc(conectar().db, "users", uid, "settings", "app"), (d) => {
    if (d.exists() && !d.metadata.hasPendingWrites) alCambiar(d.data() as Ajustes);
  });
}

export function guardarAjustes(uid: string, ajustes: Ajustes): Promise<void> {
  return setDoc(doc(conectar().db, "users", uid, "settings", "app"), ajustes, { merge: true });
}

export const escriturasConfirmadas = () => waitForPendingWrites(conectar().db);

/** Quita del navegador la copia de la cuenta. Después hay que recargar la página. */
export async function limpiarCopiaLocal() {
  const { db } = conectar();
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

/** Sin Cloud Functions, la app debe borrar los datos antes que la cuenta. */
export async function borrarCuenta(clave: string | null) {
  const { auth, db } = conectar();
  const u = auth.currentUser;
  if (!u) throw new Error("Sin sesión");
  if (clave !== null && u.email) await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, clave));
  else await reauthenticateWithPopup(u, new GoogleAuthProvider());
  const colecciones = [...TABLAS.map((t) => COLECCIONES[t]), "settings"];
  for (const nombre of colecciones) {
    const docs = (await getDocs(collection(db, "users", u.uid, nombre))).docs;
    for (let i = 0; i < docs.length; i += TAMANO_LOTE) {
      const lote = writeBatch(db);
      docs.slice(i, i + TAMANO_LOTE).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
  }
  await deleteUser(u);
}

/**
 * Preparado para Cloud Messaging. Guarda el permiso de este dispositivo, pero
 * enviar avisos programados requiere un servidor o Cloud Functions (plan de pago).
 */
export async function registrarDispositivoPush(uid: string): Promise<boolean> {
  if (!claveVapid) return false;
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return false;
  const registro = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(), { vapidKey: claveVapid, serviceWorkerRegistration: registro });
  if (!token) return false;
  await setDoc(doc(conectar().db, "users", uid, "settings", "dispositivos"), { [idDocumento(token).slice(0, 200)]: { token, registradoEn: new Date().toISOString() } }, { merge: true });
  return true;
}

const MENSAJES: Record<string, string> = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "Correo o contraseña incorrectos.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "No hay conexión. Inténtalo de nuevo cuando vuelva.",
  "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de terminar.",
  "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permítela e inténtalo de nuevo.",
  "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión e inténtalo de nuevo.",
  "auth/operation-not-allowed": "Este método de acceso no está activado en el proyecto de Firebase.",
  "auth/admin-restricted-operation": "No se pueden crear cuentas nuevas en esta instalación de Andamia.",
  "permission-denied": "Firebase rechazó el cambio. Revisa que las reglas estén publicadas.",
};

export function mensajeDeError(e: unknown): string {
  const codigo = (e as { code?: string } | null)?.code ?? "";
  return MENSAJES[codigo] ?? "Algo salió mal con la cuenta. Inténtalo de nuevo.";
}
