import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonError, jsonOk, logRequest } from "@/lib/http";
import { getPublicOutcomeContract } from "@/lib/outcome-contracts.server";

export const Route = createFileRoute("/api/v1/contracts/$contractId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = `/api/v1/contracts/${params.contractId}`;
        if (!z.uuid().safeParse(params.contractId).success) {
          logRequest("GET", path, 400);
          return jsonError(400, "Invalid contract id.", "invalid_contract_id");
        }
        const contract = await getPublicOutcomeContract(params.contractId);
        if (!contract) {
          logRequest("GET", path, 404);
          return jsonError(404, "Outcome Contract not found.", "contract_not_found");
        }
        logRequest("GET", path, 200);
        return jsonOk({ contract });
      },
    },
  },
});
