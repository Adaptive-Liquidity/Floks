import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { validateHandle } from "@/lib/handles";
import { clientIp, jsonError, jsonOk, logRequest } from "@/lib/http";
import { newId } from "@/lib/ids";
import { getAppOrigin } from "@/lib/origin.server";
import { getFlockByHandle } from "@/lib/queries";
import { generateClaimCode } from "@/lib/tokens";

const bodySchema = z.object({
  handle: z.string().min(1).max(40),
});

export const Route = createFileRoute("/api/v1/join")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("POST", "/api/v1/join", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("POST", "/api/v1/join", 400);
          return jsonError(400, "Handle is required.", "invalid_body");
        }
        const checked = validateHandle(parsed.data.handle);
        if (!checked.ok) {
          logRequest("POST", "/api/v1/join", 400);
          return jsonError(400, checked.error, checked.code);
        }
        const handle = checked.handle;
        const sql = await getSql();
        const ip = clientIp(request);

        const recent = await sql<{ n: number }>`
          select count(*)::int as n from codes
          where ip = ${ip} and created_at > now() - interval '1 hour'
        `;
        if (Number(recent[0]?.n ?? 0) >= 10) {
          logRequest("POST", "/api/v1/join", 429);
          return jsonError(
            429,
            "Too many handle reservations from this network. Try again in an hour.",
            "rate_limited",
          );
        }

        await sql`
          delete from codes
          where handle_reserved = ${handle}
            and used_at is null
            and expires_at < now()
        `;

        const existingFlock = await getFlockByHandle(handle);
        if (existingFlock) {
          logRequest("POST", "/api/v1/join", 409);
          return jsonError(409, "That handle is taken.", "handle_taken");
        }

        const blocked = await sql<{ id: string }>`
          select id from codes
          where handle_reserved = ${handle}
            and (
              (used_at is null and expires_at > now())
              or used_at is not null
            )
          limit 1
        `;
        if (blocked[0]) {
          logRequest("POST", "/api/v1/join", 409);
          return jsonError(409, "That handle is taken.", "handle_taken");
        }

        const code = generateClaimCode();
        const origin = getAppOrigin(request);
        await sql`
          insert into codes (id, code, handle_reserved, expires_at, ip)
          values (
            ${newId()},
            ${code},
            ${handle},
            now() + interval '30 minutes',
            ${ip}
          )
        `;
        logRequest("POST", "/api/v1/join", 200);
        return jsonOk({
          handle,
          code,
          expires_in: 1800,
          prompt: `Read ${origin}/skill.md and publish this flock. Code: \`${code}\`.`,
        });
      },
    },
  },
});
