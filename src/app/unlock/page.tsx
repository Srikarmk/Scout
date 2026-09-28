"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Unlock() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "that did not work");
        return;
      }
      // refresh() so the gated layout is re-fetched with the new cookie.
      router.replace("/");
      router.refresh();
    } catch {
      setError("could not reach the server");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-[20px] font-medium text-ink">Scout</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
        This deployment runs research agents against a paid API key, so it is behind an access
        token.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-3">
        <input
          type="password"
          autoFocus
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="access token"
          className="w-full rounded-lg border border-line bg-raise px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !token}
          className="w-full rounded-lg border border-accent bg-accent-soft py-2.5 text-[14px] text-ink disabled:opacity-50"
        >
          {busy ? "checking..." : "Unlock"}
        </button>
        {error ? <p className="text-[13px] text-bad">{error}</p> : null}
      </form>
    </main>
  );
}
