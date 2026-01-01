"use client";

import { useState } from "react";
import JobSearch from "@/app/components/JobSearch";

export default function Home() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <main className="relative mx-auto flex min-h-screen max-w-[108rem] flex-col gap-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 py-16">
      <div className="absolute right-6 top-6">
        <div className="relative">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md transition hover:shadow-lg hover:scale-105"
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>
          {profileMenuOpen && (
            <div className="absolute right-0 top-12 z-10 w-48 rounded-lg border border-slate-200 bg-white shadow-lg">
              <a
                href="/admin"
                className="block px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50"
              >
                Admin Dashboard
              </a>
            </div>
          )}
        </div>
      </div>
      
      <div className="text-center">
        <h1 className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-4xl font-bold text-transparent">
          InternAtlas
        </h1>
        <p className="mt-2 text-lg text-slate-600">
          A crawler-powered internship and new grad job aggregation platform.
        </p>
      </div>

      <JobSearch />
    </main>
  );
}
