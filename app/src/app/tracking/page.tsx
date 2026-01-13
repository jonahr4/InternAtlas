"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { TopNav } from "../components/TopNav";

export default function TrackingPage() {
  const { user } = useAuth();

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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
      <TopNav />
      <div className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Application Tracking
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Keep track of jobs you want to apply to and applications you've submitted.
            </p>
          </div>

        {/* To Apply Table */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              To Apply
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              0 jobs
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <div className="mb-4 flex justify-center">
              <svg className="h-16 w-16 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
              No jobs to apply to yet
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Add jobs from the main board to keep track of positions you want to apply to.
            </p>
          </div>
        </div>

        {/* Applied Table */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Applied
            </h2>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              0 jobs
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
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
        </div>
      </div>
      </div>
    </div>
  );
}
