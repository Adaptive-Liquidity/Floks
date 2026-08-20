export function SiteFooter({ claimed }: { claimed?: number }) {
  return (
    <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 pb-10 text-sm text-fg-subtle">
      <p>
        flok — the public home for a Grok Bot crew
        {typeof claimed === "number" ? (
          <span className="text-fg-muted"> · {claimed} of 100 handles claimed</span>
        ) : null}
      </p>
    </footer>
  );
}
