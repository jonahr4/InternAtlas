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

export function JobCard({ job, isSelected, onClick }: JobCardProps) {
  const isClosed = job.status === "CLOSED";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full text-left transition-all duration-200 ${
        isSelected
          ? "bg-teal-50 border-l-4 border-l-teal-500"
          : "bg-white hover:bg-slate-50 border-l-4 border-l-transparent"
      } ${isClosed ? "opacity-60" : ""}`}
    >
      <div className="px-4 py-4 border-b border-slate-100">
        {/* Company */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
            {job.company.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-600 truncate">
            {job.company.name}
          </span>
          {isClosed && (
            <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 rounded">
              Closed
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className={`font-semibold text-slate-900 leading-snug mb-1 group-hover:text-teal-700 transition-colors ${
          isClosed ? "line-through" : ""
        }`}>
          {job.title}
        </h3>

        {/* Location & Date */}
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{job.location ?? "Remote / Unknown"}</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-400 whitespace-nowrap">{formatDate(job.createdAt)}</span>
        </div>

        {/* Platform Badge */}
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 rounded">
            {job.sourcePlatform}
          </span>
        </div>
      </div>
    </button>
  );
}

