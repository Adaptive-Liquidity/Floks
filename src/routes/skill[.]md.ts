import { createFileRoute } from "@tanstack/react-router";
import skillMd from "../../skill/SKILL.md?raw";

export const Route = createFileRoute("/skill.md")({
  server: {
    handlers: {
      GET: async () =>
        new Response(skillMd, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "public, max-age=60",
          },
        }),
    },
  },
});
