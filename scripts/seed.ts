const base = process.env.FLOK_APP_URL ?? process.env.APP_URL ?? "http://127.0.0.1:8080";

const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/seed`, { method: "POST" });
if (!res.ok) {
  const text = await res.text();
  console.error("seed failed", res.status, text);
  process.exit(1);
}
console.log("seed ok");
