import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const vinextCli = resolve(projectRoot, "node_modules/vinext/dist/cli.js");
const build = spawn(process.execPath, [vinextCli, "build"], {
  cwd: projectRoot,
  stdio: "inherit",
});
const timeout = setTimeout(() => {
  build.kill("SIGTERM");
  setTimeout(() => build.kill("SIGKILL"), 10_000).unref();
}, 180_000);

const exitCode = await new Promise((resolveExit, reject) => {
  build.once("error", reject);
  build.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
});
clearTimeout(timeout);
if (exitCode !== 0) process.exit(exitCode);

const validate = spawn(process.execPath, [resolve(projectRoot, "scripts/validate-artifact.mjs")], {
  cwd: projectRoot,
  stdio: "inherit",
});
const validateCode = await new Promise((resolveExit, reject) => {
  validate.once("error", reject);
  validate.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
});
process.exit(validateCode);
