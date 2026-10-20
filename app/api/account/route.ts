import { apiError, ensureCurrentUser, getDatabase } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });
    if (currentUser.role !== "attendant") {
      return Response.json({ error: "A conta da supervisão já está configurada." }, { status: 403 });
    }

    const payload = (await request.json()) as { name?: string; employeeCode?: string };
    const name = payload.name?.trim();
    const employeeCode = payload.employeeCode?.trim();
    if (!name || name.length < 3) {
      return Response.json({ error: "Informe seu nome completo." }, { status: 400 });
    }
    if (!employeeCode || employeeCode.length < 2) {
      return Response.json({ error: "Informe sua matrícula ou identificação." }, { status: 400 });
    }
    if (name.length > 120 || employeeCode.length > 40) {
      return Response.json({ error: "Revise os dados informados." }, { status: 400 });
    }

    const db = await getDatabase();
    await db
      .prepare(`UPDATE users SET name = ?, employee_code = ?, registration_complete = 1
        WHERE email = ? AND role = 'attendant'`)
      .bind(name, employeeCode, currentUser.email)
      .run();

    return Response.json({ message: "Cadastro concluído com sucesso." });
  } catch (error) {
    return apiError(error);
  }
}
