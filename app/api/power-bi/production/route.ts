import { apiError, getDatabase, getPowerBiApiKey } from "../../../lib/server";

export const dynamic = "force-dynamic";

type ProductionRow = {
  id: number;
  attendantEmail: string;
  attendantName: string;
  employeeCode: string | null;
  type: "Protocolo" | "Ligação";
  protocol: string | null;
  outcome: string | null;
  typology: string;
  state: string | null;
  quantity: number;
  durationSeconds: number;
  productiveSeconds: number;
  occurredAt: string;
  date: string;
  time: string;
};

function unauthorized() {
  return Response.json(
    { error: "Credencial do Power BI inválida." },
    { status: 401, headers: { "www-authenticate": 'Basic realm="Backoffice Produção"' } },
  );
}

async function secureEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function authorized(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return false;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0 || decoded.slice(0, separator) !== "powerbi") return false;
    return secureEqual(decoded.slice(separator + 1), await getPowerBiApiKey());
  } catch {
    return false;
  }
}

function isoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

export async function GET(request: Request) {
  try {
    if (!(await authorized(request))) return unauthorized();

    const url = new URL(request.url);
    const startDate = isoDate(url.searchParams.get("startDate"));
    const endDate = isoDate(url.searchParams.get("endDate"));
    const requestedType = url.searchParams.get("type");
    const kind = requestedType === "protocol" || requestedType === "call" ? requestedType : null;

    const clauses: string[] = [];
    const bindings: string[] = [];
    if (startDate) {
      clauses.push("substr(a.occurred_at, 1, 10) >= ?");
      bindings.push(startDate);
    }
    if (endDate) {
      clauses.push("substr(a.occurred_at, 1, 10) <= ?");
      bindings.push(endDate);
    }
    if (kind) {
      clauses.push("a.kind = ?");
      bindings.push(kind);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const db = await getDatabase();
    const statement = db.prepare(`SELECT
      a.id,
      a.user_email AS attendantEmail,
      COALESCE(u.name, a.user_email) AS attendantName,
      u.employee_code AS employeeCode,
      CASE WHEN a.kind = 'protocol' THEN 'Protocolo' ELSE 'Ligação' END AS type,
      a.protocol,
      CASE a.outcome WHEN 'deferred' THEN 'Deferido' WHEN 'analysis' THEN 'Em análise' WHEN 'denied' THEN 'Indeferido' ELSE 'Não informado' END AS outcome,
      a.typology_name AS typology,
      a.distribution_state AS state,
      a.quantity,
      a.duration_seconds AS durationSeconds,
      (a.duration_seconds * a.quantity) AS productiveSeconds,
      a.occurred_at AS occurredAt,
      substr(a.occurred_at, 1, 10) AS date,
      substr(a.occurred_at, 12, 5) AS time
    FROM activities a
    LEFT JOIN users u ON lower(u.email) = lower(a.user_email)
    ${where}
    ORDER BY a.occurred_at DESC, a.id DESC
    LIMIT 10000`);
    const result = bindings.length
      ? await statement.bind(...bindings).all<ProductionRow>()
      : await statement.all<ProductionRow>();

    return Response.json(result.results ?? [], {
      headers: {
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
