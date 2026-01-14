import { NextResponse } from "next/server";
import {
  getUserTrackedJobs,
  getUserTrackedJobsByStatus,
  addTrackedJob,
  bulkAddTrackedJobs,
} from "@/lib/firestore";
import { prisma } from "@/lib/prisma";

// GET /api/tracked-jobs?userId=xxx&status=to_apply|applied
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status") as "to_apply" | "applied" | null;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Get tracked jobs from Firestore
    const trackedJobs = status
      ? await getUserTrackedJobsByStatus(userId, status)
      : await getUserTrackedJobs(userId);

    if (trackedJobs.length === 0) {
      return NextResponse.json({ jobs: [], count: 0 });
    }

    // Get job details from Postgres
    const jobIds = trackedJobs.map((tj) => tj.jobId);
    const jobs = await prisma.job.findMany({
      where: {
        id: {
          in: jobIds,
        },
      },
      include: {
        company: {
          select: {
            name: true,
            boardUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Merge tracked job data with job details
    const enrichedJobs = jobs.map((job) => {
      const tracked = trackedJobs.find((tj) => tj.jobId === job.id);
      return {
        ...job,
        tracked: {
          id: tracked?.id,
          status: tracked?.status,
          createdAt: tracked?.createdAt,
        },
      };
    });

    return NextResponse.json({
      jobs: enrichedJobs,
      count: enrichedJobs.length,
    });
  } catch (error) {
    console.error("Error fetching tracked jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracked jobs" },
      { status: 500 }
    );
  }
}

// POST /api/tracked-jobs
// Body: { userId, jobId, status } or { userId, jobIds: [], status }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, jobId, jobIds, status } = body;

    if (!userId || !status) {
      return NextResponse.json(
        { error: "userId and status are required" },
        { status: 400 }
      );
    }

    if (!jobId && (!jobIds || jobIds.length === 0)) {
      return NextResponse.json(
        { error: "jobId or jobIds is required" },
        { status: 400 }
      );
    }

    if (status !== "to_apply" && status !== "applied") {
      return NextResponse.json(
        { error: "status must be 'to_apply' or 'applied'" },
        { status: 400 }
      );
    }

    // Bulk add
    if (jobIds && Array.isArray(jobIds)) {
      await bulkAddTrackedJobs(userId, jobIds, status);
      return NextResponse.json({
        success: true,
        count: jobIds.length,
      });
    }

    // Single add
    const id = await addTrackedJob({ userId, jobId, status });
    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    console.error("Error adding tracked job:", error);
    return NextResponse.json(
      { error: "Failed to add tracked job" },
      { status: 500 }
    );
  }
}
