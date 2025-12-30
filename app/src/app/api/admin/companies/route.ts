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
  const blockedSegments = new Set(["job", "jobs", "details"]);
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
      const nameSlug = tenantSlug || siteSegment;
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
    const name = item.name;
    const boardUrl = item.boardUrl;

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
      } else {
        await prisma.company.create({
          data: { name, boardUrl, platform: ats },
        });
        added += 1;
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
  });
}
