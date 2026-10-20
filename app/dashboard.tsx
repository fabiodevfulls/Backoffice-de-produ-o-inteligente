"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { exportExcelReport, exportPdfReport } from "./report-export";

type Role = "supervisor" | "attendant";
type ActivityKind = "protocol" | "call";
type ProtocolOutcome = "deferred" | "analysis" | "denied";
type Tab = "overview" | "calculator" | "records" | "scripts" | "report" | "team";

type Typology = { id: number; name: string; seconds: number };
type Activity = {
  id: number;
  userEmail: string;
  userName: string;
  kind: ActivityKind;
  protocol: string | null;
  outcome: ProtocolOutcome | null;
  typologyId: number;
  typologyName: string;
  quantity: number;
  durationSeconds: number;
  occurredAt: string;
  distributionState: keyof typeof STATE_CONTACTS | null;
  backofficeUrl: string | null;
};
type TeamMember = {
  email: string;
  name: string;
  protocols: number;
  calls: number;
  total: number;
  productiveSeconds: number;
};
type DashboardData = {
  currentUser: {
    email: string;
    name: string;
    role: Role;
    employeeCode: string | null;
    registrationComplete: boolean;
    isAdmin: boolean;
  };
  typologies: Typology[];
  activities: Activity[];
  team: TeamMember[];
  settings: { workdaySeconds: number; goal: number; challenge: number };
};

const EMPTY_DATA: DashboardData = {
  currentUser: {
    email: "",
    name: "",
    role: "attendant",
    employeeCode: null,
    registrationComplete: false,
    isAdmin: false,
  },
  typologies: [],
  activities: [],
  team: [],
  settings: { workdaySeconds: 20400, goal: 0.9, challenge: 1 },
};

const todayInput = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
};

const timeInput = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h${String(minutes).padStart(2, "0")}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function attendantAverageProductivity(data: DashboardData, email: string) {
  const activities = data.activities.filter((activity) => activity.userEmail === email);
  const activeDays = new Set(activities.map((activity) => activity.occurredAt.slice(0, 10))).size;
  if (!activeDays) return 0;
  const productiveSeconds = activities.reduce(
    (sum, activity) => sum + activity.durationSeconds * activity.quantity,
    0,
  );
  return productiveSeconds / (data.settings.workdaySeconds * activeDays);
}

function kindLabel(kind: ActivityKind) {
  return kind === "protocol" ? "Protocolo" : "Ligação";
}

function outcomeLabel(outcome: ProtocolOutcome | null) {
  if (outcome === "deferred") return "Deferido";
  if (outcome === "analysis") return "Em análise";
  if (outcome === "denied") return "Indeferido";
  return "Não informado";
}

function activityDate(value: string) {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year} • ${time?.slice(0, 5) ?? "--:--"}`;
}

export default function Dashboard({
  authUser,
  accessToken,
}: {
  authUser: { displayName: string; email: string };
  accessToken: string;
}) {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const onSignOut = async () => {
    window.location.assign("/api/auth/logout");
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const payload = (await response.json()) as DashboardData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const isSupervisor = data.currentUser.role === "supervisor";
  const navItems: { id: Tab; label: string; icon: string }[] = isSupervisor
    ? [
        { id: "overview", label: "Visão geral", icon: "⌂" },
        { id: "records", label: "Protocolos e ligações", icon: "▤" },
        { id: "report", label: "Relatórios da equipe", icon: "▥" },
        { id: "team", label: "Equipe", icon: "◎" },
      ]
    : [
        { id: "overview", label: "Visão geral", icon: "⌂" },
        { id: "calculator", label: "Calculadora", icon: "▦" },
        { id: "records", label: "Meus registros", icon: "▤" },
        { id: "scripts", label: "Scripts", icon: "✎" },
        { id: "report", label: "Meu relatório", icon: "▥" },
      ];

  const today = todayInput();
  const todayActivities = useMemo(
    () => data.activities.filter((activity) => activity.occurredAt.startsWith(today)),
    [data.activities, today],
  );
  const todayProtocols = todayActivities
    .filter((activity) => activity.kind === "protocol")
    .reduce((sum, activity) => sum + activity.quantity, 0);
  const todayCalls = todayActivities
    .filter((activity) => activity.kind === "call")
    .reduce((sum, activity) => sum + activity.quantity, 0);
  const todayProductiveSeconds = todayActivities.reduce(
    (sum, activity) => sum + activity.durationSeconds * activity.quantity,
    0,
  );
  const productivity = todayProductiveSeconds / data.settings.workdaySeconds;

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    setMenuOpen(false);
    setSearch("");
  }

  if (!loading && !error && !isSupervisor && !data.currentUser.registrationComplete) {
    return (
      <AccountRegistration
        email={data.currentUser.email || authUser.email}
        suggestedName={data.currentUser.name || authUser.displayName}
        accessToken={accessToken}
        onSignOut={onSignOut}
        onCompleted={loadDashboard}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">BP</span>
          <div><strong>Backoffice</strong><small>Produção</small></div>
        </div>
        <nav aria-label="Navegação principal">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "nav-item active" : "nav-item"}
              onClick={() => selectTab(item.id)}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`role-chip ${isSupervisor ? "supervisor" : "attendant"}`}>
            {isSupervisor ? "Supervisão • leitura" : "Atendente"}
          </span>
          <small>{data.currentUser.email || authUser.email}</small>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">☰</button>
          <div>
            <h1>Controle de Produtividade <span>•</span> Backoffice</h1>
            <p>{isSupervisor ? "Acompanhamento da equipe" : "Meus protocolos e ligações"}</p>
          </div>
          <div className="topbar-user">
            <span className="today-label">{new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</span>
            <div className="avatar" aria-hidden="true">{(data.currentUser.name || authUser.displayName).charAt(0).toUpperCase()}</div>
            <button type="button" className="signout signout-button" onClick={() => void onSignOut()}>Sair</button>
          </div>
        </header>

        <div className="content">
          {error ? <div className="alert error">{error}<button onClick={() => void loadDashboard()}>Tentar novamente</button></div> : null}
          {loading ? <LoadingState /> : null}
          {!loading && !error ? (
            <>
              {tab === "overview" && (
                <Overview
                  isSupervisor={isSupervisor}
                  data={data}
                  productivity={productivity}
                  todayProtocols={todayProtocols}
                  todayCalls={todayCalls}
                  todayProductiveSeconds={todayProductiveSeconds}
                  onSaved={loadDashboard}
                  accessToken={accessToken}
                />
              )}
              {tab === "calculator" && !isSupervisor && <Calculator data={data} />}
              {tab === "scripts" && !isSupervisor && <Scripts />}
              {tab === "records" && (
                <Records
                  activities={data.activities}
                  typologies={data.typologies}
                  search={search}
                  setSearch={setSearch}
                  isSupervisor={isSupervisor}
                  accessToken={accessToken}
                  onChanged={loadDashboard}
                />
              )}
              {tab === "report" && (
                <ProductionReports data={data} isSupervisor={isSupervisor} />
              )}
              {tab === "team" && isSupervisor && <div className="page-stack"><Team data={data} />{data.currentUser.isAdmin ? <Attendants typologies={data.typologies} onChanged={loadDashboard} /> : null}</div>}
            </>
          ) : null}
        </div>
      </section>
      {menuOpen ? <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} /> : null}
    </main>
  );
}

function AccountRegistration({
  email,
  suggestedName,
  accessToken,
  onSignOut,
  onCompleted,
}: {
  email: string;
  suggestedName: string;
  accessToken: string;
  onSignOut: () => Promise<void>;
  onCompleted: () => Promise<void>;
}) {
  const [name, setName] = useState(suggestedName);
  const [employeeCode, setEmployeeCode] = useState("");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "error"; message: string }>({
    type: "idle",
    message: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "saving", message: "Criando seu cadastro..." });
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name, employeeCode }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir o cadastro.");
      await onCompleted();
    } catch (submitError) {
      setStatus({
        type: "error",
        message: submitError instanceof Error ? submitError.message : "Não foi possível concluir o cadastro.",
      });
    }
  }

  return (
    <main className="registration-shell">
      <section className="registration-card" aria-labelledby="registration-title">
        <div className="registration-heading">
          <span className="brand-mark">BP</span>
          <div><p className="eyebrow">PRIMEIRO ACESSO</p><h1 id="registration-title">Crie seu cadastro de atendente</h1></div>
        </div>
        <p className="registration-copy">
          Preencha seus dados uma única vez. Depois você terá acesso à calculadora,
          aos seus registros e ao seu relatório individual.
        </p>
        <form className="activity-form" onSubmit={submit}>
          <label className="field"><span>Nome completo</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={120} required /></label>
          <label className="field"><span>E-mail de acesso</span><input value={email} readOnly aria-readonly="true" /></label>
          <label className="field"><span>Matrícula ou identificação</span><input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} minLength={2} maxLength={40} placeholder="Ex.: 123456" required /></label>
          <button className="primary-button" type="submit" disabled={status.type === "saving"}>{status.type === "saving" ? "Criando cadastro..." : "Concluir meu cadastro"}</button>
          {status.message ? <p className={`form-status ${status.type}`}>{status.message}</p> : null}
        </form>
        <button className="registration-exit registration-exit-button" type="button" onClick={() => void onSignOut()}>Sair e usar outra conta</button>
      </section>
    </main>
  );
}

function LoadingState() {
  return (
    <div className="loading-grid" aria-label="Carregando painel">
      {[1, 2, 3, 4].map((item) => <div className="skeleton" key={item} />)}
    </div>
  );
}

function Overview({
  isSupervisor,
  data,
  productivity,
  todayProtocols,
  todayCalls,
  todayProductiveSeconds,
  onSaved,
  accessToken,
}: {
  isSupervisor: boolean;
  data: DashboardData;
  productivity: number;
  todayProtocols: number;
  todayCalls: number;
  todayProductiveSeconds: number;
  onSaved: () => Promise<void>;
  accessToken: string;
}) {
  const [overviewEmail, setOverviewEmail] = useState("all");
  const selectedOverviewMember = data.team.find((member) => member.email === overviewEmail);
  const overviewActivities = overviewEmail === "all"
    ? data.activities
    : data.activities.filter((activity) => activity.userEmail === overviewEmail);
  const overviewTeam = selectedOverviewMember ? [selectedOverviewMember] : data.team;
  const overviewData = { ...data, activities: overviewActivities, team: overviewTeam };
  const teamProductivity = data.team.length
    ? data.team.reduce((sum, member) => sum + attendantAverageProductivity(data, member.email), 0) / data.team.length
    : 0;
  const selectedProductivity = selectedOverviewMember
    ? attendantAverageProductivity(data, selectedOverviewMember.email)
    : teamProductivity;
  const cards = isSupervisor
    ? [
        { label: selectedOverviewMember?.name ?? "Atendentes", value: selectedOverviewMember ? "1" : String(data.team.length), icon: "◎", tone: "blue" },
        { label: "Protocolos registrados", value: String(overviewActivities.filter((a) => a.kind === "protocol").reduce((s, a) => s + a.quantity, 0)), icon: "▤", tone: "blue" },
        { label: "Ligações registradas", value: String(overviewActivities.filter((a) => a.kind === "call").reduce((s, a) => s + a.quantity, 0)), icon: "◖", tone: "green" },
        { label: selectedOverviewMember ? "Produtividade média do atendente" : "Média de produtividade da equipe", value: formatPercent(selectedProductivity), icon: "↗", tone: "green" },
      ]
    : [
        { label: "Produtividade hoje", value: formatPercent(productivity), icon: "↗", tone: "green" },
        { label: "Protocolos hoje", value: String(todayProtocols), icon: "▤", tone: "blue" },
        { label: "Ligações hoje", value: String(todayCalls), icon: "◖", tone: "blue" },
        { label: "Tempo produtivo", value: formatDuration(todayProductiveSeconds), icon: "◷", tone: "green" },
      ];

  return (
    <div className="page-stack">
      {isSupervisor ? <section className="panel overview-scope-filter"><div><p className="eyebrow">VISÃO DA PRODUTIVIDADE</p><h2>{selectedOverviewMember ? selectedOverviewMember.name : "Equipe geral"}</h2><p>Escolha a equipe completa ou um atendente para atualizar todos os indicadores desta tela.</p></div><label><span>Visualizar</span><select value={overviewEmail} onChange={(event) => setOverviewEmail(event.target.value)}><option value="all">Equipe geral</option>{data.team.map((member) => <option key={member.email} value={member.email}>{member.name}</option>)}</select></label></section> : null}
      <section className="metric-grid">
        {cards.map((card) => (
          <article className="metric-card" key={card.label}>
            <span className={`metric-icon ${card.tone}`}>{card.icon}</span>
            <div><small>{card.label}</small><strong>{card.value}</strong></div>
          </article>
        ))}
      </section>

      {isSupervisor ? (
        <div className="dashboard-grid supervisor-grid">
          <TeamSummary data={overviewData} compact />
          <RecentActivities activities={overviewActivities} supervisor />
        </div>
      ) : (
        <div className="dashboard-grid">
          <ActivityForm typologies={data.typologies} onSaved={onSaved} accessToken={accessToken} />
          <RecentActivities activities={data.activities} />
        </div>
      )}
    </div>
  );
}

function ActivityForm({ typologies, onSaved, accessToken }: { typologies: Typology[]; onSaved: () => Promise<void>; accessToken: string }) {
  const [kind, setKind] = useState<ActivityKind>("protocol");
  const [protocol, setProtocol] = useState("");
  const [outcome, setOutcome] = useState<ProtocolOutcome>("analysis");
  const [typologyId, setTypologyId] = useState(typologies[0]?.id ?? 0);
  const [date, setDate] = useState(todayInput());
  const [time, setTime] = useState(timeInput());
  const [quantity, setQuantity] = useState(1);
  const [distributionState, setDistributionState] = useState<keyof typeof STATE_CONTACTS>("PA");
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const selectedTypologyId = typologyId || typologies[0]?.id || 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "saving", message: "Salvando registro..." });
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ kind, protocol, outcome, typologyId: selectedTypologyId, date, time, quantity, distributionState }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setStatus({ type: "success", message: result.message || "Registro salvo." });
      setProtocol("");
      setQuantity(1);
      await onSaved();
    } catch (submitError) {
      setStatus({ type: "error", message: submitError instanceof Error ? submitError.message : "Não foi possível salvar." });
    }
  }

  return (
    <section className="panel register-panel">
      <div className="section-heading"><div><p className="eyebrow">NOVO REGISTRO</p><h2>Registrar atividade</h2></div><span className="permission-tag">Seu acesso</span></div>
      <div className="kind-toggle" role="group" aria-label="Tipo de atividade">
        <button type="button" className={kind === "protocol" ? "selected" : ""} onClick={() => setKind("protocol")}>Protocolo</button>
        <button type="button" className={kind === "call" ? "selected" : ""} onClick={() => setKind("call")}>Ligação</button>
      </div>
      <form onSubmit={submit} className="activity-form">
        <label className="field"><span>Tipologia</span><select value={selectedTypologyId} onChange={(event) => setTypologyId(Number(event.target.value))} required>{typologies.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        {kind === "protocol" ? <><label className="field"><span>Número do protocolo</span><input value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="Ex.: PC-5821" required /></label><label className="field"><span>Parecer do protocolo</span><select value={outcome} onChange={(event) => setOutcome(event.target.value as ProtocolOutcome)} required><option value="deferred">Deferido</option><option value="analysis">Em análise</option><option value="denied">Indeferido</option></select></label></> : null}
        <label className="field"><span>Estado atendido</span><select value={distributionState} onChange={(event) => setDistributionState(event.target.value as keyof typeof STATE_CONTACTS)} required>{Object.entries(STATE_CONTACTS).map(([code, item]) => <option key={code} value={code}>{item.state}</option>)}</select></label>
        <div className="form-row three">
          <label className="field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label className="field"><span>Hora</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          <label className="field"><span>Quantidade</span><input type="number" min="1" max="9999" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label>
        </div>
        <button className="primary-button" type="submit" disabled={status.type === "saving"}>{status.type === "saving" ? "Salvando..." : "Salvar meu registro"}</button>
        {status.message ? <p className={`form-status ${status.type}`}>{status.message}</p> : null}
      </form>
    </section>
  );
}

function RecentActivities({ activities, supervisor = false }: { activities: Activity[]; supervisor?: boolean }) {
  const recent = activities.slice(0, 8);
  return (
    <section className="panel recent-panel">
      <div className="section-heading"><div><p className="eyebrow">ATUALIZAÇÃO AUTOMÁTICA</p><h2>{supervisor ? "Últimos registros da equipe" : "Meus últimos registros"}</h2></div><span className="live-dot">Ao vivo</span></div>
      {recent.length ? <div className="activity-list">{recent.map((activity) => (
        <article className="activity-item" key={activity.id}>
          <span className={`kind-badge ${activity.kind}`}>{activity.kind === "protocol" ? "P" : "L"}</span>
          <div className="activity-main"><strong>{activity.protocol || kindLabel(activity.kind)}</strong><span>{activity.typologyName}{activity.distributionState ? ` • ${activity.distributionState}` : ""}</span>{supervisor ? <small>{activity.userName}</small> : null}</div>
          <div className="activity-meta"><strong>{activity.quantity}</strong><span>{activityDate(activity.occurredAt)}</span></div>
        </article>
      ))}</div> : <EmptyState title="Nenhum registro ainda" text={supervisor ? "Os registros dos atendentes aparecerão aqui." : "Cadastre seu primeiro protocolo ou ligação."} />}
    </section>
  );
}

function Calculator({ data }: { data: DashboardData }) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const productiveSeconds = data.typologies.reduce((sum, item) => sum + item.seconds * (quantities[item.id] || 0), 0);
  const percentage = productiveSeconds / data.settings.workdaySeconds;
  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">SIMULAÇÃO INDIVIDUAL</p><h2>Calculadora de produtividade</h2><p>Informe quanto realizou de cada tipologia. A simulação não cria registros.</p></div></div>
      <section className="calculator-layout">
        <div className="panel calculator-table">
          <div className="table-header"><span>Tipologia</span><span>Tempo padrão</span><span>Quantidade</span></div>
          {data.typologies.map((item) => (
            <div className="calculator-row" key={item.id}>
              <span>{item.name}</span><span>{formatDuration(item.seconds)}</span>
              <input aria-label={`Quantidade de ${item.name}`} type="number" min="0" value={quantities[item.id] || ""} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, Number(event.target.value) || 0) }))} />
            </div>
          ))}
        </div>
        <aside className="panel calculator-result">
          <p className="eyebrow">RESULTADO</p><div className="score-ring" style={{ "--score": `${Math.min(100, percentage * 100)}%` } as React.CSSProperties}><strong>{formatPercent(percentage)}</strong><span>produtividade</span></div>
          <div className="result-line"><span>Tempo produtivo</span><strong>{formatDuration(productiveSeconds)}</strong></div>
          <div className="result-line"><span>Meta</span><strong>90%</strong></div>
          <div className={`result-status ${percentage >= 1 ? "challenge" : percentage >= 0.9 ? "goal" : "below"}`}>{percentage >= 1 ? "Desafio alcançado" : percentage >= 0.9 ? "Meta alcançada" : "Abaixo da meta"}</div>
        </aside>
      </section>
    </div>
  );
}

function Records({ activities, typologies, search, setSearch, isSupervisor, accessToken, onChanged }: { activities: Activity[]; typologies: Typology[]; search: string; setSearch: (value: string) => void; isSupervisor: boolean; accessToken: string; onChanged: () => Promise<void> }) {
  const [kind, setKind] = useState<"all" | ActivityKind>("all");
  const [selectedAttendant, setSelectedAttendant] = useState("all");
  const [recordPeriod, setRecordPeriod] = useState<ReportPeriod>("daily");
  const [recordDate, setRecordDate] = useState(todayInput());
  const [editing, setEditing] = useState<Activity | null>(null);
  const [actionStatus, setActionStatus] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const filtered = activities.filter((activity) => {
    const matchesKind = kind === "all" || activity.kind === kind;
    const matchesAttendant = !isSupervisor || selectedAttendant === "all" || activity.userEmail === selectedAttendant;
    const range = reportRange(recordPeriod, recordDate);
    const activityDay = activity.occurredAt.slice(0, 10);
    const matchesPeriod = !isSupervisor || (activityDay >= range.start && activityDay <= range.end);
    const haystack = `${activity.protocol ?? ""} ${activity.typologyName} ${activity.userName} ${activity.distributionState ?? ""}`.toLowerCase();
    return matchesKind && matchesAttendant && matchesPeriod && haystack.includes(search.toLowerCase());
  });
  const attendantOptions = [...new Map(activities.map((activity) => [activity.userEmail, activity.userName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  async function deleteActivity(activity: Activity) {
    const label = activity.protocol ? `o protocolo ${activity.protocol}` : "esta ligação";
    if (!window.confirm(`Tem certeza que deseja excluir ${label}? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(activity.id);
    setActionStatus("");
    try {
      const response = await fetch(`/api/activities?id=${activity.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o registro.");
      setActionStatus(result.message || "Registro excluído.");
      await onChanged();
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Não foi possível excluir o registro.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">HISTÓRICO</p><h2>{isSupervisor ? "Protocolos e ligações da equipe" : "Meus registros"}</h2><p>{isSupervisor ? "Consulta somente de leitura, organizada por atendente." : "Confira tudo o que você cadastrou."}</p></div></div>
      <section className="panel records-panel">
        <div className="filters"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar protocolo, tipologia ou atendente" /><select value={kind} onChange={(event) => setKind(event.target.value as "all" | ActivityKind)}><option value="all">Todos os tipos</option><option value="protocol">Protocolos</option><option value="call">Ligações</option></select></div>
        {isSupervisor ? <div className="record-period-filters"><label className="record-calendar"><span>Escolher dia no calendário</span><input type="date" value={recordDate} onChange={(event) => { setRecordDate(event.target.value); setRecordPeriod("daily"); }} /><small>Ao escolher uma data, serão mostrados somente os registros daquele dia.</small></label><label><span>Atendente</span><select value={selectedAttendant} onChange={(event) => setSelectedAttendant(event.target.value)}><option value="all">Todos os atendentes</option>{attendantOptions.map(([email, name]) => <option key={email} value={email}>{name}</option>)}</select></label><label><span>Período</span><select value={recordPeriod} onChange={(event) => setRecordPeriod(event.target.value as ReportPeriod)}><option value="daily">Somente o dia escolhido</option><option value="weekly">Semana do dia escolhido</option><option value="monthly">Mês do dia escolhido</option></select></label></div> : null}
        {actionStatus ? <p className="records-status" role="status">{actionStatus}</p> : null}
        <ActivityTable activities={filtered} showUser={isSupervisor} onEdit={isSupervisor ? undefined : setEditing} onDelete={isSupervisor ? undefined : deleteActivity} deletingId={deletingId} />
      </section>
      {editing ? <EditActivityModal activity={editing} typologies={typologies} accessToken={accessToken} onClose={() => setEditing(null)} onSaved={async (message) => { setEditing(null); setActionStatus(message); await onChanged(); }} /> : null}
    </div>
  );
}

function ActivityTable({ activities, showUser, onEdit, onDelete, deletingId }: { activities: Activity[]; showUser: boolean; onEdit?: (activity: Activity) => void; onDelete?: (activity: Activity) => void; deletingId?: number | null }) {
  if (!activities.length) return <EmptyState title="Nada encontrado" text="Ajuste os filtros ou aguarde novos registros." />;
  return (
    <div className="table-scroll"><table><thead><tr>{showUser ? <th>Atendente</th> : null}<th>Tipo</th><th>Estado</th><th>Protocolo</th><th>Parecer</th><th>Tipologia</th><th>Quantidade</th><th>Data e hora</th>{onEdit && onDelete ? <th>Ações</th> : null}</tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}>{showUser ? <td><strong>{activity.userName}</strong><small>{activity.userEmail}</small></td> : null}<td><span className={`table-kind ${activity.kind}`}>{kindLabel(activity.kind)}</span></td><td><strong>{activity.distributionState || "—"}</strong></td><td>{activity.protocol || "—"}</td><td>{activity.kind === "protocol" ? <span className={`outcome-badge ${activity.outcome || "unknown"}`}>{outcomeLabel(activity.outcome)}</span> : "—"}</td><td>{activity.typologyName}</td><td>{activity.quantity}</td><td>{activityDate(activity.occurredAt)}</td>{onEdit && onDelete ? <td><div className="record-actions"><button type="button" className="edit-action" onClick={() => onEdit(activity)}>Editar</button><button type="button" className="delete-action" onClick={() => onDelete(activity)} disabled={deletingId === activity.id}>{deletingId === activity.id ? "Excluindo..." : "Excluir"}</button></div></td> : null}</tr>)}</tbody></table></div>
  );
}

function EditActivityModal({ activity, typologies, accessToken, onClose, onSaved }: { activity: Activity; typologies: Typology[]; accessToken: string; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [kind, setKind] = useState<ActivityKind>(activity.kind);
  const [protocol, setProtocol] = useState(activity.protocol || "");
  const [outcome, setOutcome] = useState<ProtocolOutcome>(activity.outcome || "analysis");
  const [typologyId, setTypologyId] = useState(activity.typologyId);
  const [quantity, setQuantity] = useState(activity.quantity);
  const [date, setDate] = useState(activity.occurredAt.slice(0, 10));
  const [time, setTime] = useState(activity.occurredAt.slice(11, 16));
  const [distributionState, setDistributionState] = useState<keyof typeof STATE_CONTACTS>(activity.distributionState || "PA");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/activities", {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id: activity.id, kind, protocol, outcome, typologyId, quantity, date, time, distributionState }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o registro.");
      await onSaved(result.message || "Registro atualizado.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível atualizar o registro.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-record-title">
        <div className="section-heading"><div><p className="eyebrow">CORRIGIR REGISTRO</p><h2 id="edit-record-title">Editar protocolo ou ligação</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button></div>
        <div className="kind-toggle" role="group" aria-label="Tipo de atividade"><button type="button" className={kind === "protocol" ? "selected" : ""} onClick={() => setKind("protocol")}>Protocolo</button><button type="button" className={kind === "call" ? "selected" : ""} onClick={() => setKind("call")}>Ligação</button></div>
        <form className="activity-form" onSubmit={submit}>
          <label className="field"><span>Tipologia</span><select value={typologyId} onChange={(event) => setTypologyId(Number(event.target.value))} required>{typologies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {kind === "protocol" ? <><label className="field"><span>Número do protocolo</span><input value={protocol} onChange={(event) => setProtocol(event.target.value)} required autoFocus /></label><label className="field"><span>Parecer do protocolo</span><select value={outcome} onChange={(event) => setOutcome(event.target.value as ProtocolOutcome)} required><option value="deferred">Deferido</option><option value="analysis">Em análise</option><option value="denied">Indeferido</option></select></label></> : null}
          <label className="field"><span>Estado atendido</span><select value={distributionState} onChange={(event) => setDistributionState(event.target.value as keyof typeof STATE_CONTACTS)} required>{Object.entries(STATE_CONTACTS).map(([code, item]) => <option key={code} value={code}>{item.state}</option>)}</select></label>
          <div className="form-row three"><label className="field"><span>Data</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field"><span>Hora</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label><label className="field"><span>Quantidade</span><input type="number" min="1" max="9999" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required /></label></div>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
          {status ? <p className="form-status error" role="alert">{status}</p> : null}
        </form>
      </section>
    </div>
  );
}

type AttendantAccount = { email: string; name: string; employeeCode: string; active: number; createdAt: string; protocols: number; calls: number; lastActivityAt: string | null };

function Attendants({ typologies, onChanged }: { typologies: Typology[]; onChanged: () => Promise<void> }) {
  const [attendants, setAttendants] = useState<AttendantAccount[]>([]);
  const [limit, setLimit] = useState(25);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [deletingEmail, setDeletingEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState("");
  const [productionEmail, setProductionEmail] = useState("");
  const [productionKind, setProductionKind] = useState<ActivityKind>("protocol");
  const [productionProtocol, setProductionProtocol] = useState("");
  const [productionOutcome, setProductionOutcome] = useState<ProtocolOutcome>("analysis");
  const [productionTypologyId, setProductionTypologyId] = useState(typologies[0]?.id ?? 0);
  const [productionState, setProductionState] = useState<keyof typeof STATE_CONTACTS>("PA");
  const [productionQuantity, setProductionQuantity] = useState(1);
  const [productionDate, setProductionDate] = useState(todayInput());
  const [productionTime, setProductionTime] = useState(timeInput());
  const [productionStatus, setProductionStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "loading", message: "Carregando atendentes..." });

  const loadAttendants = useCallback(async () => {
    const response = await fetch("/api/attendants", { cache: "no-store" });
    const result = await response.json() as { attendants?: AttendantAccount[]; limit?: number; error?: string };
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os atendentes.");
    setAttendants(result.attendants ?? []);
    setLimit(result.limit ?? 25);
    setStatus({ type: "idle", message: "" });
  }, []);

  useEffect(() => {
    void loadAttendants().catch((error) => setStatus({ type: "error", message: error instanceof Error ? error.message : "Erro ao carregar." }));
  }, [loadAttendants]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "loading", message: "Criando acesso..." });
    try {
      const response = await fetch("/api/attendants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, employeeCode, password }),
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar.");
      setName(""); setEmail(""); setEmployeeCode(""); setPassword("");
      await loadAttendants();
      setStatus({ type: "success", message: result.message || "Atendente cadastrado." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível cadastrar." });
    }
  }

  async function deleteAttendant(attendant: AttendantAccount) {
    if (!window.confirm(`Excluir o cadastro de ${attendant.name}? O acesso será removido, mas os registros de produção serão preservados.`)) return;
    setDeletingEmail(attendant.email);
    setStatus({ type: "loading", message: "Excluindo cadastro..." });
    try {
      const response = await fetch(`/api/attendants?email=${encodeURIComponent(attendant.email)}`, { method: "DELETE" });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o cadastro.");
      await loadAttendants();
      setStatus({ type: "success", message: result.message || "Cadastro excluído." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível excluir o cadastro." });
    } finally {
      setDeletingEmail("");
    }
  }

  async function toggleAttendant(attendant: AttendantAccount) {
    const nextActive = !attendant.active;
    if (!window.confirm(`${nextActive ? "Reativar" : "Suspender"} o acesso de ${attendant.name}?`)) return;
    setUpdatingEmail(attendant.email);
    setStatus({ type: "loading", message: nextActive ? "Reativando acesso..." : "Suspendendo acesso..." });
    try {
      const response = await fetch("/api/attendants", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: attendant.email, active: nextActive }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar o acesso.");
      await loadAttendants();
      setStatus({ type: "success", message: result.message || "Acesso atualizado." });
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível alterar o acesso." });
    } finally { setUpdatingEmail(""); }
  }

  const visibleAttendants = attendants.filter((attendant) => `${attendant.name} ${attendant.email} ${attendant.employeeCode}`.toLowerCase().includes(adminSearch.toLowerCase()));

  async function addMissingProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductionStatus({ type: "loading", message: "Salvando produção..." });
    try {
      const response = await fetch("/api/activities", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userEmail: productionEmail, kind: productionKind, protocol: productionKind === "protocol" ? productionProtocol : "", outcome: productionOutcome, typologyId: productionTypologyId, distributionState: productionState, quantity: productionQuantity, date: productionDate, time: productionTime }) });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível lançar a produção.");
      setProductionProtocol("");
      await Promise.all([loadAttendants(), onChanged()]);
      setProductionStatus({ type: "success", message: `Produção lançada para ${attendants.find((item) => item.email === productionEmail)?.name ?? productionEmail}.` });
    } catch (error) {
      setProductionStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível lançar a produção." });
    }
  }

  return (
    <div className="page-stack attendants-page">
      <div className="page-title"><div><p className="eyebrow">ADMINISTRAÇÃO DE ACESSOS</p><h2>Cadastro de atendentes</h2><p>Crie até {limit} acessos individuais. Somente e-mails Microsoft corporativos da Equatorial Serviços.</p></div><span className="permission-tag">{attendants.length}/{limit} cadastrados</span></div>
      <section className="attendants-layout">
        <form className="panel attendants-form activity-form" onSubmit={submit}>
          <div className="section-heading"><div><p className="eyebrow">NOVO ACESSO</p><h2>Adicionar atendente</h2></div></div>
          <label className="field"><span>Nome completo</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={120} required /></label>
          <label className="field"><span>E-mail corporativo Microsoft</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value.toLowerCase())} placeholder="nome@equatorialservicos.com.br" pattern=".+@equatorialservicos\.com\.br" required /></label>
          <label className="field"><span>Matrícula</span><input value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} minLength={2} maxLength={40} required /></label>
          <label className="field"><span>Senha inicial</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required /><em>Use no mínimo 8 caracteres. Entregue a senha diretamente ao atendente.</em></label>
          <button className="primary-button" type="submit" disabled={status.type === "loading" || attendants.length >= limit}>{attendants.length >= limit ? "Limite atingido" : status.type === "loading" ? "Salvando..." : "Cadastrar atendente"}</button>
          {status.message ? <p className={`form-status ${status.type}`}>{status.message}</p> : null}
        </form>
        <section className="panel attendants-list-panel">
          <div className="section-heading"><div><p className="eyebrow">EQUIPE CADASTRADA</p><h2>Gerenciar atendentes</h2></div></div>
          <input className="admin-search" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou matrícula" />
          {visibleAttendants.length ? <div className="attendant-list">{visibleAttendants.map((attendant) => <article key={attendant.email} className={`attendant-card ${attendant.active ? "" : "inactive"}`}><span className="avatar">{attendant.name.charAt(0).toUpperCase()}</span><div><strong>{attendant.name}</strong><span>{attendant.email}</span><small>Matrícula: {attendant.employeeCode}</small><small>Protocolos: {attendant.protocols} • Ligações: {attendant.calls}</small><small>Último registro: {attendant.lastActivityAt ? activityDate(attendant.lastActivityAt) : "Nenhum"}</small></div><div className="attendant-access-actions"><span className={attendant.active ? "active-badge" : "inactive-badge"}>{attendant.active ? "Ativo" : "Suspenso"}</span><button type="button" className="secondary-button" disabled={updatingEmail === attendant.email} onClick={() => void toggleAttendant(attendant)}>{updatingEmail === attendant.email ? "Atualizando..." : attendant.active ? "Suspender acesso" : "Reativar acesso"}</button><button type="button" className="delete-attendant-button" disabled={deletingEmail === attendant.email} onClick={() => void deleteAttendant(attendant)}>{deletingEmail === attendant.email ? "Excluindo..." : "Excluir cadastro"}</button></div></article>)}</div> : <EmptyState title="Nenhum atendente encontrado" text="Ajuste a busca ou cadastre um novo acesso." />}
        </section>
      </section>
      <form className="panel admin-production-form activity-form" onSubmit={addMissingProduction}>
        <div className="section-heading"><div><p className="eyebrow">CORREÇÃO ADMINISTRATIVA</p><h2>Lançar produção não registrada</h2><p>Use quando uma atividade do atendente não tiver sido adicionada no dia correto.</p></div><span className="permission-tag">Somente Admin</span></div>
        <div className="form-row"><label className="field"><span>Atendente</span><select value={productionEmail} onChange={(event) => setProductionEmail(event.target.value)} required><option value="">Escolha o atendente</option>{attendants.map((attendant) => <option key={attendant.email} value={attendant.email}>{attendant.name}</option>)}</select></label><label className="field"><span>Tipo</span><select value={productionKind} onChange={(event) => setProductionKind(event.target.value as ActivityKind)}><option value="protocol">Protocolo</option><option value="call">Ligação</option></select></label><label className="field"><span>Tipologia</span><select value={productionTypologyId} onChange={(event) => setProductionTypologyId(Number(event.target.value))} required>{typologies.map((typology) => <option key={typology.id} value={typology.id}>{typology.name}</option>)}</select></label></div>
        {productionKind === "protocol" ? <div className="form-row"><label className="field"><span>Número do protocolo</span><input value={productionProtocol} onChange={(event) => setProductionProtocol(event.target.value)} required /></label><label className="field"><span>Parecer do protocolo</span><select value={productionOutcome} onChange={(event) => setProductionOutcome(event.target.value as ProtocolOutcome)} required><option value="deferred">Deferido</option><option value="analysis">Em análise</option><option value="denied">Indeferido</option></select></label></div> : null}
        <div className="form-row"><label className="field"><span>Estado</span><select value={productionState} onChange={(event) => setProductionState(event.target.value as keyof typeof STATE_CONTACTS)}>{Object.entries(STATE_CONTACTS).map(([code, item]) => <option key={code} value={code}>{item.state}</option>)}</select></label><label className="field"><span>Quantidade</span><input type="number" min="1" max="9999" value={productionQuantity} onChange={(event) => setProductionQuantity(Number(event.target.value))} required /></label><label className="field"><span>Data da produção</span><input type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} required /></label><label className="field"><span>Hora</span><input type="time" value={productionTime} onChange={(event) => setProductionTime(event.target.value)} required /></label></div>
        <button className="primary-button" type="submit" disabled={productionStatus.type === "loading"}>{productionStatus.type === "loading" ? "Salvando..." : "Lançar para o atendente"}</button>
        {productionStatus.message ? <p className={`form-status ${productionStatus.type}`}>{productionStatus.message}</p> : null}
      </form>
    </div>
  );
}

type ScriptKind = "immediate" | "analysis" | "denied" | "reactivation" | "repeat";

const STATE_CONTACTS = {
  AL: { state: "Alagoas", whatsapp: "(82) 2126-9200", central: "0800 082 0196" },
  AP: { state: "Amapá", whatsapp: "(96) 3082-2949", central: "0800 096 0196" },
  GO: { state: "Goiás", whatsapp: "(62) 3243-2020", central: "0800 062 0196" },
  MA: { state: "Maranhão", whatsapp: "(98) 2055-0116", central: "116" },
  PA: { state: "Pará", whatsapp: "(91) 3217-8200", central: "0800 091 0196" },
  PI: { state: "Piauí", whatsapp: "(86) 3228-8200", central: "0800 086 0800" },
  RS: { state: "Rio Grande do Sul", whatsapp: "(51) 3382-5500", central: "0800 721 2333" },
} as const;

function Scripts() {
  const [stateCode, setStateCode] = useState<keyof typeof STATE_CONTACTS>("PA");
  const [kind, setKind] = useState<ScriptKind>("immediate");
  const [siteCustomerName, setSiteCustomerName] = useState("");
  const [sapCustomerName, setSapCustomerName] = useState("");
  const [sapProtocol, setSapProtocol] = useState("");
  const [newContract, setNewContract] = useState("");
  const [siteProtocol, setSiteProtocol] = useState("");
  const [previousProtocol, setPreviousProtocol] = useState("");
  const [denialReason, setDenialReason] = useState("");
  const [accountContract, setAccountContract] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [documents, setDocuments] = useState("RG, CPF, DOCUMENTO DE POSSE");
  const [returnEmail, setReturnEmail] = useState("");
  const [consumptionClass, setConsumptionClass] = useState("RESIDENCIAL");
  const [copied, setCopied] = useState<"customer" | "sap" | null>(null);
  const contact = STATE_CONTACTS[stateCode];
  const siteName = siteCustomerName.trim().toUpperCase() || "NOME COMPLETO DO CLIENTE";
  const sapName = sapCustomerName.trim().toUpperCase() || "NOME COMPLETO DO CLIENTE";
  const protocol = sapProtocol.trim() || "NÚMERO DO PROTOCOLO SAP";
  const footer = `Estamos à disposição para lhe atender: www.equatorialenergia.com.br, WhatsApp ${contact.whatsapp} e Central de Atendimento ${contact.central}.\n\nConte sempre com a nossa Energia!\n\nEquatorial Energia`;

  const scripts: Record<ScriptKind, string> = {
    immediate: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já registramos em nosso sistema. Sua nova conta contrato ${newContract.trim() || "NOVA CONTA CONTRATO"} marca o início da sua jornada como cliente da Equatorial. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
    analysis: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já encaminhamos para análise. Se estiver tudo certo, o serviço será realizado em até 3 (três) dias úteis para área urbana ou 5 (cinco) dias úteis para área rural. Orientamos acompanhar o andamento pela Central de Atendimento, site ou agência mais próxima. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
    denied: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade, porém ainda não foi possível realizar o atendimento pelo seguinte motivo: ${denialReason.trim().toUpperCase() || "INFORME O MOTIVO DO INDEFERIMENTO"}. Solicite um novo serviço assim que o motivo indicado estiver resolvido. Aguardamos seu retorno!\n\nO número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
    reactivation: `Olá, ${siteName}!\n\nRecebemos a sua solicitação de Troca de Titularidade e já encaminhamos para análise. Se estiver tudo certo, o serviço será realizado em até 3 (três) dias úteis para área urbana ou 5 (cinco) dias úteis para área rural, e a reativação será realizada em até 5 dias úteis. Orientamos acompanhar o andamento pela Central de Atendimento, site ou agência mais próxima. O número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
    repeat: `Olá, ${siteName}!\n\nA sua solicitação de Troca de Titularidade, registrada pelo protocolo do site ${siteProtocol.trim() || "PROTOCOLO DO SITE"}, não foi registrada porque identificamos que já consta uma solicitação pelo protocolo ${previousProtocol.trim() || "PROTOCOLO ANTERIOR"}, que se encontra em andamento. Esta solicitação será classificada como reincidente e será necessário aguardar sua conclusão e comunicação.\n\nO número do seu protocolo de atendimento é ${protocol}.\n\n${footer}`,
  };
  const result = scripts[kind];
  const sapRequest = `SOLICITAÇÃO VIA BACKOFFICE
Nº DO PROTOCOLO DO SITE: ${siteProtocol.trim() || "INFORME O PROTOCOLO DO SITE"}

PEDIDO DE TROCA DE TITULARIDADE PARA O CLIENTE: ${sapName}

CC/UC: ${accountContract.trim() || "INFORME A CC/UC"}

MOTIVO DA TROCA: XXXXXXXXXXXXXXX

TELEFONE DE CONTATO: ${contactPhone.trim() || "INFORME O TELEFONE DE CONTATO"}

DOCUMENTOS APRESENTADOS: ${documents.trim().toUpperCase() || "INFORME OS DOCUMENTOS APRESENTADOS"}.

OPÇÃO DE RETORNO CASO IMPROCEDENTE:
E-MAIL: ${returnEmail.trim() || "INFORME O E-MAIL"}
CLASSE DE CONSUMO: ${consumptionClass.trim().toUpperCase() || "INFORME A CLASSE DE CONSUMO"}

CLIENTE ESTÁ CIENTE QUE PRECISA ACOMPANHAR SUA SOLICITAÇÃO PELA CENTRAL DE ATENDIMENTO, SITE OU NAS AGÊNCIAS DE ATENDIMENTO. CIENTE DO PRAZO DE 3 DIAS (ÚTEIS ÁREA URBANA) / 5 DIAS (ÚTEIS ÁREA RURAL) PARA A CONCLUSÃO.
EM ANEXO DECLARAÇÃO DE TROCA DE TITULARIDADE REVISADA COM AS DOCUMENTAÇÕES APRESENTADAS.`;

  async function copyScript(text: string, target: "customer" | "sap") {
    await navigator.clipboard.writeText(text);
    setCopied(target);
    window.setTimeout(() => setCopied(null), 2200);
  }

  return (
    <div className="page-stack scripts-page">
      <div className="page-title"><div><p className="eyebrow">TEXTOS PADRONIZADOS</p><h2>Scripts de Troca de Titularidade</h2><p>Selecione o estado e o parecer. Os telefones corretos entram automaticamente.</p></div></div>
      <section className="scripts-layout">
        <div className="panel scripts-form-panel">
          <div className="form-row script-two-columns">
            <label className="field"><span>Estado do atendimento</span><select value={stateCode} onChange={(event) => setStateCode(event.target.value as keyof typeof STATE_CONTACTS)}>{Object.entries(STATE_CONTACTS).map(([code, item]) => <option key={code} value={code}>{item.state}</option>)}</select></label>
            <label className="field"><span>Tipo de parecer</span><select value={kind} onChange={(event) => setKind(event.target.value as ScriptKind)}><option value="immediate">Deferido — troca imediata</option><option value="analysis">Deferido — encaminhado para análise</option><option value="denied">Indeferido</option><option value="reactivation">Análise com reativação</option><option value="repeat">Reincidente</option></select></label>
          </div>
          <label className="field"><span>Nome do cliente - script do site</span><input value={siteCustomerName} onChange={(event) => setSiteCustomerName(event.target.value)} placeholder="Ex.: Antônio dos Santos Sousa" /></label>
          <label className="field"><span>Protocolo do SAP</span><input value={sapProtocol} onChange={(event) => setSapProtocol(event.target.value)} placeholder="Ex.: 65986619" /></label>
          {kind === "immediate" ? <label className="field"><span>Nova conta contrato</span><input value={newContract} onChange={(event) => setNewContract(event.target.value)} placeholder="Ex.: 3040387519" /></label> : null}
          {kind === "denied" ? <label className="field"><span>Motivo do indeferimento</span><textarea value={denialReason} onChange={(event) => setDenialReason(event.target.value)} placeholder="Ex.: Documentação incompleta..." rows={4} /></label> : null}
          {kind === "repeat" ? <div className="form-row script-two-columns"><label className="field"><span>Protocolo do site</span><input value={siteProtocol} onChange={(event) => setSiteProtocol(event.target.value)} /></label><label className="field"><span>Protocolo anterior em andamento</span><input value={previousProtocol} onChange={(event) => setPreviousProtocol(event.target.value)} /></label></div> : null}
          <div className="section-heading script-sap-heading"><div><p className="eyebrow">TEXTO PARA O SAP</p><h2>Solicitação via Backoffice</h2></div></div>
          {kind !== "repeat" ? <label className="field"><span>Protocolo do site</span><input value={siteProtocol} onChange={(event) => setSiteProtocol(event.target.value)} placeholder="Ex.: 20260805000579351" /></label> : null}
          <div className="form-row script-two-columns"><label className="field"><span>Nome do cliente - texto do SAP</span><input value={sapCustomerName} onChange={(event) => setSapCustomerName(event.target.value)} placeholder="Ex.: Antônio dos Santos Sousa" /></label><label className="field"><span>CC/UC</span><input value={accountContract} onChange={(event) => setAccountContract(event.target.value)} /></label></div>
          <label className="field"><span>Telefone de contato</span><input type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Ex.: (91) 99999-9999" /></label>
          <label className="field"><span>Documentos apresentados</span><input value={documents} onChange={(event) => setDocuments(event.target.value)} /></label>
          <div className="form-row script-two-columns"><label className="field"><span>E-mail para retorno</span><input type="email" value={returnEmail} onChange={(event) => setReturnEmail(event.target.value)} /></label><label className="field"><span>Classe de consumo</span><select value={consumptionClass} onChange={(event) => setConsumptionClass(event.target.value)}><option value="RESIDENCIAL">Residencial</option><option value="EMPRESA">Empresa</option></select></label></div>
          <div className="state-contact-card"><strong>Contatos de {contact.state}</strong><span>WhatsApp {contact.whatsapp}</span><span>Central {contact.central}</span></div>
        </div>
        <aside className="panel script-preview-panel">
          <div className="section-heading"><div><p className="eyebrow">PRONTO PARA USAR</p><h2>Prévia do script</h2></div></div>
          <pre>{result}</pre>
          <button className="primary-button copy-script-button" type="button" onClick={() => void copyScript(result, "customer")}>{copied === "customer" ? "Script copiado!" : "Copiar mensagem do cliente"}</button>
          <div className="section-heading script-sap-heading"><div><p className="eyebrow">PRONTO PARA COLAR NO SAP</p><h2>Solicitação via Backoffice</h2></div></div>
          <pre>{sapRequest}</pre>
          <button className="primary-button copy-script-button" type="button" onClick={() => void copyScript(sapRequest, "sap")}>{copied === "sap" ? "Texto do SAP copiado!" : "Copiar texto para o SAP"}</button>
        </aside>
      </section>
    </div>
  );
}

function Report({ data, isSupervisor }: { data: DashboardData; isSupervisor: boolean }) {
  const [selectedEmail, setSelectedEmail] = useState("all");
  const source = isSupervisor && selectedEmail !== "all" ? data.activities.filter((activity) => activity.userEmail === selectedEmail) : data.activities;
  const groups = data.typologies.map((typology) => {
    const items = source.filter((activity) => activity.typologyId === typology.id);
    return { name: typology.name, total: items.reduce((sum, item) => sum + item.quantity, 0) };
  }).filter((item) => item.total > 0).sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...groups.map((item) => item.total));
  const protocolCount = source.filter((item) => item.kind === "protocol").reduce((sum, item) => sum + item.quantity, 0);
  const callCount = source.filter((item) => item.kind === "call").reduce((sum, item) => sum + item.quantity, 0);
  const selectedMember = data.team.find((member) => member.email === selectedEmail);
  const exportOptions = {
    title: isSupervisor ? "Relatório de produtividade da equipe" : "Relatório individual de produtividade",
    subtitle: isSupervisor ? (selectedMember?.name ?? "Toda a equipe") : data.currentUser.name,
    activities: source,
  };
  return (
    <div className="page-stack">
      <div className="page-title report-title"><div><p className="eyebrow">ANÁLISE</p><h2>{isSupervisor ? "Relatórios da equipe" : "Meu relatório"}</h2><p>{isSupervisor ? "Selecione toda a equipe ou um atendente para consultar e exportar." : "Resumo individual dos seus registros realizados no sistema."}</p></div>{isSupervisor ? <div className="report-toolbar"><select value={selectedEmail} onChange={(event) => setSelectedEmail(event.target.value)}><option value="all">Toda a equipe</option>{data.team.map((member) => <option key={member.email} value={member.email}>{member.name}</option>)}</select><div className="export-actions"><button type="button" className="export-button pdf" onClick={() => exportPdfReport(exportOptions)}>Baixar PDF</button><button type="button" className="export-button excel" onClick={() => exportExcelReport(exportOptions)}>Baixar Excel</button></div></div> : <span className="permission-tag readonly">Visualização individual</span>}</div>
      <section className="metric-grid report-metrics"><article className="metric-card"><span className="metric-icon blue">▤</span><div><small>Protocolos</small><strong>{protocolCount}</strong></div></article><article className="metric-card"><span className="metric-icon green">◖</span><div><small>Ligações</small><strong>{callCount}</strong></div></article><article className="metric-card"><span className="metric-icon blue">Σ</span><div><small>Total</small><strong>{protocolCount + callCount}</strong></div></article></section>
      <section className="panel chart-panel"><div className="section-heading"><div><p className="eyebrow">DISTRIBUIÇÃO</p><h2>Quantidade por tipologia</h2></div></div>{groups.length ? <div className="bar-chart">{groups.map((item) => <div className="bar-row" key={item.name}><div><span>{item.name}</span><strong>{item.total}</strong></div><div className="bar-track"><span style={{ width: `${(item.total / max) * 100}%` }} /></div></div>)}</div> : <EmptyState title="Sem dados para o relatório" text="Os indicadores serão exibidos após os primeiros registros." />}</section>
    </div>
  );
}

type ReportPeriod = "daily" | "weekly" | "monthly" | "custom";

function reportRange(period: ReportPeriod, reference: string) {
  const [year, month, day] = reference.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(start);
  if (period === "weekly") {
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 6);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
  }
  const iso = (value: Date) => {
    const offset = value.getTimezoneOffset();
    return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
  };
  return { start: iso(start), end: iso(end) };
}

function ProductionReports({ data, isSupervisor }: { data: DashboardData; isSupervisor: boolean }) {
  const [selectedEmail, setSelectedEmail] = useState("all");
  const [period, setPeriod] = useState<ReportPeriod | "">("");
  const [referenceDate, setReferenceDate] = useState(todayInput());
  const [startDate, setStartDate] = useState(todayInput());
  const [endDate, setEndDate] = useState(todayInput());
  const periods: { id: ReportPeriod; label: string; description: string }[] = [
    { id: "daily", label: "Diário", description: "Produção do dia selecionado" },
    { id: "weekly", label: "Semanal", description: "De segunda-feira a domingo" },
    { id: "monthly", label: "Mensal", description: "Produção do mês selecionado" },
  ];
  const selectedMember = data.team.find((member) => member.email === selectedEmail);
  const personLabel = isSupervisor ? (selectedMember?.name ?? "Toda a equipe") : data.currentUser.name;
  const baseSource = (isSupervisor && selectedEmail !== "all"
    ? data.activities.filter((activity) => activity.userEmail === selectedEmail)
    : data.activities).filter((activity) => activity.kind === "protocol");
  const rangeFor = (nextPeriod: ReportPeriod) => nextPeriod === "custom"
    ? { start: startDate <= endDate ? startDate : endDate, end: startDate <= endDate ? endDate : startDate }
    : reportRange(nextPeriod, referenceDate);
  const filterPeriod = (nextPeriod: ReportPeriod) => {
    const range = rangeFor(nextPeriod);
    return baseSource.filter((activity) => {
      const date = activity.occurredAt.slice(0, 10);
      return date >= range.start && date <= range.end;
    });
  };
  const activePeriod: ReportPeriod = period || "daily";
  const source = filterPeriod(activePeriod);
  const range = rangeFor(activePeriod);
  const currentPeriod = periods.find((item) => item.id === activePeriod) ?? { id: "custom" as ReportPeriod, label: "Personalizado", description: "Intervalo escolhido" };
  const dateText = range.start === range.end
    ? new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")
    : `${new Date(`${range.start}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${range.end}T12:00:00`).toLocaleDateString("pt-BR")}`;
  const protocolCount = source.reduce((sum, item) => sum + item.quantity, 0);
  const groupMap = new Map<string, { name: string; total: number }>();
  source.forEach((activity) => {
    const key = String(activity.typologyId);
    const existing = groupMap.get(key);
    groupMap.set(key, { name: `Protocolo — ${activity.typologyName}`, total: (existing?.total ?? 0) + activity.quantity });
  });
  const groups = [...groupMap.values()].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...groups.map((item) => item.total));
  const dailySummary = [...source.reduce((days, activity) => {
    const day = activity.occurredAt.slice(0, 10);
    const current = days.get(day) ?? { day, protocols: 0 };
    current.protocols += activity.quantity;
    days.set(day, current);
    return days;
  }, new Map<string, { day: string; protocols: number }>()).values()].sort((a, b) => b.day.localeCompare(a.day));
  const optionsFor = (nextPeriod: ReportPeriod) => {
    const label = periods.find((item) => item.id === nextPeriod)?.label ?? "Personalizado";
    const exportRange = rangeFor(nextPeriod);
    const exportDates = exportRange.start === exportRange.end
      ? new Date(`${exportRange.start}T12:00:00`).toLocaleDateString("pt-BR")
      : `${new Date(`${exportRange.start}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${exportRange.end}T12:00:00`).toLocaleDateString("pt-BR")}`;
    return { title: `Relatório ${label.toLowerCase()} de protocolos`, subtitle: `${personLabel} • Período: ${exportDates}`, activities: filterPeriod(nextPeriod).filter((activity) => activity.kind === "protocol") };
  };
  return <div className="page-stack">
    <div className="page-title report-title"><div><p className="eyebrow">ANÁLISE DE PRODUÇÃO</p><h2>{isSupervisor ? "Relatórios por atendente" : "Meu relatório"}</h2><p>{isSupervisor ? "Consulte e exporte a produção diária, semanal e mensal de cada atendente." : "Consulte e exporte sua produção por período."}</p></div><span className="permission-tag readonly">Somente leitura</span></div>
    <section className="panel report-filters">
      {isSupervisor ? <label><span>Atendente</span><select value={selectedEmail} onChange={(event) => setSelectedEmail(event.target.value)}><option value="all">Toda a equipe</option>{data.team.map((member) => <option key={member.email} value={member.email}>{member.name}</option>)}</select></label> : null}
      <label><span>Período exibido</span><select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod | "")}><option value="">Escolha Diário, Semanal ou Mensal</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}<option value="custom">Personalizado</option></select></label>
      {period === "custom" ? <span className="permission-tag">Período personalizado</span> : null}
      <label className="report-date-range"><span>Data inicial</span><input type="date" value={startDate} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => { setStartDate(event.target.value); setReferenceDate(event.target.value); setPeriod("custom"); }} /><small>Clique no campo para abrir o calendário.</small></label>
      <label className="report-date-range"><span>Data final</span><input type="date" value={endDate} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => { setEndDate(event.target.value); setPeriod("custom"); }} /><small>Clique no campo para abrir o calendário.</small></label>
    </section>
    {period ? <><section className="report-period-grid single-period">{periods.filter((item) => item.id === period).map((item) => {
      const itemSource = filterPeriod(item.id);
      const protocols = itemSource.filter((activity) => activity.kind === "protocol").reduce((sum, activity) => sum + activity.quantity, 0);
      return <article key={item.id} className={`panel report-period-card ${period === item.id ? "active" : ""}`}><button className="period-select" type="button" onClick={() => setPeriod(item.id)}><span>{item.label}</span><div className="period-kind-counts"><strong>Protocolos: {protocols}</strong></div><small>{item.description}</small></button>{period === item.id ? <div className="export-actions"><button type="button" className="export-button pdf" onClick={() => exportPdfReport(optionsFor(item.id))}>Baixar PDF</button><button type="button" className="export-button excel" onClick={() => void exportExcelReport(optionsFor(item.id))}>Baixar Excel</button></div> : <p className="period-download-hint">Selecione este período para baixar</p>}</article>;
    })}</section>
    {period === "custom" ? <section className="panel report-custom-download"><div><p className="eyebrow">PERÍODO PERSONALIZADO</p><h2>{dateText}</h2><p>Baixe somente os protocolos encontrados entre as datas escolhidas.</p></div><div className="export-actions"><button type="button" className="export-button pdf" onClick={() => exportPdfReport(optionsFor("custom"))}>Baixar PDF</button><button type="button" className="export-button excel" onClick={() => void exportExcelReport(optionsFor("custom"))}>Baixar Excel</button></div></section> : null}
    <div className="report-range-note"><strong>{personLabel}</strong><span>{currentPeriod.label}: {dateText}</span></div>
    <section className="metric-grid report-metrics report-one-metric"><article className="metric-card"><span className="metric-icon blue">P</span><div><small>Quantidade de protocolos</small><strong>{protocolCount}</strong></div></article></section>
    <section className="panel report-days"><div className="section-heading"><div><p className="eyebrow">PROTOCOLOS POR DIA</p><h2>Dias incluídos no relatório</h2><p>Clique em um dia para filtrar somente os protocolos daquela data.</p></div></div>{dailySummary.length ? <div className="table-scroll"><table><thead><tr><th>Dia</th><th>Protocolos</th><th>Filtrar</th></tr></thead><tbody>{dailySummary.map((item) => <tr key={item.day}><td><strong>{new Date(`${item.day}T12:00:00`).toLocaleDateString("pt-BR")}</strong></td><td>{item.protocols}</td><td><button type="button" className="export-button" onClick={() => { setStartDate(item.day); setEndDate(item.day); setReferenceDate(item.day); setPeriod("custom"); }}>Ver este dia</button></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum dia encontrado" text="Escolha outro período para consultar." />}</section>
    <section className="panel chart-panel"><div className="section-heading"><div><p className="eyebrow">DISTRIBUIÇÃO</p><h2>Quantidade por tipologia</h2></div></div>{groups.length ? <div className="bar-chart">{groups.map((item) => <div className="bar-row" key={item.name}><div><span>{item.name}</span><strong>{item.total}</strong></div><div className="bar-track"><span style={{ width: `${(item.total / max) * 100}%` }} /></div></div>)}</div> : <EmptyState title="Sem produção neste período" text="Escolha outra data, período ou atendente para consultar." />}</section></> : <section className="panel report-awaiting-selection"><EmptyState title="Escolha o período do relatório" text="Selecione Diário, Semanal, Mensal ou informe as datas inicial e final para visualizar e baixar os protocolos." /></section>}
  </div>;
}

function Team({ data }: { data: DashboardData }) {
  return <div className="page-stack"><div className="page-title"><div><p className="eyebrow">ACESSO DA SUPERVISÃO</p><h2>Desempenho da equipe</h2><p>Somente visualização: nenhum registro pode ser criado ou alterado aqui.</p></div></div><TeamSummary data={data} /></div>;
}

function TeamSummary({ data, compact = false }: { data: DashboardData; compact?: boolean }) {
  return (
    <section className={`panel team-panel ${compact ? "compact" : ""}`}>
      <div className="section-heading"><div><p className="eyebrow">EQUIPE</p><h2>Resultado por atendente</h2></div><span className="permission-tag readonly">Somente leitura</span></div>
      {data.team.length ? <div className="table-scroll"><table><thead><tr><th>Atendente</th><th>Protocolos</th><th>Ligações</th><th>Produtividade média</th></tr></thead><tbody>{data.team.map((member) => { const score = attendantAverageProductivity(data, member.email); return <tr key={member.email}><td><strong>{member.name}</strong><small>{member.email}</small></td><td>{member.protocols}</td><td>{member.calls}</td><td><span className={`score-pill ${score >= 0.9 ? "good" : "low"}`}>{formatPercent(score)}</span></td></tr>; })}</tbody></table></div> : <EmptyState title="Nenhum atendente identificado" text="Os atendentes aparecerão depois do primeiro acesso ao sistema." />}
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span>○</span><strong>{title}</strong><p>{text}</p></div>;
}
