import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [
      totalJobs,
      activeJobs,
      totalCompanies,
      recentJob
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: 'ACTIVE' } }),
      prisma.company.count(),
      prisma.job.findFirst({
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true }
      })
    ]);

    return NextResponse.json({
      totalJobs,
      activeJobs,
      totalCompanies,
      lastUpdated: recentJob?.lastSeenAt || new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
