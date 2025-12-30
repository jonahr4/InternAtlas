import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

type RequestBody = {
  urls?: string;
  method?: "google" | "html";
  ats?: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
};

function extractGreenhouseSlugs(input: string): string[] {
  const slugs = new Set<string>();
  const urlMatches = input.match(/https?:\/\/[^\s]+/g) ?? [];
  const blockedSlugs = new Set([
    "about",
    "apply",
    "careers",
    "company",
    "embed",
    "home",
    "job",
    "jobs",
    "positions",
    "requests",
  ]);

  for (const rawUrl of urlMatches) {
    try {
      const url = new URL(rawUrl);
      if (
        url.hostname !== "boards.greenhouse.io" &&
        url.hostname !== "job-boards.greenhouse.io"
      ) {
        continue;
      }
      if (url.hostname === "job-boards.greenhouse.io") {
        const forParam = url.searchParams.get("for");
        if (forParam) {
          slugs.add(forParam.toLowerCase());
          continue;
        }
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) {
        continue;
      }
      if (parts[0] === "embed") {
        const forParam = url.searchParams.get("for");
        if (forParam) {
          slugs.add(forParam.toLowerCase());
        }
        continue;
      }
      slugs.add(parts[0]);
    } catch {
      continue;
    }
  }

  const textMatches =
    input.match(/boards\.greenhouse\.io\s*[^a-z0-9]+([a-z0-9_-]+)/gi) ?? [];

  for (const match of textMatches) {
    const slugMatch = match.match(/([a-z0-9_-]+)$/i);
    if (slugMatch) {
      slugs.add(slugMatch[1].toLowerCase());
    }
  }

  const embedMatches =
    input.match(/job_app\?[^\\s]*for=([a-z0-9_-]+)/gi) ?? [];

  for (const match of embedMatches) {
    const slugMatch = match.match(/for=([a-z0-9_-]+)/i);
    if (slugMatch) {
      slugs.add(slugMatch[1].toLowerCase());
    }
  }

  return Array.from(slugs)
    .map((slug) => {
      try {
        return decodeURIComponent(slug);
      } catch {
        return slug;
      }
    })
    .map((slug) => slug.replace(/["'<>%]+/g, "").trim())
    .filter((slug) => {
      if (blockedSlugs.has(slug)) {
        return false;
      }
      if (!slug) {
        return false;
      }
      if (slug.includes("%")) {
        return false;
      }
      if (
        slug.includes("<") ||
        slug.includes(">") ||
        slug.includes("\"") ||
        slug.includes(":")
      ) {
        return false;
      }
      return /^[a-z0-9_-]+$/.test(slug);
    });
}

function extractLeverSlugs(input: string): string[] {
  const normalizedInput = input.replace(/&amp;/g, "&");
  const slugs = new Set<string>();
  const urlMatches = normalizedInput.match(/https?:\/\/[^\s]+/g) ?? [];

  for (const rawUrl of urlMatches) {
    try {
      const url = new URL(rawUrl);
      if (url.hostname !== "jobs.lever.co") {
        continue;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) {
        continue;
      }
      slugs.add(parts[0].toLowerCase());
    } catch {
      continue;
    }
  }

  const textMatches =
    normalizedInput.match(/jobs\.lever\.co\s*[^a-z0-9]+([a-z0-9_-]+)/gi) ?? [];

  for (const match of textMatches) {
    const slugMatch = match.match(/([a-z0-9_-]+)$/i);
    if (slugMatch) {
      slugs.add(slugMatch[1].toLowerCase());
    }
  }

  return Array.from(slugs)
    .map((slug) => {
      try {
        return decodeURIComponent(slug);
      } catch {
        return slug;
      }
    })
    .map((slug) => slug.replace(/["'<>%]+/g, "").trim())
    .filter((slug) => slug && /^[a-z0-9_-]+$/.test(slug));
}

function extractWorkdayBoards(input: string): { name: string; boardUrl: string }[] {
  const normalizedInput = input.replace(/&amp;/g, "&");
  const urlMatches = normalizedInput.match(/https?:\/\/[^\s]+/g) ?? [];
  const blockedSegments = new Set(["job", "jobs", "details", "careers"]);
  const boards = new Map<string, string>();

  for (const rawUrl of urlMatches) {
    try {
      const url = new URL(rawUrl);
      if (!url.hostname.endsWith("myworkdayjobs.com")) {
        continue;
      }
      const hostParts = url.hostname.split(".").filter(Boolean);
      const tenantSlug = hostParts.length > 0 ? hostParts[0] : "";
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) {
        continue;
      }
      let siteSegment = parts[0];
      let localeSegment = "";
      if (/^[a-z]{2}-[A-Z]{2}$/.test(siteSegment) && parts.length > 1) {
        localeSegment = siteSegment;
        siteSegment = parts[1];
      }
      if (!siteSegment || blockedSegments.has(siteSegment.toLowerCase())) {
        continue;
      }
      const boardUrl = localeSegment
        ? `${url.origin}/${localeSegment}/${siteSegment}`
        : `${url.origin}/${siteSegment}`;
      
      // Use a placeholder name - we'll fetch the real name from the page
      const nameSlug = `${tenantSlug}_${siteSegment}`;
      
      boards.set(nameSlug, boardUrl);
    } catch {
      continue;
    }
  }

  return Array.from(boards.entries()).map(([name, boardUrl]) => ({
    name: nameFromSlug(name),
    boardUrl,
  }));
}

async function fetchWorkdayCompanyName(boardUrl: string): Promise<string | null> {
  try {
    const response = await fetch(boardUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Try multiple patterns to extract company name
    // Pattern 1: <title>Company Name - Career Site</title>
    const titleMatch = html.match(/<title>([^<-]+)/i);
    if (titleMatch) {
      const title = titleMatch[1].trim();
      // Clean up common suffixes
      const cleaned = title
        .replace(/\s*-?\s*(careers?|jobs?|employment|opportunities).*$/i, '')
        .trim();
      if (cleaned && cleaned.length > 2 && cleaned.length < 100) {
        return cleaned;
      }
    }
    
    // Pattern 2: og:site_name meta tag
    const ogSiteMatch = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
    if (ogSiteMatch) {
      const siteName = ogSiteMatch[1].trim();
      if (siteName && siteName.length > 2 && siteName.length < 100) {
        return siteName;
      }
    }
    
    // Pattern 3: Look for "companyName" or similar in JSON data
    const companyMatch = html.match(/"companyName"\s*:\s*"([^"]+)"/i) ||
                         html.match(/"company"\s*:\s*"([^"]+)"/i);
    if (companyMatch) {
      const company = companyMatch[1].trim();
      if (company && company.length > 2 && company.length < 100) {
        return company;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

function nameFromSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function POST(request: Request) {
  const body = (await request.json()) as RequestBody;
  const input = body.urls?.trim() ?? "";
  const method = body.method ?? "google";
  const ats = body.ats ?? "GREENHOUSE";

  if (!input) {
    return NextResponse.json({
      total: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      message:
        method === "html"
          ? "No HTML provided."
          : "No URLs or search results provided.",
    });
  }

  const slugs =
    ats === "LEVER" ? extractLeverSlugs(input) : extractGreenhouseSlugs(input);
  const workdayBoards = ats === "WORKDAY" ? extractWorkdayBoards(input) : [];
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const addedUrls: string[] = [];
  const updatedUrls: string[] = [];

  const workItems =
    ats === "WORKDAY"
      ? workdayBoards
      : slugs.map((slug) => ({
          name: nameFromSlug(slug),
          boardUrl:
            ats === "LEVER"
              ? `https://jobs.lever.co/${slug}/`
              : `https://job-boards.greenhouse.io/${slug}/`,
        }));

  for (const item of workItems) {
    let name = item.name;
    const boardUrl = item.boardUrl;

    // For Workday, try to fetch the real company name from the page
    if (ats === "WORKDAY") {
      const realName = await fetchWorkdayCompanyName(boardUrl);
      if (realName) {
        name = realName;
      }
    }

    try {
      const existing = await prisma.company.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existing) {
        await prisma.company.update({
          where: { name },
          data: { boardUrl, platform: ats },
        });
        updated += 1;
        updatedUrls.push(boardUrl);
      } else {
        await prisma.company.create({
          data: { name, boardUrl, platform: ats },
        });
        added += 1;
        addedUrls.push(boardUrl);
      }
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({
    total: workItems.length,
    added,
    updated,
    skipped,
    addedUrls,
    updatedUrls,
  });
}
