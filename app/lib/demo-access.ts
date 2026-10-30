export const DEMO_SESSION_SECONDS = 3600;
export const DEMO_ACCESS_EXPIRES_AT = "2026-11-13T03:00:00.000Z";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_END = Date.parse(DEMO_ACCESS_EXPIRES_AT);

export type DemoAccessRecord = {
  id: string;
  email: string;
  tokenHash: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
};

export function isDemoAccessEnabled(value: unknown) {
  return value === "true";
}

export function generateDemoToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function digestDemoToken(token: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function createDemoAccess(
  input: { origin: string; createdBy: string },
  dependencies: {
    now: () => Date;
    generateId: () => string;
    generateToken: () => string;
    hashToken: (token: string) => Promise<string>;
    createAccess: (record: DemoAccessRecord) => Promise<void>;
  },
) {
  const now = dependencies.now();
  if (now.getTime() >= TOKEN_END) {
    throw new Error("O período do acesso de demonstração terminou em 12 de novembro de 2026.");
  }

  const id = dependencies.generateId();
  const token = dependencies.generateToken();
  if (!TOKEN_PATTERN.test(token)) throw new Error("Não foi possível gerar um token de demonstração seguro.");

  const url = new URL("/demo-access", input.origin);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("O acesso de demonstração exige uma origem HTTPS.");
  }
  url.hash = token;

  const createdAt = now.toISOString();
  const expiresAt = DEMO_ACCESS_EXPIRES_AT;
  await dependencies.createAccess({
    id,
    email: `demo-${id}@demo.invalid`,
    tokenHash: await dependencies.hashToken(token),
    createdBy: input.createdBy.trim().toLowerCase(),
    createdAt,
    expiresAt,
  });
  return { url: url.toString(), expiresAt };
}

export async function redeemDemoAccess(
  token: unknown,
  dependencies: {
    now: () => Date;
    hashToken: (token: string) => Promise<string>;
    findAccess: (tokenHash: string, checkedAt: string) => Promise<{ email: string; expiresAt: string } | null>;
  },
) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;
  const now = dependencies.now();
  const access = await dependencies.findAccess(await dependencies.hashToken(token), now.toISOString());
  if (!access) return null;
  const remaining = Math.floor((Date.parse(access.expiresAt) - now.getTime()) / 1000);
  if (!Number.isFinite(remaining) || remaining < 1) return null;
  return { email: access.email, maxAgeSeconds: Math.min(DEMO_SESSION_SECONDS, remaining) };
}
