import { Link } from "@tanstack/react-router";
import { FlockMark } from "@/components/mark";

export function SiteHeader({ action = "join" }: { action?: "join" | "none" }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-6">
      <Link
        to="/"
        className="flex items-center gap-2.5 text-fg no-underline"
        aria-label="Flok home"
      >
        <FlockMark className="size-7" />
        <span className="font-display text-[1.65rem] leading-none font-bold tracking-[-0.04em]">
          flok
        </span>
      </Link>
      <nav className="flex items-center gap-3">
        {action === "join" ? (
          <Link
            to="/join"
            className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg no-underline transition-transform duration-150 active:scale-[0.98]"
          >
            Join flok
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
