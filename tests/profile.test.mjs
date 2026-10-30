import assert from "node:assert/strict";
import test from "node:test";

import { validateProfileUpdate } from "../app/lib/profile.ts";

test("accepts a trimmed profile name and a compressed JPEG photo", () => {
  assert.deepEqual(validateProfileUpdate({
    name: "  Ana Silva  ",
    profilePhoto: "data:image/jpeg;base64,YW5h",
  }), {
    ok: true,
    value: { name: "Ana Silva", profilePhoto: "data:image/jpeg;base64,YW5h" },
  });
});

test("allows clearing a profile photo while keeping the account name", () => {
  assert.deepEqual(validateProfileUpdate({ name: "Ana Silva", profilePhoto: null }), {
    ok: true,
    value: { name: "Ana Silva", profilePhoto: null },
  });
});

test("rejects missing or invalid profile names", () => {
  assert.equal(validateProfileUpdate({ name: "  ", profilePhoto: null }).ok, false);
  assert.equal(validateProfileUpdate({ name: "AB", profilePhoto: null }).ok, false);
  assert.equal(validateProfileUpdate({ name: "A".repeat(121), profilePhoto: null }).ok, false);
});

test("rejects unsupported, malformed, and oversized profile photos", () => {
  assert.equal(validateProfileUpdate({ name: "Ana Silva", profilePhoto: "data:image/svg+xml;base64,PHN2Zz4=" }).ok, false);
  assert.equal(validateProfileUpdate({ name: "Ana Silva", profilePhoto: "data:image/jpeg;base64,***" }).ok, false);
  assert.equal(validateProfileUpdate({ name: "Ana Silva", profilePhoto: `data:image/jpeg;base64,${"A".repeat(350_000)}` }).ok, false);
});
