/** No importa Firebase: sin configuración, ese código ni siquiera se descarga. */
const e = import.meta.env;

export const configFirebase = {
  apiKey: e.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: e.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: e.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: e.VITE_FIREBASE_APP_ID as string | undefined,
};

export const hayFirebase = Boolean(configFirebase.apiKey && configFirebase.projectId);
export const usarEmuladores = e.VITE_FIREBASE_EMULADORES === "si";
export const claveVapid = (e.VITE_FIREBASE_VAPID_KEY as string | undefined) || null;
