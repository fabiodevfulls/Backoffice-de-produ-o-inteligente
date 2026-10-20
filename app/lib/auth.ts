const COOKIE_NAME = "backoffice_session";
const DEFAULT_EMAIL = "fabiodasilvaa82@gmail.com";
const SESSION_SECONDS = 60 * 60 * 12;
const PASSWORD_HASH_ITERATIONS = 100_000;

type AuthEnv = { AUTH_EMAIL?: string; AUTH_PASSWORD?: string; SESSION_SECRET?: string; DB?: D1Database };
type SessionPayload = { email: string; exp: number };

async function authEnv() {
  const cloudflare = await import("cloudflare:workers");
  const env = cloudflare.env as unknown as AuthEnv;
  const password = env.AUTH_PASSWORD ?? process.env.AUTH_PASSWORD;
  const secret = env.SESSION_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) throw new Error("Sessão de login ainda não configurada.");
  return {
    AUTH_EMAIL: (env.AUTH_EMAIL ?? process.env.AUTH_EMAIL ?? DEFAULT_EMAIL).toLowerCase(),
    AUTH_PASSWORD: password,
    SESSION_SECRET: secret,
    DB: env.DB,
  };
}

function base64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return new Uint8Array([...binary].map((character) => character.charCodeAt(0)));
}

async function signature(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function secureEqual(left: string, right: string) {
  const { SESSION_SECRET } = await authEnv();
  const [a, b] = await Promise.all([signature(left, SESSION_SECRET), signature(right, SESSION_SECRET)]);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function authenticate(email: string, password: string) {
  const env = await authEnv();
  const normalizedEmail = email.trim().toLowerCase();
  if (env.AUTH_PASSWORD) {
    const [emailMatches, passwordMatches] = await Promise.all([
      secureEqual(normalizedEmail, env.AUTH_EMAIL),
      secureEqual(password, env.AUTH_PASSWORD),
    ]);
    if (emailMatches && passwordMatches) return normalizedEmail;
  }
  if (!env.DB) return null;
  const user = await env.DB.prepare(`SELECT password_hash AS passwordHash, password_salt AS passwordSalt
    FROM users WHERE email = ? AND active = 1 AND registration_complete = 1`)
    .bind(normalizedEmail)
    .first<{ passwordHash: string | null; passwordSalt: string | null }>();
  if (!user?.passwordHash || !user.passwordSalt) return null;
  return (await verifyPassword(password, user.passwordSalt, user.passwordHash)) ? normalizedEmail : null;
}

export async function hashPassword(password: string, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_HASH_ITERATIONS }, key, 256);
  return { hash: base64url(new Uint8Array(bits)), salt: base64url(salt) };
}

async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const calculated = await hashPassword(password, fromBase64url(salt));
  return secureEqual(calculated.hash, expectedHash);
}

export async function createSessionCookie(email: string) {
  const { SESSION_SECRET } = await authEnv();
  const payload = base64url(JSON.stringify({ email, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS } satisfies SessionPayload));
  const token = `${payload}.${base64url(await signature(payload, SESSION_SECRET))}`;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function sessionEmail(requestHeaders: Headers) {
  const token = requestHeaders.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token) return null;
  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;
  const { SESSION_SECRET, AUTH_EMAIL, DB } = await authEnv();
  const expected = base64url(await signature(payload, SESSION_SECRET));
  if (!(await secureEqual(suppliedSignature, expected))) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as SessionPayload;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (await secureEqual(session.email, AUTH_EMAIL)) return session.email;
    if (!DB) return null;
    const active = await DB.prepare("SELECT 1 AS allowed FROM users WHERE email = ? AND active = 1 AND registration_complete = 1").bind(session.email).first<{ allowed: number }>();
    return active?.allowed ? session.email : null;
  } catch {
    return null;
  }
}
