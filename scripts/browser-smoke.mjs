#!/usr/bin/env node
/**
 * Headless load + screenshot of the local Flok server.
 * Exit 0 on success, 1 on navigation failure.
 * Uncaught page errors exit 2. Console errors warn; set FLOK_BROWSER_STRICT=1 to fail on them.
 *
 * Screenshot defaults to $PWD/screenshots/browser-smoke.png (Grok sandbox: /workspace/...).
 */
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";
import { computeBrandWarnings } from "./brand-check.mjs";

const defaultUrl = `${(process.env.FLOK_APP_URL || "http://127.0.0.1:8080").replace(/\/$/, "")}/`;
const url = checkedUrl(process.argv[2] || defaultUrl);
const defaultPng = join(resolve(process.cwd()), "screenshots", "browser-smoke.png");
const outPng = checkedOutputPath(process.argv[3] || process.env.BROWSER_SMOKE_OUT || defaultPng, [
  join(resolve(process.cwd()), "screenshots"),
  "/workspace/screenshots",
  "/tmp",
]);
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);
const waitUntil = process.env.CI ? "load" : "networkidle";
const strict = process.env.FLOK_BROWSER_STRICT === "1";

mkdirSync(dirname(outPng), { recursive: true });

const consoleErrors = [];
const pageErrors = [];

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

  const resp = await page.goto(url, { waitUntil, timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);

  const title = await page.title();
  const hasCanvas = (await page.locator("canvas").count()) > 0;
  const bodyTextLen = (
    await page
      .locator("body")
      .innerText()
      .catch(() => "")
  ).trim().length;
  const hasFlok = /flok/i.test(title) || (await page.locator("body").innerText()).includes("flok");

  await page.screenshot({ path: outPng, fullPage: false });

  const brandWarnings = computeBrandWarnings({ hasCanvas });

  console.log(
    JSON.stringify(
      {
        url,
        status,
        title,
        hasCanvas,
        hasFlok,
        bodyTextLen,
        consoleErrors,
        pageErrors,
        brandWarnings,
        screenshot: outPng,
      },
      null,
      2,
    ),
  );
  for (const w of brandWarnings) console.error(w);

  if (status >= 400 || status === 0) process.exit(1);
  if (pageErrors.length) process.exit(2);
  if (strict && consoleErrors.length) process.exit(2);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
