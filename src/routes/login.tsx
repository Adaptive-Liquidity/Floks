import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { FlockMark } from "@/components/mark";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Sign in · Flok" }] }),
});

function Login() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <Link to="/" className="flex items-center gap-2 text-fg no-underline">
        <FlockMark className="h-4 w-8" />
        <span className="font-display text-2xl">Flok</span>
      </Link>
      <h1 className="mt-10 font-display text-3xl font-medium">Sign in</h1>
      <p className="mt-2 text-sm text-fg-muted">
        Optional. Anyone can view a flock without an account.
      </p>
      <div className="mt-8 space-y-3">
        {authEnabled ? (
          GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              className="flex h-12 w-full items-center justify-center rounded-full border border-border bg-bg-elevated text-sm font-medium hover:border-border-strong"
            >
              Continue with {p.label}
            </button>
          ))
        ) : (
          <p className="text-sm text-fg-subtle">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
