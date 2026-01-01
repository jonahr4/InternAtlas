 "use client";

import { useMemo, useState } from "react";

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

type JobTableProps = {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  onPageChange: (nextPage: number) => void;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

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

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "ACTIVE";
  const classes = isActive
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
    : "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${classes}`}>
      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`} />
      {isActive ? "Open" : "Closed"}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-600">
      {platform}
    </span>
  );
}

export function JobTable({
  jobs,
  total,
  page,
  pageSize,
  isLoading = false,
  onPageChange,
}: JobTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rangeLabel = useMemo(() => {
    if (total === 0) return "Showing 0 jobs";
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(total, start + jobs.length - 1);
    return `Showing ${start}–${end} of ${total}`;
  }, [jobs.length, page, pageSize, total]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="grid gap-3">
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          {isLoading ? "Loading jobs..." : "No jobs found."}
        </div>
      ) : (
        jobs.map((job) => {
          const plainDescription = job.descriptionText
            ? stripHtml(decodeHtml(job.descriptionText))
            : "No description provided.";
          const isClosed = job.status === "CLOSED";
          const isExpanded = expandedId === job.id;
          return (
            <article
              key={job.id}
              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isClosed ? "opacity-70" : ""
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <a
                      className={`text-lg font-semibold text-slate-900 hover:text-indigo-600 hover:underline ${
                        isClosed ? "line-through" : ""
                      }`}
                      href={job.jobUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {job.title}
                    </a>
                    <StatusBadge status={job.status} />
                    <PlatformBadge platform={job.sourcePlatform} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <a
                      className="font-medium text-indigo-600 hover:underline"
                      href={job.company.boardUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {job.company.name}
                    </a>
                    <span className="text-slate-300">•</span>
                    <span>{job.location ?? "Unknown location"}</span>
                    <span className="text-slate-300">•</span>
                    <span>Found {formatDate(job.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <a
                    className="rounded-full border border-indigo-100 px-3 py-1 font-medium hover:border-indigo-200 hover:bg-indigo-50"
                    href={job.jobUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open listing →
                  </a>
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-700">
                {isExpanded ? plainDescription : plainDescription.slice(0, 220)}
                {plainDescription.length > 220 && !isExpanded ? "…" : ""}
              </div>

              {plainDescription.length > 220 ? (
                <button
                  type="button"
                  className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  onClick={() => setExpandedId(isExpanded ? null : job.id)}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </article>
          );
        })
      )}
    </div>
  );
}
