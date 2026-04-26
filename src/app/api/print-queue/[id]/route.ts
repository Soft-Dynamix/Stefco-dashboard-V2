import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const item = await db.printQueueItem.update({
      where: { id },
      data: {
        printStatus: body.printStatus,
        printedAt: body.printedAt ? new Date(body.printedAt) : null,
        printedBy: body.printedBy,
        errorMessage: body.errorMessage,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "print_status_updated",
        entityType: "print_queue_item",
        entityId: item.id,
        details: JSON.stringify({ status: body.printStatus }),
        status: "SUCCESS",
        processedBy: body.printedBy || "SYSTEM",
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Print queue PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update print queue item" },
      { status: 500 }
    );
  }
}
