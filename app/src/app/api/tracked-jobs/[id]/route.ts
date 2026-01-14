import { NextResponse } from "next/server";
import {
  updateTrackedJobStatus,
  deleteTrackedJob,
} from "@/lib/firestore";

// PATCH /api/tracked-jobs/[id]
// Body: { status: "to_apply" | "applied" }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || (status !== "to_apply" && status !== "applied")) {
      return NextResponse.json(
        { error: "status must be 'to_apply' or 'applied'" },
        { status: 400 }
      );
    }

    await updateTrackedJobStatus(id, status);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating tracked job:", error);
    return NextResponse.json(
      { error: "Failed to update tracked job" },
      { status: 500 }
    );
  }
}

// DELETE /api/tracked-jobs/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTrackedJob(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting tracked job:", error);
    return NextResponse.json(
      { error: "Failed to delete tracked job" },
      { status: 500 }
    );
  }
}
