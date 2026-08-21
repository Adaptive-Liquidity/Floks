import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const vite = join(root, "node_modules", "vite", "bin", "vite.js");

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function startApp(authEnabled) {
  const port = await availablePort();
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.GROK_AUTH_CLIENT_SECRET;
  delete env.GROK_PREVIEW_CLIENT_SECRET;
  env.VITE_AUTH_ENABLED = authEnabled ? "true" : "false";
  if (authEnabled) env.GROK_PREVIEW_CLIENT_SECRET = "outcome-contract-route-test";

  const child = spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before startup (${child.exitCode}).\n${output}`);
    }
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return { baseUrl, child, output: () => output };
      }
    } catch {
      // Startup connection failures are expected until Vite is listening.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`Timed out waiting for Vite.\n${output}`);
}

async function stopApp(app) {
  if (app.child.exitCode !== null) return;
  app.child.kill();
  await Promise.race([
    new Promise((resolve) => app.child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (app.child.exitCode === null) {
    app.child.kill("SIGKILL");
  }
}

async function post(baseUrl, headers, body = "{}") {
  return fetch(`${baseUrl}/api/v1/contracts`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

test(
  "POST /api/v1/contracts enforces auth and request isolation",
  { timeout: 60_000 },
  async () => {
    const app = await startApp(true);
    try {
      const unauthorized = await post(app.baseUrl, { "sec-fetch-site": "same-origin" });
      assert.equal(unauthorized.status, 401, app.output());
      assert.equal((await unauthorized.json()).code, "unauthorized");

      const crossSite = await post(app.baseUrl, {
        cookie: "session=untrusted",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      });
      assert.equal(crossSite.status, 403, app.output());
      assert.equal((await crossSite.json()).code, "forbidden");
    } finally {
      await stopApp(app);
    }
  },
);

test(
  "POST /api/v1/contracts requires a real session when auth is disabled",
  { timeout: 60_000 },
  async () => {
    const app = await startApp(false);
    try {
      const unauthorized = await post(app.baseUrl, { "sec-fetch-site": "same-origin" });
      assert.equal(unauthorized.status, 401, app.output());
      assert.equal((await unauthorized.json()).code, "unauthorized");
    } finally {
      await stopApp(app);
    }
  },
);
