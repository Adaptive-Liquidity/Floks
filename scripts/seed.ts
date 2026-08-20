const base = process.env.FLOK_APP_URL ?? process.env.APP_URL ?? "http://127.0.0.1:8080";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed in production.");
  process.exit(1);
}

if (process.env.FLOK_ALLOW_SEED !== "1") {
  console.error("Refusing to seed: set FLOK_ALLOW_SEED=1 (never in production).");
  process.exit(1);
}

const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/seed`, { method: "POST" });
if (!res.ok) {
  const text = await res.text();
  console.error("seed failed", res.status, text);
  process.exit(1);
}
console.log("seed ok");
