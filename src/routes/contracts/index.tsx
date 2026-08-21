import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ContractHeader } from "@/components/contract-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { authMiddleware } from "@/lib/auth/middleware";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listPosterOutcomeContracts } from "@/lib/outcome-contracts.server";
import type { OutcomeContractHeader } from "@/lib/outcome-contract";

const loadPosterContracts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => listPosterOutcomeContracts(context.userId));

export const Route = createFileRoute("/contracts/")({
  component: PosterContracts,
  head: () => ({ meta: [{ title: "Your Contracts · Flok" }] }),
});

function PosterContracts() {
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id;
  const [contracts, setContracts] = useState<OutcomeContractHeader[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setContracts(null);
    setLoadFailed(false);
    void loadPosterContracts()
      .then((rows) => {
        if (active) setContracts(rows);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader action="none" />
      <main className="flex-1 pt-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-fg-subtle uppercase">
              Poster history
            </p>
            <h1 className="mt-3 text-4xl leading-none font-bold sm:text-5xl">Your Contracts</h1>
          </div>
          <UserButton />
        </div>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-muted">
          Only Contracts created by this signed-in poster appear here.
        </p>

        {loadFailed ? (
          <p className="mt-10 rounded-2xl border border-border p-5 text-sm text-fg-muted">
            Contracts could not be loaded. Try again.
          </p>
        ) : contracts === null ? (
          <p className="mt-10 font-mono text-xs text-fg-subtle">Loading contracts…</p>
        ) : contracts.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-border p-5 text-sm text-fg-muted">
            No Outcome Contracts yet.
          </p>
        ) : (
          <ul className="mt-10 space-y-4">
            {contracts.map((contract) => (
              <li key={contract.id}>
                <ContractHeader contract={contract} linked />
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
