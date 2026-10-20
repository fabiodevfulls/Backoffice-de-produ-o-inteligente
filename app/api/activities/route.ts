import { apiError, ensureCurrentUser, getDatabase, isAdminEmail } from "../../lib/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });
    const adminEntry = isAdminEmail(currentUser.email);
    if (currentUser.role !== "attendant" && !adminEntry) {
      return Response.json(
        { error: "A supervisão possui acesso somente para visualização." },
        { status: 403 },
      );
    }
    if (!currentUser.registrationComplete) {
      return Response.json(
        { error: "Conclua seu cadastro antes de registrar atividades." },
        { status: 403 },
      );
    }

    const payload = (await request.json()) as {
      kind?: "protocol" | "call";
      protocol?: string;
      outcome?: "deferred" | "analysis" | "denied";
      typologyId?: number;
      quantity?: number;
      date?: string;
      time?: string;
      distributionState?: string;
      backofficeUrl?: string;
      userEmail?: string;
    };
    const kind = payload.kind;
    const protocol = payload.protocol?.trim() || null;
    const outcome = payload.outcome;
    const typologyId = Number(payload.typologyId);
    const quantity = Math.max(1, Math.min(9999, Number(payload.quantity) || 1));
    const date = payload.date?.trim();
    const time = payload.time?.trim();
    const distributionState = payload.distributionState?.trim().toUpperCase();
    const backofficeUrl = payload.backofficeUrl?.trim() || null;
    const targetEmail = adminEntry ? payload.userEmail?.trim().toLowerCase() : currentUser.email;
    if (!targetEmail) return Response.json({ error: "Escolha o atendente." }, { status: 400 });
    if (kind !== "protocol" && kind !== "call") {
      return Response.json({ error: "Escolha protocolo ou ligação." }, { status: 400 });
    }
    if (kind === "protocol" && !protocol) {
      return Response.json({ error: "Informe o número do protocolo." }, { status: 400 });
    }
    if (kind === "protocol" && !["deferred", "analysis", "denied"].includes(outcome ?? "")) {
      return Response.json({ error: "Informe se o protocolo foi deferido, indeferido ou encaminhado para análise." }, { status: 400 });
    }
    if (!typologyId || !date || !time) {
      return Response.json({ error: "Preencha tipologia, data e horário." }, { status: 400 });
    }
    if (!distributionState || !["AL", "AP", "GO", "MA", "PA", "PI", "RS"].includes(distributionState)) {
      return Response.json({ error: "Informe o estado atendido." }, { status: 400 });
    }
    if (backofficeUrl) {
      try {
        const url = new URL(backofficeUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        return Response.json({ error: "Informe um link válido do Backoffice." }, { status: 400 });
      }
    }

    const db = await getDatabase();
    if (adminEntry) {
      const target = await db.prepare("SELECT role, active FROM users WHERE lower(email) = ?").bind(targetEmail).first<{ role: string; active: number }>();
      if (!target || target.role !== "attendant") return Response.json({ error: "Atendente não encontrado." }, { status: 404 });
    }
    const typology = await db
      .prepare("SELECT id, name, seconds FROM typologies WHERE id = ? AND active = 1")
      .bind(typologyId)
      .first<{ id: number; name: string; seconds: number }>();
    if (!typology) return Response.json({ error: "Tipologia não encontrada." }, { status: 404 });

    const occurredAt = `${date}T${time}:00`;
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(`INSERT INTO activities
        (user_email, kind, protocol, outcome, typology_id, typology_name, quantity, duration_seconds, occurred_at, distribution_state, backoffice_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(
        targetEmail,
        kind,
        protocol,
        kind === "protocol" ? outcome : null,
        typology.id,
        typology.name,
        quantity,
        typology.seconds,
        occurredAt,
        distributionState,
        backofficeUrl,
        createdAt,
      )
      .first<{ id: number }>();
    return Response.json({ id: result?.id, message: "Registro salvo com sucesso." }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });
    if (currentUser.role !== "attendant") {
      return Response.json({ error: "A supervisão possui acesso somente para visualização." }, { status: 403 });
    }

    const payload = (await request.json()) as {
      id?: number;
      kind?: "protocol" | "call";
      protocol?: string;
      outcome?: "deferred" | "analysis" | "denied";
      typologyId?: number;
      quantity?: number;
      date?: string;
      time?: string;
      distributionState?: string;
      backofficeUrl?: string;
    };
    const id = Number(payload.id);
    const kind = payload.kind;
    const protocol = payload.protocol?.trim() || null;
    const outcome = payload.outcome;
    const typologyId = Number(payload.typologyId);
    const quantity = Math.max(1, Math.min(9999, Number(payload.quantity) || 1));
    const date = payload.date?.trim();
    const time = payload.time?.trim();
    const distributionState = payload.distributionState?.trim().toUpperCase();
    const backofficeUrl = payload.backofficeUrl?.trim() || null;

    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Registro inválido." }, { status: 400 });
    }
    if (kind !== "protocol" && kind !== "call") {
      return Response.json({ error: "Escolha protocolo ou ligação." }, { status: 400 });
    }
    if (kind === "protocol" && !protocol) {
      return Response.json({ error: "Informe o número do protocolo." }, { status: 400 });
    }
    if (kind === "protocol" && !["deferred", "analysis", "denied"].includes(outcome ?? "")) {
      return Response.json({ error: "Informe se o protocolo foi deferido, indeferido ou encaminhado para análise." }, { status: 400 });
    }
    if (!typologyId || !date || !time) {
      return Response.json({ error: "Preencha tipologia, data e horário." }, { status: 400 });
    }
    if (!distributionState || !["AL", "AP", "GO", "MA", "PA", "PI", "RS"].includes(distributionState)) {
      return Response.json({ error: "Informe o estado atendido." }, { status: 400 });
    }
    if (backofficeUrl) {
      try {
        const url = new URL(backofficeUrl);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      } catch {
        return Response.json({ error: "Informe um link válido do Backoffice." }, { status: 400 });
      }
    }

    const db = await getDatabase();
    const typology = await db
      .prepare("SELECT id, name, seconds FROM typologies WHERE id = ? AND active = 1")
      .bind(typologyId)
      .first<{ id: number; name: string; seconds: number }>();
    if (!typology) return Response.json({ error: "Tipologia não encontrada." }, { status: 404 });

    const result = await db
      .prepare(`UPDATE activities SET kind = ?, protocol = ?, outcome = ?, typology_id = ?, typology_name = ?,
        quantity = ?, duration_seconds = ?, occurred_at = ?, distribution_state = ?, backoffice_url = ?
        WHERE id = ? AND user_email = ?`)
      .bind(
        kind,
        kind === "protocol" ? protocol : null,
        kind === "protocol" ? outcome : null,
        typology.id,
        typology.name,
        quantity,
        typology.seconds,
        `${date}T${time}:00`,
        distributionState,
        backofficeUrl,
        id,
        currentUser.email,
      )
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Registro não encontrado ou sem permissão para editar." }, { status: 404 });
    }
    return Response.json({ message: "Registro atualizado com sucesso." });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await ensureCurrentUser(request);
    if (!currentUser) return Response.json({ error: "Não autenticado." }, { status: 401 });
    if (currentUser.role !== "attendant") {
      return Response.json({ error: "A supervisão possui acesso somente para visualização." }, { status: 403 });
    }

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ error: "Registro inválido." }, { status: 400 });
    }
    const db = await getDatabase();
    const result = await db
      .prepare("DELETE FROM activities WHERE id = ? AND user_email = ?")
      .bind(id, currentUser.email)
      .run();
    if (!result.meta.changes) {
      return Response.json({ error: "Registro não encontrado ou sem permissão para excluir." }, { status: 404 });
    }
    return Response.json({ message: "Registro excluído com sucesso." });
  } catch (error) {
    return apiError(error);
  }
}
