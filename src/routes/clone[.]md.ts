import { createFileRoute } from "@tanstack/react-router";
import cloneMd from "../../skill/clone.md?raw";

export const Route = createFileRoute("/clone.md")({
  server: {
    handlers: {
      GET: async () =>
        new Response(cloneMd, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        }),
    },
  },
});
