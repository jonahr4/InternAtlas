"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { TopNav } from "../components/TopNav";
import { useState, useEffect } from "react";
import { CompactJobCard, CompactJobCardSkeleton } from "../components/CompactJobCard";
import {
  getUserTrackedJobsByStatus,
  updateTrackedJobStatus,
  deleteTrackedJob,
  getUserStarredJobs,
  addStarredJob,
  removeStarredJob,
} from "@/lib/firestore";

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

export default function TrackingPage() {
  const { user } = useAuth();
  const [toApplyJobs, setToApplyJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
  const [starredJobIds, setStarredJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user]);

  const loadJobs = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get tracked jobs and starred jobs from Firestore
      const [toApplyTracked, appliedTracked, starredTracked] = await Promise.all([
        getUserTrackedJobsByStatus(user.uid, "to_apply"),
        getUserTrackedJobsByStatus(user.uid, "applied"),
        getUserStarredJobs(user.uid),
      ]);

      // Create a set of starred job IDs for quick lookup
      const starredIds = new Set(starredTracked.map(sj => sj.jobId));
      setStarredJobIds(starredIds);

      // Get job details from Postgres API for each list
      const loadJobDetails = async (trackedJobs: any[]) => {
        if (trackedJobs.length === 0) return [];

        const jobIds = trackedJobs.map(tj => tj.jobId);
        const response = await fetch(`/api/jobs?ids=${jobIds.join(",")}`);

        if (!response.ok) return [];

        const data = await response.json();
        const jobs = data.items || [];

        // Merge tracked data with job details
        return jobs.map((job: any) => {
          const tracked = trackedJobs.find(tj => tj.jobId === job.id);
          return {
            ...job,
            tracked: {
              id: tracked?.id,
              status: tracked?.status,
              createdAt: tracked?.createdAt,
            },
          };
        });
      };

      const [toApplyJobs, appliedJobs] = await Promise.all([
        loadJobDetails(toApplyTracked),
        loadJobDetails(appliedTracked),
      ]);

      setToApplyJobs(toApplyJobs);
      setAppliedJobs(appliedJobs);
    } catch (error) {
      console.error("Error loading tracked jobs:", error);
    } finally {
      setLoading(false);
    }
  };

  const moveToApplied = async (job: Job) => {
    if (!job.tracked?.id) return;

    try {
      setActionLoading(job.id);

      await updateTrackedJobStatus(job.tracked.id, "applied");

      // Optimistically update UI
      setToApplyJobs((prev) => prev.filter((j) => j.id !== job.id));
      setAppliedJobs((prev) => [
        { ...job, tracked: { ...job.tracked!, status: "applied" } },
        ...prev,
      ]);
    } catch (error) {
      console.error("Error moving job to applied:", error);
      // Reload to ensure consistency
      loadJobs();
    } finally {
      setActionLoading(null);
    }
  };

  const moveToToApply = async (job: Job) => {
    if (!job.tracked?.id) return;

    try {
      setActionLoading(job.id);

      await updateTrackedJobStatus(job.tracked.id, "to_apply");

      // Optimistically update UI
      setAppliedJobs((prev) => prev.filter((j) => j.id !== job.id));
      setToApplyJobs((prev) => [
        { ...job, tracked: { ...job.tracked!, status: "to_apply" } },
        ...prev,
      ]);
    } catch (error) {
      console.error("Error moving job to to-apply:", error);
      // Reload to ensure consistency
      loadJobs();
    } finally {
      setActionLoading(null);
    }
  };

  const removeJob = async (job: Job) => {
    if (!job.tracked?.id) return;

    try {
      setActionLoading(job.id);

      await deleteTrackedJob(job.tracked.id);

      // Optimistically update UI
      if (job.tracked.status === "to_apply") {
        setToApplyJobs((prev) => prev.filter((j) => j.id !== job.id));
      } else {
        setAppliedJobs((prev) => prev.filter((j) => j.id !== job.id));
      }
    } catch (error) {
      console.error("Error removing job:", error);
      // Reload to ensure consistency
      loadJobs();
    } finally {
      setActionLoading(null);
    }
  };

  const starJob = async (jobId: string) => {
    if (!user) return;

    try {
      setActionLoading(jobId);
      await addStarredJob(user.uid, jobId);

      // Optimistically update UI
      setStarredJobIds((prev) => new Set(prev).add(jobId));
    } catch (error) {
      console.error("Error starring job:", error);
      alert("Failed to star job. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const unstarJob = async (jobId: string) => {
    if (!user) return;

    try {
      setActionLoading(jobId);
      await removeStarredJob(user.uid, jobId);

      // Optimistically update UI
      setStarredJobIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    } catch (error) {
      console.error("Error unstarring job:", error);
      alert("Failed to unstar job. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };


  if (!user) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
        <TopNav />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-4">
                <svg className="h-12 w-12 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
              Application Tracking
            </h1>
            <p className="mb-6 text-slate-600 dark:text-slate-400">
              Sign in to track jobs you want to apply to and jobs you've already applied to.
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      <TopNav />
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Application Tracking
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              Keep track of jobs you want to apply to and applications you've submitted.
            </p>
          </div>

          {/* To Apply Table */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                To Apply
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                {toApplyJobs.length} {toApplyJobs.length === 1 ? "job" : "jobs"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
              {loading ? (
                <div>
                  {[...Array(3)].map((_, i) => (
                    <CompactJobCardSkeleton key={i} />
                  ))}
                </div>
              ) : toApplyJobs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mb-4 flex justify-center">
                    <svg className="h-16 w-16 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                    No jobs to apply to yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400 mb-4">
                    Add jobs from the main board or custom tables to keep track of positions you want to apply to.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
                  >
                    Browse Jobs
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {toApplyJobs.map((job) => (
                    <CompactJobCard
                      key={job.id}
                      job={job}
                      onMoveToApplied={() => moveToApplied(job)}
                      onRemove={() => removeJob(job)}
                      isStarred={starredJobIds.has(job.id)}
                      onStar={() => starJob(job.id)}
                      onUnstar={() => unstarJob(job.id)}
                      showActions={actionLoading !== job.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Applied Table */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Applied
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-medium">
                {appliedJobs.length} {appliedJobs.length === 1 ? "job" : "jobs"}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
              {loading ? (
                <div>
                  {[...Array(3)].map((_, i) => (
                    <CompactJobCardSkeleton key={i} />
                  ))}
                </div>
              ) : appliedJobs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="mb-4 flex justify-center">
                    <svg className="h-16 w-16 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                    No applications tracked yet
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    Mark jobs as applied to keep a record of your application history.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {appliedJobs.map((job) => (
                    <CompactJobCard
                      key={job.id}
                      job={job}
                      onMoveToToApply={() => moveToToApply(job)}
                      onRemove={() => removeJob(job)}
                      isStarred={starredJobIds.has(job.id)}
                      onStar={() => starJob(job.id)}
                      onUnstar={() => unstarJob(job.id)}
                      showActions={actionLoading !== job.id}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
