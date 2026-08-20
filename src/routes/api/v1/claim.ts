import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { generateFlockToken, hashToken } from "@/lib/tokens";

const bodySchema = z.object({
  code: z.string().trim().min(4).max(12),
});

export const Route = createFileRoute("/api/v1/claim")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          logRequest("POST", "/api/v1/claim", 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) {
          logRequest("POST", "/api/v1/claim", 400);
          return jsonError(400, "Code is required.", "code_invalid");
        }
        const code = parsed.data.code.trim().toUpperCase();
        const sql = await getSql();
        const rows = await sql<{
          id: string;
          handle_reserved: string;
          expires_at: unknown;
          used_at: unknown;
        }>`
          select id, handle_reserved, expires_at, used_at
          from codes where code = ${code} limit 1
        `;
        const row = rows[0];
        if (!row || row.used_at) {
          logRequest("POST", "/api/v1/claim", 400);
          return jsonError(400, "That code is invalid or already used.", "code_invalid");
        }
        const expires = new Date(String(row.expires_at)).getTime();
        if (Number.isNaN(expires) || expires < Date.now()) {
          logRequest("POST", "/api/v1/claim", 400);
          return jsonError(400, "That code has expired.", "code_invalid");
        }

        const flockToken = generateFlockToken();
        const tokenHash = hashToken(flockToken);
        await sql`
          update codes
          set used_at = now(), token_hash = ${tokenHash}
          where id = ${row.id} and used_at is null
        `;
        logRequest("POST", "/api/v1/claim", 200);
        return jsonOk({
          flock_token: flockToken,
          handle: row.handle_reserved,
        });
      },
    },
  },
});
