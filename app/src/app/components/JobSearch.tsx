"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { JobTable } from "./JobTable";

type Job = {
  id: string;
  title: string;
  location: string | null;
  jobUrl: string;
  descriptionText: string | null;
  createdAt: string;
  updatedAt?: string;
  sourcePlatform: string;
  status: string;
  company: {
    name: string;
    boardUrl: string;
  };
};

type ApiResponse = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
};

type SortOption = {
  label: string;
  sort: string;
  sortDir: "asc" | "desc";
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Company (A-Z)", sort: "company", sortDir: "asc" },
  { label: "Company (Z-A)", sort: "company", sortDir: "desc" },
  { label: "Title (A-Z)", sort: "title", sortDir: "asc" },
  { label: "Title (Z-A)", sort: "title", sortDir: "desc" },
  { label: "Date Found (Newest)", sort: "created_at", sortDir: "desc" },
  { label: "Date Found (Oldest)", sort: "created_at", sortDir: "asc" },
  { label: "Date Updated (Newest)", sort: "updated_at", sortDir: "desc" },
  { label: "Date Updated (Oldest)", sort: "updated_at", sortDir: "asc" },
];

const PAGE_SIZE = 50;

type QueryState = {
  titleQuery: string;
  companyFilter: string;
  locationFilter: string;
  statusOpen: boolean;
  statusClosed: boolean;
  sortOption: SortOption;
  page: number;
};

const DEFAULT_STATE: QueryState = {
  titleQuery: "",
  companyFilter: "",
  locationFilter: "",
  statusOpen: true,
  statusClosed: false,
  sortOption: SORT_OPTIONS[0],
  page: 1,
};

function buildSearchParams(state: QueryState) {
  const params = new URLSearchParams();
  if (state.titleQuery.trim()) params.set("title", state.titleQuery.trim());
  if (state.companyFilter.trim())
    params.set("companyName", state.companyFilter.trim());
  if (state.locationFilter.trim())
    params.set("location", state.locationFilter.trim());

  if (state.statusOpen && !state.statusClosed) {
    params.set("status", "ACTIVE");
  } else if (!state.statusOpen && state.statusClosed) {
    params.set("status", "CLOSED");
  }

  params.set("page", String(state.page));
  params.set("pageSize", String(PAGE_SIZE));
  params.set("sort", state.sortOption.sort);
  params.set("sortDir", state.sortOption.sortDir);

  return params;
}

function parseSearchParams(searchParams: URLSearchParams): QueryState {
  const titleQuery = searchParams.get("title") ?? "";
  const companyFilter = searchParams.get("companyName") ?? "";
  const locationFilter = searchParams.get("location") ?? "";
  const statusParam = (searchParams.get("status") ?? "").toUpperCase();
  const sort = searchParams.get("sort") ?? "";
  const sortDir =
    (searchParams.get("sortDir")?.toLowerCase() as "asc" | "desc") ?? "asc";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10)
  );

  const sortOption =
    SORT_OPTIONS.find(
      (option) => option.sort === sort && option.sortDir === sortDir
    ) ?? DEFAULT_STATE.sortOption;

  const statusOpen =
    statusParam === "CLOSED" ? false : DEFAULT_STATE.statusOpen;
  const statusClosed =
    statusParam === "ACTIVE" ? false : statusParam === "CLOSED";

  return {
    titleQuery,
    companyFilter,
    locationFilter,
    statusOpen,
    statusClosed,
    sortOption,
    page,
  };
}

export default function JobSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const [rangeLabel, setRangeLabel] = useState<string>("Showing 0 jobs");

  const [titleQuery, setTitleQuery] = useState(DEFAULT_STATE.titleQuery);
  const [companyFilter, setCompanyFilter] = useState(
    DEFAULT_STATE.companyFilter
  );
  const [locationFilter, setLocationFilter] = useState(
    DEFAULT_STATE.locationFilter
  );
  const [statusOpen, setStatusOpen] = useState(DEFAULT_STATE.statusOpen);
  const [statusClosed, setStatusClosed] = useState(DEFAULT_STATE.statusClosed);
  const [sortOption, setSortOption] = useState(DEFAULT_STATE.sortOption);
  const [page, setPage] = useState(DEFAULT_STATE.page);

  const [data, setData] = useState<ApiResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isLastUpdatedLoading, setIsLastUpdatedLoading] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const parsed = parseSearchParams(new URLSearchParams(searchParams.toString()));
    setTitleQuery(parsed.titleQuery);
    setCompanyFilter(parsed.companyFilter);
    setLocationFilter(parsed.locationFilter);
    setStatusOpen(parsed.statusOpen);
    setStatusClosed(parsed.statusClosed);
    setSortOption(parsed.sortOption);
    setPage(parsed.page);
    fetchJobs(parsed.page, { overrideState: parsed, skipUrlUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLatestUpdatedAt();
  }, []);

  type FetchOptions = {
    overrideState?: Partial<QueryState>;
    skipUrlUpdate?: boolean;
  };

  function formatRelativeTime(date: Date | null): string {
    if (!date) return "—";
    const diffMs = date.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const minutes = Math.round(absMs / (1000 * 60));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ${diffMs < 0 ? "ago" : "from now"}`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ${diffMs < 0 ? "ago" : "from now"}`;
    const days = Math.round(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} ${diffMs < 0 ? "ago" : "from now"}`;
  }

  async function fetchJobs(
    nextPage = 1,
    options: FetchOptions = { overrideState: {}, skipUrlUpdate: false }
  ) {
    setIsLoading(true);
    setError(null);

    const nextState: QueryState = {
      titleQuery,
      companyFilter,
      locationFilter,
      statusOpen,
      statusClosed,
      sortOption,
      ...(options.overrideState ?? {}),
      page: nextPage,
    };

    try {
      const params = buildSearchParams(nextState);
      if (!options.skipUrlUpdate) {
        router.replace(`?${params.toString()}`, { scroll: false });
      }

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const payload = (await res.json()) as ApiResponse;
      setData(payload);
      setPage(nextState.page);
      setTitleQuery(nextState.titleQuery);
      setCompanyFilter(nextState.companyFilter);
      setLocationFilter(nextState.locationFilter);
      setStatusOpen(nextState.statusOpen);
      setStatusClosed(nextState.statusClosed);
      setSortOption(nextState.sortOption);
      const start = (payload.page - 1) * payload.pageSize + 1;
      const end = Math.min(payload.total, start + payload.items.length - 1);
      setRangeLabel(
        payload.total === 0
          ? "Showing 0 jobs"
          : `Showing ${start}–${end} of ${payload.total}`
      );
      const latestFromPage = payload.items.reduce<Date | null>(
        (latestDate, job) => {
          const ts = job.updatedAt ?? job.createdAt;
          const date = new Date(ts);
          if (Number.isNaN(date.getTime())) {
            return latestDate;
          }
          if (!latestDate) return date;
          return date.getTime() > latestDate.getTime() ? date : latestDate;
        },
        null
      );
      if (
        latestFromPage &&
        (!lastUpdatedAt || latestFromPage.getTime() > lastUpdatedAt.getTime())
      ) {
        setLastUpdatedAt(latestFromPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchLatestUpdatedAt() {
    try {
      setIsLastUpdatedLoading(true);
      const res = await fetch(`/api/jobs/last-updated`);
      if (!res.ok) return;
      const payload = (await res.json()) as { lastUpdated: string | null };
      if (!payload.lastUpdated) return;
      const date = new Date(payload.lastUpdated);
      if (!Number.isNaN(date.getTime())) {
        setLastUpdatedAt(date);
      }
    } finally {
      setIsLastUpdatedLoading(false);
    }
  }

  const activeChips = useMemo(() => {
    const chips: Array<{ label: string; override: Partial<QueryState> }> = [];
    if (titleQuery.trim()) {
      chips.push({
        label: `Title: ${titleQuery.trim()}`,
        override: { titleQuery: "" },
      });
    }
    if (companyFilter.trim()) {
      chips.push({
        label: `Company: ${companyFilter.trim()}`,
        override: { companyFilter: "" },
      });
    }
    if (locationFilter.trim()) {
      chips.push({
        label: `Location: ${locationFilter.trim()}`,
        override: { locationFilter: "" },
      });
    }
    if (statusOpen && !statusClosed) {
      chips.push({
        label: "Status: Open",
        override: { statusOpen: false },
      });
    } else if (!statusOpen && statusClosed) {
      chips.push({
        label: "Status: Closed",
        override: { statusClosed: false },
      });
    }
    return chips;
  }, [companyFilter, locationFilter, statusClosed, statusOpen, titleQuery]);

  function resetFilters() {
    setTitleQuery(DEFAULT_STATE.titleQuery);
    setCompanyFilter(DEFAULT_STATE.companyFilter);
    setLocationFilter(DEFAULT_STATE.locationFilter);
    setStatusOpen(DEFAULT_STATE.statusOpen);
    setStatusClosed(DEFAULT_STATE.statusClosed);
    setSortOption(DEFAULT_STATE.sortOption);
    setPage(DEFAULT_STATE.page);
    fetchJobs(1, { overrideState: DEFAULT_STATE });
  }

  return (
    <section className="mx-auto flex w-[80vw] max-w-6xl flex-col">
      <div className="rounded-2xl border border-white/20 bg-white/80 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-100/50 bg-gradient-to-r from-indigo-50/30 to-purple-50/30 px-5 py-4">
          <h2 className="bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-2xl font-bold text-transparent">Job Board</h2>
          <p className="text-sm text-slate-600">
            Last updated: {isLastUpdatedLoading ? "…" : formatRelativeTime(lastUpdatedAt)}
          </p>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Search job title..."
              value={titleQuery}
              onChange={(event) => setTitleQuery(event.target.value)}
            />
            <input
              className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Filter by company"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            />
            <input
              className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm outline-none ring-0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              placeholder="Filter by location"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              value={sortOption.label}
              onChange={(event) => {
                const next =
                  SORT_OPTIONS.find(
                    (option) => option.label === event.target.value
                  ) ?? SORT_OPTIONS[0];
                setSortOption(next);
                fetchJobs(1, { overrideState: { sortOption: next } });
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-70"
              onClick={() => fetchJobs(1)}
              disabled={isLoading}
            >
              Search
            </button>
            <button
              type="button"
              className="h-11 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={resetFilters}
              disabled={isLoading}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={statusOpen}
                onChange={(event) => {
                  setStatusOpen(event.target.checked);
                  fetchJobs(1, { overrideState: { statusOpen: event.target.checked } });
                }}
              />
              Open
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={statusClosed}
                onChange={(event) => {
                  setStatusClosed(event.target.checked);
                  fetchJobs(1, { overrideState: { statusClosed: event.target.checked } });
                }}
              />
              Closed
            </label>
          </div>
          {activeChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                  onClick={() => {
                    if (chip.override.titleQuery !== undefined) {
                      setTitleQuery(chip.override.titleQuery);
                    }
                    if (chip.override.companyFilter !== undefined) {
                      setCompanyFilter(chip.override.companyFilter);
                    }
                    if (chip.override.locationFilter !== undefined) {
                      setLocationFilter(chip.override.locationFilter);
                    }
                    if (chip.override.statusOpen !== undefined) {
                      setStatusOpen(chip.override.statusOpen);
                    }
                    if (chip.override.statusClosed !== undefined) {
                      setStatusClosed(chip.override.statusClosed);
                    }
                    fetchJobs(1, { overrideState: { ...chip.override, page: 1 } });
                  }}
                >
                  {chip.label}
                  <span className="text-slate-400">×</span>
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                onClick={resetFilters}
                disabled={isLoading}
              >
                Clear all
              </button>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              Tip: apply filters to narrow results. They’ll stay in the URL so you can refresh or share.
            </div>
          )}
        </div>

        {error ? <div className="px-5 pb-4 text-sm text-amber-700">{error}</div> : null}

        <div className="border-t border-slate-100 px-5 py-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-700">{rangeLabel}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-9 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
                onClick={() => fetchJobs(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
              >
                Prev
              </button>
              <button
                type="button"
                className="h-9 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
                onClick={() => fetchJobs(page + 1)}
                disabled={page >= Math.max(1, Math.ceil(data.total / PAGE_SIZE)) || isLoading}
              >
                Next
              </button>
            </div>
          </div>
          <JobTable
            jobs={data.items}
            total={data.total}
            page={page}
            pageSize={PAGE_SIZE}
            isLoading={isLoading}
            onPageChange={(next) => fetchJobs(next)}
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-700">{rangeLabel}</div>
            <div className="flex gap-2">
              <button
                type="button"
                className="h-9 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
                onClick={() => fetchJobs(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
              >
                Prev
              </button>
              <button
                type="button"
                className="h-9 rounded border border-slate-200 px-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-50"
                onClick={() => fetchJobs(page + 1)}
                disabled={page >= Math.max(1, Math.ceil(data.total / PAGE_SIZE)) || isLoading}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
