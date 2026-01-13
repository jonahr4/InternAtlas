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
  const skipCount = searchParams.get("skipCount") === "true";

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
  
  // Fetch jobs
  const jobs = await prisma.job.findMany({
    where: whereClause,
    take: pageSize,
    skip: (page - 1) * pageSize,
    orderBy,
    include: { company: true },
  });

  // Skip count if requested (for faster page loads after page 1)
  let total: number;
  if (skipCount) {
    total = -1; // Client will use cached value
  } else {
    // Use raw SQL for count to avoid Prisma's slow OFFSET wrapper
    total = await fastCount(whereClause);
  }

  return NextResponse.json({
    items: jobs,
    total,
    page,
    pageSize,
  });
}

// Fast count using raw SQL to avoid Prisma's OFFSET wrapper
async function fastCount(where: any): Promise<number> {
  if (!where || !where.AND || where.AND.length === 0) {
    // Simple count with no filters
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count FROM "Job"
    `;
    return Number(result[0].count);
  }

  // Build WHERE clause from Prisma where object
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  for (const condition of where.AND) {
    if (condition.status) {
      conditions.push(`status = $${paramIndex}::"JobStatus"`);
      params.push(condition.status);
      paramIndex++;
    }
    
    if (condition.employmentType) {
      conditions.push(`"employmentType" = $${paramIndex}::"EmploymentType"`);
      params.push(condition.employmentType);
      paramIndex++;
    }
    
    if (condition.locationType) {
      conditions.push(`"locationType" = $${paramIndex}::"LocationType"`);
      params.push(condition.locationType);
      paramIndex++;
    }
    
    if (condition.postedAt?.gte) {
      conditions.push(`"postedAt" >= $${paramIndex}`);
      params.push(condition.postedAt.gte);
      paramIndex++;
    }
    
    if (condition.sourcePlatform?.in) {
      const platforms = condition.sourcePlatform.in;
      const placeholders = platforms.map((_: any, i: number) => `$${paramIndex + i}::"SourcePlatform"`).join(', ');
      conditions.push(`"sourcePlatform" IN (${placeholders})`);
      params.push(...platforms);
      paramIndex += platforms.length;
    }
    
    // Handle OR conditions (title, location, q)
    if (condition.OR) {
      const orConditions: string[] = [];
      
      for (const orCond of condition.OR) {
        // Title contains
        if (orCond.title?.contains) {
          orConditions.push(`title ILIKE $${paramIndex}`);
          params.push(`%${orCond.title.contains}%`);
          paramIndex++;
        }
        
        // Location contains
        if (orCond.location?.contains) {
          orConditions.push(`location ILIKE $${paramIndex}`);
          params.push(`%${orCond.location.contains}%`);
          paramIndex++;
        }
        
        // Description/requirements text
        if (orCond.descriptionText?.contains) {
          orConditions.push(`"descriptionText" ILIKE $${paramIndex}`);
          params.push(`%${orCond.descriptionText.contains}%`);
          paramIndex++;
        }
        
        if (orCond.requirementsText?.contains) {
          orConditions.push(`"requirementsText" ILIKE $${paramIndex}`);
          params.push(`%${orCond.requirementsText.contains}%`);
          paramIndex++;
        }
        
        // Nested AND for multi-token title search
        if (orCond.AND) {
          const andParts: string[] = [];
          for (const andCond of orCond.AND) {
            if (andCond.title?.contains) {
              andParts.push(`title ILIKE $${paramIndex}`);
              params.push(`%${andCond.title.contains}%`);
              paramIndex++;
            }
          }
          if (andParts.length > 0) {
            orConditions.push(`(${andParts.join(' AND ')})`);
          }
        }
      }
      
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
    }
    
    // Handle company name filter (requires JOIN)
    if (condition.company?.name?.contains) {
      conditions.push(`EXISTS (
        SELECT 1 FROM "Company" c 
        WHERE c.id = "Job"."companyId" 
        AND c.name ILIKE $${paramIndex}
      )`);
      params.push(`%${condition.company.name.contains}%`);
      paramIndex++;
    }
    
    if (condition.company?.name?.in) {
      const companyNames = condition.company.name.in;
      conditions.push(`EXISTS (
        SELECT 1 FROM "Company" c 
        WHERE c.id = "Job"."companyId" 
        AND c.name = ANY($${paramIndex}::text[])
      )`);
      params.push(companyNames);
      paramIndex++;
    }
    
    if (condition.createdAt?.gte) {
      conditions.push(`"createdAt" >= $${paramIndex}`);
      params.push(condition.createdAt.gte);
      paramIndex++;
    }
    
    if (condition.lastSeenAt?.gte) {
      conditions.push(`"lastSeenAt" >= $${paramIndex}`);
      params.push(condition.lastSeenAt.gte);
      paramIndex++;
    }
  }

  const whereSQL = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*)::bigint as count FROM "Job" ${whereSQL}`;
  
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(sql, ...params);
  return Number(result[0].count);
}
