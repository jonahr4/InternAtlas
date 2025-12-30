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
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
  boardUrl: string;
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

function normalizeWorkdayJob(
  companyName: string,
  boardUrl: string,
  job: WorkdayJob
): NormalizedJob | null {
  const externalId = job.jobReqId ?? job.externalPath ?? "";
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
  const atsArg = process.argv.find((arg) => arg.startsWith("--ats="));
  const atsFilter = atsArg
    ? atsArg
        .replace("--ats=", "")
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean)
    : [];
  const debugMode = process.argv.includes("--debug");
  
  console.log(`Log file: ${logFilePath}`);
  
  const companies = (await prisma.company.findMany({
    select: { id: true, name: true, platform: true, boardUrl: true },
  })) as Company[];
  let supportedCompanies = getSupportedCompanies(companies);
  if (atsFilter.length > 0) {
    const allowed = new Set(atsFilter);
    supportedCompanies = supportedCompanies.filter((company) =>
      allowed.has(company.platform)
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
  let totalDeactivated = 0;
  const jobsFoundByPlatform = new Map<string, number>();
  const jobsCreatedByPlatform = new Map<string, number>();
  const jobsDeactivatedByPlatform = new Map<string, number>();
  const companiesByPlatform = new Map<string, number>();
  const nameColumnWidth = Math.max(
    12,
    ...supportedCompanies.map((company) => company.name.length + 2)
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
      let normalized: NormalizedJob[] = [];
      if (company.platform === "GREENHOUSE") {
        const jobs = await fetchGreenhouseJobs(company.boardUrl);
        normalized = jobs.map((job) => normalizeGreenhouseJob(company.name, job));
      } else if (company.platform === "LEVER") {
        const jobs = await fetchLeverJobs(company.boardUrl);
        normalized = jobs
          .map((job) => normalizeLeverJob(company.name, job))
          .filter((job) => job.jobUrl);
      } else if (company.platform === "WORKDAY") {
        const jobs = await fetchWorkdayJobs(company.boardUrl, debugMode);
        normalized = jobs
          .map((job) => normalizeWorkdayJob(company.name, company.boardUrl, job))
          .filter((job): job is NormalizedJob => Boolean(job && job.jobUrl));
      } else {
        console.log(`${company.name}: unsupported ATS (${company.platform})`);
        continue;
      }

      if (keyword) {
        normalized = normalized.filter((job) => {
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
        select: { id: true, externalId: true, status: true },
      });
      
      const existingActiveIds = new Set(
        existingJobs
          .filter((job) => job.status === "ACTIVE")
          .map((job) => job.externalId)
          .filter((id): id is string => Boolean(id))
      );
      const isNewCompany = existingActiveIds.size === 0;
      let newJobsForCompany = 0;

      // Get current job IDs from the board
      const currentExternalIds = new Set(
        normalized
          .map((job) => job.externalId)
          .filter((id): id is string => Boolean(id))
      );

      // Create or reactivate jobs
      for (const job of normalized) {
        // Check if this job already exists (in any status)
        const existingJob = existingJobs.find(j => j.externalId === job.externalId);
        
        if (existingJob) {
          // Update existing job: refresh lastSeenAt and ensure it's ACTIVE
          await prisma.job.update({
            where: { id: existingJob.id },
            data: {
              lastSeenAt: new Date(),
              status: "ACTIVE", // ✅ Reactivate if it was wrongly closed
            },
          });
          
          // If it was previously CLOSED and we just reactivated it
          if (existingJob.status === "CLOSED") {
            newJobsForCompany += 1; // Count as "new" for logging
          }
          continue;
        }

        // Try to create the job - if it already exists (from another company with same board URL), skip it
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
          // Ignore unique constraint violations (job already exists from another company)
          // Prisma error codes: P2002 = Unique constraint failed
          if (error?.code !== 'P2002' && !error?.message?.includes('Unique constraint failed')) {
            throw error; // Re-throw if it's not a duplicate error
          }
          // Silently skip duplicates
        }
      }

      // Deactivate ACTIVE jobs that are no longer on the board
      let deactivatedJobsForCompany = 0;
      for (const existingJob of existingJobs) {
        // Only close jobs that are currently ACTIVE and not found on the board
        if (
          existingJob.status === "ACTIVE" &&
          existingJob.externalId && 
          !currentExternalIds.has(existingJob.externalId)
        ) {
          await prisma.job.update({
            where: { id: existingJob.id },
            data: { status: "CLOSED" },
          });
          deactivatedJobsForCompany += 1;
          totalDeactivated += 1;
          jobsDeactivatedByPlatform.set(
            company.platform,
            (jobsDeactivatedByPlatform.get(company.platform) ?? 0) + 1
          );
        }
      }

      totalJobs += normalized.length;
      jobsFoundByPlatform.set(
        company.platform,
        (jobsFoundByPlatform.get(company.platform) ?? 0) + normalized.length
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
      const totalClosedJobs = existingJobs.filter(job => job.status === "CLOSED").length;
      
      const totalLabel = `Total Jobs:${normalized.length}`;
      const newLabel = `New Jobs:${newJobsForCompany}`;
      const totalClosedLabel = `Total Closed:${totalClosedJobs}`;
      const newClosedLabel = `New Closed:${deactivatedJobsForCompany}`;
      console.log(
        `${company.name.padEnd(nameColumnWidth)}${company.platform.padEnd(
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
    `| Total jobs deactivated       | ${String(totalDeactivated).padEnd(25)}|`
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
      const deactivated = jobsDeactivatedByPlatform.get(platform) ?? 0;
      const companies = companiesByPlatform.get(platform) ?? 0;
      const label = `${platform} (found/new/deact/co.)`;
      console.log(
        `| ${label.padEnd(29)}| ${`${found}/${created}/${deactivated}/${companies}`.padEnd(
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

    const headers = ["id", "name", "platform", "boardUrl", "createdAt", "updatedAt"];
    const rows = companies.map(company => [
      company.id,
      company.name,
      company.platform,
      company.boardUrl,
      company.createdAt.toISOString(),
      company.updatedAt.toISOString(),
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
