import { apiError, ensureCurrentUser, getDatabase } from "../../lib/server";
import { validateProfileUpdate } from "../../lib/profile";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });

    const validation = validateProfileUpdate(await request.json());
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

    const db = await getDatabase();
    await db.prepare("UPDATE users SET name = ?, profile_photo = ? WHERE lower(email) = ?")
      .bind(validation.value.name, validation.value.profilePhoto, currentUser.email.toLowerCase())
      .run();

    return Response.json({ message: "Perfil atualizado com sucesso." });
  } catch (error) {
    return apiError(error);
  }
}
