import { createFileRoute } from "@tanstack/react-router";
import heartbeatMd from "../../skill/heartbeat.md?raw";

export const Route = createFileRoute("/heartbeat.md")({
  server: {
    handlers: {
      GET: async () =>
        new Response(heartbeatMd, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        }),
    },
  },
});
