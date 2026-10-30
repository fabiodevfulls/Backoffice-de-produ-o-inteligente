import assert from "node:assert/strict";
import test from "node:test";

import {
  averageDailyProductivity,
  dailyProductionMetrics,
  summarizeSelectedDay,
  summarizeDailyProduction,
  productivityBand,
} from "../app/lib/daily-productivity.ts";

test("averages today's productivity across attendants with production", () => {
  assert.equal(averageDailyProductivity([
    { productiveSeconds: 10_200 },
    { productiveSeconds: 20_400 },
    { productiveSeconds: 0 },
  ], 20_400), 0.75);
});

test("returns zero when there is no production or workday duration", () => {
  assert.equal(averageDailyProductivity([], 20_400), 0);
  assert.equal(averageDailyProductivity([{ productiveSeconds: 10 }], 0), 0);
});

test("uses red below 70%, yellow from 70% to below 80%, and green from 80%", () => {
  assert.equal(productivityBand(0.6999), "low");
  assert.equal(productivityBand(0.7), "medium");
  assert.equal(productivityBand(0.7999), "medium");
  assert.equal(productivityBand(0.8), "good");
});

test("summarizes a selected day and identifies each attendant who produced", () => {
  assert.deepEqual(summarizeDailyProduction([
    { email: "b@example.com", name: "Bia", productiveSeconds: 20_400, protocols: 2, calls: 1, total: 3 },
    { email: "a@example.com", name: "Ana", productiveSeconds: 10_200, protocols: 1, calls: 0, total: 1 },
    { email: "c@example.com", name: "Caio", productiveSeconds: 0, protocols: 0, calls: 0, total: 0 },
  ], 20_400), {
    average: 0.75,
    attendants: [
      { email: "a@example.com", name: "Ana", productiveSeconds: 10_200, protocols: 1, calls: 0, total: 1, productivity: 0.5 },
      { email: "b@example.com", name: "Bia", productiveSeconds: 20_400, protocols: 2, calls: 1, total: 3, productivity: 1 },
    ],
  });
});

test("uses the chosen calendar date rather than today's production", () => {
  const result = summarizeSelectedDay([
    { date: "2026-10-27", email: "a@example.com", name: "Ana", productiveSeconds: 18_564, protocols: 2, calls: 0, total: 2 },
    { date: "2026-10-29", email: "a@example.com", name: "Ana", productiveSeconds: 842, protocols: 0, calls: 1, total: 1 },
  ], "2026-10-27", 20_400);

  assert.equal(result.average, 0.91);
  assert.deepEqual(result.attendants.map((attendant) => attendant.name), ["Ana"]);
});

test("builds dashboard metrics from only the selected day's producing attendants", () => {
  const day = summarizeSelectedDay([
    { date: "2026-10-27", email: "a@example.com", name: "Ana", productiveSeconds: 18_564, protocols: 2, calls: 0, total: 2 },
    { date: "2026-10-27", email: "b@example.com", name: "Bia", productiveSeconds: 10_200, protocols: 1, calls: 3, total: 4 },
    { date: "2026-10-29", email: "c@example.com", name: "Caio", productiveSeconds: 20_400, protocols: 8, calls: 9, total: 17 },
  ], "2026-10-27", 20_400);

  assert.deepEqual(dailyProductionMetrics(day.attendants), {
    producingAttendants: 2,
    protocols: 3,
    calls: 3,
    total: 6,
  });
});
