import { createDemoAccess, digestDemoToken, generateDemoToken, isDemoAccessEnabled } from "../../lib/demo-access";
import { replaceDemoAccess } from "../../lib/demo-access-store";
import { apiError, ensureCurrentUser, getDatabase, isAdminEmail } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isDemoAccessEnabled(process.env.DEMO_ACCESS_ENABLED)) {
      return Response.json({ error: "A geração do acesso de demonstração está temporariamente indisponível." }, {
        status: 503,
        headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
      });
    }
    const admin = await ensureCurrentUser(request);
    if (!admin) return Response.json({ error: "Não autenticado." }, { status: 401 });
    if (!isAdminEmail(admin.email)) return Response.json({ error: "Acesso restrito ao administrador." }, { status: 403 });

    const access = await createDemoAccess({
      origin: new URL(request.url).origin,
      createdBy: admin.email,
    }, {
      now: () => new Date(),
      generateId: () => crypto.randomUUID(),
      generateToken: generateDemoToken,
      hashToken: digestDemoToken,
      createAccess: async (record) => replaceDemoAccess(await getDatabase(), record),
    });
    return Response.json(access, {
      status: 201,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  } catch (error) {
    return apiError(error);
  }
}
