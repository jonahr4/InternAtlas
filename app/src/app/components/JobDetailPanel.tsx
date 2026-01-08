"use client";

import { useState, useEffect } from "react";

type Job = {
  id: string;
  title: string;
  location: string | null;
  jobUrl: string;
  descriptionText: string | null;
  descriptionHtml?: string | null;
  createdAt: string;
  updatedAt?: string;
  sourcePlatform: string;
  status: string;
  company: {
    name: string;
    boardUrl: string;
  };
};

type JobDetailPanelProps = {
  job: Job | null;
  onAddToApply?: (jobId: string) => void;
  onAddToApplied?: (jobId: string) => void;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// Clean and format description text for better readability
function formatDescription(input: string | null): string {
  if (!input) return "No description available for this position.";
  
  let text = input;
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&bull;/g, "•")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  
  // Convert common HTML to readable format
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "")
    .replace(/<b[^>]*>/gi, "")
    .replace(/<\/b>/gi, "")
    .replace(/<em[^>]*>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<i[^>]*>/gi, "")
    .replace(/<\/i>/gi, "")
    .replace(/<u[^>]*>/gi, "")
    .replace(/<\/u>/gi, "");
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, "");
  
  // Clean up whitespace
  text = text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  
  return text || "No description available for this position.";
}

export function JobDetailPanel({ job, onAddToApply, onAddToApplied }: JobDetailPanelProps) {
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);
  const [addedToApply, setAddedToApply] = useState(false);
  const [addedToApplied, setAddedToApplied] = useState(false);

  // Reset save states when job changes
  useEffect(() => {
    setAddedToApply(false);
    setAddedToApplied(false);
    setSaveDropdownOpen(false);
  }, [job?.id]);

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-600">Select a job to view details</p>
          <p className="mt-1 text-sm text-slate-400">Click on any job from the list</p>
        </div>
      </div>
    );
  }

  const isClosed = job.status === "CLOSED";
  const formattedDescription = formatDescription(job.descriptionText);

  const handleToggleToApply = () => {
    setAddedToApply(!addedToApply);
    if (onAddToApply && !addedToApply) {
      onAddToApply(job.id);
    }
  };

  const handleToggleApplied = () => {
    setAddedToApplied(!addedToApplied);
    if (onAddToApplied && !addedToApplied) {
      onAddToApplied(job.id);
    }
  };

  return (
    <div className="bg-white h-full overflow-auto">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-5">
        {/* Company Row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow-sm">
            {job.company.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <a
              href={job.company.boardUrl}
              target="_blank"
              rel="noreferrer"
              className="text-base font-semibold text-teal-600 hover:text-teal-700 hover:underline"
            >
              {job.company.name}
            </a>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{job.sourcePlatform}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className={`text-2xl font-bold text-slate-900 leading-tight ${isClosed ? "line-through opacity-70" : ""}`}>
          {job.title}
        </h1>

        {/* Meta Row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{job.location ?? "Remote / Unknown"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Found {formatDate(job.createdAt)}</span>
          </div>
          {isClosed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Closed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Open
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex items-center gap-3">
          <a
            href={job.jobUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Apply Now
          </a>
          
          {/* Save Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSaveDropdownOpen(!saveDropdownOpen)}
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                addedToApply || addedToApplied
                  ? "border-teal-200 bg-teal-50 text-teal-700 focus:ring-teal-500"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus:ring-slate-500"
              }`}
            >
              <svg className="h-4 w-4" fill={addedToApply || addedToApplied ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save
              <svg className={`h-4 w-4 transition-transform ${saveDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {saveDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setSaveDropdownOpen(false)}
                />
                <div className="absolute left-0 bottom-full z-20 mb-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Add to Board
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleToggleToApply}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                      addedToApply 
                        ? "border-teal-500 bg-teal-500" 
                        : "border-slate-300 bg-white"
                    }`}>
                      {addedToApply && (
                        <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">To Apply</span>
                      <span className="text-xs text-slate-500">Jobs you want to apply to</span>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleToggleApplied}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                      addedToApplied 
                        ? "border-teal-500 bg-teal-500" 
                        : "border-slate-300 bg-white"
                    }`}>
                      {addedToApplied && (
                        <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">Applied</span>
                      <span className="text-xs text-slate-500">Jobs you've already applied to</span>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-6 py-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Job Description</h2>
        <div className="prose prose-slate prose-sm max-w-none">
          <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 leading-relaxed bg-transparent p-0 m-0 overflow-visible">
            {formattedDescription}
          </pre>
        </div>
      </div>
    </div>
  );
}
