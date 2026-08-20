import { demoResponse, findRun } from "../../_utils";

export async function POST() {
  const run = findRun("demo-sentinel");
  return demoResponse({
    exportId: "export_demo_report_001",
    status: "ready",
    title: run?.title ?? "Decision Report",
    formats: ["PDF", "JSON", "PNG"],
  });
}
