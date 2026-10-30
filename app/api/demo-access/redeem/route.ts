import { createSessionCookie } from "../../../lib/auth";
import { digestDemoToken, isDemoAccessEnabled, redeemDemoAccess } from "../../../lib/demo-access";
import { findDemoAccess } from "../../../lib/demo-access-store";
import { apiError, ensureSchema, getDatabase } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!isDemoAccessEnabled(process.env.DEMO_ACCESS_ENABLED)) {
      return Response.json({ error: "O acesso de demonstração está temporariamente indisponível." }, {
        status: 503,
        headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
      });
    }
    const body = await request.json().catch(() => null) as { token?: unknown } | null;
    const accessToken = await redeemDemoAccess(body?.token, {
      now: () => new Date(),
      hashToken: digestDemoToken,
      findAccess: async (tokenHash, checkedAt) => {
        await ensureSchema();
        return findDemoAccess(await getDatabase(), tokenHash, checkedAt);
      },
    });
    if (!accessToken) return Response.json({ error: "Este QR Code expirou ou não é válido." }, {
      status: 410,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
    return Response.json({ redirect: "/" }, { headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Set-Cookie": await createSessionCookie(accessToken.email, accessToken.maxAgeSeconds),
    } });
  } catch (error) {
    return apiError(error);
  }
}
