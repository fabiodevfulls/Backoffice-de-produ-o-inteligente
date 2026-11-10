import assert from "node:assert/strict";
import test from "node:test";
import { aggregateProduction, supervisionStatus, weekDays, shiftDay } from "../app/lib/supervision.ts";

test("monthly productivity uses distinct active days per attendant", () => {
  const row = { date: "2026-11-05", email: "a@example.com", name: "Ana", productiveSeconds: 50, protocols: 1, calls: 2, total: 3 };
  const [member] = aggregateProduction([row, row, { ...row, date: "2026-11-06" }], 100);
  assert.equal(member.activeDays, 2);
  assert.equal(member.productivity, .75);
  assert.equal(member.total, 9);
  assert.deepEqual(aggregateProduction([], 100), []);
});
test("statuses use the approved boundaries, including exact 75%, 80% and 90%", () => {
  for (const [score, label] of [[0,"Revisar"],[.74999,"Revisar"],[.75,"Acompanhar"],[.79999,"Acompanhar"],[.8,"Acompanhar"],[.80001,"Em evolução"],[.89999,"Em evolução"],[.9,"Meta atingida"],[1.1,"Meta atingida"],[null,"Sem registro"]]) {
    assert.equal(supervisionStatus(score).label, label);
  }
});
test("weeks and preceding dates cross month and year boundaries correctly", () => {
  assert.deepEqual(weekDays("2026-11-01"), ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
});
