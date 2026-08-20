import { cn } from "../layout/cn";

type PipelineStripProps = {
  stages: Array<{
    id: string;
    label: string;
    active?: boolean;
    complete?: boolean;
    blocked?: boolean;
  }>;
  className?: string;
};

export function PipelineStrip({ stages, className }: PipelineStripProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {stages.map((stage, index) => (
        <div
          key={stage.id}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em]",
            stage.active
              ? "border-[rgba(111,124,255,0.28)] bg-[rgba(111,124,255,0.14)] text-white"
              : stage.complete
                ? "border-[rgba(69,212,131,0.22)] bg-[rgba(69,212,131,0.1)] text-[#cdf8dc]"
                : stage.blocked
                  ? "border-[rgba(255,102,122,0.22)] bg-[rgba(255,102,122,0.1)] text-[#ffbfc8]"
                  : "border-[rgba(255,255,255,0.09)] bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]",
          )}
        >
          <span className="font-semibold">{String(index + 1).padStart(2, "0")}</span>
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

