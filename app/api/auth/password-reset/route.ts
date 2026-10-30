import { getConfiguredAuthEmail, hashPassword } from "../../../lib/auth";
import { apiError, ensureSchema, getDatabase, sendGmailMessage } from "../../../lib/server";

export const dynamic = "force-dynamic";
const MAX_CODE_ATTEMPTS = 5;
const CODE_EXPIRATION_MINUTES = 10;
const RESEND_WAIT_SECONDS = 60;
const GENERIC_REQUEST_MESSAGE = "Se esse e-mail estiver cadastrado, enviaremos um código para redefinir a senha.";

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      action?: string;
      email?: string;
      code?: string;
      password?: string;
    };
    const email = payload.email?.trim().toLowerCase() ?? "";
    const action = payload.action ?? "request-code";

    if (action !== "request-code" && action !== "confirm-code") {
      return Response.json({ error: "Ação de recuperação inválida." }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
      return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    }

    await ensureSchema();
    const db = await getDatabase();
    const primaryEmail = await getConfiguredAuthEmail();

    if (action === "request-code") {
      const user = await db.prepare(`SELECT 1 AS found FROM users
        WHERE email = ? AND active = 1 AND registration_complete = 1`)
        .bind(email).first<{ found: number }>();
      const isPrimaryAccount = email === primaryEmail;
      if (!user?.found && !isPrimaryAccount) {
        return Response.json({ message: GENERIC_REQUEST_MESSAGE });
      }

      const previous = await db.prepare(`SELECT last_sent_at AS lastSentAt
        FROM password_reset_verifications WHERE email = ?`)
        .bind(email).first<{ lastSentAt: string }>();
      if (previous?.lastSentAt && Date.now() - Date.parse(previous.lastSentAt) < RESEND_WAIT_SECONDS * 1000) {
        return Response.json({ message: GENERIC_REQUEST_MESSAGE });
      }

      const code = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(10, "0").slice(-6);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CODE_EXPIRATION_MINUTES * 60_000).toISOString();
      await db.prepare(`INSERT INTO password_reset_verifications
        (email, code_hash, expires_at, attempts, last_sent_at, created_at)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at,
          attempts = 0, last_sent_at = excluded.last_sent_at, created_at = excluded.created_at`)
        .bind(email, await digest(`${email}:${code}`), expiresAt, now.toISOString(), now.toISOString()).run();

      try {
        await sendGmailMessage(email, "Código para redefinir sua senha — Backoffice Produção",
          `Seu código para redefinir a senha é: ${code}\n\nEle expira em ${CODE_EXPIRATION_MINUTES} minutos.\nSe você não solicitou esta recuperação, ignore esta mensagem.`);
      } catch (error) {
        await db.prepare("DELETE FROM password_reset_verifications WHERE email = ?").bind(email).run();
        throw error;
      }
      return Response.json({ message: GENERIC_REQUEST_MESSAGE });
    }

    const code = payload.code?.trim() ?? "";
    const password = payload.password ?? "";
    if (!/^\d{6}$/.test(code)) return Response.json({ error: "Informe o código de 6 números." }, { status: 400 });
    if (password.length < 8 || password.length > 128) {
      return Response.json({ error: "A nova senha deve ter entre 8 e 128 caracteres." }, { status: 400 });
    }

    const challenge = await db.prepare(`SELECT code_hash AS codeHash, expires_at AS expiresAt, attempts
      FROM password_reset_verifications WHERE email = ?`)
      .bind(email).first<{ codeHash: string; expiresAt: string; attempts: number }>();
    if (!challenge) return Response.json({ error: "Solicite um novo código de recuperação." }, { status: 400 });
    if (Date.parse(challenge.expiresAt) < Date.now()) {
      await db.prepare("DELETE FROM password_reset_verifications WHERE email = ?").bind(email).run();
      return Response.json({ error: "O código expirou. Solicite outro." }, { status: 400 });
    }
    if (challenge.attempts >= MAX_CODE_ATTEMPTS) {
      return Response.json({ error: "Limite de tentativas atingido. Solicite outro código." }, { status: 429 });
    }
    if ((await digest(`${email}:${code}`)) !== challenge.codeHash) {
      await db.prepare("UPDATE password_reset_verifications SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
      return Response.json({ error: "Código inválido." }, { status: 400 });
    }

    const isPrimaryAccount = email === primaryEmail;
    const user = await db.prepare(`SELECT 1 AS found FROM users
      WHERE email = ? AND active = 1 AND registration_complete = 1`)
      .bind(email).first<{ found: number }>();
    if (!user?.found && !isPrimaryAccount) {
      await db.prepare("DELETE FROM password_reset_verifications WHERE email = ?").bind(email).run();
      return Response.json({ error: "Não foi possível redefinir a senha. Solicite um novo código." }, { status: 400 });
    }

    const credentials = await hashPassword(password);
    const now = new Date().toISOString();
    const updates = isPrimaryAccount
      ? [db.prepare(`INSERT INTO users
          (email, name, employee_code, role, registration_complete, password_hash, password_salt, active, created_at)
          VALUES (?, ?, NULL, 'supervisor', 1, ?, ?, 1, ?)
          ON CONFLICT(email) DO UPDATE SET role = 'supervisor', registration_complete = 1,
            password_hash = excluded.password_hash, password_salt = excluded.password_salt, active = 1`)
          .bind(email, email, credentials.hash, credentials.salt, now)]
      : [db.prepare(`UPDATE users SET password_hash = ?, password_salt = ?
          WHERE email = ? AND active = 1 AND registration_complete = 1`)
          .bind(credentials.hash, credentials.salt, email)];
    await db.batch([
      ...updates,
      db.prepare("DELETE FROM password_reset_verifications WHERE email = ?").bind(email),
    ]);

    return Response.json({ message: "Senha redefinida. Agora você pode entrar com a nova senha." });
  } catch (error) {
    return apiError(error);
  }
}
