import { IDIOMA, IDIOMAS, elegirIdioma } from "../logica/idioma";
import { FlechaVolver } from "../componentes/FlechaVolver";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Cloud, CloudOff, Download, MonitorDown, RefreshCw, Upload } from "lucide-react";
import { BotonAvisos } from "../componentes/Avisos";
import { recordatoriosActivos } from "../config";
import { claseBoton, claseBotonPrincipal, claseCampo, Modal } from "../componentes/Modal";
import { registrarDispositivoPush, useCuenta } from "../datos/cuenta";
import { claveVapid } from "../datos/firebase/config";
import * as repo from "../datos/repositorio";
import { useTienda } from "../datos/tienda";
import type { NombreTabla } from "../datos/bd";
import { cantidadDe, crearCopia, nombreArchivoCopia, validarCopia, type Copia } from "../logica/copia";
import { alCambiarInstalacion, estaInstalada, instalar, sePuedeInstalar } from "../logica/pwa";
import { esAppNativa } from "../logica/plataforma";
import { capaFondo, leerImagenFondo, TEMAS, temaEfectivo, type Tema, type TipoFondo } from "../logica/temas";

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-xl border border-borde bg-panel p-4 lg:rounded-2xl lg:p-6">
      <h2 className="mb-3 font-semibold lg:text-lg">{titulo}</h2>
      {children}
    </section>
  );
}

/** Miniatura de un tema: menú de color, fondo y una tarjeta con el acento. */
function MiniaturaTema({ tema }: { tema: Tema }) {
  return (
    <span aria-hidden="true" className="flex h-14 w-20 overflow-hidden rounded-md border border-borde lg:h-24 lg:w-36" style={{ background: capaFondo(tema) }}>
      <span className="flex w-5 flex-col items-center gap-1 pt-1.5" style={{ background: tema.lateral }}>
        <span className="h-1 w-3 rounded-sm" style={{ background: tema.lateralTexto }} />
        <span className="h-1 w-3 rounded-sm opacity-60" style={{ background: tema.lateralTexto }} />
        <span className="h-1 w-3 rounded-sm opacity-60" style={{ background: tema.lateralTexto }} />
      </span>
      <span className="flex flex-1 flex-col gap-1 p-1.5">
        <span className="h-1.5 w-1/2 rounded-sm" style={{ background: tema.acento }} />
        <span className="flex flex-1 flex-col gap-1 rounded-sm p-1" style={{ background: tema.panel, opacity: Math.max(0.6, tema.opacidadPaneles / 100) }}>
          <span className="h-1 w-full rounded-sm opacity-50" style={{ background: tema.texto }} />
          <span className="h-1 w-2/3 rounded-sm opacity-50" style={{ background: tema.texto }} />
        </span>
      </span>
    </span>
  );
}

function CampoColor({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="color" aria-label={etiqueta} value={valor} onChange={(e) => alCambiar(e.target.value)} className="h-7 w-9 cursor-pointer rounded border border-borde bg-transparent p-0.5" />
      {etiqueta}
    </label>
  );
}

function Deslizador({ etiqueta, valor, min, max, unidad, alCambiar }: { etiqueta: string; valor: number; min: number; max: number; unidad: string; alCambiar: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between">
        {etiqueta}
        <span className="text-tenue">
          {valor}
          {unidad}
        </span>
      </span>
      <input type="range" aria-label={etiqueta} min={min} max={max} value={valor} onChange={(e) => alCambiar(Number(e.target.value))} className="w-[68%] accent-[var(--app-acento)] lg:w-full" />
    </label>
  );
}

/** Personalizar el tema actual, como el panel de HorarioWidgets. */
function PersonalizarTema() {
  const eleccion = useTienda((s) => s.eleccionTema);
  const ajustar = useTienda((s) => s.ajustarTema);
  const restablecer = useTienda((s) => s.restablecerTema);
  const t = temaEfectivo(eleccion);
  const [error, setError] = useState<string | null>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const elegirImagen = async (f: File | undefined) => {
    if (!f) return;
    try {
      setError(null);
      ajustar({ imagen: await leerImagenFondo(f), tipoFondo: "imagen" });
    } catch {
      setError("No se pudo usar esa imagen.");
    }
  };

  const fondos: { id: TipoFondo; nombre: string }[] = [
    { id: "solido", nombre: "Sólido" },
    { id: "degradado", nombre: "Degradado" },
    { id: "imagen", nombre: "Imagen" },
  ];

  return (
    <details className="rounded-lg border border-borde">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Personalizar tema</summary>
      <div className="space-y-4 border-t border-borde p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <CampoColor etiqueta="Menú" valor={t.lateral} alCambiar={(v) => ajustar({ lateral: v })} />
          <CampoColor etiqueta="Texto del menú" valor={t.lateralTexto} alCambiar={(v) => ajustar({ lateralTexto: v })} />
          <CampoColor etiqueta="Acento" valor={t.acento} alCambiar={(v) => ajustar({ acento: v })} />
          <CampoColor etiqueta="Tarjetas" valor={t.panel} alCambiar={(v) => ajustar({ panel: v })} />
          <CampoColor etiqueta="Textos" valor={t.texto} alCambiar={(v) => ajustar({ texto: v })} />
        </div>

        <div className="space-y-2">
          <div role="group" aria-label="Fondo" className="flex w-fit gap-0.5 rounded-md bg-suave p-0.5">
            {fondos.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={t.tipoFondo === f.id}
                onClick={() => (f.id === "imagen" && !t.imagen ? archivo.current?.click() : ajustar({ tipoFondo: f.id }))}
                className={`rounded px-3 py-1 text-sm ${t.tipoFondo === f.id ? "bg-panel font-medium shadow-sm" : "text-tenue hover:text-texto"}`}
              >
                {f.nombre}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {t.tipoFondo !== "imagen" && <CampoColor etiqueta="Fondo" valor={t.fondo} alCambiar={(v) => ajustar({ fondo: v })} />}
            {t.tipoFondo === "degradado" && <CampoColor etiqueta="Fondo 2" valor={t.fondo2} alCambiar={(v) => ajustar({ fondo2: v })} />}
            {t.tipoFondo === "imagen" && (
              <button type="button" className={claseBoton} onClick={() => archivo.current?.click()}>
                Cambiar imagen
              </button>
            )}
            <input ref={archivo} type="file" accept="image/*" aria-label="Imagen de fondo" className="hidden" onChange={(e) => void elegirImagen(e.target.files?.[0])} />
          </div>
          {error && <p className="text-xs text-peligro">{error}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Deslizador etiqueta="Opacidad del menú" valor={t.opacidadLateral} min={0} max={100} unidad="%" alCambiar={(v) => ajustar({ opacidadLateral: v })} />
          <Deslizador etiqueta="Opacidad de las tarjetas" valor={t.opacidadPaneles} min={30} max={100} unidad="%" alCambiar={(v) => ajustar({ opacidadPaneles: v })} />
          <Deslizador etiqueta="Esquinas" valor={t.radio} min={0} max={20} unidad=" px" alCambiar={(v) => ajustar({ radio: v })} />
          <Deslizador etiqueta="Tamaño del texto" valor={t.escalaTexto} min={85} max={125} unidad="%" alCambiar={(v) => ajustar({ escalaTexto: v })} />
        </div>

        <button type="button" className={claseBoton} onClick={restablecer}>
          Restablecer tema
        </button>
      </div>
    </details>
  );
}

/** Tema de colores de la app; se guarda en este dispositivo. */
function Apariencia() {
  const eleccion = useTienda((s) => s.eleccionTema);
  const elegirTema = useTienda((s) => s.elegirTema);
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Tema de la app" className="flex flex-wrap gap-2 lg:grid lg:grid-cols-5 lg:gap-4">
        {TEMAS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={eleccion.id === t.id}
            onClick={() => elegirTema(t.id)}
            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-xs lg:gap-2 lg:rounded-xl lg:p-4 lg:text-base ${eleccion.id === t.id ? "border-acento bg-acento-suave font-medium" : "border-borde hover:bg-suave"}`}
          >
            <MiniaturaTema tema={t} />
            {t.nombre}
          </button>
        ))}
      </div>
      <PersonalizarTema />
      <p className="text-xs text-tenue">Se guarda en este dispositivo: puedes usar un tema distinto en el computador y en el celular.</p>
    </div>
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
      {/* En la app de Android no hay ventanas emergentes para entrar con Google. */}
      {!esAppNativa() && (
        <button type="button" className={`${claseBoton} mt-2 w-full`} disabled={ocupada} onClick={() => void entrarConGoogle()}>
          Continuar con Google
        </button>
      )}
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
  if (esAppNativa()) return <p className="text-sm text-tenue">Estás usando la app de Android de Andamia.</p>;
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

/** Vista "Tema" del menú: elegir y personalizar el tema de la app. */
export function VistaTema() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-4 p-5 lg:max-w-5xl lg:px-10 lg:py-8">
        <div className="flex items-center"><FlechaVolver /><h1 className="text-xl font-semibold lg:text-2xl">Tema</h1></div>
        <Seccion titulo="Elige un tema">
          <Apariencia />
        </Seccion>
      </div>
    </div>
  );
}

function SelectorIdioma() {
  return (
    <div>
      <p className="mb-2 text-sm text-tenue">Elige el idioma de la app. Se guarda en este dispositivo.</p>
      <div role="radiogroup" aria-label="Idioma" data-no-traducir className="flex gap-2">
        {IDIOMAS.map((i) => (
          <button
            key={i.id}
            type="button"
            role="radio"
            aria-checked={IDIOMA === i.id}
            lang={i.id}
            onClick={() => IDIOMA !== i.id && elegirIdioma(i.id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${IDIOMA === i.id ? "border-acento bg-acento-suave text-acento" : "border-borde hover:bg-suave"}`}
          >
            {i.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VistaAjustes() {
  const configurada = useCuenta((s) => s.configurada);
  const usuario = useCuenta((s) => s.usuario);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl space-y-4 p-5 lg:my-auto lg:max-w-3xl">
        <div className="flex items-center"><FlechaVolver /><h1 className="text-xl font-semibold">Cuenta y ajustes</h1></div>
        <Seccion titulo="Cuenta">
          {!configurada ? (
            <p data-testid="sin-firebase" className="text-sm text-tenue">Las cuentas aún no están configuradas en esta instalación. Tus datos se guardan solo en este navegador. La guía está en docs/firebase-paso-a-paso.md.</p>
          ) : usuario ? (
            <PanelCuenta />
          ) : (
            <FormularioAcceso />
          )}
        </Seccion>
        <Seccion titulo="Idioma">
          <SelectorIdioma />
        </Seccion>
        <Seccion titulo="Copia de seguridad">
          <CopiaSeguridad />
        </Seccion>
        <Seccion titulo="Instalar la app">
          <Instalacion />
        </Seccion>
        {recordatoriosActivos && (
          <Seccion titulo="Avisos">
            <p className="mb-2 text-sm text-tenue">Los avisos son fiables con la app abierta. Con la app cerrada solo funcionan a veces: el navegador decide cuándo revisar, y solo con la app instalada en Chrome o Edge.</p>
            <BotonAvisos />
          </Seccion>
        )}
      </div>
    </div>
  );
}
