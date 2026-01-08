"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { JobCard } from "./JobCard";
import { JobDetailPanel } from "./JobDetailPanel";
import { TagInput } from "./TagInput";

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

type StatusFilter = "open" | "closed" | "both";

const SORT_OPTIONS: SortOption[] = [
  { label: "Company (A-Z)", sort: "company", sortDir: "asc" },
  { label: "Company (Z-A)", sort: "company", sortDir: "desc" },
  { label: "Title (A-Z)", sort: "title", sortDir: "asc" },
  { label: "Title (Z-A)", sort: "title", sortDir: "desc" },
  { label: "Newest First", sort: "created_at", sortDir: "desc" },
  { label: "Oldest First", sort: "created_at", sortDir: "asc" },
];

const PAGE_SIZE = 50;

type QueryState = {
  titleTags: string[];
  companyFilter: string;
  locationTags: string[];
  statusFilter: StatusFilter;
  sortOption: SortOption;
  page: number;
};

const DEFAULT_STATE: QueryState = {
  titleTags: [],
  companyFilter: "",
  locationTags: [],
  statusFilter: "open",
  sortOption: SORT_OPTIONS[0],
  page: 1,
};

function buildSearchParams(state: QueryState, titleTag?: string, locationTag?: string) {
  const params = new URLSearchParams();
  
  // For URL display, join all tags
  if (state.titleTags.length > 0 && !titleTag) {
    params.set("title", state.titleTags.join(","));
  } else if (titleTag) {
    params.set("title", titleTag);
  }
  
  if (state.companyFilter.trim())
    params.set("companyName", state.companyFilter.trim());
  
  if (state.locationTags.length > 0 && !locationTag) {
    params.set("location", state.locationTags.join(","));
  } else if (locationTag) {
    params.set("location", locationTag);
  }

  if (state.statusFilter === "open") {
    params.set("status", "ACTIVE");
  } else if (state.statusFilter === "closed") {
    params.set("status", "CLOSED");
  }

  params.set("page", String(state.page));
  params.set("pageSize", String(PAGE_SIZE));
  params.set("sort", state.sortOption.sort);
  params.set("sortDir", state.sortOption.sortDir);

  return params;
}

function parseSearchParams(searchParams: URLSearchParams): QueryState {
  const titleParam = searchParams.get("title") ?? "";
  const titleTags = titleParam ? titleParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const companyFilter = searchParams.get("companyName") ?? "";
  const locationParam = searchParams.get("location") ?? "";
  const locationTags = locationParam ? locationParam.split(",").map(t => t.trim()).filter(Boolean) : [];
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

  let statusFilter: StatusFilter = "open";
  if (statusParam === "CLOSED") {
    statusFilter = "closed";
  } else if (statusParam === "ACTIVE") {
    statusFilter = "open";
  } else if (!statusParam) {
    statusFilter = "both";
  }

  return {
    titleTags,
    companyFilter,
    locationTags,
    statusFilter,
    sortOption,
    page,
  };
}

export default function JobSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialized = useRef(false);

  const [titleTags, setTitleTags] = useState<string[]>(DEFAULT_STATE.titleTags);
  const [companyFilter, setCompanyFilter] = useState(DEFAULT_STATE.companyFilter);
  const [locationTags, setLocationTags] = useState<string[]>(DEFAULT_STATE.locationTags);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATE.statusFilter);
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
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const parsed = parseSearchParams(new URLSearchParams(searchParams.toString()));
    setTitleTags(parsed.titleTags);
    setCompanyFilter(parsed.companyFilter);
    setLocationTags(parsed.locationTags);
    setStatusFilter(parsed.statusFilter);
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
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  // Fetch jobs with OR logic - make separate requests for each tag and merge
  async function fetchJobs(
    nextPage = 1,
    options: FetchOptions = { overrideState: {}, skipUrlUpdate: false }
  ) {
    setIsLoading(true);
    setError(null);

    const nextState: QueryState = {
      titleTags,
      companyFilter,
      locationTags,
      statusFilter,
      sortOption,
      ...(options.overrideState ?? {}),
      page: nextPage,
    };

    try {
      // Update URL with all tags for sharing
      if (!options.skipUrlUpdate) {
        const urlParams = buildSearchParams(nextState);
        router.replace(`?${urlParams.toString()}`, { scroll: false });
      }

      let allJobs: Job[] = [];
      let estimatedTotal = 0;

      // If we have multiple title tags OR multiple location tags, make separate requests
      const titleSearches = nextState.titleTags.length > 0 ? nextState.titleTags : [""];
      const locationSearches = nextState.locationTags.length > 0 ? nextState.locationTags : [""];

      // Build all combinations and fetch in parallel
      const fetchPromises: Promise<ApiResponse>[] = [];
      
      for (const title of titleSearches) {
        for (const location of locationSearches) {
          const params = new URLSearchParams();
          if (title) params.set("title", title);
          if (nextState.companyFilter.trim()) params.set("companyName", nextState.companyFilter.trim());
          if (location) params.set("location", location);
          if (nextState.statusFilter === "open") params.set("status", "ACTIVE");
          else if (nextState.statusFilter === "closed") params.set("status", "CLOSED");
          params.set("page", String(nextPage));
          params.set("pageSize", String(PAGE_SIZE));
          params.set("sort", nextState.sortOption.sort);
          params.set("sortDir", nextState.sortOption.sortDir);

          fetchPromises.push(
            fetch(`/api/jobs?${params.toString()}`).then(res => {
              if (!res.ok) throw new Error(`Request failed: ${res.status}`);
              return res.json() as Promise<ApiResponse>;
            })
          );
        }
      }

      const results = await Promise.all(fetchPromises);

      // Merge results and deduplicate by job ID
      const seenIds = new Set<string>();
      for (const result of results) {
        for (const job of result.items) {
          if (!seenIds.has(job.id)) {
            seenIds.add(job.id);
            allJobs.push(job);
          }
        }
        // Take max of all totals as estimate
        estimatedTotal = Math.max(estimatedTotal, result.total);
      }

      // Sort combined results
      allJobs.sort((a, b) => {
        const dir = nextState.sortOption.sortDir === "asc" ? 1 : -1;
        if (nextState.sortOption.sort === "company") {
          return a.company.name.localeCompare(b.company.name) * dir;
        } else if (nextState.sortOption.sort === "title") {
          return a.title.localeCompare(b.title) * dir;
        } else {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        }
      });

      // Limit to page size
      const paginatedJobs = allJobs.slice(0, PAGE_SIZE);

      setData({
        items: paginatedJobs,
        total: allJobs.length > 0 ? Math.max(estimatedTotal, allJobs.length) : 0,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setPage(nextState.page);
      setTitleTags(nextState.titleTags);
      setCompanyFilter(nextState.companyFilter);
      setLocationTags(nextState.locationTags);
      setStatusFilter(nextState.statusFilter);
      setSortOption(nextState.sortOption);
      
      // Auto-select first job if none selected
      if (paginatedJobs.length > 0 && !selectedJob) {
        setSelectedJob(paginatedJobs[0]);
      }
      
      const latestFromPage = paginatedJobs.reduce<Date | null>(
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
      const res = await fetch(`/api/jobs/last-updated`);
      if (!res.ok) return;
      const payload = (await res.json()) as { lastUpdated: string | null };
      if (!payload.lastUpdated) return;
      const date = new Date(payload.lastUpdated);
      if (!Number.isNaN(date.getTime())) {
        setLastUpdatedAt(date);
      }
    } catch {
      // Ignore errors
    }
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (titleTags.length > 0) count++;
    if (companyFilter.trim()) count++;
    if (locationTags.length > 0) count++;
    return count;
  }, [titleTags, companyFilter, locationTags]);

  function resetFilters() {
    setTitleTags(DEFAULT_STATE.titleTags);
    setCompanyFilter(DEFAULT_STATE.companyFilter);
    setLocationTags(DEFAULT_STATE.locationTags);
    setStatusFilter(DEFAULT_STATE.statusFilter);
    setSortOption(DEFAULT_STATE.sortOption);
    setPage(DEFAULT_STATE.page);
    setSelectedJob(null);
    fetchJobs(1, { overrideState: DEFAULT_STATE });
  }

  // Future: callbacks for board actions
  const handleAddToApply = (jobId: string) => {
    console.log("Add to 'To Apply' board:", jobId);
    // TODO: Implement backend integration
  };

  const handleAddToApplied = (jobId: string) => {
    console.log("Add to 'Applied' board:", jobId);
    // TODO: Implement backend integration
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const start = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(data.total, start + data.items.length - 1);

  // Build search summary text
  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    if (titleTags.length > 0) {
      parts.push(`Titles: ${titleTags.join(" + ")}`);
    }
    if (locationTags.length > 0) {
      parts.push(`Locations: ${locationTags.join(" + ")}`);
    }
    return parts.join(" • ");
  }, [titleTags, locationTags]);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="flex-none border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="InternAtlas"
              width={180}
              height={45}
              priority
              className="h-10 w-auto"
            />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Updated {formatRelativeTime(lastUpdatedAt)}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Sign in for more features
            </button>
            <a
              href="/admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </a>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-t border-slate-100 px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              {/* Multi-tag keyword search */}
              <TagInput
                tags={titleTags}
                onTagsChange={(newTags) => setTitleTags(newTags)}
                placeholder="Job titles (Enter to add)"
                className="h-10 flex-[2] min-w-[200px]"
              />
              <input
                className="h-10 w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-teal-300 focus:bg-white focus:ring-2 focus:ring-teal-100"
                placeholder="Company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchJobs(1)}
              />
              {/* Multi-tag location search */}
              <TagInput
                tags={locationTags}
                onTagsChange={(newTags) => setLocationTags(newTags)}
                placeholder="Locations (Enter to add)"
                className="h-10 flex-1 min-w-[180px]"
                icon="location"
              />
            </div>
            <button
              type="button"
              className="h-10 rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
              onClick={() => fetchJobs(1)}
              disabled={isLoading}
            >
              Search
            </button>
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Status Filter Dropdown */}
            <div className="relative">
              <select
                className={`h-8 appearance-none rounded-full pl-3 pr-8 text-sm font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-100 ${
                  statusFilter === "open"
                    ? "bg-emerald-100 text-emerald-700"
                    : statusFilter === "closed"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                }`}
                value={statusFilter}
                onChange={(e) => {
                  const newStatus = e.target.value as StatusFilter;
                  setStatusFilter(newStatus);
                  fetchJobs(1, { overrideState: { statusFilter: newStatus } });
                }}
              >
                <option value="open">● Open Jobs</option>
                <option value="closed">● Closed Jobs</option>
                <option value="both">● All Jobs</option>
              </select>
              <svg className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            <div className="h-5 w-px bg-slate-200" />
            
            <select
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100"
              value={sortOption.label}
              onChange={(e) => {
                const next = SORT_OPTIONS.find((opt) => opt.label === e.target.value) ?? SORT_OPTIONS[0];
                setSortOption(next);
                fetchJobs(1, { overrideState: { sortOption: next } });
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Clear filters
              </button>
            )}
            
            {/* Show active search summary */}
            {searchSummary && (
              <span className="text-sm text-slate-500">
                {searchSummary}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-none bg-red-50 border-b border-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Pane - Job List */}
        <div className="flex w-[400px] flex-col border-r border-slate-200 bg-white lg:w-[440px]">
          {/* Results Header */}
          <div className="flex-none border-b border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900">
                {data.total.toLocaleString()} jobs
              </span>
              <span className="text-sm text-slate-500">
                {start}–{end}
              </span>
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && data.items.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
              </div>
            ) : data.items.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">
                No jobs found matching your criteria.
              </div>
            ) : (
              data.items.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(job)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex-none border-t border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fetchJobs(page - 1)}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Prev
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => fetchJobs(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane - Job Details */}
        <div className="flex-1 overflow-auto">
          <JobDetailPanel 
            job={selectedJob}
            onAddToApply={handleAddToApply}
            onAddToApplied={handleAddToApplied}
          />
        </div>
      </main>
    </div>
  );
}
