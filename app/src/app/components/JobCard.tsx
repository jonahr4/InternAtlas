"use client";

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

type JobCardProps = {
  job: Job;
  isSelected: boolean;
  onClick: () => void;
  bulkMode?: boolean;
  isChecked?: boolean;
  onCheck?: (checked: boolean) => void;
  index?: number;
  showNewBadge?: boolean; // Override default NEW badge logic
  savedStatus?: 'to_apply' | 'applied'; // Status from tracked jobs
  isStarred?: boolean; // Whether job is starred
  onUnstar?: (jobId: string) => void; // Unstar handler (only shown if starred)
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function isNewJob(dateString: string): boolean {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours <= 48; // Within 48 hours
}

function isRemote(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return lower.includes("remote") || lower.includes("anywhere") || lower.includes("work from home");
}

function getJobType(title: string): "intern" | "newgrad" | null {
  const lower = title.toLowerCase();
  if (lower.includes("intern") || lower.includes("internship") || lower.includes("co-op") || lower.includes("coop")) {
    return "intern";
  }
  if (lower.includes("new grad") || lower.includes("entry level") || lower.includes("junior") || lower.includes("associate")) {
    return "newgrad";
  }
  return null;
}

export function JobCard({
  job,
  isSelected,
  onClick,
  bulkMode = false,
  isChecked = false,
  onCheck,
  index = 0,
  showNewBadge,
  savedStatus,
  isStarred = false,
  onUnstar
}: JobCardProps) {
  const isClosed = job.status === "CLOSED";
  // Use showNewBadge prop if provided, otherwise fall back to default logic
  const isNew = showNewBadge !== undefined ? showNewBadge : isNewJob(job.createdAt);
  const remote = isRemote(job.location);
  const jobType = getJobType(job.title);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheck?.(!isChecked);
  };

  const handleUnstarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUnstar?.(job.id);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full text-left transition-all duration-200 animate-fade-in ${
        isSelected
          ? "bg-teal-50 dark:bg-teal-900/30 border-l-4 border-l-teal-500"
          : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 border-l-transparent"
      } ${isClosed ? "opacity-60" : ""}`}
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      {/* NEW Badge */}
      {isNew && !isClosed && (
        <div className="absolute top-2 right-3 z-10">
          <span className="new-badge-pulse inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            NEW
          </span>
        </div>
      )}

      {/* Star Icon (only shown if starred) */}
      {isStarred && (
        <div
          className="absolute top-1/2 -translate-y-1/2 right-3 z-10 cursor-pointer"
          onClick={handleUnstarClick}
          title="Unstar job"
        >
          <svg className="h-5 w-5 text-yellow-500 dark:text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300 transition-colors drop-shadow" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
      )}

      <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start gap-3">
          {/* Checkbox for bulk mode */}
          {bulkMode && (
            <div 
              className="flex-shrink-0 pt-1"
              onClick={handleCheckboxClick}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
                isChecked 
                  ? "border-teal-500 bg-teal-500" 
                  : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              }`}>
                {isChecked && (
                  <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Company */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-inner">
                {job.company.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 truncate">
                {job.company.name}
              </span>
              {isClosed && (
                <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded">
                  Closed
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className={`font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-2 group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors ${
              isClosed ? "line-through" : ""
            }`}>
              {job.title}
            </h3>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {/* Job Type Badge */}
              {jobType === "intern" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 rounded ring-1 ring-violet-200 dark:ring-violet-800">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Intern
                </span>
              )}
              {jobType === "newgrad" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded ring-1 ring-blue-200 dark:ring-blue-800">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  New Grad
                </span>
              )}

              {/* Remote Badge */}
              {remote && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded ring-1 ring-green-200 dark:ring-green-800">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Remote
                </span>
              )}

              {/* Platform Badge */}
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded">
                {job.sourcePlatform}
              </span>
              
              {/* Saved Status Badge */}
              {savedStatus && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded ring-1 ${
                  savedStatus === "to_apply"
                    ? "text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 ring-teal-200 dark:ring-teal-800"
                    : "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 ring-emerald-200 dark:ring-emerald-800"
                }`}>
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
                  </svg>
                  Saved: {savedStatus === "to_apply" ? "To Apply" : "Applied"}
                </span>
              )}
            </div>

            {/* Location & Date */}
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{job.location ?? "Remote / Unknown"}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{formatDate(job.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// Skeleton component for loading state
export function JobCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div 
      className="px-4 py-4 border-b border-slate-100 dark:border-slate-700 animate-fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg skeleton" />
        <div className="h-4 w-24 rounded skeleton" />
      </div>
      <div className="h-5 w-3/4 rounded skeleton mb-2" />
      <div className="flex gap-2 mb-2">
        <div className="h-4 w-14 rounded skeleton" />
        <div className="h-4 w-16 rounded skeleton" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-3.5 rounded skeleton" />
        <div className="h-3 w-32 rounded skeleton" />
      </div>
    </div>
  );
}
