import assert from "node:assert/strict";
import test from "node:test";

import { displaceFromPointer } from "../app/login/particle-sphere-physics.ts";

test("points move away from a nearby mouse pointer", () => {
  const point = { x: 60, y: 50 };
  const displaced = displaceFromPointer(point, { x: 50, y: 50 }, 100, 40);

  assert.ok(displaced.x > point.x);
  assert.equal(displaced.y, point.y);
});

test("points stay in their normal position outside the hover radius", () => {
  const point = { x: 200, y: 50 };
  assert.deepEqual(displaceFromPointer(point, { x: 50, y: 50 }, 100, 40), point);
});

test("points return to their normal position when the pointer leaves", () => {
  const point = { x: 60, y: 50 };
  assert.deepEqual(displaceFromPointer(point, null, 100, 40), point);
});
