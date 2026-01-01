"use client";

import { useEffect, useState } from "react";

type ApiResponse = {
  added: number;
  updated?: number;
  skipped: number;
  total: number;
  message?: string;
  addedUrls?: { name: string; url: string }[];
  updatedUrls?: { name: string; url: string }[];
};

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [urls, setUrls] = useState("");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ats, setAts] = useState("GREENHOUSE");
  const [method, setMethod] = useState<"google" | "html">("google");
  const [roleA, setRoleA] = useState("Software Developer");
  const [roleB, setRoleB] = useState("Software Engineer");
  const [location, setLocation] = useState("united states");

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch("/api/admin/auth");
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setIsCheckingAuth(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        setPassword("");
      } else {
        setAuthError("Invalid password");
      }
    } catch {
      setAuthError("Login failed. Please try again.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <div className="text-zinc-600">Loading...</div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <div className="w-full rounded-lg border border-zinc-200 bg-white p-8 shadow-md">
          <h1 className="text-2xl font-semibold text-zinc-900">Admin Login</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Enter the password to access the admin dashboard.
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="mt-1 h-10 w-full rounded border border-zinc-200 px-3 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            {authError && (
              <div className="text-sm text-red-600">{authError}</div>
            )}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="h-10 w-full rounded bg-zinc-900 text-sm font-medium text-white disabled:opacity-60"
            >
              {isLoggingIn ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResponse(null); // Reset to refresh the list

    try {
      const res = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls, method, ats }),
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
        Admin: Import ATS Boards
      </h1>
      <p className="text-zinc-600">
        Paste Google results or job board HTML. We will extract ATS board URLs
        and store companies in the database.
      </p>
      <section className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">ATS source</div>
        <div className="mt-2 flex flex-wrap gap-3">
          <label className="flex items-center gap-2">
            <span>Provider</span>
            <select
              className="h-9 rounded border border-zinc-200 px-3"
              value={ats}
              onChange={(event) => setAts(event.target.value)}
            >
              <option value="GREENHOUSE">Greenhouse</option>
              <option value="LEVER">Lever</option>
              <option value="WORKDAY">Workday</option>
              <option value="CUSTOM">Custom (to be implemented)</option>
            </select>
          </label>
          {ats === "WORKDAY" ? (
            <div className="text-xs text-amber-700">
            </div>
          ) : null}
          {ats === "CUSTOM" ? (
            <div className="text-xs text-amber-700">
              Selected ATS is not implemented yet.
            </div>
          ) : null}
        </div>
      </section>
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
            <div className="mt-1 space-y-2">
              {ats === "LEVER" ? (
                <div className="break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
                  {`site:jobs.lever.co ${location} intext:"apply" (intext:"${roleA}" OR intext:"${roleB}")`}
                </div>
              ) : ats === "WORKDAY" ? (
                <>
                  <div className="break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
                    {`site:myworkdayjobs.com ${location} intext:"apply" (intext:"${roleA}" OR intext:"${roleB}")`}
                  </div>
                  <div className="break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
                    {`site:wd1.myworkdayjobs.com inurl:/en-US/ "${roleB}"`}
                  </div>
                </>
              ) : (
                <>
                  <div className="break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
                    {`site:boards.greenhouse.io ${location} intext:"apply" (intext:"${roleA}" OR intext:"${roleB}")`}
                  </div>
                  <div className="break-words rounded border border-zinc-200 bg-white p-3 font-mono text-xs">
                    {`inurl:"job-boards.greenhouse.io/embed/job_app?for=" "${roleB}"`}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="text-xs text-zinc-600">
            Tip: set Google time range to last 24 hours for fresh results.
          </div>
        </div>
      </section>
      <section className="rounded border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Import method</div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setMethod("google")}
            className={`h-9 rounded border px-3 text-sm ${
              method === "google"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Google results
          </button>
          <button
            type="button"
            onClick={() => setMethod("html")}
            className={`h-9 rounded border px-3 text-sm ${
              method === "html"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700"
            }`}
          >
            Job board HTML
          </button>
        </div>
        {method === "google" ? (
          <div className="mt-2 text-xs text-zinc-600">
            Paste raw Google results text (it can include non-link lines).
          </div>
        ) : (
          <div className="mt-2 text-xs text-zinc-600">
            Sources to grab table HTML:
            <div className="mt-1 space-y-1">
              <a
                className="block text-blue-600 hover:underline"
                href="https://github.com/SimplifyJobs/Summer2026-Internships"
                target="_blank"
                rel="noreferrer"
              >
                https://github.com/SimplifyJobs/Summer2026-Internships
              </a>
              <a
                className="block text-blue-600 hover:underline"
                href="https://github.com/j-delaney/easy-application?tab=readme-ov-file"
                target="_blank"
                rel="noreferrer"
              >
                https://github.com/j-delaney/easy-application?tab=readme-ov-file
              </a>
              <a
                className="block text-blue-600 hover:underline"
                href="https://github.com/SimplifyJobs/New-Grad-Positions"
                target="_blank"
                rel="noreferrer"
              >
                https://github.com/SimplifyJobs/New-Grad-Positions
              </a>
            </div>
            <div className="mt-2">
              Open the table in DevTools and paste the raw HTML for the{" "}
              <code>&lt;table&gt;</code> element here.
            </div>
          </div>
        )}
      </section>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <textarea
          className="min-h-[200px] rounded border border-zinc-200 p-3 text-sm"
          placeholder={
            method === "google"
              ? "Paste URLs here (supports raw Google result text)..."
              : "Paste raw HTML (table element) here..."
          }
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
          
          {(response.addedUrls && response.addedUrls.length > 0) || (response.updatedUrls && response.updatedUrls.length > 0) ? (
            <div className="mt-4 space-y-3">
              {response.addedUrls && response.addedUrls.length > 0 ? (
                <div>
                  <div className="font-medium text-green-700 mb-2">New:</div>
                  <div className="max-h-48 overflow-y-auto rounded border border-zinc-200 bg-white p-3">
                    <ul className="space-y-1 text-xs">
                      {response.addedUrls.map((item, idx) => (
                        <li key={idx} className="break-all">
                          <span className="font-medium text-zinc-900">{item.name}</span>
                          <span className="text-zinc-400 mx-2">→</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                            {item.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              
              {response.updatedUrls && response.updatedUrls.length > 0 ? (
                <div>
                  <div className="font-medium text-amber-700 mb-2">Updated:</div>
                  <div className="max-h-48 overflow-y-auto rounded border border-zinc-200 bg-white p-3">
                    <ul className="space-y-1 text-xs">
                      {response.updatedUrls.map((item, idx) => (
                        <li key={idx} className="break-all">
                          <span className="font-medium text-zinc-900">{item.name}</span>
                          <span className="text-zinc-400 mx-2">→</span>
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-mono">
                            {item.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
