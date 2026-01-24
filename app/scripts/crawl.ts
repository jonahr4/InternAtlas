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

type IcimsJob = {
  title: string;
  location: string | null;
  jobUrl: string;
  externalId: string | null;
  description: string | null;
};

type SmartRecruitersJob = {
  id: string;
  name: string;
  location: {
    city?: string;
    region?: string;
    country?: string;
  };
  typeOfEmployment?: string;
  company: {
    identifier?: string;
    name: string;
  };
  actions?: {
    apply?: string;
  };
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: {
    sections?: {
      companyDescription?: {
        title?: string;
        text?: string;
      };
      jobDescription?: {
        title?: string;
        text?: string;
      };
      qualifications?: {
        title?: string;
        text?: string;
      };
      additionalInformation?: {
        title?: string;
        text?: string;
      };
    };
  };
};

type WorkableJob = {
  id: number;
  shortcode: string;
  title: string;
  remote?: boolean;
  location?: {
    country?: string;
    countryCode?: string;
    city?: string;
    region?: string;
  };
  locations?: Array<{
    country?: string;
    countryCode?: string;
    city?: string;
    region?: string;
  }>;
  state?: string;
  published?: string;
  type?: string; // "full", "part", "intern", etc.
  department?: string[];
  workplace?: string; // "remote", "hybrid", "on_site"
};

type Company = {
  id: string;
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "ICIMS" | "SMARTRECRUITERS" | "WORKABLE" | "CUSTOM";
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

function stripHtmlTags(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")      // Remove HTML tags
    .replace(/&nbsp;/gi, " ")       // Replace &nbsp; with space
    .replace(/&amp;/gi, "&")        // Decode &amp;
    .replace(/&lt;/gi, "<")         // Decode &lt;
    .replace(/&gt;/gi, ">")         // Decode &gt;
    .replace(/&quot;/gi, '"')       // Decode &quot;
    .replace(/&#39;/gi, "'")        // Decode &#39;
    .replace(/&apos;/gi, "'")       // Decode &apos;
    .replace(/&#x27;/gi, "'")       // Decode &#x27;
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10))) // Numeric entities
    .replace(/\s+/g, " ")           // Collapse whitespace
    .trim();
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

  const headers = {
    'accept': 'application/json',
    'accept-language': 'en-US',
    'content-type': 'application/json',
    'origin': origin,
    'referer': boardUrl,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  };

  const limit = 20; // Workday API hard limit
  const concurrency = 10; // Optimal for production (faster than 15 with DB load)

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
    console.log(`  [DEBUG] Requests needed: ${offsets.length}, concurrency: ${concurrency}`);
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

function getIcimsSearchUrl(boardUrl: string): string {
  try {
    const url = new URL(boardUrl);
    // Normalize to /jobs/search?ss=1
    url.pathname = "/jobs/search";
    const params = url.searchParams;
    if (!params.get("ss")) {
      params.set("ss", "1");
    }
    if (!params.get("in_iframe")) {
      params.set("in_iframe", "1");
    }
    url.search = params.toString();
    return url.toString();
  } catch {
    return boardUrl;
  }
}

function parseIcimsJobs(html: string, baseUrl: string, debug = false): IcimsJob[] {
  const jobs: IcimsJob[] = [];
  
  if (!html.includes("iCIMS_JobsTable")) {
    if (debug) {
      console.log(`  [DEBUG] No iCIMS_JobsTable found in page`);
    }
    return jobs;
  }

  // Updated regex: href comes BEFORE class in the HTML
  const anchorRegex =
    /href="([^"]+)"[^>]*class="iCIMS_Anchor"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const title = stripHtmlTags(match[2]);
    
    if (!title) continue;

    const anchorPos = match.index;
    const rowStart = html.lastIndexOf('<div class="row', anchorPos);
    const nextRow = html.indexOf('<div class="row', anchorPos + match[0].length);
    const row =
      rowStart >= 0
        ? html.substring(
            rowStart,
            nextRow > rowStart ? nextRow : anchorPos + match[0].length + 4000
          )
        : match[0];

    const jobUrl = href.startsWith("http")
      ? href
      : new URL(href, baseUrl).toString();

    // Match <span> with any attributes (e.g., <span > or <span class="...">)
    // Try multiple location patterns:
    // 1. "Job Locations" field in header (Applied Systems style)
    const locMatch =
      row.match(/field-label">Job Locations<\/span>\s*<span[^>]*>\s*([\s\S]*?)<\/span>/i) ??
      row.match(/field-label">Location<\/span>\s*<span[^>]*>\s*([\s\S]*?)<\/span>/i);
    
    let location: string | null = null;
    if (locMatch) {
      location = stripHtmlTags(locMatch[1]);
    } else {
      // 2. Country/City fields in additionalFields (SAS style)
      const countryMatch = row.match(/field-label">\s*Country[^<]*<\/span>\s*<\/dt>\s*<dd[^>]*><span[^>]*>\s*([\s\S]*?)<\/span>/i);
      const cityMatch = row.match(/field-label">\s*City<\/span>\s*<\/dt>\s*<dd[^>]*><span[^>]*>\s*([\s\S]*?)<\/span>/i);
      const stateMatch = row.match(/field-label">\s*State<\/span>\s*<\/dt>\s*<dd[^>]*><span[^>]*>\s*([\s\S]*?)<\/span>/i);
      
      const parts = [];
      if (cityMatch) parts.push(stripHtmlTags(cityMatch[1]));
      if (stateMatch) parts.push(stripHtmlTags(stateMatch[1]));
      if (countryMatch) parts.push(stripHtmlTags(countryMatch[1]));
      
      if (parts.length > 0) {
        location = parts.join(', ');
      }
    }

    // Match ID field with any dd/span attributes
    const idMatch = row.match(
      /iCIMS_JobHeaderField">(?:ID|Requisition ID)<\/dt>\s*<dd[^>]*><span[^>]*>\s*([\s\S]*?)<\/span>/i
    );
    const externalId = idMatch ? stripHtmlTags(idMatch[1]) : null;

    const descMatch = row.match(/<div class="col-xs-12 description">([\s\S]*?)<\/div>/i);
    const description = descMatch ? stripHtmlTags(descMatch[1]) : null;

    jobs.push({
      title,
      jobUrl,
      location,
      externalId,
      description,
    });
  }

  return jobs;
}

async function fetchIcimsJobs(boardUrl: string, debug = false): Promise<IcimsJob[]> {
  const baseUrl = getIcimsSearchUrl(boardUrl);
  const jobs: IcimsJob[] = [];
  let page = 1;
  const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  while (true) {
    const pageUrl = baseUrl.includes("?")
      ? `${baseUrl}&pr=${page - 1}`
      : `${baseUrl}?pr=${page - 1}`;

    const res = await fetch(pageUrl, { headers });
    if (!res.ok) {
      if (debug) {
        console.log(`  [DEBUG] ICIMS fetch failed ${res.status} for ${pageUrl}`);
      }
      break;
    }
    const html = await res.text();
    const parsed = parseIcimsJobs(html, baseUrl, debug);
    if (parsed.length === 0) {
      if (debug) {
        console.log(`  [DEBUG] ICIMS page ${page} returned 0 rows. Length=${html.length}.`);
      }
      break;
    }
    jobs.push(...parsed);
    if (debug) {
      console.log(`  [DEBUG] ICIMS page ${page}: ${parsed.length} jobs`);
    }
    page += 1;
    if (page > 50) {
      // safety stop
      break;
    }
  }

  if (debug) {
    console.log(`  [DEBUG] ICIMS total jobs: ${jobs.length}`);
  }

  return jobs;
}

function normalizeIcimsJob(companyName: string, job: IcimsJob): NormalizedJob | null {
  const title = job.title.trim();
  if (!title) return null;
  
  // Extract external ID:  
  // First try the ID field from the row
  let externalId = job.externalId && job.externalId.trim() ? job.externalId.trim() : null;
  
  // If not found, extract from URL: /jobs/6419/title/job -> "6419"
  if (!externalId) {
    const urlMatch = job.jobUrl.match(/\/jobs\/(\d+)\//);
    externalId = urlMatch ? urlMatch[1] : null;
  }
  
  if (!externalId) return null;
  
  return {
    companyName,
    externalId,
    title,
    location: job.location,
    postedAt: null,
    jobUrl: job.jobUrl,
    descriptionText: job.description,
  };
}

function getSmartRecruitersSlug(boardUrl: string): string {
  try {
    const url = new URL(boardUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`Invalid SmartRecruiters board URL (no slug in path): ${boardUrl}`);
    }
    return parts[0];
  } catch (error) {
    throw new Error(`Invalid SmartRecruiters board URL: ${boardUrl}. Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function fetchSmartRecruitersJobs(boardUrl: string, debug = false): Promise<SmartRecruitersJob[]> {
  const slug = getSmartRecruitersSlug(boardUrl);
  const apiUrl = `https://api.smartrecruiters.com/v1/companies/${slug}/postings`;
  const limit = 100;
  const concurrency = 10; // Parallel batch size

  // First fetch to get total count
  const initialUrl = `${apiUrl}?limit=${limit}&offset=0`;
  const initialRes = await fetch(initialUrl, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!initialRes.ok) {
    throw new Error(`Failed to fetch ${initialUrl}: ${initialRes.status}`);
  }

  const initialData = (await initialRes.json()) as { content: SmartRecruitersJob[]; totalFound: number };
  const allJobs: SmartRecruitersJob[] = [...initialData.content];
  const totalFound = initialData.totalFound;

  if (debug) {
    console.log(`  [DEBUG] SmartRecruiters total jobs: ${totalFound}`);
  }

  // If all jobs fetched in first request, return early
  if (allJobs.length >= totalFound) {
    return allJobs;
  }

  // Calculate remaining offsets to fetch
  const offsets: number[] = [];
  for (let offset = limit; offset < totalFound; offset += limit) {
    offsets.push(offset);
  }

  // Fetch remaining pages in parallel batches
  for (let i = 0; i < offsets.length; i += concurrency) {
    const batch = offsets.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (offset) => {
      const url = `${apiUrl}?limit=${limit}&offset=${offset}`;
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      });

      if (!res.ok) {
        if (debug) {
          console.log(`  [DEBUG] SmartRecruiters fetch failed ${res.status} for offset ${offset}`);
        }
        return [];
      }

      const data = (await res.json()) as { content: SmartRecruitersJob[] };
      return data.content || [];
    });

    const batchResults = await Promise.all(batchPromises);
    const batchJobs = batchResults.flat();
    allJobs.push(...batchJobs);

    if (debug) {
      console.log(`  [DEBUG] SmartRecruiters fetched batch: ${batchJobs.length} jobs (total: ${allJobs.length}/${totalFound})`);
    }
  }

  // Validate we got all expected jobs to prevent false closures
  if (allJobs.length !== totalFound) {
    throw new Error(`SmartRecruiters data incomplete: expected ${totalFound} jobs but got ${allJobs.length}. Batch failures may have occurred.`);
  }

  return allJobs;
}

function normalizeSmartRecruitersJob(
  companyName: string,
  job: SmartRecruitersJob
): NormalizedJob {
  const locationParts = [
    job.location?.city,
    job.location?.region,
    job.location?.country,
  ].filter(Boolean);

  const location = locationParts.length > 0 ? locationParts.join(", ") : null;

  // Use the company identifier from the job, or fall back to constructing URL
  const companySlug = job.company?.identifier || job.company?.name || '';
  const jobUrl = job.postingUrl || job.applyUrl || `https://jobs.smartrecruiters.com/${companySlug}/${job.id}`;

  return {
    companyName,
    externalId: job.id,
    title: job.name,
    location,
    postedAt: null,
    jobUrl,
    descriptionText: null,
  };
}

function getWorkableSlug(boardUrl: string): string {
  try {
    const url = new URL(boardUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      throw new Error(`Invalid Workable board URL (no slug in path): ${boardUrl}`);
    }
    return parts[0];
  } catch (error) {
    throw new Error(`Invalid Workable board URL: ${boardUrl}. Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper to sleep for a given number of milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Adaptive rate limiting state for Workable
let workableRateLimitHits = 0;
let workableLastRequestTime = 0;

// Helper to get adaptive delay based on rate limit history
function getWorkableDelay(): number {
  // Base delay of 1.5s, increasing by 500ms for each recent rate limit hit
  const baseDelay = 1500;
  const additionalDelay = Math.min(workableRateLimitHits * 1000, 5000);
  return baseDelay + additionalDelay;
}

// Helper to fetch with retry logic for rate limits
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5,
  debug = false
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Enforce minimum time between Workable requests
    if (url.includes('workable.com')) {
      const timeSinceLastRequest = Date.now() - workableLastRequestTime;
      const minDelay = getWorkableDelay();
      if (timeSinceLastRequest < minDelay) {
        await sleep(minDelay - timeSinceLastRequest);
      }
      workableLastRequestTime = Date.now();
    }

    const res = await fetch(url, options);

    if (res.ok) {
      // Successful request - gradually reduce rate limit hit counter
      if (url.includes('workable.com') && workableRateLimitHits > 0) {
        workableRateLimitHits = Math.max(0, workableRateLimitHits - 0.1);
      }
      return res;
    }

    if (res.status === 429) {
      // Rate limited - increase hit counter and wait with exponential backoff
      workableRateLimitHits++;
      const waitTime = Math.min(5000 * Math.pow(2, attempt), 60000); // 5s, 10s, 20s, 40s, 60s
      if (debug) {
        console.log(`  [DEBUG] Rate limited (hit #${workableRateLimitHits}), waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
      }
      await sleep(waitTime);
      lastError = new Error(`Rate limited (429)`);
      continue;
    }

    // For other errors, don't retry
    return res;
  }

  throw lastError || new Error('Max retries exceeded');
}

async function fetchWorkableJobs(boardUrl: string, debug = false): Promise<WorkableJob[]> {
  const slug = getWorkableSlug(boardUrl);
  const apiUrl = `https://apply.workable.com/api/v3/accounts/${slug}/jobs`;

  const headers = {
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Origin: "https://apply.workable.com",
    Referer: boardUrl,
  };

  if (debug) {
    console.log(`  [DEBUG] Workable API URL: ${apiUrl}`);
  }

  // First request to get total count
  const initialBody = JSON.stringify({
    query: "",
    location: [],
    department: [],
    worktype: [],
    remote: [],
  });

  const initialRes = await fetchWithRetry(apiUrl, {
    method: "POST",
    headers,
    body: initialBody,
  }, 3, debug);

  if (!initialRes.ok) {
    if (debug) {
      const errorText = await initialRes.text();
      console.log(`  [DEBUG] Workable error ${initialRes.status}: ${errorText.slice(0, 200)}`);
    }
    throw new Error(`Failed to fetch ${apiUrl}: ${initialRes.status}`);
  }

  const initialData = (await initialRes.json()) as { total?: number; results?: WorkableJob[] };
  const total = initialData.total ?? 0;
  const allJobs: WorkableJob[] = [...(initialData.results ?? [])];

  if (debug) {
    console.log(`  [DEBUG] Workable total jobs: ${total}`);
  }

  // If we got all jobs in the first request, return early
  if (allJobs.length >= total) {
    return allJobs;
  }

  // Paginate to get remaining jobs using the "token" field
  // Workable uses cursor-based pagination with a token
  let nextToken: string | undefined = (initialData as any).nextPage;

  while (allJobs.length < total && nextToken) {
    const pageBody = JSON.stringify({
      query: "",
      location: [],
      department: [],
      worktype: [],
      remote: [],
      token: nextToken,
    });

    const pageRes = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers,
      body: pageBody,
    }, 3, debug);

    if (!pageRes.ok) {
      if (debug) {
        console.log(`  [DEBUG] Workable pagination error ${pageRes.status}`);
      }
      break;
    }

    const pageData = (await pageRes.json()) as { results?: WorkableJob[]; nextPage?: string };
    const pageJobs = pageData.results ?? [];

    if (pageJobs.length === 0) {
      break;
    }

    allJobs.push(...pageJobs);
    nextToken = pageData.nextPage;

    if (debug) {
      console.log(`  [DEBUG] Workable fetched ${allJobs.length}/${total} jobs...`);
    }
  }

  if (debug) {
    console.log(`  [DEBUG] Workable total jobs fetched: ${allJobs.length}`);
  }

  return allJobs;
}

function normalizeWorkableJob(
  companyName: string,
  companySlug: string,
  job: WorkableJob
): NormalizedJob {
  // Build location from the primary location object
  const locationParts = [
    job.location?.city,
    job.location?.region,
    job.location?.country,
  ].filter(Boolean);

  // Add remote indicator if workplace is remote
  let location = locationParts.length > 0 ? locationParts.join(", ") : null;
  if (job.workplace === "remote" || job.remote) {
    location = location ? `${location} (Remote)` : "Remote";
  } else if (job.workplace === "hybrid") {
    location = location ? `${location} (Hybrid)` : "Hybrid";
  }

  // Construct job URL from shortcode
  const jobUrl = `https://apply.workable.com/${companySlug}/j/${job.shortcode}/`;

  return {
    companyName,
    externalId: job.shortcode,
    title: job.title,
    location,
    postedAt: job.published ?? null,
    jobUrl,
    // NOTE: Workable list API doesn't include descriptions
    // Would require fetching each job page individually
    descriptionText: null,
  };
}

function getSupportedCompanies(companies: Company[]): Company[] {
  return companies.filter(
    (company) =>
      company.platform === "GREENHOUSE" ||
      company.platform === "LEVER" ||
      company.platform === "WORKDAY" ||
      company.platform === "ICIMS" ||
      company.platform === "SMARTRECRUITERS" ||
      company.platform === "WORKABLE" ||
      (company.platform === "CUSTOM" &&
        company.boardUrl.toLowerCase().includes("icims.com"))
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

  // Sort companies by least recently crawled first (null = never crawled goes first)
  supportedCompanies.sort((a, b) => {
    // Never crawled (null) should come first
    if (!a.firstCrawledAt && !b.firstCrawledAt) return 0;
    if (!a.firstCrawledAt) return -1;
    if (!b.firstCrawledAt) return 1;
    // Otherwise, oldest crawl first
    return a.firstCrawledAt.getTime() - b.firstCrawledAt.getTime();
  });
  
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
    console.log("No supported ATS companies found (Greenhouse, Lever, Workday, iCIMS, SmartRecruiters, Workable).");
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
      const effectivePlatform =
        company.platform === "CUSTOM" &&
        company.boardUrl.toLowerCase().includes("icims.com")
          ? "ICIMS"
          : company.platform;

      if (effectivePlatform === "GREENHOUSE") {
        const jobs = await fetchGreenhouseJobs(company.boardUrl);
        normalized = jobs.map((job) => normalizeGreenhouseJob(company.name, job));
      } else if (effectivePlatform === "LEVER") {
        const jobs = await fetchLeverJobs(company.boardUrl);
        normalized = jobs
          .map((job) => normalizeLeverJob(company.name, job))
          .filter((job) => job.jobUrl);
      } else if (effectivePlatform === "WORKDAY") {
        workdayJobs = await fetchWorkdayJobs(company.boardUrl, debugMode);
        normalized = workdayJobs
          .map((job) => normalizeWorkdayJob(company.name, company.boardUrl, job))
          .filter((job): job is NormalizedJob => Boolean(job && job.jobUrl));
      } else if (effectivePlatform === "ICIMS") {
        const jobs = await fetchIcimsJobs(company.boardUrl, debugMode);
        normalized = jobs
          .map((job) => normalizeIcimsJob(company.name, job))
          .filter((job): job is NormalizedJob => Boolean(job && job.jobUrl));
      } else if (effectivePlatform === "SMARTRECRUITERS") {
        const jobs = await fetchSmartRecruitersJobs(company.boardUrl, debugMode);
        normalized = jobs.map((job) => normalizeSmartRecruitersJob(company.name, job));
      } else if (effectivePlatform === "WORKABLE") {
        const companySlug = getWorkableSlug(company.boardUrl);
        const jobs = await fetchWorkableJobs(company.boardUrl, debugMode);
        normalized = jobs.map((job) => normalizeWorkableJob(company.name, companySlug, job));
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
          sourcePlatform: company.platform as any,
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
                sourcePlatform: company.platform as any,
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
                sourcePlatform: company.platform as any,
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

          // Process closed jobs in parallel batches
          const concurrency = 10;
          const jobsToReactivate: string[] = [];

          for (let i = 0; i < closedJobs.length; i += concurrency) {
            const batch = closedJobs.slice(i, i + concurrency);
            
            const results = await Promise.all(
              batch.map(async (closedJob) => {
                const canonical =
                  getWorkdayCanonicalId(closedJob.externalId) ??
                  getWorkdayCanonicalId(closedJob.jobUrl);
                if (!canonical) {
                  return null;
                }
                const found = await workdaySearchById(
                  company.boardUrl,
                  canonical,
                  debugMode
                );
                return found ? closedJob.id : null;
              })
            );

            jobsToReactivate.push(...results.filter((id): id is string => id !== null));
          }

          // Reactivate found jobs
          for (const jobId of jobsToReactivate) {
            await prisma.job.update({
              where: { id: jobId },
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
                sourcePlatform: company.platform as any,
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
          sourcePlatform: company.platform as any,
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
        )}${status.padEnd(12)}${totalLabel.padEnd(18)}${newLabel.padEnd(18)}${totalClosedLabel.padEnd(18)}${newClosedLabel}`
      );

      // Add adaptive delay between Workable companies to avoid rate limiting
      if (company.platform === "WORKABLE") {
        const delay = getWorkableDelay();
        await sleep(delay);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : '';
      totalBroken += 1;
      console.error(`${company.name}: error - ${message}`);
      if (debugMode && stack) {
        console.error(`  Stack: ${stack}`);
      }

      // If we hit a rate limit, add extra cooldown before next company
      if (company.platform === "WORKABLE" && message.includes('429')) {
        const cooldown = 10000 + (workableRateLimitHits * 2000); // 10s base + 2s per hit
        console.log(`  Cooling down for ${cooldown / 1000}s after rate limit...`);
        await sleep(cooldown);
      }
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
