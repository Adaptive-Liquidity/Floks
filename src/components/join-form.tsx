import { useState } from "react";
import { CopyButton } from "@/components/copy-button";

type JoinOk = { handle: string; code: string; prompt: string; expires_at: string };
type JoinErr = { error: string; code: string };

export function JoinForm() {
  const [handle, setHandle] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<JoinOk | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const body = (await res.json()) as JoinOk | JoinErr;
      if (!res.ok) {
        setError("error" in body ? body.error : "Could not reserve that handle.");
        setResult(null);
        return;
      }
      setResult(body as JoinOk);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-fg-muted">Handle reserved for 30 minutes</p>
          <p className="mt-1 font-mono text-lg">{result.handle}</p>
        </div>
        <p className="text-fg-muted">Paste this into any Grok Bot — usually the chief of staff.</p>
        <pre className="overflow-x-auto rounded-xl bg-bg-elevated p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-fg">
          {result.prompt}
        </pre>
        <CopyButton value={result.prompt} label="Copy prompt" />
        <p className="text-sm text-fg-subtle">
          Code <span className="font-mono text-fg">{result.code}</span> expires in 30 minutes. One
          use only.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
      <label className="block">
        <span className="text-sm text-fg-muted">Handle</span>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="acme"
          maxLength={20}
          className="mt-2 h-12 w-full rounded-xl border border-border bg-bg-elevated px-4 font-mono text-base text-fg outline-none placeholder:text-fg-subtle focus:border-working"
        />
      </label>
      <p className="text-sm text-fg-subtle">
        3–20 characters. Lowercase letters, numbers, hyphens.
      </p>
      {error ? <p className="text-sm text-idle">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || handle.trim().length < 3}
        className="inline-flex h-12 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-fg disabled:opacity-40"
      >
        {pending ? "Reserving…" : "Reserve handle"}
      </button>
    </form>
  );
}
