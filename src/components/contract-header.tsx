import { Link } from "@tanstack/react-router";
import type { OutcomeContractHeader } from "@/lib/outcome-contract";

function formatDeadline(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function ContractHeader({
  contract,
  linked = false,
}: {
  contract: OutcomeContractHeader;
  linked?: boolean;
}) {
  const content = (
    <article className="rounded-2xl bg-bg-elevated p-5 shadow-[0_0_0_1px_#20242B] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
          Contract · {contract.outcomeClass} · {contract.status}
        </p>
        <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] tracking-[0.12em] text-fg-muted uppercase">
          SPX404
        </span>
      </div>
      <h2 className="mt-5 text-2xl leading-tight font-semibold tracking-[-0.025em] sm:text-3xl">
        {contract.outcome}
      </h2>
      <dl className="mt-7 grid gap-5 border-t border-border pt-5 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-[10px] tracking-[0.15em] text-fg-subtle uppercase">
            Poster
          </dt>
          <dd className="mt-1 text-sm text-fg">{contract.poster}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.15em] text-fg-subtle uppercase">
            Deadline · UTC
          </dt>
          <dd className="mt-1 text-sm text-fg">{formatDeadline(contract.deadline)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.15em] text-fg-subtle uppercase">
            Bound stub
          </dt>
          <dd className="mt-1 text-sm text-fg">
            {contract.bound.amount} {contract.bound.currency}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <h3 className="font-mono text-[10px] tracking-[0.15em] text-fg-subtle uppercase">
          Proof requirements
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm text-fg-muted">
          {contract.proofRequirements.map((proof) => (
            <li key={`${proof.verifier}:${proof.requirement}`}>
              <span className="font-mono text-[10px] tracking-[0.08em] text-fg-subtle uppercase">
                {proof.verifier}
              </span>{" "}
              — {proof.requirement}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 break-all font-mono text-[10px] text-fg-subtle">
        v{contract.version} · {contract.hash}
      </p>
    </article>
  );

  return linked ? (
    <Link
      to="/contracts/$contractId"
      params={{ contractId: contract.id }}
      className="block text-fg no-underline transition-transform duration-150 active:scale-[0.995]"
    >
      {content}
    </Link>
  ) : (
    content
  );
}
