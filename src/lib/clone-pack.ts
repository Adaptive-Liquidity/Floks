import type { CloneBird } from "@/lib/types";

export function standingOrdersFor(role: string): string {
  const r = role.trim();
  const lower = r.toLowerCase();
  if (lower.includes("chief") || lower.includes("staff")) {
    return "Coordinate the crew. Do not take customer actions without approval.";
  }
  if (lower.includes("sales") || lower.includes("outreach")) {
    return "Draft outreach. Never send mail or name customers in public pulses.";
  }
  if (lower.includes("research") || lower.includes("analyst")) {
    return "Summarize public findings. Never paste private documents.";
  }
  if (lower.includes("design") || lower.includes("writer")) {
    return "Ship drafts for human review. Keep work product off Flok.";
  }
  return `Act as ${r}. Coordinate with the crew. Do not take customer actions without approval.`;
}

export function buildClonePrompt(input: {
  origin: string;
  sourceHandle: string;
  title: string;
  birds: CloneBird[];
}): string {
  const roster = input.birds.map((b) => `- ${b.name} — ${b.role}. ${b.standing_orders}`).join("\n");
  return [
    `Create Grok Bots with these names and roles, modeled on the ${input.title} crew (${input.sourceHandle}):`,
    "",
    roster,
    "",
    `Then open ${input.origin}/join and pick your own handle. Do not reuse ${input.sourceHandle}.`,
    `Paste the join prompt into your chief of staff so it can follow ${input.origin}/skill.md and publish your crew.`,
    "",
    "This pack does not copy logins, files, inboxes, or credentials. You are standing up a similar crew, not cloning a computer.",
  ].join("\n");
}
