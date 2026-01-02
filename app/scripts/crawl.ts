import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  created_at: string;
  updated_at: string;
  content?: string;
};

type LeverJob = {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
};

type WorkdayJob = {
  jobId?: string;
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  postedOnDate?: string;
  bulletFields?: Array<{ label?: string; value?: string }>;
  jobReqId?: string;
};

type Company = {
  id: string;
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "ICIMS" | "CUSTOM";
  boardUrl: string;
  firstCrawledAt: Date | null;
};

type NormalizedJob = {
  companyName: string;
  externalId: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  jobUrl: string;
  descriptionText?: string | null;
};

function getGreenhouseSlug(boardUrl: string): string {
  const url = new URL(boardUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid Greenhouse board URL: ${boardUrl}`);
  }
  return parts[0];
}

async function fetchGreenhouseJobs(boardUrl: string): Promise<GreenhouseJob[]> {
  const slug = getGreenhouseSlug(boardUrl);
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`);
  }

  const data = (await res.json()) as { jobs: GreenhouseJob[] };
  return data.jobs ?? [];
}

function normalizeGreenhouseJob(
  companyName: string,
  job: GreenhouseJob
): NormalizedJob {
  return {
    companyName,
    externalId: String(job.id),
    title: job.title,
    location: job.location?.name ?? null,
    postedAt: job.created_at ?? null,
    jobUrl: job.absolute_url,
    descriptionText: job.content ?? null,
  };
}

function getLeverSlug(boardUrl: string): string {
  const url = new URL(boardUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid Lever board URL: ${boardUrl}`);
  }
  return parts[0];
}

async function fetchLeverJobs(boardUrl: string): Promise<LeverJob[]> {
  const slug = getLeverSlug(boardUrl);
  const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`);
  }

  const data = (await res.json()) as LeverJob[];
  return data ?? [];
}

function normalizeLeverJob(companyName: string, job: LeverJob): NormalizedJob {
  const postedAt =
    typeof job.createdAt === "number"
      ? new Date(job.createdAt).toISOString()
      : null;
  return {
    companyName,
    externalId: job.id,
    title: job.text,
    location: job.categories?.location ?? null,
    postedAt,
    jobUrl: job.hostedUrl ?? job.applyUrl ?? "",
    descriptionText: job.description ?? null,
  };
}

type WorkdayParams = {
  origin: string;
  tenant: string;
  site: string;
  locale?: string;
};

const workdaySiteCache = new Map<string, WorkdayParams>();

function getWorkdayParams(boardUrl: string): WorkdayParams {
  const url = new URL(boardUrl);
  const hostParts = url.hostname.split(".").filter(Boolean);
  const tenant = hostParts.length > 0 ? hostParts[0] : "";
  if (!tenant) {
    throw new Error(`Invalid Workday board URL (missing tenant): ${boardUrl}`);
  }
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length === 0) {
    throw new Error(`Invalid Workday board URL (missing site): ${boardUrl}`);
  }
  const locale =
    /^[a-z]{2}-[A-Z]{2}$/.test(pathParts[0]) ? pathParts[0] : undefined;
  let site = pathParts[0];
  if (/^[a-z]{2}-[A-Z]{2}$/.test(pathParts[0]) && pathParts.length > 1) {
    site = pathParts[1];
  }
  if (!site) {
    throw new Error(`Invalid Workday board URL (missing site): ${boardUrl}`);
  }
  return { origin: url.origin, tenant, site, locale };
}

async function discoverWorkdaySite(boardUrl: string): Promise<WorkdayParams> {
  const cached = workdaySiteCache.get(boardUrl);
  if (cached) {
    return cached;
  }
  const url = new URL(boardUrl);
  const hostParts = url.hostname.split(".").filter(Boolean);
  const tenant = hostParts.length > 0 ? hostParts[0] : "";
  if (!tenant) {
    throw new Error(`Invalid Workday board URL (missing tenant): ${boardUrl}`);
  }

  const res = await fetch(boardUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${boardUrl}: ${res.status}`);
  }
  const html = await res.text();

  // Extract site from job links (the canonical source)
  // Pattern: /{locale}/{site}/job/{location}/{title}_{id}
  // or: /{locale}/{site}/details/{title}_{id}
  const jobLinkPatterns = [
    /\/([a-z]{2}[-_][A-Z]{2})\/([^/]+)\/job\//g,
    /\/([a-z]{2}[-_][A-Z]{2})\/([^/]+)\/details\//g,
    /href=["']\/([a-z]{2}[-_][A-Z]{2})\/([^/]+)\/job\//g,
    /href=["']\/([a-z]{2}[-_][A-Z]{2})\/([^/]+)\/details\//g,
  ];

  let locale: string | undefined;
  let site: string | undefined;

  // Try to extract from job links (most reliable)
  for (const pattern of jobLinkPatterns) {
    const matches = Array.from(html.matchAll(pattern));
    if (matches.length > 0) {
      const match = matches[0];
      locale = match[1].replace("_", "-");
      site = match[2];
      break;
    }
  }

  // Fallback: try JSON-embedded site IDs (common in Workday HTML)
  if (!site) {
    const siteIdMatch =
      html.match(/siteId:\s*"([^"]+)"/) ??
      html.match(/"siteId"\s*:\s*"([^"]+)"/) ??
      html.match(/"careerSiteId"\s*:\s*"([^"]+)"/);
    if (siteIdMatch) {
      site = siteIdMatch[1];
    }
  }

  if (!site) {
    throw new Error(`Workday site slug not found in board HTML for ${boardUrl}`);
  }

  // Default to en-US if no locale found
  if (!locale) {
    locale = "en-US";
  }

  const params = { origin: url.origin, tenant, site, locale };
  workdaySiteCache.set(boardUrl, params);
  return params;
}

function buildWorkdayJobUrl(boardUrl: string, externalPath?: string): string {
  if (!externalPath) {
    return boardUrl;
  }
  if (externalPath.startsWith("http")) {
    return externalPath;
  }
  const normalizedPath = externalPath.startsWith("/")
    ? externalPath
    : `/${externalPath}`;
  const url = new URL(boardUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const basePath = `/${pathParts.join("/")}`.replace(/\/+$/, "");
  const basePathLower = basePath.toLowerCase();
  const locale =
    pathParts.length > 0 && /^[a-z]{2}-[A-Z]{2}$/.test(pathParts[0])
      ? pathParts[0]
      : "";
  const siteSegment =
    locale && pathParts.length > 1 ? pathParts[1] : pathParts[0] ?? "";
  const siteLower = siteSegment.toLowerCase();
  const pathLower = normalizedPath.toLowerCase();
  const hasSite =
    siteLower &&
    (pathLower === `/${siteLower}` ||
      pathLower.startsWith(`/${siteLower}/`));
  const hasLocale = /^\/[a-z]{2}-[A-Z]{2}\//.test(normalizedPath);

  if (
    hasSite ||
    hasLocale ||
    (basePathLower && pathLower.startsWith(basePathLower))
  ) {
    return `${url.origin}${normalizedPath}`;
  }
  if (basePath) {
    return `${url.origin}${basePath}${normalizedPath}`;
  }
  if (siteSegment) {
    return `${url.origin}/${siteSegment}${normalizedPath}`;
  }
  return `${url.origin}${normalizedPath}`;
}

function getWorkdayCanonicalId(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const underscored = value.match(/R\d{2}_\d{4,}/g);
  if (underscored && underscored.length > 0) {
    return underscored[underscored.length - 1];
  }
  const plain = value.match(/R\d{4,}/g);
  if (plain && plain.length > 0) {
    return plain[plain.length - 1];
  }
  return null;
}

function getWorkdayExternalId(job: WorkdayJob): string | null {
  if (job.jobReqId) {
    return job.jobReqId;
  }
  if (!job.externalPath) {
    return null;
  }
  const canonical = getWorkdayCanonicalId(job.externalPath);
  if (canonical) {
    return canonical;
  }
  return job.externalPath;
}

async function mergeWorkdayDuplicates(companyId: string) {
  const jobs = await prisma.job.findMany({
    where: { companyId, sourcePlatform: "WORKDAY" },
    select: {
      id: true,
      externalId: true,
      jobUrl: true,
      status: true,
      lastSeenAt: true,
      updatedAt: true,
    },
  });

  const groups = new Map<string, typeof jobs>();
  for (const job of jobs) {
    const canonical =
      getWorkdayCanonicalId(job.externalId) ??
      getWorkdayCanonicalId(job.jobUrl) ??
      null;
    if (!canonical) {
      continue;
    }
    const group = groups.get(canonical);
    if (group) {
      group.push(job);
    } else {
      groups.set(canonical, [job]);
    }
  }

  for (const [canonicalId, group] of groups) {
    if (group.length < 2) {
      continue;
    }
    const sorted = [...group].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "ACTIVE" ? -1 : 1;
      }
      if (a.lastSeenAt.getTime() !== b.lastSeenAt.getTime()) {
        return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
      }
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });
    const keeper = sorted[0];
    const duplicates = sorted.slice(1);
    const shouldBeActive = group.some((job) => job.status === "ACTIVE");
    const maxLastSeenAt = group.reduce(
      (latest, job) =>
        job.lastSeenAt.getTime() > latest.getTime() ? job.lastSeenAt : latest,
      group[0].lastSeenAt
    );
    const jobUrl =
      keeper.jobUrl ??
      group.find((job) => Boolean(job.jobUrl))?.jobUrl ??
      null;

    await prisma.$transaction([
      prisma.job.deleteMany({
        where: { id: { in: duplicates.map((job) => job.id) } },
      }),
      prisma.job.update({
        where: { id: keeper.id },
        data: {
          externalId: canonicalId,
          status: shouldBeActive ? "ACTIVE" : keeper.status,
          lastSeenAt: maxLastSeenAt,
          ...(jobUrl ? { jobUrl } : {}),
        },
      }),
    ]);
  }
}

function getWorkdayLocation(job: WorkdayJob): string | null {
  if (job.locationsText) {
    return job.locationsText;
  }
  const locationField = job.bulletFields?.find((field) => {
    const label = field.label?.toLowerCase() ?? "";
    return label === "location" || label === "locations";
  });
  return locationField?.value ?? null;
}

function getWorkdayPostedAt(job: WorkdayJob): string | null {
  if (job.postedOnDate) {
    const parsed = new Date(job.postedOnDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  if (job.postedOn) {
    const parsed = new Date(job.postedOn);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

async function fetchWorkdayJobs(boardUrl: string, debug = false): Promise<WorkdayJob[]> {
  const { origin, tenant, site } = await discoverWorkdaySite(boardUrl);
  
  if (debug) {
    console.log(`  [DEBUG] Discovered: tenant=${tenant}, site=${site}`);
  }

  const apiUrl = `${origin}/wday/cxs/${tenant}/${site}/jobs`;
  
  if (debug) {
    console.log(`  [DEBUG] API URL: ${apiUrl}`);
  }

  const jobs: WorkdayJob[] = [];
  const limit = 20;
  let offset = 0;

  // Use the minimal headers from the working Reddit example
  const headers = {
    'accept': 'application/json',
    'accept-language': 'en-US',
    'content-type': 'application/json',
    'origin': origin,
    'referer': boardUrl,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  };

  while (true) {
    const payload = {
      appliedFacets: {},
      limit,
      offset,
      searchText: "",
    };

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (debug) {
          const errorText = await response.text();
          console.log(`  [DEBUG] Error ${response.status}: ${errorText.substring(0, 200)}`);
        }
        break;
      }

      const data = await response.json();
      const jobPostings = data.jobPostings || [];

      if (jobPostings.length === 0) {
        break;
      }

      if (debug && offset === 0 && jobPostings.length > 0) {
        console.log(`  [DEBUG] Sample job keys:`, Object.keys(jobPostings[0]).join(', '));
      }

      jobs.push(...jobPostings);
      
      if (debug && jobs.length % 100 === 0) {
        console.log(`  [DEBUG] Fetched ${jobs.length} jobs so far...`);
      }

      // Check if we've reached the total
      if (data.total && jobs.length >= data.total) {
        break;
      }

      offset += limit;
    } catch (error) {
      if (debug) {
        console.log(`  [DEBUG] Fetch error: ${error}`);
      }
      break;
    }
  }

  if (debug) {
    console.log(`  [DEBUG] Total jobs fetched: ${jobs.length}`);
  }

  return jobs;
}

async function workdaySearchById(
  boardUrl: string,
  id: string,
  debug = false
): Promise<boolean> {
  const { origin, tenant, site } = await discoverWorkdaySite(boardUrl);
  const apiUrl = `${origin}/wday/cxs/${tenant}/${site}/jobs`;
  const headers = {
    accept: "application/json",
    "accept-language": "en-US",
    "content-type": "application/json",
    origin,
    referer: boardUrl,
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  };
  const payload = {
    appliedFacets: {},
    limit: 5,
    offset: 0,
    searchText: id,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (debug) {
        const errorText = await response.text();
        console.log(
          `  [DEBUG] Workday search ${response.status} for ${id}: ${errorText.substring(0, 120)}`
        );
      }
      return false;
    }
    const data = await response.json();
    const jobPostings = data.jobPostings || [];
    return jobPostings.some((job: WorkdayJob) => {
      const externalId = getWorkdayExternalId(job);
      return (
        (externalId && externalId === id) ||
        (job.externalPath && job.externalPath.includes(id))
      );
    });
  } catch (error) {
    if (debug) {
      console.log(`  [DEBUG] Workday search error for ${id}: ${error}`);
    }
    return false;
  }
}

function normalizeWorkdayJob(
  companyName: string,
  boardUrl: string,
  job: WorkdayJob
): NormalizedJob | null {
  const externalId = getWorkdayExternalId(job) ?? "";
  if (!externalId) {
    return null;
  }
  const title = job.title?.trim() ?? "";
  if (!title) {
    return null;
  }
  return {
    companyName,
    externalId,
    title,
    location: getWorkdayLocation(job),
    postedAt: getWorkdayPostedAt(job),
    jobUrl: buildWorkdayJobUrl(boardUrl, job.externalPath),
    // NOTE: Workday list API doesn't include descriptions
    // Would require fetching each job page individually (very slow)
    descriptionText: null,
  };
}

function getSupportedCompanies(companies: Company[]): Company[] {
  return companies.filter(
    (company) =>
      company.platform === "GREENHOUSE" ||
      company.platform === "LEVER" ||
      company.platform === "WORKDAY"
  );
}

async function main() {
  const startedAt = Date.now();
  
  // Setup logging
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const logFilePath = path.join(logsDir, `crawl-${timestamp}.log`);
  const logStream = fs.createWriteStream(logFilePath, { flags: "a" });
  
  // Override console.log to write to both stdout and log file
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: any[]) => {
    const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
    originalLog(...args);
    logStream.write(message + "\n");
  };
  console.error = (...args: any[]) => {
    const message = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg)).join(" ");
    originalError(...args);
    logStream.write("ERROR: " + message + "\n");
  };
  
  const keywordArg = process.argv.find((arg) => arg.startsWith("--keyword="));
  const keyword = keywordArg
    ? keywordArg.replace("--keyword=", "").trim().toLowerCase()
    : "";
  const companyArg = process.argv.find((arg) => arg.startsWith("--company="));
  const companyFilters = companyArg
    ? companyArg
        .replace("--company=", "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : [];
  const atsArg = process.argv.find((arg) => arg.startsWith("--ats="));
  const atsFilter = atsArg
    ? atsArg
        .replace("--ats=", "")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    : [];
  const debugMode = process.argv.includes("--debug");
  const newOnlyMode =
    process.argv.includes("--new-only") || process.argv.includes("--new");
  const workdayVerifyDisabled = process.argv.includes("--no-workday-verify");
  const workdayRepairMode = process.argv.includes("--repair-workday");
  const workdayVerifyEnabled = !workdayVerifyDisabled;
  
  console.log(`Log file: ${logFilePath}`);
  
  const companiesFromDb = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      platform: true,
      boardUrl: true,
      firstCrawledAt: true,
    },
  } as any);
  
  const companies: Company[] = companiesFromDb.map((c) => ({
    id: c.id,
    name: c.name,
    platform: c.platform as Company["platform"],
    boardUrl: c.boardUrl,
    firstCrawledAt: (c as { firstCrawledAt?: Date | null }).firstCrawledAt ?? null,
  }));
  
  let supportedCompanies = getSupportedCompanies(companies);
  
  // Filter for companies that have never been crawled
  if (newOnlyMode) {
    supportedCompanies = supportedCompanies.filter(
      (company) => !company.firstCrawledAt
    );
    console.log(`Filtering for new companies only: ${supportedCompanies.length} companies`);
  }
  
  if (atsFilter.length > 0) {
    const allowed = new Set(atsFilter);
    supportedCompanies = supportedCompanies.filter((company) =>
      allowed.has(company.platform)
    );
  }
  if (workdayRepairMode) {
    supportedCompanies = supportedCompanies.filter(
      (company) => company.platform === "WORKDAY"
    );
  }
  if (companyFilters.length > 0) {
    supportedCompanies = supportedCompanies.filter((company) =>
      companyFilters.some((filter) =>
        company.name.toLowerCase().includes(filter)
      )
    );
  }

  if (supportedCompanies.length === 0) {
    console.log("No Greenhouse, Lever, or Workday companies found.");
    return;
  }

  let totalJobs = 0;
  let totalCreated = 0;
  let totalCreatedFromExistingCompanies = 0;
  let totalCreatedFromNewCompanies = 0;
  let totalNewCompanies = 0;
  let totalExistingCompanies = 0;
  let totalWorking = 0;
  let totalBroken = 0;
  let totalNewClosed = 0;
  let totalCurrentlyClosed = 0;
  const jobsFoundByPlatform = new Map<string, number>();
  const jobsCreatedByPlatform = new Map<string, number>();
  const jobsClosedByPlatform = new Map<string, number>();
  const companiesByPlatform = new Map<string, number>();
  const nameColumnWidth = Math.min(
    50, // Cap at 50 characters max
    Math.max(
      12,
      ...supportedCompanies.map((company) => company.name.length + 2)
    )
  );
  const atsColumnWidth = Math.max(
    5,
    ...supportedCompanies.map((company) => company.platform.length + 2)
  );

  console.log(
    `${"Company".padEnd(nameColumnWidth)}ATS${" ".repeat(
      Math.max(1, atsColumnWidth - 3)
    )}Status        Total Jobs     New Jobs       Total Closed   New Closed`
  );

  for (const company of supportedCompanies) {
    try {
      const isNewCompany = !company.firstCrawledAt;
      if (isNewCompany) {
        // Mark as seen so subsequent runs treat it as OLD, even if inserts fail
        await prisma.company.update({
          where: { id: company.id },
          data: { firstCrawledAt: new Date() } as any,
        });
      }

      let normalized: NormalizedJob[] = [];
      let workdayJobs: WorkdayJob[] | null = null;
      if (company.platform === "GREENHOUSE") {
        const jobs = await fetchGreenhouseJobs(company.boardUrl);
        normalized = jobs.map((job) => normalizeGreenhouseJob(company.name, job));
      } else if (company.platform === "LEVER") {
        const jobs = await fetchLeverJobs(company.boardUrl);
        normalized = jobs
          .map((job) => normalizeLeverJob(company.name, job))
          .filter((job) => job.jobUrl);
      } else if (company.platform === "WORKDAY") {
        workdayJobs = await fetchWorkdayJobs(company.boardUrl, debugMode);
        normalized = workdayJobs
          .map((job) => normalizeWorkdayJob(company.name, company.boardUrl, job))
          .filter((job): job is NormalizedJob => Boolean(job && job.jobUrl));
      } else {
        console.log(`${company.name}: unsupported ATS (${company.platform})`);
        continue;
      }

      const normalizedAll = normalized;
      let normalizedForCreate = normalizedAll;
      if (keyword) {
        normalizedForCreate = normalizedAll.filter((job) => {
          const haystack = `${job.title} ${job.descriptionText ?? ""}`.toLowerCase();
          return haystack.includes(keyword);
        });
      }

      // Fetch ALL jobs for this company (including CLOSED ones)
      // This allows us to reactivate jobs that were wrongly marked as closed
      const existingJobs = await prisma.job.findMany({
        where: { 
          companyId: company.id, 
          sourcePlatform: company.platform,
          // ✅ Removed status filter - fetch ALL jobs
        },
        select: { id: true, externalId: true, status: true, jobUrl: true },
      });
      const closedBeforeCount = existingJobs.filter(
        (job) => job.status === "CLOSED"
      ).length;
      const existingJobsWithMatchId =
        company.platform === "WORKDAY"
          ? existingJobs.map((job) => ({
              ...job,
              matchExternalId:
                getWorkdayCanonicalId(job.externalId) ??
                getWorkdayCanonicalId(job.jobUrl) ??
                job.externalId ??
                null,
            }))
          : existingJobs.map((job) => ({
              ...job,
              matchExternalId: job.externalId ?? null,
            }));
      
      let newJobsForCompany = 0;

      // Get current job IDs from the board
      const currentExternalIds = new Set(
        (company.platform === "WORKDAY" && workdayJobs
          ? workdayJobs
              .flatMap((job) => {
                const ids = new Set<string>();
                const externalId = getWorkdayExternalId(job);
                if (externalId) {
                  ids.add(externalId);
                }
                if (job.externalPath) {
                  ids.add(job.externalPath);
                }
                const jobUrl = buildWorkdayJobUrl(
                  company.boardUrl,
                  job.externalPath
                );
                const canonicalFromUrl = getWorkdayCanonicalId(jobUrl);
                if (canonicalFromUrl) {
                  ids.add(canonicalFromUrl);
                }
                return Array.from(ids);
              })
              .filter((id): id is string => Boolean(id))
          : normalizedAll
              .map((job) => job.externalId)
              .filter((id): id is string => Boolean(id)))
      );
      const createExternalIds = new Set(
        normalizedForCreate
          .map((job) => job.externalId)
          .filter((id): id is string => Boolean(id))
      );
      const existingJobsByExternalId = new Map(
        existingJobsWithMatchId
          .map((job) => [job.matchExternalId, job] as const)
          .filter(([externalId]) => Boolean(externalId))
      );

      let newClosedJobsForCompany = 0;
      if (company.platform === "WORKDAY") {
        // Close everything up front, then reactivate only what we see on the board.
        await prisma.job.updateMany({
          where: { companyId: company.id, sourcePlatform: "WORKDAY" },
          data: { status: "CLOSED" },
        });

        const normalizedByExternalId = new Map(
          normalizedAll.map((job) => [job.externalId, job] as const)
        );
        const activatedIds = new Set<string>();

        for (const job of normalizedAll) {
          const candidateIds = new Set<string>();
          if (job.externalId) {
            candidateIds.add(job.externalId);
          }
          const canonicalFromUrl = getWorkdayCanonicalId(job.jobUrl);
          if (canonicalFromUrl) {
            candidateIds.add(canonicalFromUrl);
          }

          const existingJob = Array.from(candidateIds)
            .map((candidate) => existingJobsByExternalId.get(candidate))
            .find(Boolean);

          if (existingJob) {
            const activeExternalId =
              Array.from(candidateIds).find(
                (candidate) => candidate === existingJob.matchExternalId
              ) ?? existingJob.matchExternalId;
          const updateData: Record<string, any> = {
            lastSeenAt: new Date(),
            status: "ACTIVE",
          };
          if (activeExternalId && existingJob.externalId !== activeExternalId) {
            const conflict = await prisma.job.findFirst({
              where: {
                sourcePlatform: company.platform,
                externalId: activeExternalId,
                id: { not: existingJob.id },
              },
              select: { id: true },
            });
            if (!conflict) {
              updateData.externalId = activeExternalId;
            }
          }
            await prisma.job.update({
              where: { id: existingJob.id },
              data: updateData,
            });
            activatedIds.add(existingJob.matchExternalId ?? job.externalId);
            if (existingJob.status === "CLOSED") {
              newJobsForCompany += 1;
            }
            continue;
          }

          try {
            await prisma.job.create({
              data: {
                companyId: company.id,
                title: job.title,
                location: job.location,
                postedAt: job.postedAt ? new Date(job.postedAt) : null,
                jobUrl: job.jobUrl,
                applyUrl: job.jobUrl,
                descriptionText: job.descriptionText,
                sourcePlatform: company.platform,
                externalId: job.externalId,
                status: "ACTIVE",
              },
            });

            activatedIds.add(job.externalId);
            newJobsForCompany += 1;
            totalCreated += 1;
            jobsCreatedByPlatform.set(
              company.platform,
              (jobsCreatedByPlatform.get(company.platform) ?? 0) + 1
            );
          } catch (error: any) {
            if (
              error?.code !== "P2002" &&
              !error?.message?.includes("Unique constraint failed")
            ) {
              throw error;
            }
          }
        }

        if (workdayVerifyEnabled) {
          const closedJobs = await prisma.job.findMany({
            where: {
              companyId: company.id,
              sourcePlatform: "WORKDAY",
              status: "CLOSED",
            },
            select: { id: true, externalId: true, jobUrl: true, status: true },
          });
          for (const closedJob of closedJobs) {
            const canonical =
              getWorkdayCanonicalId(closedJob.externalId) ??
              getWorkdayCanonicalId(closedJob.jobUrl);
            if (!canonical) {
              continue;
            }
            const found = await workdaySearchById(
              company.boardUrl,
              canonical,
              debugMode
            );
            if (!found) {
              continue;
            }
            await prisma.job.update({
              where: { id: closedJob.id },
              data: { status: "ACTIVE", lastSeenAt: new Date() },
            });
            newJobsForCompany += 1;
          }
        }

        const closedAfterCount = await prisma.job.count({
          where: {
            companyId: company.id,
            sourcePlatform: "WORKDAY",
            status: "CLOSED",
          },
        });
        newClosedJobsForCompany = Math.max(0, closedAfterCount - closedBeforeCount);
        totalNewClosed += newClosedJobsForCompany;
        jobsClosedByPlatform.set(
          company.platform,
          (jobsClosedByPlatform.get(company.platform) ?? 0) +
            newClosedJobsForCompany
        );

        await mergeWorkdayDuplicates(company.id);
      } else {
        // Create or reactivate jobs
        for (const job of normalizedAll) {
          if (!job.externalId) {
            continue;
          }
          const existingJob = existingJobsByExternalId.get(job.externalId);
          if (existingJob) {
            const updateData: Record<string, any> = {
              lastSeenAt: new Date(),
              status: "ACTIVE",
            };
            if (existingJob.externalId !== job.externalId) {
              updateData.externalId = job.externalId;
            }
            await prisma.job.update({
              where: { id: existingJob.id },
              data: updateData,
            });
            if (existingJob.status === "CLOSED") {
              newJobsForCompany += 1;
            }
            continue;
          }

          if (!createExternalIds.has(job.externalId)) {
            continue;
          }

          try {
            await prisma.job.create({
              data: {
                companyId: company.id,
                title: job.title,
                location: job.location,
                postedAt: job.postedAt ? new Date(job.postedAt) : null,
                jobUrl: job.jobUrl,
                applyUrl: job.jobUrl,
                descriptionText: job.descriptionText,
                sourcePlatform: company.platform,
                externalId: job.externalId,
                status: "ACTIVE",
              },
            });

            newJobsForCompany += 1;
            totalCreated += 1;
            jobsCreatedByPlatform.set(
              company.platform,
              (jobsCreatedByPlatform.get(company.platform) ?? 0) + 1
            );
          } catch (error: any) {
            if (
              error?.code !== "P2002" &&
              !error?.message?.includes("Unique constraint failed")
            ) {
              throw error;
            }
          }
        }

        // Deactivate ACTIVE jobs that are no longer on the board
        for (const existingJob of existingJobsWithMatchId) {
          if (
            existingJob.status === "ACTIVE" &&
            existingJob.matchExternalId &&
            !currentExternalIds.has(existingJob.matchExternalId)
          ) {
            await prisma.job.update({
              where: { id: existingJob.id },
              data: { status: "CLOSED" },
            });
            newClosedJobsForCompany += 1;
          }
        }
        totalNewClosed += newClosedJobsForCompany;
        jobsClosedByPlatform.set(
          company.platform,
          (jobsClosedByPlatform.get(company.platform) ?? 0) +
            newClosedJobsForCompany
        );
      }

      totalJobs += normalizedAll.length;
      jobsFoundByPlatform.set(
        company.platform,
        (jobsFoundByPlatform.get(company.platform) ?? 0) + normalizedAll.length
      );
      totalWorking += 1;

      if (newJobsForCompany > 0) {
        if (isNewCompany) {
          totalCreatedFromNewCompanies += newJobsForCompany;
        } else {
          totalCreatedFromExistingCompanies += newJobsForCompany;
        }
      }

      const status = isNewCompany ? "NEW" : "OLD";
      if (isNewCompany) {
        totalNewCompanies += 1;
      } else {
        totalExistingCompanies += 1;
      }
      companiesByPlatform.set(
        company.platform,
        (companiesByPlatform.get(company.platform) ?? 0) + 1
      );
      // Calculate total closed jobs for this company
      const totalClosedJobs = await prisma.job.count({
        where: {
          companyId: company.id,
          sourcePlatform: company.platform,
          status: "CLOSED",
        },
      });
      
      totalCurrentlyClosed += totalClosedJobs;
      
      // Truncate long company names
      const displayName = company.name.length > 48 
        ? company.name.substring(0, 45) + "..." 
        : company.name;
      
      const totalLabel = `Total Jobs:${normalized.length}`;
      const newLabel = `New Jobs:${newJobsForCompany}`;
      const totalClosedLabel = `Total Closed:${totalClosedJobs}`;
      const newClosedLabel = `New Closed:${newClosedJobsForCompany}`;
      console.log(
        `${displayName.padEnd(nameColumnWidth)}${company.platform.padEnd(
          atsColumnWidth
        )}${status.padEnd(7)}${totalLabel.padEnd(15)}${newLabel.padEnd(15)}${totalClosedLabel.padEnd(15)}${newClosedLabel}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalBroken += 1;
      console.error(`${company.name}: error - ${message}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  const avgMsPerJob = totalJobs > 0 ? Math.round(durationMs / totalJobs) : 0;

  console.log("");
  console.log("Crawl summary");
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total companies found        | ${String(
      supportedCompanies.length
    ).padEnd(25)}|`
  );
  console.log(
    `| New companies                | ${String(totalNewCompanies).padEnd(25)}|`
  );
  console.log(
    `| Existing companies           | ${String(
      totalExistingCompanies
    ).padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total jobs found             | ${String(totalJobs).padEnd(25)}|`
  );
  console.log(
    `| Total jobs created           | ${String(totalCreated).padEnd(25)}|`
  );
  console.log(
    `| New jobs from existing co.   | ${String(
      totalCreatedFromExistingCompanies
    ).padEnd(25)}|`
  );
  console.log(
    `| New jobs from new co.        | ${String(
      totalCreatedFromNewCompanies
    ).padEnd(25)}|`
  );
  console.log(
    `| Total jobs currently closed  | ${String(totalCurrentlyClosed).padEnd(25)}|`
  );
  console.log(
    `| Jobs newly closed this crawl | ${String(totalNewClosed).padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total working links          | ${String(totalWorking).padEnd(25)}|`
  );
  console.log(
    `| Total broken links           | ${String(totalBroken).padEnd(25)}|`
  );
  console.log(
    `| Time taken                   | ${`${(durationMs / 1000).toFixed(
      2
    )}s`.padEnd(25)}|`
  );
  console.log(
    `| Estimated time per job       | ${`${avgMsPerJob}ms${
      totalJobs === 0 ? " (n/a)" : ""
    }`.padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );

  if (jobsFoundByPlatform.size > 0) {
    console.log("Jobs by ATS");
    console.log("+------------------------------+---------------------------+");
    const platforms = Array.from(jobsFoundByPlatform.keys()).sort();
    for (const platform of platforms) {
      const found = jobsFoundByPlatform.get(platform) ?? 0;
      const created = jobsCreatedByPlatform.get(platform) ?? 0;
      const closed = jobsClosedByPlatform.get(platform) ?? 0;
      const companies = companiesByPlatform.get(platform) ?? 0;
      const label = `${platform} (found/new/closed/co.)`;
      console.log(
        `| ${label.padEnd(29)}| ${`${found}/${created}/${closed}/${companies}`.padEnd(
          25
        )}|`
      );
    }
    console.log("+------------------------------+---------------------------+");
  }
  
  // Close log stream
  logStream.end();
  // Restore original console methods
  console.log = originalLog;
  console.error = originalError;
  
  // Auto-backup companies to CSV
  await backupCompaniesToCSV();
}

async function backupCompaniesToCSV() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });

    const headers = ["id", "name", "platform", "boardUrl", "createdAt", "updatedAt", "firstCrawledAt"];
    const rows = (companies as Array<
      (typeof companies)[number] & { firstCrawledAt?: Date | null }
    >).map((row) => [
      row.id,
      row.name,
      row.platform,
      row.boardUrl,
      row.createdAt.toISOString(),
      row.updatedAt.toISOString(),
      row.firstCrawledAt ? row.firstCrawledAt.toISOString() : "",
    ]);

    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(escapeCsvField).join(",")),
    ].join("\n");

    const backupDir = path.join(process.cwd(), "data", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const csvPath = path.join(backupDir, "companies.csv");
    fs.writeFileSync(csvPath, csvContent, "utf-8");

    console.log(`✓ Backed up ${companies.length} companies to companies.csv`);
  } catch (error) {
    console.error("Warning: Failed to backup companies:", error);
  }
}

main()
  .catch((error) => {
    console.error(`Crawler failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
