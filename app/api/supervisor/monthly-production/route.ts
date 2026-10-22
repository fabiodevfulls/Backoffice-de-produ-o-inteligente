import { apiError, ensureCurrentUser, getDatabase } from "../../../lib/server";

export const dynamic = "force-dynamic";

type MonthlyActivity = {
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
    if (currentUser.role !== "supervisor") {
      return Response.json({ error: "Acesso restrito à supervisão." }, { status: 403 });
    }

    const params = new URL(request.url).searchParams;
    const month = params.get("month") ?? "";
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) return Response.json({ error: "Informe um mês válido." }, { status: 400 });

    const start = `${month}-01`;
    const nextMonth = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1));
    const end = nextMonth.toISOString().slice(0, 10);
    const selectedEmail = (params.get("email") ?? "").trim().toLowerCase();
    const db = await getDatabase();

    const teamResult = await db.prepare(`SELECT u.email, u.name,
        COALESCE(SUM(CASE WHEN a.kind = 'protocol' THEN a.quantity ELSE 0 END), 0) AS protocols,
        COALESCE(SUM(CASE WHEN a.kind = 'call' THEN a.quantity ELSE 0 END), 0) AS calls,
        COALESCE(SUM(a.quantity), 0) AS total,
        COALESCE(SUM(a.duration_seconds * a.quantity), 0) AS productiveSeconds,
        COUNT(DISTINCT CASE WHEN a.id IS NOT NULL THEN substr(a.occurred_at, 1, 10) END) AS activeDays
      FROM users u
      LEFT JOIN activities a ON a.user_email = u.email AND a.occurred_at >= ? AND a.occurred_at < ?
      WHERE u.role = 'attendant' AND u.registration_complete = 1
      GROUP BY u.email, u.name ORDER BY u.name`).bind(start, end).all<{
        email: string;
        name: string;
        protocols: number;
        calls: number;
        total: number;
        productiveSeconds: number;
        activeDays: number;
      }>();

    const recentSql = selectedEmail
      ? `SELECT a.id, a.user_email AS userEmail, COALESCE(u.name, a.user_email) AS userName,
          a.kind, a.protocol, a.outcome, a.typology_id AS typologyId, a.typology_name AS typologyName,
          a.quantity, a.duration_seconds AS durationSeconds, a.occurred_at AS occurredAt,
          a.distribution_state AS distributionState, a.backoffice_url AS backofficeUrl
        FROM activities a JOIN users u ON u.email = a.user_email
        WHERE u.role = 'attendant' AND u.registration_complete = 1
          AND a.occurred_at >= ? AND a.occurred_at < ? AND lower(a.user_email) = ?
        ORDER BY a.occurred_at DESC, a.id DESC LIMIT 8`
      : `SELECT a.id, a.user_email AS userEmail, COALESCE(u.name, a.user_email) AS userName,
          a.kind, a.protocol, a.outcome, a.typology_id AS typologyId, a.typology_name AS typologyName,
          a.quantity, a.duration_seconds AS durationSeconds, a.occurred_at AS occurredAt,
          a.distribution_state AS distributionState, a.backoffice_url AS backofficeUrl
        FROM activities a JOIN users u ON u.email = a.user_email
        WHERE u.role = 'attendant' AND u.registration_complete = 1
          AND a.occurred_at >= ? AND a.occurred_at < ?
        ORDER BY a.occurred_at DESC, a.id DESC LIMIT 8`;
    const recentResult = await (selectedEmail
      ? db.prepare(recentSql).bind(start, end, selectedEmail)
      : db.prepare(recentSql).bind(start, end)).all<MonthlyActivity>();

    return Response.json({ month, team: teamResult.results ?? [], recentActivities: recentResult.results ?? [] });
  } catch (error) {
    return apiError(error);
  }
}

