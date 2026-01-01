import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const job = await prisma.job.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });

  if (!job?.updatedAt) {
    return NextResponse.json({ lastUpdated: null });
  }

  return NextResponse.json({ lastUpdated: job.updatedAt.toISOString() });
}
