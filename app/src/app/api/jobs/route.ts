import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function getStringArray(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function getTokens(input: string): string[] {
  return input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim();
  const title = searchParams.get("title")?.trim();
  const location = searchParams.get("location")?.trim();
  const employmentType = searchParams.get("employmentType")?.trim();
  const locationType = searchParams.get("locationType")?.trim();
  const postedAfter = searchParams.get("postedAfter")?.trim();
  const sort = searchParams.get("sort")?.trim();
  const sortDir = searchParams.get("sortDir")?.trim().toLowerCase();
  const companyName = searchParams.get("companyName")?.trim();
  const status = searchParams.get("status")?.trim();
  const platforms = searchParams.get("platforms")?.trim();

  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number.parseInt(searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`, 10)
    )
  );

  const companies = getStringArray(searchParams.getAll("company"));

  const where: Record<string, unknown> = { AND: [] as unknown[] };
  const and = where.AND as unknown[];

  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { descriptionText: { contains: q, mode: "insensitive" } },
        { requirementsText: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (title) {
    // Support comma-separated title terms with OR logic
    const titleTerms = title.split(',').map(t => t.trim()).filter(Boolean);
    if (titleTerms.length > 0) {
      and.push({
        OR: titleTerms.map((term) => {
          const tokens = getTokens(term);
          if (tokens.length === 1) {
            return { title: { contains: tokens[0], mode: "insensitive" } };
          }
          return {
            AND: tokens.map((token) => ({
              title: { contains: token, mode: "insensitive" },
            })),
          };
        }),
      });
    }
  }

  if (location) {
    // Support comma-separated location terms with OR logic
    const locationTerms = location.split(',').map(l => l.trim()).filter(Boolean);
    if (locationTerms.length > 0) {
      and.push({
        OR: locationTerms.map((term) => ({
          location: { contains: term, mode: "insensitive" },
        })),
      });
    }
  }

  if (employmentType) {
    and.push({ employmentType });
  }

  if (locationType) {
    and.push({ locationType });
  }

  if (postedAfter) {
    const date = new Date(postedAfter);
    if (!Number.isNaN(date.getTime())) {
      and.push({ postedAt: { gte: date } });
    }
  }

  if (companies.length > 0) {
    and.push({ company: { name: { in: companies } } });
  }

  if (companyName) {
    and.push({ company: { name: { contains: companyName, mode: "insensitive" } } });
  }

  if (status) {
    // Map URL status values to Prisma enum values
    const statusMap: Record<string, string> = {
      'open': 'ACTIVE',
      'closed': 'CLOSED',
      'both': undefined as any, // Don't filter by status
    };
    const mappedStatus = statusMap[status.toLowerCase()];
    if (mappedStatus) {
      and.push({ status: mappedStatus });
    }
  }

  if (platforms) {
    const platformList = platforms.split(',').map(p => p.trim()).filter(Boolean);
    if (platformList.length > 0) {
      and.push({ sourcePlatform: { in: platformList } });
    }
  }

  const direction = sortDir === "asc" ? "asc" : "desc";
  type SortDirection = "asc" | "desc";
  const orderBy =
    sort === "posted_at"
      ? { postedAt: direction as SortDirection }
      : sort === "last_seen_at"
      ? { lastSeenAt: direction as SortDirection }
      : sort === "title"
      ? { title: direction as SortDirection }
      : sort === "created_at"
      ? { createdAt: direction as SortDirection }
      : sort === "company"
      ? { company: { name: direction as SortDirection } }
      : { company: { name: "asc" as SortDirection } };

  const whereClause = and.length > 0 ? where : undefined;
  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where: whereClause,
      take: pageSize,
      skip: (page - 1) * pageSize,
      orderBy,
      include: { company: true },
    }),
    prisma.job.count({ where: whereClause }),
  ]);

  return NextResponse.json({
    items: jobs,
    total,
    page,
    pageSize,
  });
}
