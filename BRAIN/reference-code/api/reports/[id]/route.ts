import { demoResponse, findRun } from "../../_utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = findRun("demo-sentinel");
  return demoResponse({
    id,
    title: run?.title ?? "Decision Report",
    decision: run?.decision,
    generatedAt: run?.endedAt ?? run?.startedAt,
    exportFormats: ["PDF", "JSON", "PNG"],
  });
}
