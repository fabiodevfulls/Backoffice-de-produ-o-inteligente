import { access } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workerPath = resolve(projectRoot, "dist/server/index.js");
await access(workerPath);

const workerUrl = pathToFileURL(workerPath);
workerUrl.searchParams.set("artifact-validation", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);
if (!worker || typeof worker.fetch !== "function") {
  throw new Error("O artefato precisa exportar um Worker com fetch(request, env, ctx).");
}

console.log("Artefato validado: dist/server/index.js exporta um Worker com fetch().");
