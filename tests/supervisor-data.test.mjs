import assert from "node:assert/strict";
import test from "node:test";

import { teamMemberProductivity } from "../app/lib/report-selection.ts";

test("team productivity uses complete aggregate totals and active days", () => {
  assert.equal(teamMemberProductivity({ productiveSeconds: 61_200, activeDays: 3 }, 20_400), 1);
});

test("team productivity returns zero when there are no active days or workday duration", () => {
  assert.equal(teamMemberProductivity({ productiveSeconds: 0, activeDays: 0 }, 20_400), 0);
  assert.equal(teamMemberProductivity({ productiveSeconds: 20_400, activeDays: 1 }, 0), 0);
});
