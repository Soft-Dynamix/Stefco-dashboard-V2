import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailIds, status } = body;

    if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "No email IDs provided" },
        { status: 400 }
      );
    }

    if (!status || !["ARCHIVED", "PENDING"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status. Must be ARCHIVED or PENDING" },
        { status: 400 }
      );
    }

    // Update all selected emails
    const result = await db.emailQueue.updateMany({
      where: {
        id: { in: emailIds },
      },
      data: {
        status: status,
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
      message: `Successfully updated ${result.count} emails`,
    });
  } catch (error) {
    console.error("Bulk archive error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update emails" },
      { status: 500 }
    );
  }
}
