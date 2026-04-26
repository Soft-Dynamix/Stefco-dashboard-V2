/**
 * Attachments API
 * 
 * Provides endpoints to retrieve, preview, download, and delete email attachments
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET: Retrieve attachment content for preview/download
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("emailId");
    const filename = searchParams.get("filename");
    const action = searchParams.get("action") || "list"; // list, download, preview

    if (!emailId) {
      return NextResponse.json(
        { error: "emailId parameter is required" },
        { status: 400 }
      );
    }

    // Get the email with attachments
    const email = await db.emailQueue.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        subject: true,
        attachments: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Parse attachments
    let attachments: Array<{
      filename: string;
      contentType?: string;
      mimeType?: string;
      size?: number;
      content?: string;
      contentBase64?: string;
    }> = [];

    if (email.attachments && email.attachments !== "NO_ATTACHMENTS") {
      try {
        attachments = JSON.parse(email.attachments);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse attachments" },
          { status: 500 }
        );
      }
    }

    // List all attachments
    if (action === "list") {
      const attachmentList = attachments.map((att, index) => ({
        id: index.toString(),
        filename: att.filename,
        contentType: att.contentType || att.mimeType || "application/octet-stream",
        size: att.size || (att.content?.length || att.contentBase64?.length || 0),
        hasContent: !!(att.content || att.contentBase64),
      }));

      return NextResponse.json({
        emailId: email.id,
        emailSubject: email.subject,
        attachments: attachmentList,
      });
    }

    // Download or preview specific attachment
    if ((action === "download" || action === "preview") && filename) {
      const attachment = attachments.find(
        (att) => att.filename === filename || decodeURIComponent(att.filename) === filename
      );

      if (!attachment) {
        return NextResponse.json(
          { error: "Attachment not found" },
          { status: 404 }
        );
      }

      // Get content - handle both formats
      let content = attachment.content || attachment.contentBase64 || "";
      let mimeType = attachment.contentType || attachment.mimeType || "application/octet-stream";

      // If content is a data URL, extract the base64 part
      if (content.startsWith("data:")) {
        const matches = content.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          mimeType = matches[1];
          content = matches[2];
        }
      }

      if (!content) {
        return NextResponse.json(
          { error: "Attachment has no content" },
          { status: 404 }
        );
      }

      // Decode base64 to buffer
      const buffer = Buffer.from(content, "base64");

      // Set appropriate headers
      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Length": buffer.length.toString(),
      };

      if (action === "download") {
        headers["Content-Disposition"] = `attachment; filename="${attachment.filename}"`;
      } else {
        headers["Content-Disposition"] = `inline; filename="${attachment.filename}"`;
      }

      return new NextResponse(buffer, {
        status: 200,
        headers,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'list', 'download', or 'preview'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Attachments API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve attachments" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an attachment from an email
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("emailId");
    const filename = searchParams.get("filename");

    if (!emailId || !filename) {
      return NextResponse.json(
        { error: "Both emailId and filename parameters are required" },
        { status: 400 }
      );
    }

    // Get the email with attachments
    const email = await db.emailQueue.findUnique({
      where: { id: emailId },
      select: {
        id: true,
        attachments: true,
      },
    });

    if (!email) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Parse attachments
    let attachments: Array<{
      filename: string;
      contentType?: string;
      mimeType?: string;
      size?: number;
      content?: string;
      contentBase64?: string;
    }> = [];

    if (email.attachments && email.attachments !== "NO_ATTACHMENTS") {
      try {
        attachments = JSON.parse(email.attachments);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse attachments" },
          { status: 500 }
        );
      }
    }

    // Find and remove the attachment
    const attachmentIndex = attachments.findIndex(
      (att) => att.filename === filename || decodeURIComponent(att.filename) === filename
    );

    if (attachmentIndex === -1) {
      return NextResponse.json(
        { error: "Attachment not found" },
        { status: 404 }
      );
    }

    // Remove the attachment
    const removedAttachment = attachments.splice(attachmentIndex, 1)[0];

    // Update the email with the new attachments list
    const newAttachmentsValue = attachments.length > 0 
      ? JSON.stringify(attachments) 
      : "NO_ATTACHMENTS";

    await db.emailQueue.update({
      where: { id: emailId },
      data: {
        attachments: newAttachmentsValue,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Attachment "${removedAttachment.filename}" removed successfully`,
      updatedAttachments: attachments,
    });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return NextResponse.json(
      { error: "Failed to delete attachment" },
      { status: 500 }
    );
  }
}
