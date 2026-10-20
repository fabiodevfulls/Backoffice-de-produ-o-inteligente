import { hashPassword } from "../../../lib/auth";
import { apiError, ensureSchema, getDatabase, getRegistrationTestEmail, sendGmailMessage } from "../../../lib/server";

export const dynamic = "force-dynamic";
const ADMIN_EMAIL = "fabiodasilvaa82@gmail.com";
const MAX_ATTENDANTS = 25;
const CORPORATE_DOMAIN = "@equatorialservicos.com.br";
const MAX_CODE_ATTEMPTS = 5;
const CODE_EXPIRATION_MINUTES = 10;
const RESEND_WAIT_SECONDS = 60;

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { action?: string; name?: string; email?: string; employeeCode?: string; password?: string; code?: string };
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const employeeCode = payload.employeeCode?.trim();
    const password = payload.password ?? "";
    const action = payload.action ?? "request-code";
    await ensureSchema();

    if (action !== "request-code" && action !== "confirm-code") {
      return Response.json({ error: "Ação de cadastro inválida." }, { status: 400 });
    }

    if (action === "confirm-code") {
      const code = payload.code?.trim() ?? "";
      if (!email || !/^\d{6}$/.test(code)) return Response.json({ error: "Informe o código de 6 números." }, { status: 400 });
      const db = await getDatabase();
      const challenge = await db.prepare(`SELECT name, employee_code AS employeeCode, password_hash AS passwordHash,
        password_salt AS passwordSalt, code_hash AS codeHash, expires_at AS expiresAt, attempts
        FROM registration_verifications WHERE email = ?`).bind(email).first<{
          name: string; employeeCode: string; passwordHash: string; passwordSalt: string;
          codeHash: string; expiresAt: string; attempts: number;
        }>();
      if (!challenge) return Response.json({ error: "Solicite um novo código." }, { status: 400 });
      if (Date.parse(challenge.expiresAt) < Date.now()) {
        await db.prepare("DELETE FROM registration_verifications WHERE email = ?").bind(email).run();
        return Response.json({ error: "O código expirou. Solicite outro." }, { status: 400 });
      }
      if (challenge.attempts >= MAX_CODE_ATTEMPTS) return Response.json({ error: "Limite de tentativas atingido. Solicite outro código." }, { status: 429 });
      if ((await digest(`${email}:${code}`)) !== challenge.codeHash) {
        await db.prepare("UPDATE registration_verifications SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
        return Response.json({ error: "Código inválido." }, { status: 400 });
      }
      const exists = await db.prepare("SELECT 1 AS found FROM users WHERE email = ?").bind(email).first<{ found: number }>();
      if (exists?.found) return Response.json({ error: "Já existe um cadastro com esse e-mail." }, { status: 409 });
      const count = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'attendant' AND email <> ?").bind(ADMIN_EMAIL).first<{ total: number }>();
      if ((count?.total ?? 0) >= MAX_ATTENDANTS) return Response.json({ error: `O limite de ${MAX_ATTENDANTS} atendentes foi atingido.` }, { status: 409 });
      await db.batch([
        db.prepare(`INSERT INTO users
          (email, name, employee_code, role, registration_complete, password_hash, password_salt, active, created_at)
          VALUES (?, ?, ?, 'attendant', 1, ?, ?, 1, ?)`).bind(email, challenge.name, challenge.employeeCode, challenge.passwordHash, challenge.passwordSalt, new Date().toISOString()),
        db.prepare("DELETE FROM registration_verifications WHERE email = ?").bind(email),
      ]);
      return Response.json({ message: "E-mail validado e cadastro criado. Agora você pode entrar." }, { status: 201 });
    }
    if (!name || name.length < 3 || name.length > 120) return Response.json({ error: "Informe seu nome completo." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    const testEmail = await getRegistrationTestEmail();
    if (!email.endsWith(CORPORATE_DOMAIN) && email !== testEmail) return Response.json({ error: `Use somente o e-mail corporativo ${CORPORATE_DOMAIN}.` }, { status: 400 });
    if (!employeeCode || employeeCode.length < 2 || employeeCode.length > 40) return Response.json({ error: "Informe sua matrícula." }, { status: 400 });
    if (password.length < 8 || password.length > 128) return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
    if (email === ADMIN_EMAIL) return Response.json({ error: "Esse e-mail pertence ao administrador." }, { status: 400 });

    const db = await getDatabase();
    const count = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'attendant' AND email <> ?").bind(ADMIN_EMAIL).first<{ total: number }>();
    if ((count?.total ?? 0) >= MAX_ATTENDANTS) return Response.json({ error: `O limite de ${MAX_ATTENDANTS} atendentes foi atingido.` }, { status: 409 });
    const exists = await db.prepare("SELECT 1 AS found FROM users WHERE email = ?").bind(email).first<{ found: number }>();
    if (exists?.found) return Response.json({ error: "Já existe um cadastro com esse e-mail." }, { status: 409 });

    const previous = await db.prepare("SELECT last_sent_at AS lastSentAt FROM registration_verifications WHERE email = ?")
      .bind(email).first<{ lastSentAt: string }>();
    if (previous?.lastSentAt && Date.now() - Date.parse(previous.lastSentAt) < RESEND_WAIT_SECONDS * 1000) {
      return Response.json({ error: "Aguarde 1 minuto antes de solicitar outro código." }, { status: 429 });
    }
    const credentials = await hashPassword(password);
    const code = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(10, "0").slice(-6);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_EXPIRATION_MINUTES * 60_000).toISOString();
    await db.prepare(`INSERT INTO registration_verifications
      (email, name, employee_code, password_hash, password_salt, code_hash, expires_at, attempts, last_sent_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET name = excluded.name, employee_code = excluded.employee_code,
        password_hash = excluded.password_hash, password_salt = excluded.password_salt,
        code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0,
        last_sent_at = excluded.last_sent_at, created_at = excluded.created_at`)
      .bind(email, name, employeeCode, credentials.hash, credentials.salt,
        await digest(`${email}:${code}`), expiresAt, now.toISOString(), now.toISOString()).run();
    try {
      await sendGmailMessage(email, "Código de validação — Backoffice Produção",
        `Seu código de validação é: ${code}\n\nEle expira em ${CODE_EXPIRATION_MINUTES} minutos.\nSe você não solicitou este código, ignore esta mensagem.`);
    } catch (error) {
      await db.prepare("DELETE FROM registration_verifications WHERE email = ?").bind(email).run();
      throw error;
    }
    return Response.json({ message: "Código enviado. Consulte seu e-mail para concluir o cadastro." });
  } catch (error) {
    return apiError(error);
  }
}
