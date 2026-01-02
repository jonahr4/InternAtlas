import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  // Aggregate job counts and rough text sizes per company
  const [totalJobs, companyStats] = await Promise.all([
    prisma.job.count(),
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        boardurl: string;
        jobcount: bigint;
        bytesize: bigint | null;
      }>
    >`
      SELECT
        c.id,
        c.name,
        c."boardUrl" as boardurl,
        COUNT(j.*) AS jobcount,
        SUM(
          LENGTH(COALESCE(j.title, '')) +
          LENGTH(COALESCE(j.location, '')) +
          LENGTH(COALESCE(j.jobUrl, '')) +
          LENGTH(COALESCE(j.applyUrl, '')) +
          LENGTH(COALESCE(j."descriptionText", '')) +
          LENGTH(COALESCE(j."requirementsText", '')) +
          LENGTH(COALESCE(j."rawPayload"::text, ''))
        ) AS bytesize
      FROM "Company" c
      LEFT JOIN "Job" j ON j."companyId" = c.id
      GROUP BY c.id
      ORDER BY jobcount DESC, c.name ASC
    `,
  ]);

  const companies = companyStats.map((row) => ({
    id: row.id,
    name: row.name,
    boardUrl: row.boardurl,
    jobCount: Number(row.jobcount ?? 0),
    byteSize: Number(row.bytesize ?? 0),
  }));

  return NextResponse.json({ totalJobs, companies });
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { ids?: string[] };
  const ids = (body.ids ?? []).filter((id) => typeof id === "string" && id.trim().length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ deleted: 0 }, { status: 400 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.job.deleteMany({ where: { companyId: { in: ids } } });
    const res = await tx.company.deleteMany({ where: { id: { in: ids } } });
    return res.count;
  });

  return NextResponse.json({ deleted });
}
