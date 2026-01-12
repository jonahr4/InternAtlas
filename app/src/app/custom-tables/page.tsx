"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

export default function CustomTablesPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-6">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-teal-100 dark:bg-teal-900/30 p-4">
              <svg className="h-12 w-12 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900 dark:text-white">
            Custom Tables
          </h1>
          <p className="mb-6 text-slate-600 dark:text-slate-400">
            Sign in to create custom job tables with your own filters and keywords.
          </p>
          <Link
            href="/"
            className="inline-block rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Custom Tables
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Create personalized job tables with custom filters and keywords.
          </p>
        </div>

        {/* Create New Table Button */}
        <div className="mb-6">
          <button
            type="button"
            className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            + Create New Table
          </button>
        </div>

        {/* Placeholder - No Tables Yet */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
          <div className="mb-4 flex justify-center">
            <svg className="h-16 w-16 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            No custom tables yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400">
            Create your first custom table to organize jobs by your preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
