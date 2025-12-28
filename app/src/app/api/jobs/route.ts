import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.job.findMany({
    take: 25,
    orderBy: { createdAt: "desc" },
    include: { company: true },
  });

  return NextResponse.json(jobs);
}
