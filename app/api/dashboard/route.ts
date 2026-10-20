import { apiError, ensureCurrentUser, getDatabase, isAdminEmail } from "../../lib/server";

export const dynamic = "force-dynamic";

type ActivityRow = {
  id: number;
  userEmail: string;
  userName: string;
  kind: "protocol" | "call";
  protocol: string | null;
  outcome: "deferred" | "analysis" | "denied" | null;
  typologyId: number;
  typologyName: string;
  quantity: number;
  durationSeconds: number;
  occurredAt: string;
  distributionState: string | null;
  backofficeUrl: string | null;
};

export async function GET(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const db = await getDatabase();
    const typologyResult = await db
      .prepare("SELECT id, name, seconds FROM typologies WHERE active = 1 ORDER BY id")
      .all<{ id: number; name: string; seconds: number }>();

    const activitySql = currentUser.role === "supervisor"
      ? `SELECT a.id, a.user_email AS userEmail, COALESCE(u.name, a.user_email) AS userName,
          a.kind, a.protocol, a.outcome, a.typology_id AS typologyId, a.typology_name AS typologyName,
          a.quantity, a.duration_seconds AS durationSeconds, a.occurred_at AS occurredAt,
          a.distribution_state AS distributionState,
          a.backoffice_url AS backofficeUrl
         FROM activities a LEFT JOIN users u ON u.email = a.user_email
         ORDER BY a.occurred_at DESC, a.id DESC LIMIT 5000`
      : `SELECT a.id, a.user_email AS userEmail, COALESCE(u.name, a.user_email) AS userName,
          a.kind, a.protocol, a.outcome, a.typology_id AS typologyId, a.typology_name AS typologyName,
          a.quantity, a.duration_seconds AS durationSeconds, a.occurred_at AS occurredAt,
          a.distribution_state AS distributionState,
          a.backoffice_url AS backofficeUrl
         FROM activities a LEFT JOIN users u ON u.email = a.user_email
         WHERE a.user_email = ? ORDER BY a.occurred_at DESC, a.id DESC LIMIT 500`;
    const activityStatement = db.prepare(activitySql);
    const activityResult = currentUser.role === "supervisor"
      ? await activityStatement.all<ActivityRow>()
      : await activityStatement.bind(currentUser.email).all<ActivityRow>();

    const teamResult = currentUser.role === "supervisor"
      ? await db.prepare(`SELECT u.email, u.name, u.role,
          COALESCE(SUM(CASE WHEN a.kind = 'protocol' THEN a.quantity ELSE 0 END), 0) AS protocols,
          COALESCE(SUM(CASE WHEN a.kind = 'call' THEN a.quantity ELSE 0 END), 0) AS calls,
          COALESCE(SUM(a.quantity), 0) AS total,
          COALESCE(SUM(a.duration_seconds * a.quantity), 0) AS productiveSeconds
        FROM users u LEFT JOIN activities a ON a.user_email = u.email
        WHERE u.role = 'attendant' AND u.registration_complete = 1
        GROUP BY u.email, u.name, u.role ORDER BY u.name`).all<{
          email: string;
          name: string;
          role: string;
          protocols: number;
          calls: number;
          total: number;
          productiveSeconds: number;
        }>()
      : { results: [] };

    return Response.json({
      currentUser: { ...currentUser, isAdmin: isAdminEmail(currentUser.email) },
      typologies: typologyResult.results ?? [],
      activities: activityResult.results ?? [],
      team: teamResult.results ?? [],
      settings: { workdaySeconds: 20400, goal: 0.9, challenge: 1 },
    });
  } catch (error) {
    return apiError(error);
  }
}
