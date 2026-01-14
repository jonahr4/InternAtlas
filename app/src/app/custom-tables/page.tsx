"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { useState, useEffect } from "react";
import { TagInput } from "../components/TagInput";
import { JobCard, JobCardSkeleton } from "../components/JobCard";
import { JobDetailPanel } from "../components/JobDetailPanel";
import { TopNav } from "../components/TopNav";
import { Cartographer } from "../components/Cartographer";
import {
  getUserCustomTables,
  createCustomTable,
  updateCustomTable,
  deleteCustomTable,
  markTableAsSeen,
  updateNewJobCount,
  resetTableSeen,
  addTrackedJob,
  bulkAddTrackedJobs,
  type CustomTable,
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
};

const ATS_PLATFORMS = [
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "LEVER", label: "Lever" },
  { value: "WORKDAY", label: "Workday" },
  { value: "ICIMS", label: "iCIMS" },
] as const;

type SortOption = {
  label: string;
  sort: string;
  sortDir: "asc" | "desc";
};

const SORT_OPTIONS: SortOption[] = [
  { label: "Newest First", sort: "created_at", sortDir: "desc" },
  { label: "Oldest First", sort: "created_at", sortDir: "asc" },
  { label: "Company (A-Z)", sort: "company", sortDir: "asc" },
  { label: "Company (Z-A)", sort: "company", sortDir: "desc" },
  { label: "Title (A-Z)", sort: "title", sortDir: "asc" },
  { label: "Title (Z-A)", sort: "title", sortDir: "desc" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export default function CustomTablesPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createTab, setCreateTab] = useState<"manual" | "ai">("manual");
  
  const [customTables, setCustomTables] = useState<CustomTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [newTableName, setNewTableName] = useState("");
  const [newTitleTags, setNewTitleTags] = useState<string[]>([]);
  const [newLocationTags, setNewLocationTags] = useState<string[]>([]);
  const [newCompanyFilter, setNewCompanyFilter] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    ATS_PLATFORMS.map(p => p.value)
  );
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [totalJobs, setTotalJobs] = useState(0);
  
  // Search, sort, pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>(SORT_OPTIONS[0]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Status filter and bulk select
  const [statusFilter, setStatusFilter] = useState<"open" | "closed" | "both">("both");
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  
  // Sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const selectedTable = customTables.find(t => t.id === selectedTableId);
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadTables = async () => {
      try {
        const tables = await getUserCustomTables(user.uid);
        setCustomTables(tables);
        if (tables.length > 0 && !selectedTableId) {
          setSelectedTableId(tables[0].id);
        }
      } catch (error: any) {
        console.error("Error loading custom tables:", error);
        // Show user-friendly error
        alert(`Error loading custom tables: ${error?.message || 'Unknown error'}. Check console for details.`);
      } finally {
        setLoading(false);
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.error('Loading timeout - Firebase may not be configured properly');
        setLoading(false);
        alert('Loading timeout. Please check that Firebase is configured correctly.');
      }
    }, 10000);

    loadTables().finally(() => clearTimeout(timeoutId));
    
    return () => clearTimeout(timeoutId);
  }, [user]);

  useEffect(() => {
    if (!selectedTable) return;

    const fetchJobs = async () => {
      setJobsLoading(true);
      try {
        const params = new URLSearchParams();
        
        // Apply table filters
        if (selectedTable.titleKeywords.length > 0) {
          params.set("title", selectedTable.titleKeywords.join(","));
        }
        if (selectedTable.locationKeywords.length > 0) {
          params.set("location", selectedTable.locationKeywords.join(","));
        }
        if (selectedTable.companyFilter.trim()) {
          params.set("companyName", selectedTable.companyFilter.trim());
        }
        if (selectedTable.selectedPlatforms.length > 0) {
          params.set("platforms", selectedTable.selectedPlatforms.join(","));
        }
        
        // Apply search within results
        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }
        
        // Apply status filter
        if (statusFilter === "open") {
          params.set("status", "ACTIVE");
        } else if (statusFilter === "closed") {
          params.set("status", "CLOSED");
        }
        // If "both", don't set status param to get all jobs
        
        // Apply sorting and pagination
        params.set("sort", sortOption.sort);
        params.set("sortDir", sortOption.sortDir);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        
        // Skip count on subsequent pages for faster loading
        if (page > 1 && totalJobs > 0) {
          params.set("skipCount", "true");
        }

        const response = await fetch(`/api/jobs?${params.toString()}`);
        const data = await response.json();
        
        setJobs(data.items || []);
        // Only update total if we got a valid count (not -1)
        if (data.total !== -1) {
          setTotalJobs(data.total || 0);
        }
        
        // Update new job count - only on first page load
        if (page === 1) {
          let newCount = 0;
          
          if (!selectedTable.lastSeenAt) {
            // If never seen, use the total count directly (all jobs are NEW)
            newCount = data.total || 0;
          } else {
            // Count NEW jobs from current page only (conservative estimate)
            // This avoids the inflated estimates from extrapolating page 1 percentage to all pages
            const lastSeen = new Date(selectedTable.lastSeenAt);
            newCount = data.items.filter((job: Job) => 
              new Date(job.createdAt) > lastSeen
            ).length;
            
            // Don't extrapolate to avoid inflated estimates
            // The badge will show "X+ NEW" to indicate there may be more
          }
          
          if (newCount !== selectedTable.newJobCount) {
            await updateNewJobCount(selectedTable.id, newCount);
            setCustomTables(prev => 
              prev.map(t => t.id === selectedTable.id ? { ...t, newJobCount: newCount } : t)
            );
          }
        }
      } catch (error) {
        console.error("Error fetching jobs:", error);
      } finally {
        setJobsLoading(false);
      }
    };

    fetchJobs();
  }, [selectedTable, searchQuery, sortOption, page, pageSize, statusFilter]);
  
  // Reset page when table changes
  useEffect(() => {
    setPage(1);
    setSearchQuery("");
  }, [selectedTableId]);

  const handleCreateTable = async () => {
    if (!user || !newTableName.trim() || creating) return;

    setCreating(true);
    setCreateModalOpen(false);

    try {
      const tableId = await createCustomTable({
        userId: user.uid,
        name: newTableName.trim(),
        titleKeywords: newTitleTags,
        locationKeywords: newLocationTags,
        companyFilter: newCompanyFilter.trim(),
        selectedPlatforms,
      });

      const tables = await getUserCustomTables(user.uid);
      setCustomTables(tables);
      setSelectedTableId(tableId);

      setNewTableName("");
      setNewTitleTags([]);
      setNewLocationTags([]);
      setNewCompanyFilter("");
      setSelectedPlatforms(ATS_PLATFORMS.map(p => p.value));
      
      // Keep loading state for a moment to show success
      setTimeout(() => {
        setCreating(false);
      }, 1000);
    } catch (error) {
      console.error("Error creating table:", error);
      alert("Failed to create table. Please try again.");
      setCreating(false);
    }
  };

  const handleJobCheck = (jobId: string, checked: boolean) => {
    const newSet = new Set(selectedJobs);
    if (checked) {
      newSet.add(jobId);
    } else {
      newSet.delete(jobId);
    }
    setSelectedJobs(newSet);
  };

  const selectAllJobs = () => {
    setSelectedJobs(new Set(jobs.map(j => j.id)));
  };

  const deselectAllJobs = () => {
    setSelectedJobs(new Set());
  };

  const handleBulkAddToApply = async () => {
    if (!user) {
      alert("Please sign in to track jobs");
      return;
    }

    try {
      const jobIds = Array.from(selectedJobs);
      await bulkAddTrackedJobs(user.uid, jobIds, "to_apply");

      alert(`${jobIds.length} job(s) added to "To Apply"`);
      setSelectedJobs(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error("Error adding jobs to To Apply:", error);
      alert("Failed to add jobs. Please try again.");
    }
  };

  const handleBulkAddToApplied = async () => {
    if (!user) {
      alert("Please sign in to track jobs");
      return;
    }

    try {
      const jobIds = Array.from(selectedJobs);
      await bulkAddTrackedJobs(user.uid, jobIds, "applied");

      alert(`${jobIds.length} job(s) added to "Applied"`);
      setSelectedJobs(new Set());
      setBulkMode(false);
    } catch (error) {
      console.error("Error adding jobs to Applied:", error);
      alert("Failed to add jobs. Please try again.");
    }
  };

  const handleMarkAsSeen = async () => {
    if (!selectedTable) return;

    try {
      await markTableAsSeen(selectedTable.id);
      setCustomTables(prev =>
        prev.map(t =>
          t.id === selectedTable.id
            ? { ...t, lastSeenAt: new Date(), newJobCount: 0 }
            : t
        )
      );
    } catch (error) {
      console.error("Error marking as seen:", error);
    }
  };

  const handleUnlock = async () => {
    if (!selectedTable) return;

    try {
      await resetTableSeen(selectedTable.id);
      setCustomTables(prev =>
        prev.map(t =>
          t.id === selectedTable.id
            ? { ...t, lastSeenAt: null, newJobCount: 0 }
            : t
        )
      );
      setIsLocked(false);
      setUnlockModalOpen(false);
      // Reset page to 1 to trigger job reload and recalculate NEW count
      setPage(1);
    } catch (error) {
      console.error("Error unlocking table:", error);
    }
  };

  const handleSaveName = async () => {
    if (!selectedTable || !editedName.trim()) {
      setEditingName(false);
      return;
    }

    try {
      await updateCustomTable(selectedTable.id, { name: editedName.trim() });
      setCustomTables(prev =>
        prev.map(t =>
          t.id === selectedTable.id ? { ...t, name: editedName.trim() } : t
        )
      );
      setEditingName(false);
    } catch (error) {
      console.error("Error updating table name:", error);
    }
  };

  const handleDeleteTable = async () => {
    if (!tableToDelete || deleting) return;

    setDeleting(true);
    try {
      await deleteCustomTable(tableToDelete);
      setCustomTables(prev => prev.filter(t => t.id !== tableToDelete));
      
      if (selectedTableId === tableToDelete) {
        const remainingTables = customTables.filter(t => t.id !== tableToDelete);
        setSelectedTableId(remainingTables.length > 0 ? remainingTables[0].id : null);
      }
      
      setDeleteModalOpen(false);
      setTableToDelete(null);
    } catch (error) {
      console.error("Error deleting table:", error);
      alert("Failed to delete table. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const isJobNew = (job: Job): boolean => {
    if (!selectedTable) return false;
    // If never seen before, all jobs are NEW
    if (!selectedTable.lastSeenAt) return true;
    const lastSeen = new Date(selectedTable.lastSeenAt);
    const jobDate = new Date(job.createdAt);
    return jobDate > lastSeen;
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
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
        <TopNav />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-slate-600 dark:text-slate-400">Loading...</div>
        </div>
      </div>
    );
  }
  if (customTables.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900">
        <TopNav />
        
        {creating && (
          <div className="flex-none bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800 px-4 py-2.5 flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4 text-teal-600 dark:text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Creating table...</span>
          </div>
        )}
        
        <div className="px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Custom Tables
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Create personalized job tables with custom filters and keywords.
              </p>
            </div>

            <div className="mb-6">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                + Create New Table
              </button>
            </div>

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
          
        {createModalOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setCreateModalOpen(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                    Create Custom Table
                  </h2>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Table Name
                    </label>
                    <input
                      type="text"
                      value={newTableName}
                      onChange={(e) => setNewTableName(e.target.value)}
                      placeholder="e.g., MA Software Interns"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Job Title Keywords (optional)
                    </label>
                    <TagInput
                      tags={newTitleTags}
                      onTagsChange={setNewTitleTags}
                      placeholder="e.g., Software Engineer, Intern..."
                      icon="search"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Location Keywords (optional)
                    </label>
                    <TagInput
                      tags={newLocationTags}
                      onTagsChange={setNewLocationTags}
                      placeholder="e.g., Remote, Boston, NYC..."
                      icon="location"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Company Name (optional)
                    </label>
                    <input
                      type="text"
                      value={newCompanyFilter}
                      onChange={(e) => setNewCompanyFilter(e.target.value)}
                      placeholder="e.g., Google"
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Job Platforms
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ATS_PLATFORMS.map((platform) => (
                        <button
                          key={platform.value}
                          type="button"
                          onClick={() => {
                            setSelectedPlatforms(prev =>
                              prev.includes(platform.value)
                                ? prev.filter(p => p !== platform.value)
                                : [...prev, platform.value]
                            );
                          }}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                            selectedPlatforms.includes(platform.value)
                              ? "bg-teal-50 dark:bg-teal-900/30 border-teal-500 dark:border-teal-600 text-teal-700 dark:text-teal-300"
                              : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {platform.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCreateModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTable}
                      disabled={!newTableName.trim() || creating}
                      className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {creating && (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {creating ? 'Creating...' : 'Create Table'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900">
      <TopNav />
      
      {creating && (
        <div className="flex-none bg-teal-50 dark:bg-teal-900/30 border-b border-teal-200 dark:border-teal-800 px-4 py-2.5 flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4 text-teal-600 dark:text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Creating table...</span>
        </div>
      )}
      
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar - Table List */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed left-0 top-0 bottom-0 z-30 ${sidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 lg:static lg:translate-x-0 transition-all duration-300 flex flex-col`}>
          <div className="flex-none p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            {!sidebarCollapsed && <h2 className="font-semibold text-slate-900 dark:text-white">My Tables</h2>}
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)} 
                className="hidden lg:block p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition"
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <svg className={`h-4 w-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {customTables.map((table) => (
              <div key={table.id} className="relative group mb-1">
                <button 
                  onClick={() => { setSelectedTableId(table.id); setIsLocked(true); setSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${selectedTableId === table.id ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                  title={sidebarCollapsed ? table.name : undefined}
                >
                  {sidebarCollapsed ? (
                    <div className="flex flex-col items-center gap-1">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {table.newJobCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="font-medium pr-6">{table.name}</div>
                      {table.newJobCount > 0 && <div className="text-xs text-teal-600 dark:text-teal-400">{table.newJobCount} NEW</div>}
                    </>
                  )}
                </button>
                {!sidebarCollapsed && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setTableToDelete(table.id); setDeleteModalOpen(true); }}
                    className="absolute right-2 top-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                    title="Delete table"
                  >
                    <svg className="h-4 w-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={() => setCreateModalOpen(true)} 
              className={`w-full text-left px-3 py-2 mt-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-500 dark:hover:border-teal-500 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition ${sidebarCollapsed ? 'flex justify-center' : ''}`}
              title={sidebarCollapsed ? "New Table" : undefined}
            >
              {sidebarCollapsed ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              ) : (
                '+ New Table'
              )}
            </button>
          </div>
        </div>

        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        {/* Left Pane - Job List (matches main job board layout) */}
        <div className="flex w-full md:w-[400px] lg:w-[440px] flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Header with filters */}
          <div className="flex-none border-b border-slate-200 dark:border-slate-700">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {selectedTable && (
                  <div className="min-w-0 flex-1">
                    {editingName ? (
                      <input type="text" value={editedName} onChange={(e) => setEditedName(e.target.value)} onBlur={handleSaveName}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                        className="text-lg font-bold bg-transparent border-b-2 border-teal-500 focus:outline-none text-slate-900 dark:text-white w-full" autoFocus />
                    ) : (
                      <h1 onClick={() => { setEditedName(selectedTable.name); setEditingName(true); }}
                        className="text-lg font-bold text-slate-900 dark:text-white cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 truncate">
                        {selectedTable.name}
                      </h1>
                    )}
                    {selectedTable.newJobCount > 0 && <span className="text-xs text-teal-600 dark:text-teal-400">{selectedTable.newJobCount} new</span>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {selectedTable && selectedTable.newJobCount > 0 && (
                  <button onClick={handleMarkAsSeen} className="px-2 py-1 text-xs font-medium bg-teal-600 text-white rounded hover:bg-teal-700 transition">
                    Seen
                  </button>
                )}
                <button onClick={() => { if (isLocked) { setUnlockModalOpen(true); } else { setIsLocked(true); } }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition" title={isLocked ? "Unlock filters" : "Lock filters"}>
                  {isLocked ? (
                    <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Filter summary */}
            {selectedTable && (
              <div className="border-b border-slate-100 dark:border-slate-700">
                <div className="px-4 py-2 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                  <button
                    type="button"
                    onClick={() => setFiltersCollapsed(!filtersCollapsed)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
                  >
                    <svg className={`h-4 w-4 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {filtersCollapsed ? 'Show' : 'Hide'} Table Filters
                  </button>
                </div>
                {!filtersCollapsed && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50">
                    {isLocked ? (
                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {selectedTable.titleKeywords.length > 0 && <div><strong>Title:</strong> {selectedTable.titleKeywords.join(", ")}</div>}
                        {selectedTable.locationKeywords.length > 0 && <div><strong>Location:</strong> {selectedTable.locationKeywords.join(", ")}</div>}
                        {selectedTable.companyFilter && <div><strong>Company:</strong> {selectedTable.companyFilter}</div>}
                        {selectedTable.selectedPlatforms.length > 0 && <div><strong>Platforms:</strong> {selectedTable.selectedPlatforms.join(", ")}</div>}
                        {selectedTable.titleKeywords.length === 0 && selectedTable.locationKeywords.length === 0 && !selectedTable.companyFilter && (
                          <div className="text-slate-400">No filters - showing all jobs</div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title</label>
                          <TagInput tags={selectedTable.titleKeywords}
                            onTagsChange={(tags) => {
                              updateCustomTable(selectedTable.id, { titleKeywords: tags });
                              setCustomTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, titleKeywords: tags } : t));
                            }} placeholder="Type keyword, press Enter..." icon="search" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Location</label>
                          <TagInput tags={selectedTable.locationKeywords}
                            onTagsChange={(tags) => {
                              updateCustomTable(selectedTable.id, { locationKeywords: tags });
                              setCustomTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, locationKeywords: tags } : t));
                            }} placeholder="Type location, press Enter..." icon="location" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Company</label>
                          <input type="text" value={selectedTable.companyFilter}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateCustomTable(selectedTable.id, { companyFilter: value });
                              setCustomTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, companyFilter: value } : t));
                            }}
                            placeholder="Company..." className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search and Sort Controls */}
          {selectedTable && (
            <div className="flex-none border-b border-slate-100 dark:border-slate-700 px-4 py-3 space-y-2">
              {/* Search bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search within results..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Sort and Page Size */}
              <div className="flex items-center justify-between gap-2">
                <select
                  value={`${sortOption.sort}-${sortOption.sortDir}`}
                  onChange={(e) => {
                    const [sort, sortDir] = e.target.value.split("-");
                    setSortOption(SORT_OPTIONS.find(o => o.sort === sort && o.sortDir === sortDir) || SORT_OPTIONS[0]);
                    setPage(1);
                  }}
                  className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={`${option.sort}-${option.sortDir}`} value={`${option.sort}-${option.sortDir}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-900 dark:text-white"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
              </div>
              
              {/* Status Filter and Bulk Select */}
              <div className="flex items-center gap-2">
                <select
                  className={`h-8 appearance-none rounded-full pl-3 pr-8 text-xs font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 ${
                    statusFilter === "open"
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                      : statusFilter === "closed"
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                  value={statusFilter}
                  onChange={(e) => {
                    const newStatus = e.target.value as "open" | "closed" | "both";
                    setStatusFilter(newStatus);
                    setPage(1);
                  }}
                >
                  <option value="open">● Open Jobs</option>
                  <option value="closed">● Closed Jobs</option>
                  <option value="both">● All Jobs</option>
                </select>
                
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode(!bulkMode);
                    if (bulkMode) setSelectedJobs(new Set());
                  }}
                  className={`h-8 inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
                    bulkMode
                      ? "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Bulk Select
                </button>
              </div>
            </div>
          )}

          {/* Results header */}
          {selectedTable && (
            <div className="flex-none border-b border-slate-100 dark:border-slate-700 px-4 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {totalJobs.toLocaleString()} jobs
                </span>
                {totalJobs > 0 && (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalJobs)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Bulk Mode Actions Bar */}
          {bulkMode && selectedJobs.size > 0 && (
            <div className="flex-none border-b border-slate-100 dark:border-slate-700 bg-teal-50 dark:bg-teal-900/30 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-teal-700 dark:text-teal-400">
                  {selectedJobs.size} job{selectedJobs.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkAddToApply}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-teal-700"
                  >
                    Add to "To Apply"
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkAddToApplied}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    Mark as Applied
                  </button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllJobs}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllJobs}
                    className="text-sm text-slate-500 dark:text-slate-400 hover:underline"
                  >
                    Deselect all
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Job list */}
          <div className="flex-1 overflow-y-auto">
            {!selectedTable ? (
              <div className="flex flex-col items-center justify-center h-full px-4 text-center">
                <svg className="h-12 w-12 mb-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Select a table to view jobs</p>
              </div>
            ) : jobsLoading ? (
              <div>
                <div className="px-4 py-3 bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800">
                  <div className="flex items-center gap-2 text-sm text-teal-700 dark:text-teal-400">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="font-medium">Searching jobs...</span>
                  </div>
                </div>
                {[...Array(8)].map((_, i) => (
                  <JobCardSkeleton key={i} index={i} />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                  <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No jobs found</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">Try adjusting your filters or search</p>
              </div>
            ) : (
              jobs.map((job, index) => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  isSelected={selectedJobId === job.id} 
                  onClick={() => setSelectedJobId(job.id)} 
                  index={index}
                  showNewBadge={isJobNew(job)}
                  bulkMode={bulkMode}
                  isChecked={selectedJobs.has(job.id)}
                  onCheck={(checked) => handleJobCheck(job.id, checked)}
                />
              ))
            )}
          </div>
          
          {/* Pagination */}
          {selectedTable && jobs.length > 0 && (
            <div className="flex-none border-t border-slate-100 dark:border-slate-700 px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage(p => p - 1)}
                  disabled={page <= 1 || jobsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Page {page} of {Math.ceil(totalJobs / pageSize)}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(totalJobs / pageSize) || jobsLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane - Job Details (hidden on mobile) */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {selectedJob ? (
            <JobDetailPanel 
              job={selectedJob} 
              onAddToApply={async (jobId) => {
                if (!user) return;
                try {
                  await addTrackedJob({ userId: user.uid, jobId, status: "to_apply" });
                  alert('Job added to "To Apply"');
                } catch (error) {
                  console.error("Error adding job:", error);
                  alert("Failed to add job. Please try again.");
                }
              }}
              onAddToApplied={async (jobId) => {
                if (!user) return;
                try {
                  await addTrackedJob({ userId: user.uid, jobId, status: "applied" });
                  alert('Job marked as "Applied"');
                } catch (error) {
                  console.error("Error adding job:", error);
                  alert("Failed to add job. Please try again.");
                }
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <div className="text-center">
                <svg className="h-16 w-16 mx-auto mb-4 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">Select a job to view details</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Detail Sheet */}
      {selectedJob && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 menu-backdrop md:hidden"
            onClick={() => setSelectedJobId(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
            <JobDetailPanel 
              job={selectedJob}
              onClose={() => setSelectedJobId(null)}
              isMobile
              onAddToApply={async (jobId) => {
                if (!user) return;
                try {
                  await addTrackedJob({ userId: user.uid, jobId, status: "to_apply" });
                  alert('Job added to "To Apply"');
                } catch (error) {
                  console.error("Error adding job:", error);
                  alert("Failed to add job. Please try again.");
                }
              }}
              onAddToApplied={async (jobId) => {
                if (!user) return;
                try {
                  await addTrackedJob({ userId: user.uid, jobId, status: "applied" });
                  alert('Job marked as "Applied"');
                } catch (error) {
                  console.error("Error adding job:", error);
                  alert("Failed to add job. Please try again.");
                }
              }}
            />
          </div>
        </>
      )}

      {createModalOpen && customTables.length > 0 && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setCreateModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Create Custom Table</h2>
                
                {/* Tab Switcher */}
                <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCreateTab("manual")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      createTab === "manual"
                        ? "border-teal-600 text-teal-600 dark:text-teal-400"
                        : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateTab("ai")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      createTab === "ai"
                        ? "border-teal-600 text-teal-600 dark:text-teal-400"
                        : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    Cartographer (AI)
                  </button>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Table Name</label>
                  <input type="text" value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="e.g., MA Software Interns"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white" />
                </div>

                {createTab === "manual" ? (
                  <>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Job Title Keywords (optional)</label>
                      <TagInput tags={newTitleTags} onTagsChange={setNewTitleTags} placeholder='Type keyword, Press "Enter" to add...' icon="search" />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Location Keywords (optional)</label>
                      <TagInput tags={newLocationTags} onTagsChange={setNewLocationTags} placeholder='Type location, Press "Enter" to add...' icon="location" />
                    </div>
                  </>
                ) : (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Use AI to generate search terms</label>
                    <Cartographer 
                      onApplySuggestions={(titleKeywords: string[], locationKeywords: string[]) => {
                        setNewTitleTags(titleKeywords);
                        setNewLocationTags(locationKeywords);
                      }} 
                    />
                    {(newTitleTags.length > 0 || newLocationTags.length > 0) && (
                      <div className="mt-4 space-y-3">
                        {newTitleTags.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Title Keywords</label>
                            <div className="flex flex-wrap gap-2">
                              {newTitleTags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-md">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => setNewTitleTags(newTitleTags.filter((_, i) => i !== idx))}
                                    className="hover:text-teal-900 dark:hover:text-teal-100"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {newLocationTags.length > 0 && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Location Keywords</label>
                            <div className="flex flex-wrap gap-2">
                              {newLocationTags.map((tag, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 text-xs rounded-md">
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => setNewLocationTags(newLocationTags.filter((_, i) => i !== idx))}
                                    className="hover:text-teal-900 dark:hover:text-teal-100"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company Name (optional)</label>
                  <input type="text" value={newCompanyFilter} onChange={(e) => setNewCompanyFilter(e.target.value)} placeholder="e.g., Google"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white" />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Job Platforms</label>
                  <div className="flex flex-wrap gap-2">
                    {ATS_PLATFORMS.map((platform) => (
                      <button key={platform.value} type="button" onClick={() => {
                        setSelectedPlatforms(prev => prev.includes(platform.value) ? prev.filter(p => p !== platform.value) : [...prev, platform.value]);
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                        selectedPlatforms.includes(platform.value)
                          ? "bg-teal-50 dark:bg-teal-900/30 border-teal-500 dark:border-teal-600 text-teal-700 dark:text-teal-300"
                          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                      }`}>
                        {platform.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                  <button onClick={handleCreateTable} disabled={!newTableName.trim()} className="px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Create Table</button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {unlockModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setUnlockModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                  <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">Unlock Filters?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">
                Unlocking will mark all jobs as UNSEEN. You'll be able to modify the search filters after unlocking, and all new jobs will be marked as NEW again.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setUnlockModalOpen(false)} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition">Cancel</button>
                <button onClick={handleUnlock} className="flex-1 px-4 py-2 text-sm font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition">Yes, Unlock</button>
              </div>
            </div>
          </div>
        </>
      )}

      {deleteModalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => !deleting && setDeleteModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="mb-4 flex justify-center">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">Delete Table?</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6 text-center">
                Are you sure you want to delete this table? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModalOpen(false)} disabled={deleting} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition disabled:opacity-50">Cancel</button>
                <button onClick={handleDeleteTable} disabled={deleting} className="flex-1 px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleting && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
