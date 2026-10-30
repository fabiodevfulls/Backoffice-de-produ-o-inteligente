import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const deployRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../deploy-ready");
const config = JSON.parse(await readFile(resolve(deployRoot, "wrangler.jsonc"), "utf8"));
const packageJson = JSON.parse(await readFile(resolve(deployRoot, "package.json"), "utf8"));

test("deployment config targets only the recovered Worker and its database", async () => {
  assert.equal(config.name, "backoffice-producao-recuperado");
  assert.equal(config.d1_databases[0].database_name, "backoffice-producao-recuperado-db");
  assert.equal(config.d1_databases[0].database_id, "8ccf22f1-220a-4112-b6c9-f9758e1d59b3");
  assert.equal(config.keep_vars, true);
  assert.equal(config.main, "server/index.js");
  assert.equal(config.assets.directory, "client");
  assert.equal((await readFile(resolve(deployRoot, config.main))).length > 0, true);
  await access(resolve(deployRoot, config.assets.directory));
});

test("deployment package exposes a deploy command using its local Wrangler config", () => {
  assert.equal(packageJson.scripts.deploy, "wrangler deploy --config ./wrangler.jsonc");
});
