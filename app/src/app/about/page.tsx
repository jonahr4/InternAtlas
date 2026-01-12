"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats {
  totalJobs: number;
  activeJobs: number;
  totalCompanies: number;
  lastUpdated: string;
}

export default function AboutPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen overflow-y-auto bg-white dark:bg-slate-900 text-zinc-900 dark:text-white">
      {/* Hero Section */}
      <section className="pt-12 pb-8 md:pt-16 md:pb-12 px-6 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-full mb-6">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
            </div>
            <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
              Live Job Data • Updated Twice Daily
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Complete Internship<br />
            & New Grad Job Board
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            We scrape company career pages directly, so you see <span className="font-semibold text-slate-900 dark:text-white">every job</span>—not just the ones posted to Handshake, LinkedIn, and Indeed.
          </p>

          {/* Live Stats */}
          <div className="mb-8 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-teal-500 dark:border-teal-500 p-6 shadow-xl">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  LIVE DATABASE
                </span>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center gap-6 py-4">
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                  <div className="animate-pulse flex flex-col items-center">
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                    <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                </div>
              ) : stats ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-teal-600 dark:text-teal-400 mb-1">
                      {stats.totalCompanies.toLocaleString()}
                    </div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Companies
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-teal-600 dark:text-teal-400 mb-1">
                      {stats.totalJobs.toLocaleString()}
                    </div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Total Jobs
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-teal-600 dark:text-teal-400 mb-1">
                      2x
                    </div>
                    <div className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium">
                      Daily Crawls
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  Stats unavailable
                </div>
              )}
              
              {stats && (
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  Last updated: {new Date(stats.lastUpdated).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/"
              className="group bg-teal-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-all flex items-center gap-2 shadow-lg"
            >
              Start Searching
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-12 px-6 bg-slate-50 dark:bg-slate-800/50 border-y border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-3">
              <span className="text-red-600 dark:text-red-400 font-bold text-sm">THE PROBLEM</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Traditional Job Boards Are{" "}
              <span className="text-red-600 dark:text-red-400">
                Incomplete
              </span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Inconsistent Posting</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Companies selectively post to platforms like LinkedIn, Indeed, and Handshake—leaving gaps in what you see.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Hidden Opportunities</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Many roles exist only on company career pages, never making it to third-party boards.
              </p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Tracking Nightmare</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Checking hundreds of individual company sites manually is impossible and time-consuming.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Solution Section */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block mb-3">
              <span className="text-teal-600 dark:text-teal-400 font-bold text-sm">THE SOLUTION</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              InternAtlas Goes{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
                Directly to the Source
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              We crawl company career pages twice daily, aggregating every internship and new grad position into one searchable database.
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-12 px-6 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Instant Updates</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Jobs appear within hours of being posted—no waiting for companies to cross-post.
              </p>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Complete Coverage</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Every role captured—including positions not advertised on LinkedIn, Indeed, or Handshake.
              </p>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Fully Transparent</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Links go directly to company pages. No middleman, no algorithms hiding jobs from you.
              </p>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Completely Free</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                No paywalls, no premium tiers. Access the entire database for free, forever.
              </p>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Powerful Filtering</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Search by title, location, company, or ATS platform. Find what you need in seconds.
              </p>
            </div>

            <div className="group bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-lg transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-teal-600 dark:text-teal-400 mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-2">Always Current</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                Automated crawls twice daily ensure closed positions are removed and new ones appear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 px-6 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">How It Works</h2>
            <p className="text-slate-600 dark:text-slate-400">Simple, automated, and reliable</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-4 items-start bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">We Identify Company Career Pages</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Our system tracks hundreds of companies across major ATS platforms (Greenhouse, Lever, Workday, iCIMS).
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Automated Crawling Twice Daily</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Every 12 hours, we scan each career page for internships and new grad positions.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">Database Updated in Real-Time</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  New jobs are added immediately, closed positions are deactivated, and everything stays current.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-500 flex items-center justify-center text-white font-bold text-sm">
                4
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1">You Search & Apply</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Browse the most comprehensive job database, filter by your preferences, and click through directly to apply.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-6 bg-slate-900 dark:bg-slate-950 text-white border-t border-slate-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
            Stop missing opportunities.
          </h2>
          <p className="text-base text-slate-400 mb-6 max-w-2xl mx-auto">
            Join thousands of job seekers who trust InternAtlas for the most complete, up-to-date job listings.
          </p>
          <Link
            href="/"
            className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-all shadow-lg"
          >
            Start Searching Now
          </Link>
        </div>
      </section>
    </div>
  );
}
