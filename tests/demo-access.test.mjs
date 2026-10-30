import assert from "node:assert/strict";
import test from "node:test";

import {
  createDemoAccess,
  digestDemoToken,
  generateDemoToken,
  isDemoAccessEnabled,
  redeemDemoAccess,
} from "../app/lib/demo-access.ts";

const now = new Date("2026-10-28T12:00:00.000Z");
const token = "a".repeat(43);

function createDependencies(overrides = {}) {
  const state = { created: null, lookups: [], stored: null };
  const dependencies = {
    now: () => now,
    generateId: () => "demo-id-1",
    generateToken: () => token,
    hashToken: async (value) => `digest:${value.length}`,
    createAccess: async (record) => { state.created = record; },
    findAccess: async (tokenHash, checkedAt) => {
      state.lookups.push({ tokenHash, checkedAt });
      if (state.stored?.tokenHash !== tokenHash || state.stored.expiresAt <= checkedAt) return null;
      return { email: state.stored.email, expiresAt: state.stored.expiresAt };
    },
    ...overrides,
  };
  return { state, dependencies };
}

test("demo access stays disabled unless explicitly enabled", () => {
  assert.equal(isDemoAccessEnabled(undefined), false);
  assert.equal(isDemoAccessEnabled("false"), false);
  assert.equal(isDemoAccessEnabled(true), false);
  assert.equal(isDemoAccessEnabled("true"), true);
});

test("creates a reusable QR link valid through November 12 without storing the raw token", async () => {
  const { state, dependencies } = createDependencies();
  const result = await createDemoAccess(
    { origin: "https://backoffice.example", createdBy: "ADMIN@example.com" },
    dependencies,
  );

  assert.equal(result.url, `https://backoffice.example/demo-access#${token}`);
  assert.equal(result.expiresAt, "2026-11-13T03:00:00.000Z");
  assert.equal(state.created.email, "demo-demo-id-1@demo.invalid");
  assert.equal(state.created.tokenHash, `digest:${token.length}`);
  assert.equal(state.created.createdBy, "admin@example.com");
  assert.equal(state.created.expiresAt, result.expiresAt);
  assert.equal(JSON.stringify(state.created).includes(token), false);
});

test("does not issue access after November 12 in Fortaleza", async () => {
  const expired = createDependencies({ now: () => new Date("2026-11-13T03:00:00.000Z") });
  await assert.rejects(
    createDemoAccess({ origin: "https://backoffice.example", createdBy: "admin@example.com" }, expired.dependencies),
    /terminou em 12 de novembro de 2026/i,
  );
  assert.equal(expired.state.created, null);
});

test("generates a URL-safe random token and a SHA-256 digest", async () => {
  assert.match(generateDemoToken(), /^[A-Za-z0-9_-]{43}$/);
  assert.match(await digestDemoToken(token), /^[a-f0-9]{64}$/);
});

test("refuses weak tokens and insecure origins without storing access", async () => {
  const weak = createDependencies({ generateToken: () => "weak-token" });
  await assert.rejects(
    createDemoAccess({ origin: "https://backoffice.example", createdBy: "admin@example.com" }, weak.dependencies),
    /token de demonstração seguro/i,
  );
  assert.equal(weak.state.created, null);

  const insecure = createDependencies();
  await assert.rejects(
    createDemoAccess({ origin: "http://backoffice.example", createdBy: "admin@example.com" }, insecure.dependencies),
    /HTTPS/i,
  );
  assert.equal(insecure.state.created, null);
});

test("allows repeated QR use until token expiry but limits each session to one hour", async () => {
  const { state, dependencies } = createDependencies();
  state.stored = {
    tokenHash: `digest:${token.length}`,
    email: "demo-demo-id-1@demo.invalid",
    expiresAt: "2026-11-13T03:00:00.000Z",
  };

  const first = await redeemDemoAccess(token, dependencies);
  const second = await redeemDemoAccess(token, dependencies);
  assert.deepEqual(first, { email: state.stored.email, maxAgeSeconds: 3_600 });
  assert.deepEqual(second, first);
  assert.equal(state.lookups.length, 2);
});

test("rejects malformed and expired tokens", async () => {
  const malformed = createDependencies();
  assert.equal(await redeemDemoAccess("short", malformed.dependencies), null);
  assert.equal(malformed.state.lookups.length, 0);

  const expired = createDependencies({
    now: () => new Date("2026-11-13T03:00:00.001Z"),
    findAccess: async () => ({ email: "demo@demo.invalid", expiresAt: "2026-11-13T03:00:00.000Z" }),
  });
  assert.equal(await redeemDemoAccess(token, expired.dependencies), null);
});
