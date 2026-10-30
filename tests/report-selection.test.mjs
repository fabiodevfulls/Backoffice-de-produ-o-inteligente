import assert from "node:assert/strict";
import test from "node:test";

import { filterReportSelection } from "../app/lib/report-selection.ts";

const attendants = [
  { name: "Ana", email: "ana@example.com" },
  { name: "Bia", email: "bia@example.com" },
  { name: "Acesso de demonstração", email: "demo-123@demo.invalid" },
  { name: "Acesso de demonstração", email: "preview@example.com" },
];
const activities = [
  { userEmail: "ana@example.com", protocol: "A-1" },
  { userEmail: "bia@example.com", protocol: "B-1" },
  { userEmail: "demo-123@demo.invalid", protocol: "D-1" },
  { userEmail: "preview@example.com", userName: "Acesso de demonstração", protocol: "D-2" },
];

test("whole-team reports exclude the free demonstration account", () => {
  const result = filterReportSelection(attendants, activities, []);

  assert.deepEqual(result.attendants.map(({ email }) => email), ["ana@example.com", "bia@example.com"]);
  assert.deepEqual(result.activities.map(({ userEmail }) => userEmail), ["ana@example.com", "bia@example.com"]);
});

test("reports can combine selected attendants and include only their records", () => {
  const result = filterReportSelection(attendants, activities, ["BIA@example.com", "ana@example.com"]);

  assert.deepEqual(result.attendants.map(({ email }) => email), ["ana@example.com", "bia@example.com"]);
  assert.deepEqual(result.activities.map(({ userEmail }) => userEmail), ["ana@example.com", "bia@example.com"]);
});

test("a single selection stays individual and hidden demo names are excluded", () => {
  const result = filterReportSelection([
    { name: "Acesso de demonstração", email: "preview@example.com" },
    attendants[0],
  ], activities, ["ana@example.com"]);

  assert.deepEqual(result.attendants, [attendants[0]]);
  assert.deepEqual(result.activities, [activities[0]]);
});
