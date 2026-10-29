"use client";

import { useState } from "react";
import { niche } from "@/lib/niche";

export default function Unlock() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  async function unlock(e) {
    e.preventDefault();
    setChecking(true);
    setError(null);

    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.message || "Couldn't unlock");
      }

      window.location.href = "/";
    } catch (err) {
      setError(err.message);
      setChecking(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={unlock}
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-6 ring-1 ring-zinc-800"
      >
        <h1 className="text-xl font-semibold tracking-tight text-white">
          {niche.appName}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Enter your passcode to continue.</p>

        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mt-5 w-full rounded-xl bg-zinc-800 px-4 py-3 text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-emerald-500"
          placeholder="Passcode"
        />

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <button
          type="submit"
          disabled={checking || !passcode}
          className="mt-5 w-full rounded-xl bg-emerald-500 py-3 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
