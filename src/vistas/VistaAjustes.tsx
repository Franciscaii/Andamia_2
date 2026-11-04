import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Cloud, CloudOff, Download, MonitorDown, RefreshCw, Upload } from "lucide-react";
import { BotonAvisos } from "../componentes/Avisos";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { registrarDispositivoPush, useCuenta } from "../datos/cuenta";
import { claveVapid } from "../datos/firebase/config";
import * as repo from "../datos/repositorio";
import { useTienda } from "../datos/tienda";
import type { NombreTabla } from "../datos/bd";
import { cantidadDe, crearCopia, nombreArchivoCopia, validarCopia, type Copia } from "../logica/copia";
import { alCambiarInstalacion, estaInstalada, instalar, sePuedeInstalar } from "../logica/pwa";

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-borde bg-panel p-4">
      <h2 className="mb-3 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function FormularioAcceso() {
  const { registrar, entrar, entrarConGoogle, recuperarClave, ocupada, error, limpiarError } = useCuenta();
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    if (modo === "entrar") await entrar(email.trim(), clave);
    else await registrar(email.trim(), clave);
  };

  const recuperar = async () => {
    if (!email.trim()) {
      setAviso("Escribe tu correo para enviarte el enlace.");
      return;
    }
    // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
    if (await recuperarClave(email.trim())) setAviso("Si existe una cuenta con ese correo, te enviamos un enlace para cambiar la contraseña.");
  };

  const cambiarModo = () => {
    setModo(modo === "entrar" ? "registrar" : "entrar");
    limpiarError();
    setAviso(null);
  };

  return (
    <div className="max-w-sm">
      <p className="mb-3 text-sm text-tenue">Con una cuenta, tus datos se sincronizan entre tus dispositivos. Sin ella, Andamia sigue funcionando en este navegador.</p>
      <form onSubmit={enviar} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Correo</span>
          <input type="email" required autoComplete="email" aria-label="Correo" className={claseCampo} value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-tenue">Contraseña</span>
          <input type="password" required minLength={modo === "registrar" ? 8 : undefined} autoComplete={modo === "entrar" ? "current-password" : "new-password"} aria-label="Contraseña" className={claseCampo} value={clave} onChange={(e) => setClave(e.target.value)} />
          {modo === "registrar" && <span className="mt-1 block text-xs text-tenue">Al menos 8 caracteres.</span>}
        </label>
        {error && <p role="alert" className="text-sm text-peligro">{error}</p>}
        {aviso && <p role="status" className="text-sm text-tenue">{aviso}</p>}
        <button type="submit" className={`${claseBotonPrincipal} w-full`} disabled={ocupada}>
          {modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
        </button>
      </form>
      <button type="button" className={`${claseBoton} mt-2 w-full`} disabled={ocupada} onClick={() => void entrarConGoogle()}>
        Continuar con Google
      </button>
      <div className="mt-3 flex justify-between text-xs">
        <button type="button" className="text-acento hover:underline" onClick={cambiarModo}>
          {modo === "entrar" ? "Crear una cuenta nueva" : "Ya tengo una cuenta"}
        </button>
        {modo === "entrar" && (
          <button type="button" className="text-tenue hover:underline" onClick={() => void recuperar()}>
            Olvidé mi contraseña
          </button>
        )}
      </div>
    </div>
  );
}

function PanelCuenta() {
  const { usuario, enLinea, sinConfirmar, error, ocupada, salir, borrarCuenta, revisarMigracion } = useCuenta();
  const [dialogo, setDialogo] = useState<"salir" | "borrar" | null>(null);
  const [borrarCopia, setBorrarCopia] = useState(false);
  const [clave, setClave] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [dispositivo, setDispositivo] = useState<string | null>(null);
  if (!usuario) return null;

  const estado = !enLinea ? { icono: <CloudOff size={16} />, texto: "Sin conexión: tus cambios se guardan y se enviarán al reconectar." } : sinConfirmar ? { icono: <RefreshCw size={16} className="animate-spin" />, texto: "Enviando cambios…" } : { icono: <Cloud size={16} />, texto: "Todo sincronizado." };

  return (
    <div className="space-y-3">
      <p className="text-sm">
        Sesión iniciada como <strong data-testid="correo-cuenta">{usuario.email ?? "tu cuenta"}</strong>
      </p>
      <p className="flex items-center gap-2 text-sm text-tenue">
        {estado.icono} {estado.texto}
      </p>
      {error && <p role="alert" className="text-sm text-peligro">{error}</p>}
      {aviso && <p role="status" className="text-sm text-tenue">{aviso}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={claseBoton} onClick={() => setDialogo("salir")}>
          Cerrar sesión
        </button>
        <button
          type="button"
          className={claseBoton}
          onClick={() =>
            void revisarMigracion().then((hay) => {
              if (!hay) setAviso("Este navegador no tiene datos guardados sin cuenta.");
            })
          }
        >
          Copiar datos sin cuenta
        </button>
        {claveVapid && (
          <button type="button" className={claseBoton} onClick={() => void registrarDispositivoPush(usuario.uid).then((ok) => setDispositivo(ok ? "Dispositivo registrado." : "Este navegador no admite avisos push."))}>
            Registrar para avisos push
          </button>
        )}
        <button type="button" className={`${claseBoton} text-peligro`} onClick={() => setDialogo("borrar")}>
          Borrar mi cuenta
        </button>
      </div>
      {dispositivo && <p className="text-xs text-tenue">{dispositivo}</p>}

      {dialogo === "salir" && (
        <Modal titulo="¿Cerrar sesión?" alCerrar={() => setDialogo(null)}>
          <p className="mb-3 text-sm text-tenue">Dejarás de ver los datos de tu cuenta aquí. Siguen a salvo en la nube.{!enLinea || sinConfirmar ? " Tienes cambios sin enviar: se enviarán cuando vuelvas a entrar con conexión." : ""}</p>
          <label className="mb-5 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={borrarCopia} onChange={(e) => setBorrarCopia(e.target.checked)} />
            <span>
              También borrar la copia de la cuenta en este navegador. Recomendado en un equipo compartido.{(!enLinea || sinConfirmar) && <strong className="text-peligro"> Perderías los cambios sin enviar.</strong>}
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className={claseBoton} onClick={() => setDialogo(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={claseBotonPrincipal}
              onClick={() => {
                setDialogo(null);
                void salir(borrarCopia);
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </Modal>
      )}

      {dialogo === "borrar" && (
        <Modal titulo="¿Borrar tu cuenta para siempre?" alCerrar={() => setDialogo(null)}>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void borrarCuenta(usuario.usaClave ? clave : null).then((ok) => {
                if (ok) setDialogo(null);
              });
            }}
          >
            <p className="text-sm text-tenue">Se borrarán la cuenta y todos sus datos en la nube y en este navegador. No se puede deshacer. Antes, puedes descargar una copia de seguridad.</p>
            {usuario.usaClave ? (
              <label className="block text-sm">
                <span className="mb-1 block text-tenue">Confirma con tu contraseña</span>
                <input type="password" required autoFocus autoComplete="current-password" aria-label="Confirmar contraseña" className={claseCampo} value={clave} onChange={(e) => setClave(e.target.value)} />
              </label>
            ) : (
              <p className="text-sm text-tenue">Google te pedirá confirmar tu identidad.</p>
            )}
            {error && <p role="alert" className="text-sm text-peligro">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className={claseBoton} onClick={() => setDialogo(null)}>
                Cancelar
              </button>
              <button type="submit" disabled={ocupada} className="rounded-md bg-peligro px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:text-black">
                Borrar para siempre
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

async function descargarCopia() {
  const copia = crearCopia(await repo.exportarTodo());
  const url = URL.createObjectURL(new Blob([JSON.stringify(copia, null, 1)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivoCopia();
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function CopiaSeguridad() {
  const usuario = useCuenta((s) => s.usuario);
  const cargar = useTienda((s) => s.cargar);
  const entrada = useRef<HTMLInputElement>(null);
  const [revisada, setRevisada] = useState<{ copia: Copia; conteos: Record<NombreTabla, number>; total: number } | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);

  const elegir = async (archivo: File | undefined) => {
    setErrores([]);
    setAviso(null);
    if (!archivo) return;
    const r = validarCopia(await archivo.text());
    if (r.ok) setRevisada({ copia: r.copia, conteos: r.conteos, total: r.total });
    else setErrores(r.errores);
    if (entrada.current) entrada.current.value = "";
  };

  const reemplazar = async () => {
    if (!revisada) return;
    try {
      await repo.reemplazarTodo(revisada.copia.datos);
      await cargar();
      setAviso(`Copia restaurada: ${revisada.total} registros.`);
    } catch (e) {
      console.error(e);
      setErrores(["No se pudo restaurar la copia. Tus datos no cambiaron."]);
    }
    setRevisada(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-tenue">Guarda todos tus datos en un archivo, o restáuralos desde uno. El temporizador en curso y los ajustes de este navegador no se incluyen.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={() => void descargarCopia()}>
          <Download size={15} /> Descargar copia
        </button>
        <button type="button" className={`${claseBoton} flex items-center gap-1.5`} onClick={() => entrada.current?.click()}>
          <Upload size={15} /> Restaurar copia
        </button>
        <input ref={entrada} type="file" accept="application/json,.json" aria-label="Archivo de copia" className="hidden" onChange={(e) => void elegir(e.target.files?.[0])} />
      </div>
      {aviso && <p role="status" className="text-sm text-tenue">{aviso}</p>}
      {errores.length > 0 && (
        <div role="alert" className="text-sm text-peligro">
          <p className="font-medium">No se restauró nada: el archivo tiene problemas.</p>
          <ul className="mt-1 list-inside list-disc">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {revisada && (
        <Modal titulo="¿Reemplazar todos tus datos?" alCerrar={() => setRevisada(null)}>
          <p className="mb-2 text-sm text-tenue">
            Todo lo que hay ahora {usuario ? "en tu cuenta, en todos tus dispositivos," : "en este navegador"} se borrará y se cambiará por esta copia del {new Date(revisada.copia.exportadaEn).toLocaleString("es-CL")}:
          </p>
          <ul className="mb-3 list-inside list-disc text-sm">
            {(Object.entries(revisada.conteos) as [NombreTabla, number][])
              .filter(([, n]) => n > 0)
              .map(([t, n]) => (
                <li key={t}>{cantidadDe(t, n)}</li>
              ))}
            {revisada.total === 0 && <li>La copia está vacía</li>}
          </ul>
          <button type="button" className="mb-5 flex items-center gap-1.5 text-sm text-acento hover:underline" onClick={() => void descargarCopia()}>
            <Download size={14} /> Primero, descargar una copia de lo actual
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" className={claseBoton} onClick={() => setRevisada(null)}>
              Cancelar
            </button>
            <button type="button" className="rounded-md bg-peligro px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 dark:text-black" onClick={() => void reemplazar()}>
              Reemplazar mis datos
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Instalacion() {
  const [, redibujar] = useState(0);
  useEffect(() => alCambiarInstalacion(() => redibujar((n) => n + 1)), []);
  if (estaInstalada()) return <p className="text-sm text-tenue">Andamia ya está instalada en este dispositivo.</p>;
  if (sePuedeInstalar()) {
    return (
      <button type="button" className={`${claseBotonPrincipal} flex items-center gap-1.5`} onClick={() => void instalar()}>
        <MonitorDown size={15} /> Instalar Andamia
      </button>
    );
  }
  return <p className="text-sm text-tenue">Si tu navegador lo permite, puedes instalarla desde su menú. En iPhone: Compartir → Añadir a pantalla de inicio. La instalación requiere la versión publicada de la app, no el modo de desarrollo.</p>;
}

export function VistaAjustes() {
  const configurada = useCuenta((s) => s.configurada);
  const usuario = useCuenta((s) => s.usuario);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-5">
        <h1 className="text-xl font-semibold">Cuenta y ajustes</h1>
        <Seccion titulo="Cuenta">
          {!configurada ? (
            <p data-testid="sin-firebase" className="text-sm text-tenue">Las cuentas aún no están configuradas en esta instalación. Tus datos se guardan solo en este navegador. La guía está en docs/firebase-paso-a-paso.md.</p>
          ) : usuario ? (
            <PanelCuenta />
          ) : (
            <FormularioAcceso />
          )}
        </Seccion>
        <Seccion titulo="Copia de seguridad">
          <CopiaSeguridad />
        </Seccion>
        <Seccion titulo="Instalar la app">
          <Instalacion />
        </Seccion>
        <Seccion titulo="Avisos">
          <p className="mb-2 text-sm text-tenue">Los avisos son fiables con la app abierta. Con la app cerrada solo funcionan a veces: el navegador decide cuándo revisar, y solo con la app instalada en Chrome o Edge.</p>
          <BotonAvisos />
        </Seccion>
      </div>
    </div>
  );
}
