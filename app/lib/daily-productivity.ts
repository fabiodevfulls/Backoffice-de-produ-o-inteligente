export type DailyProductivityRow = { productiveSeconds: number };
export type AttendantDayProduction = {
  email: string;
  name: string;
  productiveSeconds: number;
  protocols: number;
  calls: number;
  total: number;
};
export type ProductivityBand = "low" | "medium" | "good";

export function averageDailyProductivity(rows: DailyProductivityRow[], workdaySeconds: number) {
  if (workdaySeconds <= 0) return 0;
  const activeRows = rows.filter((row) => row.productiveSeconds > 0);
  if (!activeRows.length) return 0;
  return activeRows.reduce((sum, row) => sum + row.productiveSeconds / workdaySeconds, 0) / activeRows.length;
}

export function productivityBand(productivity: number): ProductivityBand {
  if (productivity >= 0.8) return "good";
  if (productivity >= 0.7) return "medium";
  return "low";
}

export function summarizeDailyProduction(rows: AttendantDayProduction[], workdaySeconds: number) {
  const attendants = rows
    .filter((row) => row.productiveSeconds > 0)
    .map((row) => ({
      ...row,
      productivity: workdaySeconds > 0 ? row.productiveSeconds / workdaySeconds : 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  return {
    average: averageDailyProductivity(attendants, workdaySeconds),
    attendants,
  };
}

export function summarizeSelectedDay(rows: Array<AttendantDayProduction & { date: string }>, selectedDate: string, workdaySeconds: number) {
  return summarizeDailyProduction(rows.filter((row) => row.date === selectedDate), workdaySeconds);
}

export function dailyProductionMetrics(attendants: AttendantDayProduction[]) {
  return attendants.reduce((totals, attendant) => ({
    producingAttendants: totals.producingAttendants + 1,
    protocols: totals.protocols + attendant.protocols,
    calls: totals.calls + attendant.calls,
    total: totals.total + attendant.total,
  }), { producingAttendants: 0, protocols: 0, calls: 0, total: 0 });
}
