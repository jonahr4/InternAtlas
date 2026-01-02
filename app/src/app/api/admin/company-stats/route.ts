import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  // Aggregate counts; estimate size proportionally to table size to avoid full scans
  const [totalJobs, totalTableSize, companyCounts] = await Promise.all([
    prisma.job.count(),
    prisma
      .$queryRawUnsafe<Array<{ size: bigint }>>(
        `SELECT pg_total_relation_size('"Job"') as size`
      )
      .then((rows) => Number(rows?.[0]?.size ?? 0)),
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        boardurl: string;
        jobcount: bigint;
      }>
    >`
      SELECT
        c.id,
        c.name,
        c."boardUrl" as boardurl,
        COUNT(j.*) AS jobcount
      FROM "Company" c
      LEFT JOIN "Job" j ON j."companyId" = c.id
      GROUP BY c.id
      ORDER BY jobcount DESC, c.name ASC
    `,
  ]);

  const companies = companyCounts.map((row) => {
    const jobCount = Number(row.jobcount ?? 0);
    const byteSize =
      totalJobs > 0 ? Math.round((jobCount / totalJobs) * Number(totalTableSize)) : 0;
    return {
      id: row.id,
      name: row.name,
      boardUrl: row.boardurl,
      jobCount,
      byteSize,
    };
  });

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
