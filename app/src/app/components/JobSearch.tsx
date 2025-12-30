"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

type Job = {
  id: string;
  title: string;
  location: string | null;
  jobUrl: string;
  descriptionText: string | null;
  createdAt: string;
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
];

const PAGE_SIZE = 50;
const MIN_COLUMN_WIDTHS = [160, 240, 320, 160, 100, 140, 140];
const DEFAULT_COLUMN_WIDTHS = [220, 320, 460, 200, 120, 160, 160];

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(input: string): string {
  if (typeof document === "undefined") {
    return input;
  }
  const textarea = document.createElement("textarea");
  textarea.innerHTML = input;
  return textarea.value;
}

function truncate(input: string, length: number): string {
  if (input.length <= length) {
    return input;
  }
  return `${input.slice(0, length)}…`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  const parts = formatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      lookup[part.type] = part.value;
    }
  }
  const tzLabel =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "ET";
  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second} ${tzLabel}`;
}

export default function JobSearch() {
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [titleQuery, setTitleQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(true);
  const [statusClosed, setStatusClosed] = useState(false);
  const [openFilter, setOpenFilter] = useState<"company" | "title" | "location" | "status" | null>(null);
  const [sortOption, setSortOption] = useState(SORT_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resizeState = useRef<{
    index: number;
    startX: number;
    startLeft: number;
    startRight: number;
  } | null>(null);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  }, [data.total]);

  async function fetchJobs(nextPage: number) {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (titleQuery.trim()) {
        params.set("title", titleQuery.trim());
      }
      if (companyFilter.trim()) {
        params.set("companyName", companyFilter.trim());
      }
      if (locationFilter.trim()) {
        params.set("location", locationFilter.trim());
      }
      if (statusOpen && !statusClosed) {
        params.set("status", "ACTIVE");
      } else if (!statusOpen && statusClosed) {
        params.set("status", "CLOSED");
      }
      params.set("page", String(nextPage));
      params.set("pageSize", String(PAGE_SIZE));
      params.set("sort", sortOption.sort);
      params.set("sortDir", sortOption.sortDir);

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      const payload = (await res.json()) as ApiResponse;
      setData(payload);
      setPage(payload.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchJobs(1);
  }, [sortOption, statusOpen, statusClosed]);

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (!resizeState.current) {
        return;
      }
      const { index, startX, startLeft, startRight } = resizeState.current;
      const delta = event.clientX - startX;
      setColumnWidths((prev) => {
        const next = [...prev];
        const minLeft = MIN_COLUMN_WIDTHS[index];
        const minRight = MIN_COLUMN_WIDTHS[index + 1];
        let leftWidth = startLeft + delta;
        let rightWidth = startRight - delta;

        if (leftWidth < minLeft) {
          leftWidth = minLeft;
          rightWidth = startLeft + startRight - leftWidth;
        }

        if (rightWidth < minRight) {
          rightWidth = minRight;
          leftWidth = startLeft + startRight - rightWidth;
        }

        next[index] = leftWidth;
        next[index + 1] = rightWidth;
        return next;
      });
    }

    function onMouseUp() {
      if (resizeState.current) {
        resizeState.current = null;
        document.body.style.cursor = "";
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const tableMinWidth = useMemo(
    () => columnWidths.reduce((sum, width) => sum + width, 0),
    [columnWidths]
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded border border-zinc-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="h-9 flex-1 rounded border border-zinc-200 px-3 text-sm"
            placeholder="Search job title..."
            value={titleQuery}
            onChange={(event) => setTitleQuery(event.target.value)}
          />
          <button
            type="button"
            className="h-9 rounded bg-zinc-900 px-4 text-sm font-medium text-white"
            onClick={() => fetchJobs(1)}
          >
            Search
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <span>Sort</span>
          <select
            className="h-9 rounded border border-zinc-200 bg-white px-3 text-sm"
            value={sortOption.label}
            onChange={(event) => {
              const next = SORT_OPTIONS.find(
                (option) => option.label === event.target.value
              );
              setSortOption(next ?? SORT_OPTIONS[0]);
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.label} value={option.label}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-zinc-600">Loading jobs...</div>
      ) : null}
      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table
          className="w-full table-fixed border-collapse text-left text-sm text-zinc-900"
          style={{ minWidth: tableMinWidth }}
        >
          <colgroup>
            {columnWidths.map((width, index) => (
              <col key={index} style={{ width: `${width}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 bg-zinc-50 text-zinc-700">
            <tr>
              <th
                className="relative cursor-pointer border-r border-zinc-200 px-3 py-2 font-medium"
                onClick={() =>
                  setOpenFilter(openFilter === "company" ? null : "company")
                }
              >
                Company
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 0,
                      startX: event.clientX,
                      startLeft: columnWidths[0],
                      startRight: columnWidths[1],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th
                className="relative cursor-pointer border-r border-zinc-200 px-3 py-2 font-medium"
                onClick={() =>
                  setOpenFilter(openFilter === "title" ? null : "title")
                }
              >
                Job Title
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 1,
                      startX: event.clientX,
                      startLeft: columnWidths[1],
                      startRight: columnWidths[2],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th className="relative border-r border-zinc-200 px-3 py-2 font-medium">
                Short Description
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 2,
                      startX: event.clientX,
                      startLeft: columnWidths[2],
                      startRight: columnWidths[3],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th
                className="relative cursor-pointer border-r border-zinc-200 px-3 py-2 font-medium"
                onClick={() =>
                  setOpenFilter(openFilter === "location" ? null : "location")
                }
              >
                Location
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 3,
                      startX: event.clientX,
                      startLeft: columnWidths[3],
                      startRight: columnWidths[4],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th className="relative border-r border-zinc-200 px-3 py-2 font-medium">
                Date Found
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 4,
                      startX: event.clientX,
                      startLeft: columnWidths[4],
                      startRight: columnWidths[5],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th
                className="relative cursor-pointer border-r border-zinc-200 px-3 py-2 font-medium"
                onClick={() =>
                  setOpenFilter(openFilter === "status" ? null : "status")
                }
              >
                Status
                <span
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                  onMouseDown={(event) => {
                    resizeState.current = {
                      index: 5,
                      startX: event.clientX,
                      startLeft: columnWidths[5],
                      startRight: columnWidths[6],
                    };
                    document.body.style.cursor = "col-resize";
                  }}
                />
              </th>
              <th className="relative px-3 py-2 font-medium">ATS</th>
            </tr>
            {openFilter ? (
              <tr className="bg-white">
                <th className="border-r border-zinc-200 px-3 py-2">
                  {openFilter === "company" ? (
                    <input
                      className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                      placeholder="Filter company"
                      value={companyFilter}
                      onChange={(event) => setCompanyFilter(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          fetchJobs(1);
                        }
                      }}
                    />
                  ) : null}
                </th>
                <th className="border-r border-zinc-200 px-3 py-2">
                  {openFilter === "title" ? (
                    <input
                      className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                      placeholder="Filter title"
                      value={titleQuery}
                      onChange={(event) => setTitleQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          fetchJobs(1);
                        }
                      }}
                    />
                  ) : null}
                </th>
                <th className="border-r border-zinc-200 px-3 py-2" />
                <th className="border-r border-zinc-200 px-3 py-2">
                  {openFilter === "location" ? (
                    <input
                      className="h-8 w-full rounded border border-zinc-200 px-2 text-xs"
                      placeholder="Filter location"
                      value={locationFilter}
                      onChange={(event) => setLocationFilter(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          fetchJobs(1);
                        }
                      }}
                    />
                  ) : null}
                </th>
                <th className="border-r border-zinc-200 px-3 py-2" />
                <th className="border-r border-zinc-200 px-3 py-2">
                  {openFilter === "status" ? (
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={statusOpen}
                          onChange={(e) => setStatusOpen(e.target.checked)}
                        />
                        Open
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={statusClosed}
                          onChange={(e) => setStatusClosed(e.target.checked)}
                        />
                        Closed
                      </label>
                    </div>
                  ) : null}
                </th>
                <th />
              </tr>
            ) : null}
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={7}>
                  No jobs found.
                </td>
              </tr>
            ) : (
              data.items.map((job) => {
                const plainDescription = job.descriptionText
                  ? stripHtml(decodeHtml(job.descriptionText))
                  : "No description provided.";
                const isExpanded = expandedId === job.id;
                return (
                  <Fragment key={job.id}>
                    <tr className={`border-t hover:bg-zinc-50 ${job.status === "CLOSED" ? "opacity-60" : ""}`}>
                      <td className="border-r border-zinc-100 px-3 py-2">
                        <a
                          className="text-blue-600 hover:underline"
                          href={job.company.boardUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {job.company.name}
                        </a>
                      </td>
                      <td className="border-r border-zinc-100 px-3 py-2">
                        <a
                          className={`text-blue-600 hover:underline ${job.status === "CLOSED" ? "line-through" : ""}`}
                          href={job.jobUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {job.title}
                        </a>
                        {job.status === "CLOSED" ? (
                          <span className="ml-2 text-xs text-red-600">(Expired)</span>
                        ) : null}
                      </td>
                      <td
                        className="border-r border-zinc-100 px-3 py-2 text-zinc-600"
                        onDoubleClick={() =>
                          setExpandedId(isExpanded ? null : job.id)
                        }
                      >
                        {truncate(plainDescription, 120)}
                      </td>
                      <td className="border-r border-zinc-100 px-3 py-2">
                        {job.location ?? "Unknown"}
                      </td>
                      <td className="border-r border-zinc-100 px-3 py-2">
                        {formatDate(job.createdAt)}
                      </td>
                      <td className="border-r border-zinc-100 px-3 py-2">
                        {job.status === "ACTIVE" ? "OPEN" : "CLOSED"}
                      </td>
                      <td className="px-3 py-2">{job.sourcePlatform}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t bg-zinc-50">
                        <td className="px-3 py-3 text-xs text-zinc-700" colSpan={7}>
                          <div className="rounded border border-zinc-200 bg-white p-3">
                            {plainDescription}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Page {page} of {totalPages} • {data.total} jobs
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="h-9 rounded border border-zinc-200 px-3 text-sm disabled:opacity-50"
            onClick={() => fetchJobs(Math.max(1, page - 1))}
            disabled={page <= 1 || isLoading}
          >
            Prev
          </button>
          <button
            type="button"
            className="h-9 rounded border border-zinc-200 px-3 text-sm disabled:opacity-50"
            onClick={() => fetchJobs(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
