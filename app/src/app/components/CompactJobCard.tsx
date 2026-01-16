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
  tracked?: {
    id: string;
    status: "to_apply" | "applied";
    createdAt: Date;
  };
};

type CompactJobCardProps = {
  job: Job;
  onMoveToApplied?: () => void;
  onMoveToToApply?: () => void;
  onRemove?: () => void;
  isStarred?: boolean;
  onStar?: () => void;
  onUnstar?: () => void;
  showActions?: boolean;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function isRemote(location: string | null): boolean {
  if (!location) return false;
  const lower = location.toLowerCase();
  return lower.includes("remote") || lower.includes("anywhere") || lower.includes("work from home");
}

export function CompactJobCard({
  job,
  onMoveToApplied,
  onMoveToToApply,
  onRemove,
  isStarred = false,
  onStar,
  onUnstar,
  showActions = true,
}: CompactJobCardProps) {
  const isClosed = job.status === "CLOSED";
  const remote = isRemote(job.location);
  const isToApply = job.tracked?.status === "to_apply";

  const showStarActions = onStar || onUnstar;

  return (
    <div className="group relative bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Company Logo */}
          <div className="flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-600 dark:to-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
              {job.company.name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Job Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <a
                href={job.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-semibold text-slate-900 dark:text-slate-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors leading-tight ${
                  isClosed ? "line-through opacity-60" : ""
                }`}
              >
                {job.title}
              </a>
              {isClosed && (
                <span className="flex-shrink-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded">
                  Closed
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 mb-1">
              <span className="font-medium">{job.company.name}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="truncate">{job.location ?? "Remote / Unknown"}</span>
              {remote && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">•</span>
                  <span className="inline-flex items-center gap-0.5 text-green-600 dark:text-green-400 font-medium">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Remote
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
              <span className="uppercase text-[10px] font-medium">{job.sourcePlatform}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>Posted {formatDate(job.createdAt)}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                isClosed 
                  ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400" 
                  : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
              }`}>
                <span className={`h-1 w-1 rounded-full ${
                  isClosed ? "bg-slate-500" : "bg-emerald-500"
                }`} />
                {isClosed ? "Closed" : "Open"}
              </span>
            </div>
          </div>

          {/* Action Buttons - Always visible star, hover-only other actions */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {/* Star button - always visible when star handlers provided */}
            {showStarActions && (
              <button
                onClick={isStarred ? onUnstar : onStar}
                className="p-1.5 rounded text-yellow-500 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-900/30 transition-colors"
                title={isStarred ? "Unstar" : "Star"}
              >
                <svg className="h-4 w-4" fill={isStarred ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            )}

            {/* Other action buttons - hover only */}
            {showActions && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {isToApply && onMoveToApplied && (
                  <button
                    onClick={onMoveToApplied}
                    className="p-1.5 rounded text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 transition-colors"
                    title="Mark as Applied"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
                {!isToApply && onMoveToToApply && (
                  <button
                    onClick={onMoveToToApply}
                    className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                    title="Move to To Apply"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                  </button>
                )}
                {onRemove && (
                  <button
                    onClick={onRemove}
                    className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CompactJobCardSkeleton() {
  return (
    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded skeleton" />
        <div className="flex-1">
          <div className="h-4 w-3/4 rounded skeleton mb-2" />
          <div className="h-3 w-1/2 rounded skeleton mb-1.5" />
          <div className="h-3 w-1/3 rounded skeleton" />
        </div>
      </div>
    </div>
  );
}
