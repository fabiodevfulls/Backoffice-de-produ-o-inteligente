export type ProductionRow = { date: string; email: string; name: string; productiveSeconds: number; protocols: number; calls: number; total: number };
export type SupervisionMember = Omit<ProductionRow, "date"> & { activeDays: number; productivity: number | null };

export function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function weekDays(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const monday = shiftDay(day, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index));
}

export function aggregateProduction(rows: ProductionRow[], workday: number): SupervisionMember[] {
  const members = new Map<string, SupervisionMember & { dates: Set<string> }>();
  for (const row of rows) {
    const member = members.get(row.email) ?? { email: row.email, name: row.name, protocols: 0, calls: 0, total: 0, productiveSeconds: 0, activeDays: 0, productivity: null, dates: new Set<string>() };
    member.protocols += row.protocols;
    member.calls += row.calls;
    member.total += row.total;
    member.productiveSeconds += row.productiveSeconds;
    if (row.total > 0) member.dates.add(row.date);
    members.set(row.email, member);
  }
  return Array.from(members.values(), ({ dates, ...member }) => ({ ...member, activeDays: dates.size, productivity: dates.size && workday > 0 ? member.productiveSeconds / (dates.size * workday) : null }));
}

export function supervisionStatus(score: number | null) {
  if (score === null) return { label: "Sem registro", tone: "neutral" };
  if (score >= 0.9) return { label: "Meta atingida", tone: "achieved" };
  if (score > 0.8) return { label: "Em evolução", tone: "evolving" };
  if (score < 0.75) return { label: "Revisar", tone: "review" };
  return { label: "Acompanhar", tone: "follow" };
}
