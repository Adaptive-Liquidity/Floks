import { agentsSeed } from "@/lib/seed-data";
import { demoResponse } from "../_utils";

export async function GET() {
  return demoResponse(agentsSeed);
}
