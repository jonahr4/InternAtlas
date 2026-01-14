"use client";

import { useState, useRef, useEffect } from "react";

type CartographerProps = {
  onApplySuggestions: (titleKeywords: string[], locationKeywords: string[]) => void;
  disabled?: boolean;
};

type Suggestion = {
  titleKeywords: string[];
  locationKeywords: string[];
  explanation: string;
};

export function Cartographer({ onApplySuggestions, disabled = false }: CartographerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  async function handleSubmit() {
    if (!query.trim() || isLoading || disabled) return;

    setIsLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const res = await fetch("/api/cartographer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to get suggestions");
      }

      const data = await res.json();
      setSuggestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  function handleApply() {
    if (suggestion) {
      onApplySuggestions(suggestion.titleKeywords, suggestion.locationKeywords);
      setIsOpen(false);
      setQuery("");
      setSuggestion(null);
    }
  }

  function handleReset() {
    setQuery("");
    setSuggestion(null);
    setError(null);
    inputRef.current?.focus();
  }

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className="group inline-flex items-center gap-2 h-10 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 text-sm font-medium text-white shadow-md transition-all hover:shadow-lg hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md disabled:hover:from-violet-600 disabled:hover:to-indigo-600"
        title="Get AI-powered search suggestions"
      >
        <svg 
          className="h-4 w-4 transition-transform group-hover:rotate-12" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
          />
        </svg>
        <span className="hidden sm:inline">Cartographer</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Cartographer
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    AI-powered search assistant
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {!suggestion ? (
                  <>
                    <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Describe what you&apos;re looking for
                    </label>
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      placeholder="e.g., I'm a CS student looking for summer software engineering internships in the Bay Area, interested in backend development and distributed systems..."
                      className="h-32 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-violet-300 focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-900"
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Press Enter to submit or Shift+Enter for new line
                    </p>

                    {error && (
                      <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!query.trim() || isLoading}
                      className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Mapping your journey...
                        </span>
                      ) : (
                        "Get Suggestions"
                      )}
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Explanation */}
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 px-4 py-3">
                      <p className="text-sm text-violet-700 dark:text-violet-300">
                        {suggestion.explanation}
                      </p>
                    </div>

                    {/* Title Keywords */}
                    {suggestion.titleKeywords.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          Suggested Job Titles
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.titleKeywords.map((keyword, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-teal-100 dark:bg-teal-900/50 px-3 py-1 text-sm font-medium text-teal-700 dark:text-teal-400"
                            >
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Location Keywords */}
                    {suggestion.locationKeywords.length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                          Suggested Locations
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {suggestion.locationKeywords.map((keyword, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/50 px-3 py-1 text-sm font-medium text-amber-700 dark:text-amber-400"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {keyword}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        onClick={handleApply}
                        className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:from-violet-500 hover:to-indigo-500"
                      >
                        Apply to Search
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Example Prompts */}
              {!suggestion && !isLoading && (
                <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                  <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Try asking:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "ML/AI internships",
                      "Remote frontend roles",
                      "New grad backend jobs in NYC",
                    ].map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setQuery(example)}
                        className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
