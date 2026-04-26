import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10000");
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status && status !== "all") {
      where.status = status;
    } else if (!status || status === "all") {
      // Exclude archived and ignored emails from "All Statuses" view
      where.status = { notIn: ["ARCHIVED", "IGNORED"] };
    }

    const [emails, total] = await Promise.all([
      db.emailQueue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: "desc" },
      }),
      db.emailQueue.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Email inbox GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/email-inbox
 * Delete one or more emails from the queue
 * 
 * Body options:
 * - emailId: string - single email ID to delete
 * - emailIds: string[] - array of email IDs to delete (bulk)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailId, emailIds } = body;

    // Determine which IDs to delete
    const idsToDelete: string[] = [];
    
    if (emailId) {
      idsToDelete.push(emailId);
    }
    if (emailIds && Array.isArray(emailIds)) {
      idsToDelete.push(...emailIds);
    }

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { error: "No email ID(s) provided" },
        { status: 400 }
      );
    }

    // First, delete related records that reference these emails
    // Delete predictions
    await db.prediction.deleteMany({
      where: { emailQueueId: { in: idsToDelete } }
    });

    // Delete attachment analyses
    await db.attachmentAnalysis.deleteMany({
      where: { emailQueueId: { in: idsToDelete } }
    });

    // Delete email attachment summaries
    await db.emailAttachmentSummary.deleteMany({
      where: { emailQueueId: { in: idsToDelete } }
    });

    // Delete attachment data
    await db.attachmentData.deleteMany({
      where: { emailQueueId: { in: idsToDelete } }
    });

    // Delete extracted entities
    await db.extractedEntity.deleteMany({
      where: { emailQueueId: { in: idsToDelete } }
    });

    // Now delete the emails themselves
    const result = await db.emailQueue.deleteMany({
      where: {
        id: { in: idsToDelete }
      }
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "emails_deleted",
        entityType: "email_queue",
        details: JSON.stringify({ 
          count: result.count, 
          ids: idsToDelete 
        }),
        status: "SUCCESS",
        processedBy: "USER",
      }
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Deleted ${result.count} email(s)`
    });
  } catch (error) {
    console.error("Email delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete email(s)" },
      { status: 500 }
    );
  }
}
