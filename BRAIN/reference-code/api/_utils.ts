import { NextResponse } from "next/server";
import { contractsSeed, evidenceSeed, runsSeed, agentsSeed, timelineSeed, seedVersion } from "@/lib/seed-data";

export function demoResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    {
      ok: true,
      data,
      meta: {
        demoMode: true,
        seedVersion,
      },
    },
    init,
  );
}

export function findAgent(id: string) {
  return agentsSeed.find((agent) => agent.id === id);
}

export function findRun(id: string) {
  return runsSeed.find((run) => run.id === id || (id === "demo-sentinel" && run.id === runsSeed[0]?.id));
}

export function findContract(id: string) {
  return contractsSeed.find((contract) => contract.id === id);
}

export function findEvidence(id: string) {
  return evidenceSeed.find((evidence) => evidence.id === id);
}

export function findTimeline(runId: string) {
  const resolvedRun = findRun(runId);
  return timelineSeed.filter((event) => event.relatedIds.includes(resolvedRun?.id ?? runId));
}
