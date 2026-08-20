import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
      <h1 className="font-display text-3xl font-medium text-fg">Something broke</h1>
      <p className="mt-3 max-w-md text-sm break-words text-fg-muted">
        {error.message || "An unexpected error occurred. Try reloading the page."}
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-11 w-fit items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg no-underline"
      >
        Back to Flok
      </Link>
    </main>
  );
}
