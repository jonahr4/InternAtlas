"use client";

import { useState } from "react";

type ApiResponse = {
  added: number;
  updated?: number;
  skipped: number;
  total: number;
  message?: string;
};

export default function AdminPage() {
  const [urls, setUrls] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleA, setRoleA] = useState("Software Developer");
  const [roleB, setRoleB] = useState("Software Engineer");
  const [location, setLocation] = useState("united states");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResponse(null);

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });

      const data = (await res.json()) as ApiResponse;
      setResponse(data);
    } catch {
      setResponse({
        added: 0,
        skipped: 0,
        total: 0,
        message: "Request failed. Check the server logs.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Admin: Import Greenhouse Boards
      </h1>
      <p className="text-zinc-600">
        Paste Google results or a list of Greenhouse board URLs. We will extract
        company slugs and store them in the database.
      </p>
      <section className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Search query builder</div>
        <div className="mt-2 grid gap-3">
          <label className="flex flex-col gap-1">
            <span>Location keywords</span>
            <input
              className="h-9 rounded border border-zinc-200 px-3"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Role keyword A</span>
            <input
              className="h-9 rounded border border-zinc-200 px-3"
              value={roleA}
              onChange={(event) => setRoleA(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Role keyword B</span>
            <input
              className="h-9 rounded border border-zinc-200 px-3"
              value={roleB}
              onChange={(event) => setRoleB(event.target.value)}
            />
          </label>
          <div>
            <div className="font-medium text-zinc-900">Google query</div>
            <div className="mt-1 break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
              {`site:boards.greenhouse.io ${location} intext:"apply" (intext:"${roleA}" OR intext:"${roleB}")`}
            </div>
          </div>
          <div className="text-xs text-zinc-600">
            Tip: set Google time range to last 24 hours for fresh results.
          </div>
        </div>
      </section>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          className="min-h-[200px] rounded border border-zinc-200 p-3 text-sm"
          placeholder="Paste URLs here (supports raw Google result text)..."
          value={urls}
          onChange={(event) => setUrls(event.target.value)}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="h-10 rounded bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSubmitting ? "Importing..." : "Import boards"}
        </button>
      </form>
      {response ? (
        <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <div>Total URLs parsed: {response.total}</div>
          <div>New companies: {response.added}</div>
          <div>Updated (duplicates): {response.updated ?? 0}</div>
          <div>Skipped: {response.skipped}</div>
          {response.message ? <div>{response.message}</div> : null}
        </div>
      ) : null}
    </main>
  );
}
