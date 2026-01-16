"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

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
  onRemove?: (jobId: string) => void;
  onStar?: (jobId: string) => void;
  onUnstar?: (jobId: string) => void;
  onClose?: () => void;
  isMobile?: boolean;
  savedStatus?: 'to_apply' | 'applied';
  isStarred?: boolean;
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

function isNewJob(dateString: string): boolean {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 48;
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

export function JobDetailPanel({ job, onAddToApply, onAddToApplied, onRemove, onStar, onUnstar, onClose, isMobile = false, savedStatus, isStarred = false }: JobDetailPanelProps) {
  const { user } = useAuth();
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);

  // Reset dropdown when job changes
  useEffect(() => {
    setSaveDropdownOpen(false);
  }, [job?.id]);

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900/50">
        <div className="text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 shadow-inner">
            <svg className="h-10 w-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Select a job to view details</p>
          <p className="mt-2 text-sm text-slate-400 dark:text-slate-500">Click on any job from the list</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400 dark:text-slate-500">
            <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 font-mono text-xs">↑</kbd>
            <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 font-mono text-xs">↓</kbd>
            <span>to navigate</span>
            <kbd className="ml-2 rounded bg-slate-100 dark:bg-slate-700 px-2 py-0.5 font-mono text-xs">Enter</kbd>
            <span>to apply</span>
          </div>
        </div>
      </div>
    );
  }

  const isClosed = job.status === "CLOSED";
  const isNew = isNewJob(job.createdAt);
  const formattedDescription = formatDescription(job.descriptionText);

  const handleToggleToApply = () => {
    if (!user) return;

    if (savedStatus === 'to_apply') {
      // Already saved as to_apply, remove it
      if (onRemove) onRemove(job.id);
    } else {
      // Add to to_apply list
      if (onAddToApply) onAddToApply(job.id);
    }
    setSaveDropdownOpen(false);
  };

  const handleToggleApplied = () => {
    if (!user) return;

    if (savedStatus === 'applied') {
      // Already saved as applied, remove it
      if (onRemove) onRemove(job.id);
    } else {
      // Add to applied list
      if (onAddToApplied) onAddToApplied(job.id);
    }
    setSaveDropdownOpen(false);
  };

  const handleToggleStar = () => {
    if (!user) return;

    if (isStarred) {
      if (onUnstar) onUnstar(job.id);
    } else {
      if (onStar) onStar(job.id);
    }
  };

  const containerClass = isMobile 
    ? "mobile-sheet bg-white dark:bg-slate-800 animate-slide-in-up"
    : "h-full bg-white dark:bg-slate-800 animate-fade-in";

  return (
    <div className={containerClass}>
      {/* Mobile handle */}
      {isMobile && (
        <div className="mobile-sheet-handle" />
      )}

      {/* Scrollable content wrapper */}
      <div className={`overflow-y-auto ${isMobile ? "max-h-[calc(85vh-20px)]" : "h-full"}`}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-5">
          {/* Close button for mobile */}
          {isMobile && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Company Row */}
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow-sm">
              {job.company.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={job.company.boardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline"
                >
                  {job.company.name}
                </a>
                {isNew && !isClosed && (
                  <span className="new-badge-pulse inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    NEW
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>{job.sourcePlatform}</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className={`text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight ${isClosed ? "line-through opacity-70" : ""}`}>
            {job.title}
          </h1>

          {/* Meta Row */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-800">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Closed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800">
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
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Apply Now
            </a>

            {/* Save Dropdown - Only show when logged in */}
            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSaveDropdownOpen(!saveDropdownOpen)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                    savedStatus
                      ? "border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 focus:ring-teal-500"
                      : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 focus:ring-slate-500"
                  }`}
                >
                  <svg className="h-4 w-4" fill={savedStatus ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="absolute left-0 bottom-full z-20 mb-2 w-56 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 py-1 shadow-lg animate-fade-in">
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Add to Board
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleToggleToApply}
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                        savedStatus === 'to_apply'
                          ? "border-teal-500 bg-teal-500"
                          : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600"
                      }`}>
                        {savedStatus === 'to_apply' && (
                          <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">To Apply</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Jobs you want to apply to</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleApplied}
                      className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                      <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                        savedStatus === 'applied'
                          ? "border-teal-500 bg-teal-500"
                          : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600"
                      }`}>
                        {savedStatus === 'applied' && (
                          <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">Applied</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Jobs you&apos;ve already applied to</span>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
            ) : (
              <div className="text-center py-2 px-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-lg">
                Sign in to save jobs
              </div>
            )}

            {/* Star Button - Icon only, shown after Save button when logged in */}
            {user && (
              <button
                type="button"
                onClick={handleToggleStar}
                className={`inline-flex items-center justify-center rounded-lg border p-2.5 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
                  isStarred
                    ? "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50 focus:ring-yellow-500"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 hover:text-yellow-500 dark:hover:text-yellow-400 focus:ring-slate-500"
                }`}
                title={isStarred ? "Unstar job" : "Star job"}
              >
                <svg className="h-5 w-5" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="px-6 py-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Job Description</h2>
          <div className="prose-description text-slate-600 dark:text-slate-300">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-transparent p-0 m-0 overflow-visible">
              {formattedDescription}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

// Skeleton component for loading state
export function JobDetailSkeleton() {
  return (
    <div className="h-full bg-white dark:bg-slate-800 animate-fade-in">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-12 w-12 rounded-xl skeleton" />
          <div className="flex-1">
            <div className="h-5 w-32 rounded skeleton mb-2" />
            <div className="h-4 w-20 rounded skeleton" />
          </div>
        </div>
        <div className="h-7 w-3/4 rounded skeleton mb-3" />
        <div className="flex gap-3">
          <div className="h-4 w-24 rounded skeleton" />
          <div className="h-4 w-32 rounded skeleton" />
        </div>
        <div className="flex gap-3 mt-5">
          <div className="h-10 w-28 rounded-lg skeleton" />
          <div className="h-10 w-24 rounded-lg skeleton" />
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="h-6 w-40 rounded skeleton mb-4" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded skeleton" />
          <div className="h-4 w-full rounded skeleton" />
          <div className="h-4 w-3/4 rounded skeleton" />
          <div className="h-4 w-full rounded skeleton" />
          <div className="h-4 w-5/6 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}
