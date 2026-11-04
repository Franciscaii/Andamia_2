import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 2 ** 15;
const R = 8;
const P = 1;
const LARGO = 32;

function derivar(clave: string, sal: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((ok, mal) => {
    scrypt(clave.normalize("NFKC"), sal, LARGO, { N: n, r, p, maxmem: 256 * n * r }, (e, d) => (e ? mal(e) : ok(d)));
  });
}

export async function cifrarClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(clave, sal, N, R, P);
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarClave(clave: string, guardada: string): Promise<boolean> {
  const [, n, r, p, sal, hash] = guardada.split("$");
  const esperado = Buffer.from(hash, "base64");
  const calculado = await derivar(clave, Buffer.from(sal, "base64"), Number(n), Number(r), Number(p));
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

/** Para gastar lo mismo cuando el usuario no existe, sin revelar qué correos están registrados. */
export const CLAVE_FICTICIA = `scrypt$${N}$${R}$${P}$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(LARGO).toString("base64")}`;

export const nuevoToken = () => randomBytes(32).toString("base64url");

/** En la base solo queda el hash: una copia filtrada no permite entrar. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
