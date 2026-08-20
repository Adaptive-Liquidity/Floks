export function jsonError(status: number, error: string, code: string): Response {
  return Response.json({ error, code }, { status });
}

export function jsonOk(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.slice(0, 128);
  return "unknown";
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

export function logRequest(method: string, path: string, status: number): void {
  console.info(`[flok] ${method} ${path} ${status}`);
}
