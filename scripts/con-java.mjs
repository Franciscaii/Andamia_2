// Ejecuta un comando con Java disponible, para los emuladores de Firebase.
// Usa el Java del sistema o, si no hay, el que trae Android Studio. No instala nada.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function buscarJava() {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  if (spawnSync("java", ["-version"], { stdio: "ignore", shell: true }).status === 0) return null;
  const candidatos = [process.env.ProgramFiles && join(process.env.ProgramFiles, "Android", "Android Studio", "jbr"), "/Applications/Android Studio.app/Contents/jbr/Contents/Home"];
  return candidatos.find((c) => c && existsSync(join(c, "bin"))) ?? false;
}

export function entornoConJava() {
  const java = buscarJava();
  if (java === false) return null;
  if (java === null) return { ...process.env };
  const separador = process.platform === "win32" ? ";" : ":";
  const clavePath = Object.keys(process.env).find((k) => k.toLowerCase() === "path") ?? "PATH";
  return { ...process.env, JAVA_HOME: java, [clavePath]: `${join(java, "bin")}${separador}${process.env[clavePath] ?? ""}` };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const entorno = entornoConJava();
  if (!entorno) {
    console.error("Los emuladores de Firebase necesitan Java 21 o superior, y no lo encontré en este equipo.");
    process.exit(1);
  }
  const comando = process.argv.slice(2).map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(" ");
  const hijo = spawn(comando, { stdio: "inherit", shell: true, env: entorno });
  hijo.on("exit", (codigo) => process.exit(codigo ?? 1));
}
