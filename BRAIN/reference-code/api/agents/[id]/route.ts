import { NextResponse } from "next/server";
import { demoResponse, findAgent } from "../../_utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const agent = findAgent(id);
  return agent ? demoResponse(agent) : NextResponse.json({ ok: false, error: "Agent not found" }, { status: 404 });
}
