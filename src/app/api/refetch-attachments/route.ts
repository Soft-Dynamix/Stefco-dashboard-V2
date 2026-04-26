import { NextRequest, NextResponse } from "next/server";
import { 
  refetchEmailsWithAttachments, 
  refetchSingleEmailAttachments,
  getAttachmentStats 
} from "@/lib/attachment-extractor";
import { db } from "@/lib/db";

/**
 * GET /api/refetch-attachments
 * Get attachment statistics
 */
export async function GET() {
  try {
    const stats = await getAttachmentStats();
    
    // Get list of emails that could benefit from attachment refetch
    // Only "active" emails (PENDING, AI_ANALYZED, USER_REVIEWING, CLAIM_CREATED)
    const emailsNeedingRefetch = await db.emailQueue.findMany({
      where: {
        OR: [
          { attachments: null },
          { attachments: "[]" },
          { attachments: "" },
        ],
        status: {
          in: ["PENDING", "AI_ANALYZED", "USER_REVIEWING", "CLAIM_CREATED"]
        },
      },
      orderBy: { receivedAt: "desc" },
      take: 20,
      select: {
        id: true,
        messageId: true,
        subject: true,
        from: true,
        fromDomain: true,
        receivedAt: true,
        status: true,
      },
    });

    return NextResponse.json({
      stats,
      emailsNeedingRefetch,
      totalNeedingRefetch: stats.activeEmailsNeedingRefetch,
    });
  } catch (error) {
    console.error("Failed to get attachment stats:", error);
    return NextResponse.json(
      { error: "Failed to get attachment statistics" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/refetch-attachments
 * Refetch attachments for emails
 * 
 * Body options:
 * - limit: number (default 50) - max emails to process
 * - emailId: string (optional) - specific email ID to refetch
 * - messageId: string (optional) - specific message ID to refetch
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;
    const emailId = body.emailId;
    const messageId = body.messageId;

    // If specific email requested
    if (emailId || messageId) {
      // Find the email in database
      const email = emailId 
        ? await db.emailQueue.findUnique({ where: { id: emailId } })
        : await db.emailQueue.findUnique({ where: { messageId } });

      if (!email) {
        return NextResponse.json(
          { error: "Email not found in database" },
          { status: 404 }
        );
      }

      // Use subject and date as fallback matching if Message-ID is generated
      const result = await refetchSingleEmailAttachments(
        email.messageId || '',
        email.subject,
        email.emailDate
      );

      if (result.success && result.attachments.length > 0) {
        // Update the email with attachments
        const attachmentMetadata = result.attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          size: a.size,
          contentId: a.contentId,
          contentBase64: a.size < 5 * 1024 * 1024 ? a.contentBase64 : undefined,
        }));

        await db.emailQueue.update({
          where: { id: email.id },
          data: {
            attachments: JSON.stringify(attachmentMetadata),
          },
        });

        // Store in attachment data table
        for (const attachment of result.attachments) {
          await db.attachmentData.upsert({
            where: { id: `${email.id}-${attachment.filename}` },
            create: {
              emailQueueId: email.id,
              fileName: attachment.filename,
              fileType: attachment.contentType.startsWith('image/') ? 'IMAGE' :
                        attachment.contentType.includes('pdf') ? 'PDF' :
                        attachment.contentType.includes('word') ? 'DOC' : 'OTHER',
              fileSize: attachment.size,
              rawText: null,
            },
            update: {
              fileSize: attachment.size,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: `Found ${result.attachments.length} attachment(s)`,
          attachments: result.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
          emailId: email.id,
        });
      }

      return NextResponse.json({
        success: result.success,
        message: result.error || "No attachments found",
        attachments: [],
        emailId: email.id,
      });
    }

    // Batch refetch for all emails needing attachments
    const result = await refetchEmailsWithAttachments(limit);

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Processed ${result.processed} emails, found attachments in ${result.updated}`
        : "Failed to refetch attachments",
      processed: result.processed,
      updated: result.updated,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Refetch attachments error:", error);
    return NextResponse.json(
      { error: "Failed to refetch attachments", details: String(error) },
      { status: 500 }
    );
  }
}
