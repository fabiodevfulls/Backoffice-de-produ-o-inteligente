import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("admin attendants page exposes a QR access with a one-hour session and Nov 12 expiry", async () => {
  const dashboard = await read("app/dashboard.tsx");
  const card = await read("app/demo-access/demo-access-card.tsx");
  assert.match(dashboard, /<DemoAccessCard\s*\/>/);
  assert.match(card, /Gerar QR Code de teste/);
  assert.match(card, /1 hora/);
  assert.match(card, /12 de novembro de 2026/);
});

test("demo redemption consumes fragment token and redeems repeatedly without query-string token", async () => {
  const form = await read("app/demo-access/demo-access-form.tsx");
  assert.match(form, /window\.location\.hash/);
  assert.match(form, /history\.replaceState/);
  assert.match(form, /\/api\/demo-access\/redeem/);
});

test("demo sessions are capped at one hour and test user stays out of production data", async () => {
  const auth = await read("app/lib/auth.ts");
  const dashboardApi = await read("app/api/dashboard/route.ts");
  const monthlyApi = await read("app/api/supervisor/monthly-production/route.ts");
  assert.match(auth, /requestedMaxAge/);
  assert.match(dashboardApi, /COALESCE\(u\.is_demo, 0\) = 0/);
  assert.match(monthlyApi, /COALESCE\(u\.is_demo, 0\) = 0/);
});

test("production deployment explicitly enables the demo access until the app-level expiry", async () => {
  const config = await read("wrangler.jsonc");
  assert.match(config, /"DEMO_ACCESS_ENABLED"\s*:\s*"true"/);
});


test("the redeemed QR offers both modes without giving the demo user a production supervisor role", async () => {
  const form = await read("app/demo-access/demo-access-form.tsx");
  const page = await read("app/demo-access/supervision/page.tsx");
  const session = await read("app/lib/demo-session.ts");
  const store = await read("app/lib/demo-access-store.ts");
  const dashboard = await read("app/dashboard.tsx");

  assert.match(form, /href="\/">Atendimento<\/Link>/);
  assert.match(form, /href="\/demo-access\/supervision">Supervisão<\/Link>/);
  assert.match(page, /if \(!await hasActiveDemoSession\(await headers\(\)\)\) redirect/);
  assert.match(session, /revoked_at IS NULL AND expires_at > \?/);
  assert.match(store, /'attendant'/);
  assert.match(dashboard, /if \(demo \|\| !isSupervisor \|\| !accessToken\) return/);
});
