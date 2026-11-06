"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ClipboardList, Headset, Phone, TrendingUp, X } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aggregateProduction, shiftDay, supervisionStatus, weekDays, type ProductionRow, type SupervisionMember } from "./lib/supervision";

type Member = { email: string; name: string };
type Props = { accessToken: string; team: Member[]; settings: { workdaySeconds: number; goal: number } };
const percent = (value: number) => value.toLocaleString("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const duration = (seconds: number) => `${Math.floor(seconds / 3600)}h${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

export default function SupervisionOverview({ accessToken, team, settings }: Props) {
  const [mode, setMode] = useState<"day" | "month">("day");
  const [day, setDay] = useState(today);
  const [email, setEmail] = useState("all");
  const [rows, setRows] = useState<ProductionRow[]>([]);
  const [roster, setRoster] = useState<Member[]>(team);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [showMissing, setShowMissing] = useState(false);
  const [detail, setDetail] = useState<SupervisionMember | null>(null);
  const month = day.slice(0, 7);
  const week = useMemo(() => weekDays(day), [day]);
  const previousMonth = shiftDay(`${month}-01`, -1).slice(0, 7);

  useEffect(() => {
    const controller = new AbortController();
    const months = [...new Set([month, previousMonth, ...week.map(value => value.slice(0, 7))])];
    setLoading(true);
    setError("");
    setRows([]);
    Promise.all(months.map(async value => {
      const response = await fetch(`/api/supervisor/monthly-production?${new URLSearchParams({ month: value })}`, { cache: "no-store", headers: { authorization: `Bearer ${accessToken}` }, signal: controller.signal });
      const result = await response.json() as { error?: string; dailyProduction: ProductionRow[]; team: Member[] };
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar a produção.");
      return result as { dailyProduction: ProductionRow[]; team: Member[] };
    })).then(results => {
      if (controller.signal.aborted) return;
      setRows(results.flatMap(result => result.dailyProduction ?? []));
      setRoster(results[months.indexOf(month)]?.team ?? team);
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a produção.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accessToken, month, previousMonth, week, reload, team]);

  const filtered = rows.filter(row => email === "all" || row.email === email);
  const periodRows = filtered.filter(row => mode === "day" ? row.date === day : row.date.startsWith(month) && row.date <= today());
  const members = aggregateProduction(periodRows, settings.workdaySeconds).filter(member => member.total > 0).sort((a, b) => (a.productivity ?? 0) - (b.productivity ?? 0));
  const missing = roster.filter(member => (email === "all" || member.email === email) && !members.some(active => active.email === member.email));
  const totals = members.reduce((sum, member) => ({ protocols: sum.protocols + member.protocols, calls: sum.calls + member.calls, total: sum.total + member.total }), { protocols: 0, calls: 0, total: 0 });
  const validScores = members.filter(member => member.productivity !== null);
  const average = validScores.length ? validScores.reduce((sum, member) => sum + member.productivity!, 0) / validScores.length : null;
  const averageColor = average === null ? "#94a3b8" : average >= 0.9 ? "#a3e635" : average >= 0.75 ? "#facc15" : "#fb7185";
  const priorDay = shiftDay(day, -1);
  // Compare month-to-date with the same number of calendar days in the previous month.
  const cutoff = month === today().slice(0, 7) ? Number(today().slice(8)) : 31;
  const priorMembers = aggregateProduction(filtered.filter(row => mode === "day" ? row.date === priorDay : row.date.startsWith(previousMonth) && Number(row.date.slice(8)) <= cutoff), settings.workdaySeconds);
  const comparisonAvailable = mode === "month" || priorDay.slice(0, 7) === month || priorDay.startsWith(previousMonth);
  const period = mode === "day" ? (day === today() ? "hoje" : `em ${dateLabel(day)}`) : `em ${new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  const trendDays = mode === "day" ? week.filter(value => value <= day) : Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`).filter(value => value <= today());
  const trend = trendDays.map(date => {
    const active = aggregateProduction(filtered.filter(row => row.date === date), settings.workdaySeconds).filter(member => member.productivity !== null);
    return { label: dateLabel(date), score: active.length ? active.reduce((sum, member) => sum + member.productivity!, 0) / active.length * 100 : null };
  });
  const weekly = week.map(date => ({ label: new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "") + ` ${dateLabel(date)}`, total: date > today() ? null : filtered.filter(row => row.date === date).reduce((sum, row) => sum + row.total, 0) }));
  const cards = [
    { label: `Atendentes com produção ${period}`, value: members.length, icon: Headset, tone: "cyan" },
    { label: `Protocolos ${period}`, value: totals.protocols, icon: ClipboardList, tone: "cyan" },
    { label: `Ligações ${period}`, value: totals.calls, icon: Phone, tone: "lime" },
    { label: `Atividades ${period}`, value: totals.total, icon: Activity, tone: "lime" },
  ];
  return <div className="supervision-overview">
    <header className="supervision-heading"><h2>Pulso da <span>operação</span></h2><p>Acompanhamento da equipe • Somente leitura</p></header>
    <div className="supervision-filters">
      <div className="supervision-toggle" role="group" aria-label="Período de acompanhamento"><button type="button" aria-pressed={mode === "day"} onClick={() => { setMode("day"); setDay(today()); setDetail(null); }}>Hoje</button><button type="button" aria-pressed={mode === "month"} onClick={() => { setMode("month"); setDetail(null); }}>Mês</button></div>
      <label><span>Escolher dia</span><input type="date" max={today()} value={day} onChange={event => { if (event.target.value) { setDay(event.target.value); setMode("day"); setDetail(null); } }} /></label>
      <label><span>Atendente</span><select value={email} onChange={event => { setEmail(event.target.value); setDetail(null); }}><option value="all">Equipe geral</option>{roster.map(member => <option key={member.email} value={member.email}>{member.name}</option>)}</select></label>
    </div>
    {error ? <div role="alert" className="alert error">{error}<button type="button" onClick={() => setReload(value => value + 1)}>Tentar novamente</button></div> : loading ? <p role="status">Carregando a produção e os comparativos…</p> : <>
    <section className="supervision-metrics" aria-label={`Resumo ${period}`}>{cards.map(card => <article key={card.label}><card.icon aria-hidden="true" className={card.tone} size={40} strokeWidth={1.5} /><div><small>{card.label}</small><strong>{card.value.toLocaleString("pt-BR")}</strong></div></article>)}</section>
    <section className="supervision-section"><div className="supervision-section-heading"><div><h3>Produtividade da equipe {period}</h3><p>{mode === "day" ? "Evolução diária na semana selecionada" : "Evolução diária no mês selecionado"} • média dos atendentes com produção</p></div><div className="supervision-average"><strong style={{ color: averageColor }}>{average === null ? "—" : percent(average)}</strong><span>Meta: {percent(settings.goal)}</span></div></div>
      {trend.some(point => point.score !== null) ? <div className="supervision-chart" role="img" aria-label={`Evolução diária da produtividade. Média do período: ${average === null ? "sem registro" : percent(average)}. Meta: ${percent(settings.goal)}.`}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 25, right: 35, bottom: 5, left: 0 }}><CartesianGrid stroke="#26384d" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" stroke="#94a3b8" fontSize={12} /><YAxis domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]} tickFormatter={value => `${value}%`} stroke="#94a3b8" fontSize={12} /><Tooltip contentStyle={{ background: "#111f32", border: "1px solid #26384d", color: "#f4f7fb" }} formatter={value => [`${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`, "Produtividade"]} /><ReferenceLine y={settings.goal * 100} stroke="#22d3ee" strokeDasharray="6 5" /><Area type="linear" dataKey="score" stroke={averageColor} fill={averageColor} fillOpacity={0.12} strokeWidth={3} dot={{ r: 4, fill: averageColor }} connectNulls={false} /></ComposedChart></ResponsiveContainer></div> : <p className="supervision-empty">Sem produção registrada para o gráfico neste período.</p>}
      <div className="supervision-legend"><span style={{ color: averageColor }}>● Produtividade da equipe</span><span>┄ Meta: {percent(settings.goal)}</span></div><p className="supervision-note">Cor pela média do período: vermelho abaixo de 75% • amarelo de 75% até abaixo de 90% • verde a partir de 90%.</p>
    </section>
    <section className="supervision-section"><div className="supervision-section-heading"><div><h3>Acompanhamento da equipe {period}</h3><p>Prioridade para quem precisa de acompanhamento</p></div></div>
      <div className="supervision-tabs" role="group" aria-label="Situação dos registros"><button type="button" aria-pressed={!showMissing} onClick={() => setShowMissing(false)}>Com produção ({members.length})</button><button type="button" aria-pressed={showMissing} onClick={() => setShowMissing(true)}>Sem registro ({missing.length})</button></div>
      <div className="table-scroll"><table className="supervision-table"><thead><tr><th>Atendente</th><th>Protocolos</th><th>Ligações</th><th>Total</th><th>Tempo produtivo</th><th>Produtividade</th><th>Situação</th><th><span className="sr-only">Detalhes</span></th></tr></thead><tbody>{showMissing ? missing.map(member => <tr key={member.email}><td><strong>{member.name}</strong></td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>Sem registro</td><td /></tr>) : members.map(member => {
        const status = supervisionStatus(member.productivity);
        const prior = priorMembers.find(item => item.email === member.email);
        const delta = comparisonAvailable && prior?.productivity !== null && prior?.productivity !== undefined && member.productivity !== null ? (member.productivity - prior.productivity) * 100 : null;
        return <tr key={member.email}><td><strong>{member.name}</strong></td><td>{member.protocols}</td><td>{member.calls}</td><td>{member.total}</td><td>{duration(member.productiveSeconds)}</td><td><div className={`supervision-score ${status.tone}`}><span>{member.productivity === null ? "—" : percent(member.productivity)}</span><meter min={0} max={Math.max(1, member.productivity ?? 0)} value={member.productivity ?? 0} aria-label={`Produtividade de ${member.name}`} /></div></td><td><span className={`supervision-status ${status.tone}`}>{status.label}</span>{delta !== null && delta >= 0.1 ? <small className="supervision-evolution"><TrendingUp size={14} aria-hidden="true" /> Variação <span>+{delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.</span></small> : null}</td><td><button type="button" className="supervision-detail-button" onClick={() => setDetail(member)}>Ver detalhes<span className="sr-only"> de {member.name}</span></button></td></tr>;
      })}</tbody></table></div>
      {(showMissing ? missing : members).length === 0 ? <p className="supervision-empty">{showMissing ? "Todos os atendentes deste filtro têm produção no período." : "Não há registros de produção para este período e este filtro."}</p> : null}
      <p className="supervision-note">Revisar: abaixo de 75%. Acompanhar: de 75% até 80%. Em evolução: acima de 80% e abaixo de 90%. Meta atingida: a partir de 90%. A variação compara com o {mode === "day" ? "dia anterior" : "mesmo intervalo do mês anterior"}, quando há registros comparáveis.</p>
      {detail ? <div className="supervision-detail" role="region" aria-label={`Detalhes de ${detail.name}`}><button type="button" aria-label="Fechar detalhes" onClick={() => setDetail(null)}><X size={20} /></button><h4>{detail.name}</h4><p>{detail.email}</p><p>{detail.activeDays} dia(s) com produção • {duration(detail.productiveSeconds)} de tempo produtivo • {detail.total} atividades {period}.</p><p>Produtividade = tempo produtivo ÷ ({duration(settings.workdaySeconds)} de jornada × dias com produção).</p></div> : null}
    </section>
    <section className="supervision-section"><div className="supervision-section-heading"><div><h3>Atividades da semana</h3><p>{dateLabel(week[0])} a {dateLabel(week[6])} • semana da data selecionada • {email === "all" ? "Equipe geral" : roster.find(member => member.email === email)?.name}</p></div></div><div className="supervision-chart weekly" role="img" aria-label={weekly.map(point => `${point.label}: ${point.total === null ? "data futura" : point.total}`).join("; ")}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={weekly} margin={{ top: 25, right: 20, left: 0, bottom: 10 }}><CartesianGrid stroke="#26384d" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" stroke="#94a3b8" fontSize={11} interval={0} /><YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} /><Tooltip contentStyle={{ background: "#111f32", border: "1px solid #26384d", color: "#f4f7fb" }} /><Bar dataKey="total" name="Atividades" fill="#22d3ee" radius={[4, 4, 0, 0]} maxBarSize={65} label={{ position: "top", fill: "#f4f7fb", fontSize: 12 }} /></ComposedChart></ResponsiveContainer></div><p className="supervision-note">Datas futuras ficam sem produção exibida.</p></section>
    </>}
    <footer className="supervision-note">Período: {period} • Supervisão • Somente leitura</footer>
  </div>;
}
