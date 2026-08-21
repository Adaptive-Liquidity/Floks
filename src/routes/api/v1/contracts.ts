import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/lib/api-user-auth.server";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { outcomeContractInputSchema } from "@/lib/outcome-contract";
import {
  ContractLimitError,
  createOutcomeContract,
  listPosterOutcomeContracts,
} from "@/lib/outcome-contracts.server";

const path = "/api/v1/contracts";

function privateAuthResponse(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie, Authorization");
  return response;
}

export const Route = createFileRoute("/api/v1/contracts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireApiUser(request);
        if (!auth.ok) {
          logRequest("GET", path, auth.response.status);
          return privateAuthResponse(auth.response);
        }
        const contracts = await listPosterOutcomeContracts(auth.userId);
        logRequest("GET", path, 200);
        return privateAuthResponse(jsonOk({ contracts }));
      },
      POST: async ({ request }) => {
        const auth = await requireApiUser(request);
        if (!auth.ok) {
          logRequest("POST", path, auth.response.status);
          return auth.response;
        }
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          logRequest("POST", path, 400);
          return jsonError(400, "Expected JSON body.", "invalid_json");
        }
        const parsed = outcomeContractInputSchema.safeParse(body);
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? "Provide a valid contract.";
          logRequest("POST", path, 400);
          return jsonError(400, message, "invalid_body");
        }
        try {
          const contract = await createOutcomeContract(auth.userId, parsed.data);
          logRequest("POST", path, 201);
          return jsonOk({ contract }, 201);
        } catch (error) {
          if (error instanceof ContractLimitError) {
            logRequest("POST", path, 429);
            return jsonError(
              429,
              "Contract limit reached for this poster.",
              "contract_limit_reached",
            );
          }
          throw error;
        }
      },
    },
  },
});
