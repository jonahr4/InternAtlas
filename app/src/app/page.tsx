"use client";

import { Suspense } from "react";
import JobSearch from "@/app/components/JobSearch";

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
          <p className="text-sm text-slate-600">Loading InternAtlas...</p>
        </div>
      </div>
    }>
      <JobSearch />
    </Suspense>
  );
}
