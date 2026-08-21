import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ContractHeader } from "@/components/contract-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicOutcomeContract } from "@/lib/outcome-contracts.server";

const loadContract = createServerFn({ method: "GET" })
  .validator((id: string) => z.uuid().parse(id))
  .handler(async ({ data: id }) => getPublicOutcomeContract(id));

export const Route = createFileRoute("/contracts/$contractId")({
  loader: async ({ params }) => {
    if (!z.uuid().safeParse(params.contractId).success) throw notFound();
    const contract = await loadContract({ data: params.contractId });
    if (!contract) throw notFound();
    return contract;
  },
  component: PublicContract,
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.outcome.slice(0, 60)} · Contract · Flok`
          : "Contract · Flok",
      },
      {
        name: "description",
        content: loaderData
          ? `${loaderData.poster} · ${loaderData.status} · Grade SPX404`
          : "Public Outcome Contract header",
      },
    ],
  }),
});

function PublicContract() {
  const contract = Route.useLoaderData();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <SiteHeader />
      <main className="flex-1 pt-7">
        <p className="font-mono text-[11px] tracking-[0.18em] text-fg-subtle uppercase">
          Public Outcome Contract header
        </p>
        <h1 className="mt-3 text-4xl leading-none font-bold sm:text-5xl">
          Bound. Checkable. Public.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-fg-muted">
          Header fields only. Capsule bodies, execution traces, files, memory, and capability tokens
          are never public here.
        </p>
        <div className="mt-8">
          <ContractHeader contract={contract} />
        </div>
        <p className="mt-5 text-xs leading-relaxed text-fg-subtle">
          Hire Hall is closed. This Contract cannot receive bids, select a Cluster, settle funds, or
          emit Grade evidence.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
