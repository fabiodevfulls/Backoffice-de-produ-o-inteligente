import { hashPassword } from "../../lib/auth";
import { apiError, ensureCurrentUser, getDatabase, isAdminEmail } from "../../lib/server";

export const dynamic = "force-dynamic";
const ADMIN_EMAIL = "fabiodasilvaa82@gmail.com";
const MAX_ATTENDANTS = 25;
const CORPORATE_DOMAIN = "@equatorialservicos.com.br";

async function requireAdmin(request: Request) {
  const user = await ensureCurrentUser(request);
  return user && isAdminEmail(user.email) ? user : null;
}

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin(request))) return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const db = await getDatabase();
    const result = await db.prepare(`SELECT u.email, u.name, u.employee_code AS employeeCode, u.active, u.created_at AS createdAt,
      COALESCE(SUM(CASE WHEN a.kind = 'protocol' THEN a.quantity ELSE 0 END), 0) AS protocols,
      COALESCE(SUM(CASE WHEN a.kind = 'call' THEN a.quantity ELSE 0 END), 0) AS calls,
      MAX(a.occurred_at) AS lastActivityAt
      FROM users u LEFT JOIN activities a ON a.user_email = u.email
      WHERE u.role = 'attendant' AND u.email <> ?
      GROUP BY u.email, u.name, u.employee_code, u.active, u.created_at ORDER BY u.name`).bind(ADMIN_EMAIL).all();
    return Response.json({ attendants: result.results ?? [], limit: MAX_ATTENDANTS });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin(request))) return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const payload = (await request.json()) as { email?: string; active?: boolean };
    const email = payload.email?.trim().toLowerCase();
    if (!email || typeof payload.active !== "boolean") return Response.json({ error: "Informe o atendente e o novo status." }, { status: 400 });
    if (isAdminEmail(email)) return Response.json({ error: "Não é permitido alterar o acesso de um administrador." }, { status: 403 });
    const db = await getDatabase();
    const result = await db.prepare("UPDATE users SET active = ? WHERE lower(email) = ? AND role = 'attendant'")
      .bind(payload.active ? 1 : 0, email).run();
    if (!result.meta.changes) return Response.json({ error: "Atendente não encontrado." }, { status: 404 });
    return Response.json({ message: payload.active ? "Acesso reativado com sucesso." : "Acesso suspenso com sucesso." });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!(await requireAdmin(request))) return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const payload = (await request.json()) as { name?: string; email?: string; employeeCode?: string; password?: string };
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const employeeCode = payload.employeeCode?.trim();
    const password = payload.password ?? "";
    if (!name || name.length < 3 || name.length > 120) return Response.json({ error: "Informe o nome completo." }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (!email.endsWith(CORPORATE_DOMAIN)) return Response.json({ error: `Use somente e-mail corporativo ${CORPORATE_DOMAIN}.` }, { status: 400 });
    if (!employeeCode || employeeCode.length < 2 || employeeCode.length > 40) return Response.json({ error: "Informe a matrícula." }, { status: 400 });
    if (password.length < 8 || password.length > 128) return Response.json({ error: "A senha deve ter pelo menos 8 caracteres." }, { status: 400 });
    if (email === ADMIN_EMAIL) return Response.json({ error: "Esse e-mail pertence ao administrador." }, { status: 400 });

    const db = await getDatabase();
    const count = await db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'attendant' AND email <> ?").bind(ADMIN_EMAIL).first<{ total: number }>();
    if ((count?.total ?? 0) >= MAX_ATTENDANTS) return Response.json({ error: `Limite de ${MAX_ATTENDANTS} atendentes atingido.` }, { status: 409 });
    const exists = await db.prepare("SELECT 1 AS found FROM users WHERE email = ?").bind(email).first<{ found: number }>();
    if (exists?.found) return Response.json({ error: "Já existe um cadastro com esse e-mail." }, { status: 409 });

    const credentials = await hashPassword(password);
    await db.prepare(`INSERT INTO users
      (email, name, employee_code, role, registration_complete, password_hash, password_salt, active, created_at)
      VALUES (?, ?, ?, 'attendant', 1, ?, ?, 1, ?)`)
      .bind(email, name, employeeCode, credentials.hash, credentials.salt, new Date().toISOString())
      .run();
    return Response.json({ message: "Atendente cadastrado com sucesso." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin(request))) return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });
    const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
    if (!email) return Response.json({ error: "Informe o atendente." }, { status: 400 });
    if (isAdminEmail(email)) return Response.json({ error: "Não é permitido excluir um administrador." }, { status: 403 });
    const db = await getDatabase();
    const user = await db.prepare("SELECT role FROM users WHERE lower(email) = ?").bind(email).first<{ role: string }>();
    if (!user || user.role !== "attendant") return Response.json({ error: "Atendente não encontrado." }, { status: 404 });
    await db.batch([
      db.prepare("DELETE FROM registration_verifications WHERE lower(email) = ?").bind(email),
      db.prepare("DELETE FROM users WHERE lower(email) = ? AND role = 'attendant'").bind(email),
    ]);
    return Response.json({ message: "Cadastro excluído. Os registros de produção foram preservados." });
  } catch (error) {
    return apiError(error);
  }
}
