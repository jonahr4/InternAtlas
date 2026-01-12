import { prisma } from "./lib/prisma";

// ============================================================================
// Types
// ============================================================================

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

type WorkdayParams = {
  origin: string;
  tenant: string;
  site: string;
  locale?: string;
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

// ============================================================================
// Cache
// ============================================================================

const workdaySiteCache = new Map<string, WorkdayParams>();

// ============================================================================
// Workday Helper Functions
// ============================================================================

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

// ============================================================================
// Workday Fetch Function (Parallel Optimized)
// ============================================================================

async function fetchWorkdayJobs(
  boardUrl: string, 
  debug = false,
  concurrency = 5
): Promise<WorkdayJob[]> {
  const { origin, tenant, site } = await discoverWorkdaySite(boardUrl);
  
  if (debug) {
    console.log(`  [DEBUG] Discovered: tenant=${tenant}, site=${site}`);
  }

  const apiUrl = `${origin}/wday/cxs/${tenant}/${site}/jobs`;
  
  if (debug) {
    console.log(`  [DEBUG] API URL: ${apiUrl}`);
    console.log(`  [DEBUG] Concurrency: ${concurrency}`);
  }

  const headers = {
    'accept': 'application/json',
    'accept-language': 'en-US',
    'content-type': 'application/json',
    'origin': origin,
    'referer': boardUrl,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  };

  const limit = 20; // Workday API hard limit

  // First, get total count
  const initialResponse = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ appliedFacets: {}, limit, offset: 0, searchText: "" }),
  });

  if (!initialResponse.ok) {
    if (debug) {
      const errorText = await initialResponse.text();
      console.log(`  [DEBUG] Error ${initialResponse.status}: ${errorText.substring(0, 200)}`);
    }
    return [];
  }

  const initialData = await initialResponse.json();
  const total = initialData.total || 0;
  
  if (debug) {
    console.log(`  [DEBUG] Total jobs: ${total}`);
  }

  if (total === 0) {
    return [];
  }

  // Calculate all offsets needed
  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += limit) {
    offsets.push(offset);
  }

  if (debug) {
    console.log(`  [DEBUG] Requests needed: ${offsets.length}`);
  }

  // Fetch in parallel batches
  const allJobs: WorkdayJob[] = [];
  
  for (let i = 0; i < offsets.length; i += concurrency) {
    const batch = offsets.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (offset) => {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({ appliedFacets: {}, limit, offset, searchText: "" }),
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        return data.jobPostings || [];
      } catch (error) {
        if (debug) {
          console.log(`  [DEBUG] Fetch error at offset ${offset}: ${error}`);
        }
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const batchJobs = batchResults.flat();
    allJobs.push(...batchJobs);

    if (debug && i + concurrency < offsets.length) {
      console.log(`  [DEBUG] Fetched ${allJobs.length}/${total} jobs...`);
    }
  }

  if (debug) {
    console.log(`  [DEBUG] Total jobs fetched: ${allJobs.length}`);
  }

  return allJobs;
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

// ============================================================================
// Test Script
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const debug = args.includes("--debug");
  
  // Test multiple concurrency levels to find optimal
  const concurrencyLevels = [10, 15, 20, 25, 30];
  
  console.log("🚀 Testing Workday Crawler - Concurrency Optimization");
  console.log(`🔬 Testing concurrency levels: ${concurrencyLevels.join(", ")}\n`);

  // Target companies for benchmarking
  const targetCompanies = ["Globalhr"];

  // Fetch these specific Workday companies from the database
  const companies = await prisma.company.findMany({
    where: { 
      platform: "WORKDAY",
      name: { in: targetCompanies }
    },
    select: {
      id: true,
      name: true,
      boardUrl: true,
    },
  });

  if (companies.length === 0) {
    console.log("❌ No target Workday companies found in database");
    console.log(`   Looking for: ${targetCompanies.join(", ")}`);
    return;
  }

  console.log(`Found ${companies.length} target companies for benchmarking\n`);
  console.log("=" .repeat(80));
  console.log("");

  // Test each concurrency level
  for (const concurrency of concurrencyLevels) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`⚡ TESTING CONCURRENCY = ${concurrency}`);
    console.log("=".repeat(80));
    console.log("");

    const results: Array<{
      name: string;
      jobs: number;
      duration: number;
      msPerJob: number;
      status: "success" | "error";
      errorCount?: number;
    }> = [];

    // Crawl each company
    for (const company of companies) {
      const displayName = company.name.length > 48 
        ? company.name.substring(0, 45) + "..." 
        : company.name;
      
      console.log(`Crawling: ${displayName}`);
      console.log(`URL: ${company.boardUrl}`);
      console.log("-".repeat(80));

      const startTime = Date.now();
      
      try {
        const jobs = await fetchWorkdayJobs(company.boardUrl, debug, concurrency);
        const endTime = Date.now();
        const duration = endTime - startTime;
        const msPerJob = jobs.length > 0 ? Math.round(duration / jobs.length) : 0;
        
        const normalized = jobs
          .map((job) => normalizeWorkdayJob(company.name, company.boardUrl, job))
          .filter((job): job is NormalizedJob => job !== null);
        
        console.log(`✅ Fetched ${jobs.length} jobs in ${(duration / 1000).toFixed(2)}s`);
        console.log(`   Normalized: ${normalized.length} jobs`);
        console.log(`   Time per job: ${msPerJob}ms`);
        console.log("");
        
        results.push({
          name: company.name,
          jobs: jobs.length,
          duration,
          msPerJob,
          status: "success"
        });
        
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const message = error instanceof Error ? error.message : String(error);
        
        console.error(`❌ Error: ${message}`);
        console.error(`   Failed after ${(duration / 1000).toFixed(2)}s`);
        console.log("");
        
        results.push({
          name: company.name,
          jobs: 0,
          duration,
          msPerJob: 0,
          status: "error"
        });
      }
    }

    // Summary for this concurrency level
    const successful = results.filter(r => r.status === "success");
    const totalJobs = successful.reduce((sum, r) => sum + r.jobs, 0);
    const totalDuration = successful.reduce((sum, r) => sum + r.duration, 0);
    const avgMsPerJob = totalJobs > 0 ? Math.round(totalDuration / totalJobs) : 0;

    console.log(`\n📊 Concurrency ${concurrency} Summary:`);
    console.log(`   Total jobs: ${totalJobs}`);
    console.log(`   Total time: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Avg ms/job: ${avgMsPerJob}ms`);
    console.log(`   Success rate: ${successful.length}/${results.length}`);
  }

  console.log(`\n\n${"=".repeat(80)}`);
  console.log("🏁 ALL TESTS COMPLETE");
  console.log("=".repeat(80));
  console.log("");

  await prisma.$disconnect();
}

main().catch(console.error);
