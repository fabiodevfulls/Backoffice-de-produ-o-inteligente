import { sessionEmail } from "./auth";
import { isDemoAccessEnabled } from "./demo-access";
import { getDatabase } from "./server";

export async function hasActiveDemoSession(requestHeaders: Headers) {
  if (!isDemoAccessEnabled(process.env.DEMO_ACCESS_ENABLED)) return false;
  const email = await sessionEmail(requestHeaders);
  if (!email?.endsWith("@demo.invalid")) return false;
  const db = await getDatabase();
  const access = await db.prepare(`SELECT 1 AS allowed FROM demo_access
    WHERE user_email = ? AND revoked_at IS NULL AND expires_at > ?`)
    .bind(email, new Date().toISOString()).first<{ allowed: number }>();
  return Boolean(access?.allowed);
}
