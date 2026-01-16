"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { JobCard, JobCardSkeleton } from "./JobCard";
import { JobDetailPanel, JobDetailSkeleton } from "./JobDetailPanel";
import { TagInput } from "./TagInput";
import { Cartographer } from "./Cartographer";
import { useAuth } from "@/contexts/AuthContext";
import { AuthButton } from "./AuthButton";
import { addTrackedJob, bulkAddTrackedJobs, createCustomTable, getUserTrackedJobs } from "@/lib/firestore";

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

type ApiResponse = {
  items: Job[];
  total: number;
  page: number;
  pageSize: number;
};

type SortOption = {
  label: string;
  sort: string;
  sortDir: "asc" | "desc";
};

type StatusFilter = "open" | "closed" | "both";

const SORT_OPTIONS: SortOption[] = [
  { label: "Company (A-Z)", sort: "company", sortDir: "asc" },
  { label: "Company (Z-A)", sort: "company", sortDir: "desc" },
  { label: "Title (A-Z)", sort: "title", sortDir: "asc" },
  { label: "Title (Z-A)", sort: "title", sortDir: "desc" },
  { label: "Newest First", sort: "created_at", sortDir: "desc" },
  { label: "Oldest First", sort: "created_at", sortDir: "asc" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 25;

const ATS_PLATFORMS = [
  { value: "GREENHOUSE", label: "Greenhouse" },
  { value: "LEVER", label: "Lever" },
  { value: "WORKDAY", label: "Workday" },
  { value: "ICIMS", label: "iCIMS" },
  { value: "SMARTRECRUITERS", label: "SmartRecruiters" },
] as const;

type QueryState = {
  titleTags: string[];
  companyFilter: string;
  locationTags: string[];
  statusFilter: StatusFilter;
  sortOption: SortOption;
  page: number;
  pageSize: number;
  selectedPlatforms: string[];
};

const DEFAULT_STATE: QueryState = {
  titleTags: [],
  companyFilter: "",
  locationTags: [],
  statusFilter: "open",
  sortOption: SORT_OPTIONS[0],
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  selectedPlatforms: ATS_PLATFORMS.map(p => p.value),
};

function buildSearchParams(state: QueryState, titleTag?: string, locationTag?: string) {
  const params = new URLSearchParams();
  
  if (state.titleTags.length > 0 && !titleTag) {
    params.set("title", state.titleTags.join(","));
  } else if (titleTag) {
    params.set("title", titleTag);
  }
  
  if (state.companyFilter.trim())
    params.set("companyName", state.companyFilter.trim());
  
  if (state.locationTags.length > 0 && !locationTag) {
    params.set("location", state.locationTags.join(","));
  } else if (locationTag) {
    params.set("location", locationTag);
  }

  if (state.statusFilter === "open") {
    params.set("status", "ACTIVE");
  } else if (state.statusFilter === "closed") {
    params.set("status", "CLOSED");
  }

  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  params.set("sort", state.sortOption.sort);
  params.set("sortDir", state.sortOption.sortDir);
  
  if (state.selectedPlatforms.length > 0 && state.selectedPlatforms.length < ATS_PLATFORMS.length) {
    params.set("platforms", state.selectedPlatforms.join(","));
  }

  return params;
}

function parseSearchParams(searchParams: URLSearchParams): QueryState {
  const titleParam = searchParams.get("title") ?? "";
  const titleTags = titleParam ? titleParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const companyFilter = searchParams.get("companyName") ?? "";
  const locationParam = searchParams.get("location") ?? "";
  const locationTags = locationParam ? locationParam.split(",").map(t => t.trim()).filter(Boolean) : [];
  const statusParam = (searchParams.get("status") ?? "").toUpperCase();
  const sort = searchParams.get("sort") ?? "";
  const sortDir =
    (searchParams.get("sortDir")?.toLowerCase() as "asc" | "desc") ?? "asc";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10)
  );
  const pageSizeParam = Number.parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = (pageSizeParam === 10 || pageSizeParam === 25 || pageSizeParam === 50) 
    ? pageSizeParam 
    : DEFAULT_PAGE_SIZE;

  const sortOption =
    SORT_OPTIONS.find(
      (option) => option.sort === sort && option.sortDir === sortDir
    ) ?? DEFAULT_STATE.sortOption;

  let statusFilter: StatusFilter = "open";
  if (statusParam === "CLOSED") {
    statusFilter = "closed";
  } else if (statusParam === "ACTIVE") {
    statusFilter = "open";
  } else if (!statusParam) {
    statusFilter = "both";
  }

  const platformsParam = searchParams.get("platforms") ?? "";
  const selectedPlatforms = platformsParam 
    ? platformsParam.split(",").filter(p => ATS_PLATFORMS.some(ats => ats.value === p))
    : ATS_PLATFORMS.map(p => p.value);

  return {
    titleTags,
    companyFilter,
    locationTags,
    statusFilter,
    sortOption,
    page,
    pageSize,
    selectedPlatforms,
  };
}

export default function JobSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const initialized = useRef(false);
  const jobListRef = useRef<HTMLDivElement>(null);
  
  // Simple in-memory cache for pagination
  const cacheRef = useRef<Map<string, ApiResponse>>(new Map());
  
  // Queue system for prefetching pages
  type QueueItem = { cacheKey: string; pageNum: number; state: QueryState };
  const fetchQueueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);

  const [titleTags, setTitleTags] = useState<string[]>(DEFAULT_STATE.titleTags);
  const [companyFilter, setCompanyFilter] = useState(DEFAULT_STATE.companyFilter);
  const [locationTags, setLocationTags] = useState<string[]>(DEFAULT_STATE.locationTags);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATE.statusFilter);
  const [sortOption, setSortOption] = useState(DEFAULT_STATE.sortOption);
  const [page, setPage] = useState(DEFAULT_STATE.page);
  const [pageSize, setPageSize] = useState(DEFAULT_STATE.pageSize);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(DEFAULT_STATE.selectedPlatforms);
  const [platformsDropdownOpen, setPlatformsDropdownOpen] = useState(false);

  const [data, setData] = useState<ApiResponse>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // UI State
  const [darkMode, setDarkMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [showLimitWarning, setShowLimitWarning] = useState<{show: boolean, type: 'title' | 'location' | null}>({show: false, type: null});
  const [mobileSearchExpanded, setMobileSearchExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  
  // Save to Custom Table modal
  const [saveToTableModalOpen, setSaveToTableModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  
  // Tracked jobs (for showing save status on job cards)
  const [trackedJobs, setTrackedJobs] = useState<Map<string, 'to_apply' | 'applied'>>(new Map());

  // Initialize dark mode and listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const savedMode = localStorage.getItem("darkMode");
    
    // If user has manually set a preference, use that; otherwise follow system
    const isDark = savedMode !== null ? savedMode === "true" : mediaQuery.matches;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);

    // Only listen to system changes if user hasn't set a manual preference
    const handleChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem("darkMode") === null) {
        setDarkMode(e.matches);
        document.documentElement.classList.toggle("dark", e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Toggle dark mode manually
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.classList.toggle("dark", newMode);
    localStorage.setItem("darkMode", String(newMode));
  };

  // Prevent hydration mismatch by not rendering dark mode toggle until client-side
  const isDarkModeReady = darkMode !== null;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const parsed = parseSearchParams(new URLSearchParams(searchParams.toString()));
    setTitleTags(parsed.titleTags);
    setCompanyFilter(parsed.companyFilter);
    setLocationTags(parsed.locationTags);
    setStatusFilter(parsed.statusFilter);
    setSortOption(parsed.sortOption);
    setPage(parsed.page);
    setPageSize(parsed.pageSize);
    setSelectedPlatforms(parsed.selectedPlatforms);
    fetchJobs(parsed.page, { overrideState: parsed, skipUrlUpdate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLatestUpdatedAt();
  }, []);

  // Fetch tracked jobs when user logs in
  useEffect(() => {
    if (user?.uid) {
      getUserTrackedJobs(user.uid).then(jobs => {
        const map = new Map<string, 'to_apply' | 'applied'>();
        jobs.forEach(job => {
          map.set(job.jobId, job.status);
        });
        setTrackedJobs(map);
      }).catch(err => {
        console.error('Failed to fetch tracked jobs:', err);
      });
    } else {
      setTrackedJobs(new Map());
    }
  }, [user?.uid]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (menuOpen || mobileDetailOpen) return;
      
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const nextIndex = Math.min(selectedIndex + 1, data.items.length - 1);
        setSelectedIndex(nextIndex);
        if (data.items[nextIndex]) {
          setSelectedJob(data.items[nextIndex]);
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const nextIndex = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(nextIndex);
        if (data.items[nextIndex]) {
          setSelectedJob(data.items[nextIndex]);
        }
      } else if (e.key === "Enter" && selectedJob) {
        e.preventDefault();
        window.open(selectedJob.jobUrl, "_blank");
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedJob(null);
        setSelectedIndex(-1);
        setMobileDetailOpen(false);
      } else if (e.key === "b" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setBulkMode(!bulkMode);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, data.items, selectedJob, menuOpen, mobileDetailOpen, bulkMode]);

  // Scroll selected job into view
  useEffect(() => {
    if (selectedIndex >= 0 && jobListRef.current) {
      const jobButtons = jobListRef.current.querySelectorAll("button");
      const selectedButton = jobButtons[selectedIndex];
      if (selectedButton) {
        selectedButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

  type FetchOptions = {
    overrideState?: Partial<QueryState>;
    skipUrlUpdate?: boolean;
  };

  function formatRelativeTime(date: Date | null): string {
    if (!date) return "—";
    const diffMs = date.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const minutes = Math.round(absMs / (1000 * 60));
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  async function fetchJobs(
    nextPage = 1,
    options: FetchOptions = { overrideState: {}, skipUrlUpdate: false }
  ) {
    const nextState: QueryState = {
      titleTags,
      companyFilter,
      locationTags,
      statusFilter,
      sortOption,
      pageSize,
      selectedPlatforms,
      ...(options.overrideState ?? {}),
      page: nextPage,
    };

    // Build cache key
    const cacheKey = `${nextState.titleTags.join(',')}_${nextState.companyFilter}_${nextState.locationTags.join(',')}_${nextState.statusFilter}_${nextState.sortOption.sort}_${nextState.sortOption.sortDir}_${nextPage}_${nextState.pageSize}_${nextState.selectedPlatforms.join(',')}`;
    
    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      // Use cached data instantly
      console.log(`⚡ Page ${nextPage} loaded instantly from cache (0ms)`);
      setData(cached);
      setPage(nextState.page);
      setPageSize(nextState.pageSize);
      setTitleTags(nextState.titleTags);
      setCompanyFilter(nextState.companyFilter);
      setLocationTags(nextState.locationTags);
      setStatusFilter(nextState.statusFilter);
      setSortOption(nextState.sortOption);
      setSelectedPlatforms(nextState.selectedPlatforms);
      
      if (!options.skipUrlUpdate) {
        const urlParams = buildSearchParams(nextState);
        router.replace(`?${urlParams.toString()}`, { scroll: false });
      }
      
      if (cached.items.length > 0 && !selectedJob) {
        setSelectedJob(cached.items[0]);
        setSelectedIndex(0);
      }
      
      // Still prefetch next pages even when using cache
      prefetchNextPages(nextState, nextPage);
      return; // Skip loading - instant!
    }

    // Not in cache, fetch from API
    setIsLoading(true);
    setError(null);

    console.log(`📡 Page ${nextPage} not cached, fetching from API...`);

    try {
      if (!options.skipUrlUpdate) {
        const urlParams = buildSearchParams(nextState);
        router.replace(`?${urlParams.toString()}`, { scroll: false });
      }

      // Build single API request with comma-separated terms
      const params = new URLSearchParams();
      
      if (nextState.titleTags.length > 0) {
        params.set("title", nextState.titleTags.join(","));
      }
      
      if (nextState.companyFilter.trim()) {
        params.set("companyName", nextState.companyFilter.trim());
      }
      
      if (nextState.locationTags.length > 0) {
        params.set("location", nextState.locationTags.join(","));
      }
      
      if (nextState.statusFilter === "open") {
        params.set("status", "ACTIVE");
      } else if (nextState.statusFilter === "closed") {
        params.set("status", "CLOSED");
      }
      
      params.set("page", String(nextPage));
      params.set("pageSize", String(nextState.pageSize));
      params.set("sort", nextState.sortOption.sort);
      params.set("sortDir", nextState.sortOption.sortDir);
      
      if (nextState.selectedPlatforms.length > 0 && nextState.selectedPlatforms.length < ATS_PLATFORMS.length) {
        params.set("platforms", nextState.selectedPlatforms.join(","));
      }

      // Single API call instead of cartesian product
      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const result = (await res.json()) as ApiResponse;

      // Store in cache
      cacheRef.current.set(cacheKey, result);
      // Limit cache size to 50 entries
      if (cacheRef.current.size > 50) {
        const firstKey = cacheRef.current.keys().next().value;
        if (firstKey) cacheRef.current.delete(firstKey);
      }

      setData({
        items: result.items,
        total: result.total,
        page: nextPage,
        pageSize: nextState.pageSize,
      });
      setPage(nextState.page);
      setPageSize(nextState.pageSize);
      setTitleTags(nextState.titleTags);
      setCompanyFilter(nextState.companyFilter);
      setLocationTags(nextState.locationTags);
      setStatusFilter(nextState.statusFilter);
      setSortOption(nextState.sortOption);
      setSelectedPlatforms(nextState.selectedPlatforms);
      
      if (result.items.length > 0 && !selectedJob) {
        setSelectedJob(result.items[0]);
        setSelectedIndex(0);
      }
      
      const latestFromPage = result.items.reduce<Date | null>(
        (latestDate, job) => {
          const ts = job.updatedAt ?? job.createdAt;
          const date = new Date(ts);
          if (Number.isNaN(date.getTime())) {
            return latestDate;
          }
          if (!latestDate) return date;
          return date.getTime() > latestDate.getTime() ? date : latestDate;
        },
        null
      );
      if (
        latestFromPage &&
        (!lastUpdatedAt || latestFromPage.getTime() > lastUpdatedAt.getTime())
      ) {
        setLastUpdatedAt(latestFromPage);
      }
      
      // Prefetch next 5 pages in background for instant pagination
      prefetchNextPages(nextState, nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setIsLoading(false);
    }
  }

  // Process the fetch queue one item at a time
  async function processQueue() {
    if (isProcessingRef.current) return; // Already processing
    if (fetchQueueRef.current.length === 0) return; // Queue empty
    
    isProcessingRef.current = true;
    
    while (fetchQueueRef.current.length > 0) {
      const item = fetchQueueRef.current.shift();
      if (!item) break;
      
      const { cacheKey, pageNum, state } = item;
      
      // Skip if already cached
      if (cacheRef.current.has(cacheKey)) {
        console.log(`✅ Page ${pageNum} already cached, skipping from queue`);
        continue;
      }
      
      try {
        console.log(`⏳ Loading page ${pageNum} from queue (${fetchQueueRef.current.length} remaining)...`);
        const params = new URLSearchParams();
        if (state.titleTags.length > 0) params.set("title", state.titleTags.join(","));
        if (state.companyFilter.trim()) params.set("companyName", state.companyFilter.trim());
        if (state.locationTags.length > 0) params.set("location", state.locationTags.join(","));
        if (state.statusFilter === "open") params.set("status", "ACTIVE");
        else if (state.statusFilter === "closed") params.set("status", "CLOSED");
        params.set("page", String(pageNum));
        params.set("pageSize", String(state.pageSize));
        params.set("sort", state.sortOption.sort);
        params.set("sortDir", state.sortOption.sortDir);
        
        const res = await fetch(`/api/jobs?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          cacheRef.current.set(cacheKey, result);
          console.log(`✅ Page ${pageNum} loaded (${result.items.length} jobs)`);
          
          // Limit cache size
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            if (firstKey) cacheRef.current.delete(firstKey);
          }
        } else {
          console.log(`❌ Failed to load page ${pageNum}`);
        }
      } catch (error) {
        console.log(`❌ Error loading page ${pageNum}:`, error);
      }
    }
    
    isProcessingRef.current = false;
    console.log(`🏁 Queue processing complete`);
  }

  // Add pages to the fetch queue
  function addToQueue(state: QueryState, currentPage: number) {
    const maxPage = Math.ceil(data.total / state.pageSize);
    const pagesToPrefetch = 10;
    
    const newPages: number[] = [];
    
    for (let i = 1; i <= pagesToPrefetch; i++) {
      const nextPageNum = currentPage + i;
      if (nextPageNum > maxPage) break;
      
      const cacheKey = `${state.titleTags.join(',')}_${state.companyFilter}_${state.locationTags.join(',')}_${state.statusFilter}_${state.sortOption.sort}_${state.sortOption.sortDir}_${nextPageNum}_${state.pageSize}`;
      
      // Skip if already cached
      if (cacheRef.current.has(cacheKey)) {
        continue;
      }
      
      // Skip if already in queue
      if (fetchQueueRef.current.some(item => item.cacheKey === cacheKey)) {
        continue;
      }
      
      // Add to queue
      fetchQueueRef.current.push({ cacheKey, pageNum: nextPageNum, state });
      newPages.push(nextPageNum);
    }
    
    if (newPages.length > 0) {
      console.log(`📥 Added pages ${newPages.join(', ')} to queue (${fetchQueueRef.current.length} total in queue)`);
      // Start processing if not already running
      processQueue();
    } else {
      console.log(`✅ All next 5 pages already cached or queued`);
    }
  }

  // Prefetch next 5 pages in the background
  async function prefetchNextPages(state: QueryState, currentPage: number) {
    addToQueue(state, currentPage);
  }

  async function fetchLatestUpdatedAt() {
    try {
      const res = await fetch(`/api/jobs/last-updated`);
      if (!res.ok) return;
      const payload = (await res.json()) as { lastUpdated: string | null };
      if (!payload.lastUpdated) return;
      const date = new Date(payload.lastUpdated);
      if (!Number.isNaN(date.getTime())) {
        setLastUpdatedAt(date);
      }
    } catch {
      // Ignore errors
    }
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (titleTags.length > 0) count++;
    if (companyFilter.trim()) count++;
    if (locationTags.length > 0) count++;
    return count;
  }, [titleTags, companyFilter, locationTags]);

  function resetFilters() {
    setTitleTags(DEFAULT_STATE.titleTags);
    setCompanyFilter(DEFAULT_STATE.companyFilter);
    setLocationTags(DEFAULT_STATE.locationTags);
    setStatusFilter(DEFAULT_STATE.statusFilter);
    setSortOption(DEFAULT_STATE.sortOption);
    setPage(DEFAULT_STATE.page);
    setPageSize(DEFAULT_STATE.pageSize);
    setSelectedJob(null);
    setSelectedIndex(-1);
    fetchJobs(1, { overrideState: DEFAULT_STATE });
  }

  // Bulk mode handlers
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
    setSelectedJobs(new Set(data.items.map(j => j.id)));
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

  const handleAddToApply = async (jobId: string) => {
    if (!user) {
      alert('Please sign in to track jobs');
      return;
    }

    try {
      await addTrackedJob({ userId: user.uid, jobId, status: 'to_apply' });
      // Update local state immediately
      setTrackedJobs(prev => new Map(prev).set(jobId, 'to_apply'));
      alert('Job added to "To Apply"');
    } catch (error) {
      console.error('Error adding job to To Apply:', error);
      alert('Failed to add job. Please try again.');
    }
  };

  const handleAddToApplied = async (jobId: string) => {
    if (!user) {
      alert('Please sign in to track jobs');
      return;
    }

    try {
      await addTrackedJob({ userId: user.uid, jobId, status: 'applied' });
      // Update local state immediately
      setTrackedJobs(prev => new Map(prev).set(jobId, 'applied'));
      alert('Job added to "Applied"');
    } catch (error) {
      console.error('Error adding job to Applied:', error);
      alert('Failed to add job. Please try again.');
    }
  };

  const handleJobClick = (job: Job, index: number) => {
    setSelectedJob(job);
    setSelectedIndex(index);
    // On mobile, open the detail sheet
    if (window.innerWidth < 768) {
      setMobileDetailOpen(true);
    }
  };

  // Cartographer handler - applies AI-suggested search terms
  const handleCartographerSuggestions = (titleKeywords: string[], locationKeywords: string[]) => {
    const newTitleTags = titleKeywords.slice(0, 5); // Limit to 5
    const newLocationTags = locationKeywords.slice(0, 5); // Limit to 5
    
    setTitleTags(newTitleTags);
    setLocationTags(newLocationTags);
    
    // Trigger search with new terms
    fetchJobs(1, { 
      overrideState: { 
        titleTags: newTitleTags, 
        locationTags: newLocationTags 
      } 
    });
  };

  // Handle creating custom table from current search
  const handleCreateCustomTable = async () => {
    if (!user || !newTableName.trim()) return;

    setIsCreatingTable(true);
    try {
      await createCustomTable({
        userId: user.uid,
        name: newTableName.trim(),
        titleKeywords: titleTags,
        locationKeywords: locationTags,
        companyFilter: companyFilter,
        selectedPlatforms: [], // Always use all platforms for scalability
      });

      setSaveToTableModalOpen(false);
      setNewTableName("");
      alert("Custom table created successfully!");
    } catch (error) {
      console.error("Error creating custom table:", error);
      alert("Failed to create custom table. Please try again.");
    } finally {
      setIsCreatingTable(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  const start = data.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(data.total, start + data.items.length - 1);

  const searchSummary = useMemo(() => {
    const parts: string[] = [];
    if (titleTags.length > 0) {
      parts.push(`Titles: ${titleTags.join(" + ")}`);
    }
    if (locationTags.length > 0) {
      parts.push(`Locations: ${locationTags.join(" + ")}`);
    }
    return parts.join(" • ");
  }, [titleTags, locationTags]);

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900" style={{ height: '100dvh' }}>
      {/* Header */}
      <header className="flex-none border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 lg:px-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.svg"
              alt="InternAtlas"
              width={160}
              height={40}
              priority
              className="h-8 md:h-10 w-auto"
            />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Learn More Link */}
            <a
              href="/about"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/40 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why InternAtlas?
            </a>
            
            <span className="hidden sm:inline text-xs md:text-sm text-slate-500 dark:text-slate-400">
              Updated {formatRelativeTime(lastUpdatedAt)}
            </span>
            
            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <AuthButton />
            
            {/* Menu Button */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 lg:px-6">
          {/* Search Filters Toggle */}
          <div className="flex items-center justify-between mb-3">
            {/* Mobile Toggle */}
            <button
              type="button"
              onClick={() => setMobileSearchExpanded(!mobileSearchExpanded)}
              className="md:hidden flex items-center justify-between w-full text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              <span>Search Filters</span>
              <svg 
                className={`h-5 w-5 transition-transform ${mobileSearchExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Desktop Toggle */}
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
            >
              <svg 
                className={`h-5 w-5 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span>{filtersExpanded ? 'Hide' : 'Show'} Filters</span>
            </button>
          </div>

          <div className={`flex flex-wrap items-start gap-2 md:gap-3 transition-all ${mobileSearchExpanded ? '' : 'hidden'} ${filtersExpanded ? 'md:flex' : 'md:hidden'}`}>
            <div className="flex flex-1 flex-wrap md:flex-nowrap items-start gap-2 min-w-0">
              <div className="relative flex-1 md:flex-[2] min-w-[180px]">
                {showLimitWarning.show && showLimitWarning.type === 'title' && (
                  <div className="absolute -top-10 left-0 right-0 z-10 animate-fade-in">
                    <div className="bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
                      Limited to 5 search terms
                    </div>
                  </div>
                )}
                <TagInput
                  tags={titleTags}
                  onTagsChange={(newTags) => {
                    if (newTags.length > 5) {
                      setShowLimitWarning({show: true, type: 'title'});
                      setTimeout(() => setShowLimitWarning({show: false, type: null}), 2000);
                      return;
                    }
                    setTitleTags(newTags);
                  }}
                  placeholder='Job titles (Press "Enter" to add)'
                  className="flex-1 md:flex-[2] min-w-[180px]"
                />
              </div>
              <input
                className="h-10 w-full md:w-32 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-teal-300 focus:bg-white dark:focus:bg-slate-600 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900"
                placeholder="Company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchJobs(1)}
              />
              <div className="relative flex-1 min-w-[180px]">
                {showLimitWarning.show && showLimitWarning.type === 'location' && (
                  <div className="absolute -top-10 left-0 right-0 z-10 animate-fade-in">
                    <div className="bg-amber-500 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
                      Limited to 5 search terms
                    </div>
                  </div>
                )}
                <TagInput
                  tags={locationTags}
                  onTagsChange={(newTags) => {
                    if (newTags.length > 5) {
                      setShowLimitWarning({show: true, type: 'location'});
                      setTimeout(() => setShowLimitWarning({show: false, type: null}), 2000);
                      return;
                    }
                    setLocationTags(newTags);
                  }}
                  placeholder='Locations (Press "Enter" to add)'
                  className="flex-1 min-w-[180px]"
                  icon="location"
                />
              </div>
            </div>
            <div className="flex w-full md:w-auto gap-2">
              <button
                type="button"
                className="h-10 flex-1 md:flex-none rounded-lg bg-teal-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed relative"
                onClick={() => fetchJobs(1)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </span>
                ) : (
                  "Search"
                )}
              </button>
              <div className="relative group">
                {!user && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    Login to use AI tool Cartographer
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                  </div>
                )}
                <Cartographer onApplySuggestions={handleCartographerSuggestions} disabled={!user} />
              </div>
              {user && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setSaveToTableModalOpen(true)}
                    disabled={titleTags.length === 0 && locationTags.length === 0 && !companyFilter}
                    className="h-10 flex-1 md:flex-none rounded-lg border border-teal-600 text-teal-600 dark:border-teal-500 dark:text-teal-400 px-4 text-sm font-medium transition hover:bg-teal-50 dark:hover:bg-teal-900/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title="Save current search terms to a custom table"
                  >
                    <span className="hidden sm:inline">Add to Custom Table</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  {titleTags.length === 0 && locationTags.length === 0 && !companyFilter && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      No terms searched for
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Filter Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Status Filter Dropdown */}
            <div className="relative">
              <select
                className={`h-8 appearance-none rounded-full pl-3 pr-8 text-sm font-medium transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 ${
                  statusFilter === "open"
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400"
                    : statusFilter === "closed"
                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                }`}
                value={statusFilter}
                onChange={(e) => {
                  const newStatus = e.target.value as StatusFilter;
                  setStatusFilter(newStatus);
                  fetchJobs(1, { overrideState: { statusFilter: newStatus } });
                }}
              >
                <option value="open">● Open Jobs</option>
                <option value="closed">● Closed Jobs</option>
                <option value="both">● All Jobs</option>
              </select>
              <svg className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-current opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-600" />
            
            {/* ATS Multi-Select Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPlatformsDropdownOpen(!platformsDropdownOpen)}
                className="h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 pr-8 text-sm text-slate-600 dark:text-slate-300 outline-none transition hover:bg-slate-50 dark:hover:bg-slate-600 focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 flex items-center gap-2"
              >
                <span>Select ATS</span>
                {selectedPlatforms.length < ATS_PLATFORMS.length && (
                  <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-xs font-medium rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-400">
                    {selectedPlatforms.length}
                  </span>
                )}
              </button>
              <svg className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none text-slate-600 dark:text-slate-300 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              
              {platformsDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setPlatformsDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 py-1 shadow-lg">
                    {ATS_PLATFORMS.map((platform) => {
                      const isSelected = selectedPlatforms.includes(platform.value);
                      return (
                        <button
                          key={platform.value}
                          type="button"
                          onClick={() => {
                            const newPlatforms = isSelected
                              ? selectedPlatforms.filter(p => p !== platform.value)
                              : [...selectedPlatforms, platform.value];
                            
                            // Prevent deselecting all
                            if (newPlatforms.length === 0) return;
                            
                            setSelectedPlatforms(newPlatforms);
                            fetchJobs(1, { overrideState: { selectedPlatforms: newPlatforms } });
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-600"
                        >
                          <div className={`flex h-4 w-4 items-center justify-center rounded border ${
                            isSelected
                              ? "border-teal-500 bg-teal-500"
                              : "border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-600"
                          }`}>
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span>{platform.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            <div className="h-5 w-px bg-slate-200 dark:bg-slate-600" />
            
            <select
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-sm text-slate-600 dark:text-slate-300 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900"
              value={sortOption.label}
              onChange={(e) => {
                const next = SORT_OPTIONS.find((opt) => opt.label === e.target.value) ?? SORT_OPTIONS[0];
                setSortOption(next);
                fetchJobs(1, { overrideState: { sortOption: next } });
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.label}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Page Size Dropdown */}
            <select
              className="h-8 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-sm text-slate-600 dark:text-slate-300 outline-none transition focus:border-teal-300 focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPageSize(newSize);
                fetchJobs(1, { overrideState: { pageSize: newSize } });
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>

            {/* Bulk Mode Toggle - Only show when logged in */}
            {user && (
              <button
                type="button"
                onClick={() => {
                  setBulkMode(!bulkMode);
                  if (bulkMode) setSelectedJobs(new Set());
                }}
                className={`hidden md:inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
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
            )}

            {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
                className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
                Clear filters
            </button>
            )}
            
            {searchSummary && (
              <span className="hidden md:inline text-sm text-slate-500 dark:text-slate-400">
                {searchSummary}
              </span>
            )}
          </div>
        </div>

        {/* Bulk Mode Actions Bar */}
        {bulkMode && selectedJobs.size > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 bg-teal-50 dark:bg-teal-900/30 px-4 py-2 lg:px-6">
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
      </header>

      {/* Error Banner */}
      {error && (
        <div className="flex-none bg-red-50 dark:bg-red-900/30 border-b border-red-100 dark:border-red-900 px-4 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left Pane - Job List */}
        <div className="flex w-full md:w-[400px] lg:w-[440px] flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {/* Results Header */}
          <div className="flex-none border-b border-slate-100 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {data.total.toLocaleString()} jobs
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {start}–{end}
              </span>
            </div>
          </div>

          {/* Job List */}
          <div ref={jobListRef} className="flex-1 overflow-y-auto">
            {isLoading && data.items.length === 0 ? (
              // Skeleton loading state with progress indicator
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
            ) : data.items.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
                  <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No jobs found</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">Try adjusting your search filters</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTitleTags(["Software Engineer"]);
                      fetchJobs(1, { overrideState: { titleTags: ["Software Engineer"] } });
                    }}
                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Software Engineer
                  </button>
              <button
                type="button"
                    onClick={() => {
                      setTitleTags(["Intern"]);
                      fetchJobs(1, { overrideState: { titleTags: ["Intern"] } });
                    }}
                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Intern
              </button>
              <button
                type="button"
                    onClick={() => {
                      setTitleTags(["Data Science"]);
                      fetchJobs(1, { overrideState: { titleTags: ["Data Science"] } });
                    }}
                    className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Data Science
              </button>
            </div>
          </div>
            ) : (
              data.items.map((job, index) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => handleJobClick(job, index)}
                  bulkMode={bulkMode}
                  isChecked={selectedJobs.has(job.id)}
                  onCheck={(checked) => handleJobCheck(job.id, checked)}
                  index={index}
                  savedStatus={trackedJobs.get(job.id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="flex-none border-t border-slate-100 dark:border-slate-700 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => fetchJobs(page - 1)}
                disabled={page <= 1 || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Prev
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => fetchJobs(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Next
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Pane - Job Details (hidden on mobile) */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          {isLoading && !selectedJob ? (
            <JobDetailSkeleton />
          ) : (
            <JobDetailPanel 
              job={selectedJob}
              onAddToApply={handleAddToApply}
              onAddToApplied={handleAddToApplied}
            />
          )}
        </div>
      </main>

      {/* Mobile Detail Sheet */}
      {mobileDetailOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 menu-backdrop md:hidden"
            onClick={() => setMobileDetailOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
            <JobDetailPanel 
              job={selectedJob}
              onAddToApply={handleAddToApply}
              onAddToApplied={handleAddToApplied}
              onClose={() => setMobileDetailOpen(false)}
              isMobile
            />
          </div>
        </>
      )}

      {/* Slide-in Menu */}
      {menuOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 menu-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white dark:bg-slate-800 shadow-2xl animate-slide-in-right">
            <div className="flex h-full flex-col">
              {/* Menu Header */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Menu</h2>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto py-4">
                {/* Navigation Links - Primary */}
                <nav className="px-4 space-y-1 mb-4">
                  {user ? (
                    <>
                      <a
                        href="/custom-tables"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium">Custom Tables</span>
                      </a>
                      <a
                        href="/tracking"
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="font-medium">Application Tracking</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="font-medium">Custom Tables</span>
                          <span className="text-xs">Sign in to use</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="font-medium">Application Tracking</span>
                          <span className="text-xs">Sign in to use</span>
                        </div>
                      </div>
                    </>
                  )}
                </nav>

                <div className="h-px bg-slate-200 dark:bg-slate-700 mx-4 mb-4" />

                {/* Secondary Links */}
                <nav className="px-4 space-y-1">
                  {/* Why InternAtlas */}
                  <a
                    href="/about"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">Why InternAtlas?</span>
                  </a>
                  
                  {/* Theme Toggle */}
                  <button
                    type="button"
                    onClick={toggleDarkMode}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    {darkMode ? (
                      <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                    )}
                    <span className="text-sm text-slate-700 dark:text-slate-200">
                      {darkMode ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>
                  
                  <a
                    href="/admin"
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm">Admin</span>
                  </a>
                </nav>

                <div className="h-px bg-slate-200 dark:bg-slate-700 mx-4 my-4" />

                {/* Keyboard Shortcuts */}
                <div className="px-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Keyboard Shortcuts
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Navigate jobs</span>
                      <div className="flex gap-1">
                        <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-xs">↑</kbd>
                        <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-xs">↓</kbd>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Open job</span>
                      <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Enter</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Close panel</span>
                      <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-xs">Esc</kbd>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Bulk mode</span>
                      <kbd className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 font-mono text-xs">B</kbd>
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu Footer */}
              <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-4">
                <button
                  type="button"
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                >
                  Sign in for more features
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add to Custom Table Modal */}
      {saveToTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSaveToTableModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-white">Save Search as Custom Table</h2>
              
              {/* Table Name Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Table Name
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g., Software Engineering Internships 2025"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Current Search Terms Display */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Current Search Terms:</h3>
                
                {titleTags.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Job Titles:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {titleTags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {locationTags.length > 0 && (
                  <div className="mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Locations:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {locationTags.map((tag, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {companyFilter && (
                  <div className="mb-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Company:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm">
                        {companyFilter}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Note:</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Custom tables automatically search across all ATS platforms for maximum coverage.</p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSaveToTableModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                  disabled={isCreatingTable}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCustomTable}
                  disabled={isCreatingTable || !newTableName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTable ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
