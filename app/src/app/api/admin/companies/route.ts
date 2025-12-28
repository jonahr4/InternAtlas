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

  for (const rawUrl of urlMatches) {
    try {
      const url = new URL(rawUrl);
      if (
        url.hostname !== "boards.greenhouse.io" &&
        url.hostname !== "job-boards.greenhouse.io"
      ) {
        continue;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length === 0) {
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

  return Array.from(slugs);
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

  if (ats !== "GREENHOUSE") {
    return NextResponse.json({
      total: 0,
      added: 0,
      updated: 0,
      skipped: 0,
      message: "Selected ATS is not implemented yet.",
    });
  }

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

  const slugs = extractGreenhouseSlugs(input);
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const name = nameFromSlug(slug);
    const boardUrl = `https://job-boards.greenhouse.io/${slug}/`;

    try {
      const existing = await prisma.company.findUnique({
        where: { name },
        select: { id: true },
      });

      if (existing) {
        await prisma.company.update({
          where: { name },
          data: { boardUrl, platform: "GREENHOUSE" },
        });
        updated += 1;
      } else {
        await prisma.company.create({
          data: { name, boardUrl, platform: "GREENHOUSE" },
        });
        added += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({
    total: slugs.length,
    added,
    updated,
    skipped,
  });
}
