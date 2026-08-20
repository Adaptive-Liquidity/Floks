import type { GradeSnapshot } from "@/lib/grade";

export function GradeBadge({ snapshot }: { snapshot: GradeSnapshot }) {
  const confidence =
    snapshot.confidence === null
      ? "confidence unavailable"
      : `${Math.round(snapshot.confidence * 100)}% confidence`;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase ${
        snapshot.outlined
          ? "border-dashed border-border-strong bg-transparent text-fg-subtle"
          : "border-accent/60 bg-accent/12 text-working"
      }`}
      title={`${snapshot.grade} · ${confidence}`}
      aria-label={`${snapshot.grade}, ${confidence}${snapshot.outlined ? ", thin evidence" : ""}`}
    >
      {snapshot.grade}
    </span>
  );
}
