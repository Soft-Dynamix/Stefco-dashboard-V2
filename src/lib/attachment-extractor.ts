/**
 * Attachment Extractor Module for STEFCO Claims Dashboard
 * 
 * Parses raw email MIME source to extract attachment metadata and content.
 * Supports both extracting from raw email source and refetching from IMAP.
 */

import { ImapFlow } from "imapflow";
import { db } from "./db";

export interface ExtractedAttachment {
  filename: string;
  contentType: string;
  size: number;
  contentId?: string;
  content?: Buffer; // Actual attachment content (base64 decoded)
  contentBase64?: string; // Base64 encoded content for storage
}

export interface EmailWithAttachments {
  messageId: string;
  subject: string | null;
  from: string | null;
  fromDomain: string | null;
  to: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: ExtractedAttachment[];
  date: Date | null;
}

/**
 * Parse MIME boundary from email source
 */
function parseMIMEBoundary(source: string): string | null {
  const boundaryMatch = source.match(/boundary=["']?([^"'\r\n]+)["']?/i);
  return boundaryMatch ? boundaryMatch[1] : null;
}

/**
 * Extract all parts from a multipart email source
 */
function extractParts(source: string, boundary: string): Array<{
  headers: Record<string, string>;
  content: string;
  raw: string;
}> {
  const parts: Array<{ headers: Record<string, string>; content: string; raw: string }> = [];
  
  // Split by boundary
  const boundaryRegex = new RegExp(`--${escapeRegex(boundary)}`, 'g');
  const splits = source.split(boundaryRegex);
  
  for (let i = 1; i < splits.length; i++) {
    const part = splits[i];
    
    // Skip the final boundary marker
    if (part.trim() === '--' || part.trim() === '--\r\n' || part.trim() === '') continue;
    
    // Parse headers and content
    const headerEndIndex = part.indexOf('\r\n\r\n');
    if (headerEndIndex === -1) continue;
    
    const headerSection = part.substring(0, headerEndIndex);
    let content = part.substring(headerEndIndex + 4);
    
    // Parse headers
    const headers: Record<string, string> = {};
    const headerLines = headerSection.split('\r\n');
    let currentHeader = '';
    
    for (const line of headerLines) {
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // Continuation of previous header
        if (currentHeader) {
          headers[currentHeader] += ' ' + line.trim();
        }
      } else {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentHeader = line.substring(0, colonIndex).toLowerCase().trim();
          headers[currentHeader] = line.substring(colonIndex + 1).trim();
        }
      }
    }
    
    // Remove trailing boundary marker if present
    content = content.replace(/\r\n--[^-]*$/, '').trim();
    
    parts.push({ headers, content, raw: part });
  }
  
  return parts;
}

/**
 * Escape regex special characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decode content based on Content-Transfer-Encoding
 */
function decodeContent(content: string, encoding: string): Buffer {
  const cleanContent = content.replace(/\r\n/g, '').trim();
  
  switch (encoding.toLowerCase()) {
    case 'base64':
      try {
        return Buffer.from(cleanContent, 'base64');
      } catch {
        return Buffer.from(content);
      }
    
    case 'quoted-printable':
      const decoded = content
        .replace(/=\r\n/g, '')
        .replace(/=([0-9A-F]{2})/gi, (_, hex) => 
          String.fromCharCode(parseInt(hex, 16))
        );
      return Buffer.from(decoded);
    
    default:
      return Buffer.from(content);
  }
}

/**
 * Extract filename from Content-Disposition header
 */
function extractFilename(headers: Record<string, string>): string {
  const contentDisposition = headers['content-disposition'] || '';
  const filenameMatch = contentDisposition.match(/filename=["']?([^"';\r\n]+)["']?/i);
  
  if (filenameMatch) {
    return filenameMatch[1];
  }
  
  // Try Content-Type name parameter
  const contentType = headers['content-type'] || '';
  const nameMatch = contentType.match(/name=["']?([^"';\r\n]+)["']?/i);
  
  return nameMatch ? nameMatch[1] : 'unknown-attachment';
}

/**
 * Determine if a part is an attachment (not inline text/html)
 */
function isAttachment(headers: Record<string, string>): boolean {
  const contentDisposition = (headers['content-disposition'] || '').toLowerCase();
  const contentType = (headers['content-type'] || '').toLowerCase();
  
  // It's an attachment if:
  // 1. Content-Disposition is "attachment"
  // 2. Or it has a filename but is not text/plain or text/html inline
  if (contentDisposition.includes('attachment')) {
    return true;
  }
  
  // Check if it has a filename and is not the main body
  const hasFilename = /filename=/i.test(headers['content-disposition'] || '') ||
                      /name=/i.test(headers['content-type'] || '');
  
  if (hasFilename && !contentDisposition.includes('inline')) {
    // Skip inline text/plain and text/html that are the email body
    if (contentType.includes('text/plain') || contentType.includes('text/html')) {
      return contentDisposition.includes('attachment');
    }
    return true;
  }
  
  // PDF, images, documents are always attachments
  if (contentType.includes('application/pdf') ||
      contentType.includes('image/') ||
      contentType.includes('application/msword') ||
      contentType.includes('application/vnd.openxmlformats') ||
      contentType.includes('application/zip') ||
      contentType.includes('application/x-zip')) {
    return true;
  }
  
  return false;
}

/**
 * Extract attachments from raw email source
 */
export function extractAttachmentsFromSource(source: string): ExtractedAttachment[] {
  const attachments: ExtractedAttachment[] = [];
  
  try {
    // Check if this is a multipart message
    const contentTypeMatch = source.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n]+)["']?/i);
    
    if (!contentTypeMatch) {
      // Not multipart, check for single attachment
      return attachments;
    }
    
    const boundary = contentTypeMatch[1];
    const parts = extractParts(source, boundary);
    
    for (const part of parts) {
      if (isAttachment(part.headers)) {
        const encoding = part.headers['content-transfer-encoding'] || '7bit';
        const content = decodeContent(part.content, encoding);
        const filename = extractFilename(part.headers);
        const contentType = part.headers['content-type']?.split(';')[0].trim() || 'application/octet-stream';
        
        // Skip very small attachments (likely artifacts)
        if (content.length < 10) continue;
        
        attachments.push({
          filename,
          contentType,
          size: content.length,
          contentId: part.headers['content-id'],
          content,
          contentBase64: content.toString('base64'),
        });
      }
    }
  } catch (error) {
    console.error('Error extracting attachments from source:', error);
  }
  
  return attachments;
}

// Get headers safely
const headers: Record<string, string> = {};

/**
 * Extract attachment metadata only (no content) from email source
 * This is lighter and used for initial email polling
 */
export function extractAttachmentMetadataFromSource(source: string): Array<{
  filename: string;
  contentType: string;
  size: number;
}> {
  const metadata: Array<{ filename: string; contentType: string; size: number }> = [];
  
  try {
    const contentTypeMatch = source.match(/Content-Type:\s*multipart\/[^;]+;\s*boundary=["']?([^"'\r\n]+)["']?/i);
    
    if (!contentTypeMatch) {
      return metadata;
    }
    
    const boundary = contentTypeMatch[1];
    const parts = extractParts(source, boundary);
    
    for (const part of parts) {
      if (isAttachment(part.headers)) {
        const encoding = part.headers['content-transfer-encoding'] || '7bit';
        const content = decodeContent(part.content, encoding);
        const filename = extractFilename(part.headers);
        const contentType = part.headers['content-type']?.split(';')[0].trim() || 'application/octet-stream';
        
        if (content.length < 10) continue;
        
        metadata.push({
          filename,
          contentType,
          size: content.length,
        });
      }
    }
  } catch (error) {
    console.error('Error extracting attachment metadata from source:', error);
  }
  
  return metadata;
}

/**
 * Get IMAP configuration from database
 */
async function getImapConfig() {
  try {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD", "IMAP_SSL", "IMAP_TLS"],
        },
      },
    });

    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const host = configMap.get("IMAP_HOST");
    const user = configMap.get("IMAP_USER");
    const password = configMap.get("IMAP_PASSWORD");

    if (!host || !user || !password) {
      return null;
    }

    return {
      host,
      port: parseInt(configMap.get("IMAP_PORT") || "993"),
      user,
      password,
      ssl: configMap.get("IMAP_SSL") !== "false",
      tls: true,
    };
  } catch (error) {
    console.error("Failed to get IMAP config:", error);
    return null;
  }
}

/**
 * Refetch emails with attachment content from IMAP
 * This function fetches emails that already exist in the database but have no attachments,
 * and extracts their attachment content.
 */
export async function refetchEmailsWithAttachments(limit: number = 50): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  errors: string[];
}> {
  const config = await getImapConfig();
  
  if (!config) {
    return {
      success: false,
      processed: 0,
      updated: 0,
      errors: ["IMAP not configured. Please set up IMAP settings."],
    };
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.ssl,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  const errors: string[] = [];
  let updated = 0;

  try {
    // Find emails that have no attachment metadata OR need attachment content
    // Only process "active" emails (PENDING, AI_ANALYZED, USER_REVIEWING, CLAIM_CREATED)
    // Skip ARCHIVED and IGNORED emails which are usually marketing/spam
    const emailsNeedingAttachments = await db.emailQueue.findMany({
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
      take: limit,
    });

    if (emailsNeedingAttachments.length === 0) {
      return { success: true, processed: 0, updated: 0, errors: [] };
    }

    await client.connect();
    await client.mailboxOpen("INBOX");

    // Get message IDs to search for
    const messageIdsToFind = emailsNeedingAttachments
      .filter(e => e.messageId)
      .map(e => e.messageId);

    // Fetch all messages and find matching ones
    const mailbox = await client.mailboxOpen("INBOX");
    const totalMessages = mailbox.exists || 0;

    if (totalMessages === 0) {
      await client.logout();
      return { success: true, processed: 0, updated: 0, errors: [] };
    }

    // Search through messages to find the ones we need
    const matchedEmailIds = new Set<string>(); // Track which emails were matched in IMAP
    
    for await (const message of client.fetch('1:*', { source: true, envelope: true })) {
      if (processed >= limit) break;

      try {
        const source = message.source?.toString("utf-8") || "";
        const envelope = message.envelope;

        // Extract Message-ID from source
        const headerMessageId = source.match(/Message-ID:\s*<([^>]+)>/i)?.[1];
        
        // Find matching email in our list
        const matchingEmail = emailsNeedingAttachments.find(e => 
          e.messageId === headerMessageId ||
          (e.subject === envelope.subject && Math.abs((e.emailDate?.getTime() || 0) - (envelope.date?.getTime() || 0)) < 60000)
        );

        if (!matchingEmail) continue;

        // Mark this email as matched
        matchedEmailIds.add(matchingEmail.id);

        // Extract attachments from this message
        const attachments = extractAttachmentsFromSource(source);

        // Always update the email record to mark it as "checked for attachments"
        // This prevents re-processing emails that legitimately have no attachments
        if (attachments.length > 0) {
          // Store attachment metadata with content for smaller attachments
          const attachmentMetadata = attachments.map(a => {
            // Create proper data URL format for the content
            const contentDataUrl = a.contentBase64 
              ? `data:${a.contentType};base64,${a.contentBase64}`
              : undefined;
            
            return {
              filename: a.filename,
              contentType: a.contentType,
              mimeType: a.contentType, // Add mimeType for compatibility
              size: a.size,
              contentId: a.contentId,
              // Store as both formats for compatibility
              contentBase64: a.size < 5 * 1024 * 1024 ? a.contentBase64 : undefined,
              content: a.size < 5 * 1024 * 1024 ? contentDataUrl : undefined,
            };
          });

          // Update the email record with attachments
          await db.emailQueue.update({
            where: { id: matchingEmail.id },
            data: {
              attachments: JSON.stringify(attachmentMetadata),
            },
          });

          // Store individual attachments for AI analysis
          for (const attachment of attachments) {
            // Store in AttachmentData table for later analysis
            await db.attachmentData.upsert({
              where: {
                id: `${matchingEmail.id}-${attachment.filename}`,
              },
              create: {
                emailQueueId: matchingEmail.id,
                fileName: attachment.filename,
                fileType: attachment.contentType.startsWith('image/') ? 'IMAGE' :
                          attachment.contentType.includes('pdf') ? 'PDF' :
                          attachment.contentType.includes('word') ? 'DOC' : 'OTHER',
                fileSize: attachment.size,
                rawText: null, // Will be extracted later with AI
              },
              update: {
                fileSize: attachment.size,
              },
            });
          }

          updated++;
        } else {
          // Mark as checked but no attachments found (use special marker)
          // This prevents re-processing emails that legitimately have no attachments
          // We use "NO_ATTACHMENTS" as a marker that won't match the "needing refetch" query
          await db.emailQueue.update({
            where: { id: matchingEmail.id },
            data: {
              attachments: "NO_ATTACHMENTS", // Special marker for "checked, no attachments"
            },
          });
        }

      } catch (msgError) {
        errors.push(`Failed to process message: ${msgError}`);
      }
    }

    await client.logout();

    // Mark remaining emails that weren't found in IMAP as "NO_ATTACHMENTS"
    // This prevents them from showing up repeatedly in the refetch count
    const unmatchedEmailIds = emailsNeedingAttachments
      .filter(e => !matchedEmailIds.has(e.id))
      .map(e => e.id);
    
    if (unmatchedEmailIds.length > 0) {
      await db.emailQueue.updateMany({
        where: {
          id: { in: unmatchedEmailIds },
        },
        data: {
          attachments: "NO_ATTACHMENTS",
        },
      });
      console.log(`Marked ${unmatchedEmailIds.length} unmatched emails as NO_ATTACHMENTS`);
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "attachment_refetch_completed",
        entityType: "email",
        details: JSON.stringify({ 
          processed: matchedEmailIds.size, 
          updated, 
          markedAsNoAttachments: unmatchedEmailIds.length,
          errors: errors.length 
        }),
        status: errors.length > 0 ? "WARNING" : "SUCCESS",
        processedBy: "AUTO",
      },
    });

    return { success: true, processed: matchedEmailIds.size, updated, errors };
  } catch (error) {
    errors.push(`IMAP connection failed: ${error}`);
    
    await db.auditLog.create({
      data: {
        action: "attachment_refetch_failed",
        entityType: "system",
        details: JSON.stringify({ error: String(error) }),
        status: "ERROR",
        processedBy: "AUTO",
      },
    });

    return { success: false, processed, updated, errors };
  }
}

/**
 * Refetch a single email's attachments by Message-ID or subject+date
 */
export async function refetchSingleEmailAttachments(
  messageId: string,
  subject?: string | null,
  emailDate?: Date | null
): Promise<{
  success: boolean;
  attachments: ExtractedAttachment[];
  error?: string;
}> {
  const config = await getImapConfig();
  
  if (!config) {
    return {
      success: false,
      attachments: [],
      error: "IMAP not configured",
    };
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.ssl,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Search for the specific message by Message-ID or subject+date
    for await (const message of client.fetch('1:*', { source: true, envelope: true })) {
      const source = message.source?.toString("utf-8") || "";
      const envelope = message.envelope;
      const headerMessageId = source.match(/Message-ID:\s*<([^>]+)>/i)?.[1];
      
      // Match by Message-ID or by subject+date
      const matchesMessageId = headerMessageId === messageId;
      const matchesSubjectAndDate = subject && envelope.subject === subject && 
        emailDate && envelope.date && 
        Math.abs((emailDate.getTime()) - (envelope.date.getTime())) < 60000; // Within 1 minute
      
      if (matchesMessageId || matchesSubjectAndDate) {
        const attachments = extractAttachmentsFromSource(source);
        await client.logout();
        return { success: true, attachments };
      }
    }

    await client.logout();
    return {
      success: false,
      attachments: [],
      error: "Email not found in mailbox",
    };
  } catch (error) {
    return {
      success: false,
      attachments: [],
      error: String(error),
    };
  }
}

/**
 * Get attachment statistics for the inbox
 * Only counts "active" emails that could potentially be claim-related
 * (excludes ARCHIVED and IGNORED emails which are usually marketing/spam)
 */
export async function getAttachmentStats(): Promise<{
  totalEmails: number;
  emailsWithAttachments: number;
  emailsWithoutAttachments: number;
  totalAttachments: number;
  activeEmailsNeedingRefetch: number;
}> {
  // Total count (for reference)
  const totalEmails = await db.emailQueue.count();
  
  // Count emails with attachments (any status)
  const emailsWithAttachments = await db.emailQueue.count({
    where: {
      attachments: { not: null },
      NOT: { attachments: "[]" },
    },
  });
  
  // Count "active" emails (PENDING, AI_ANALYZED, USER_REVIEWING, CLAIM_CREATED) without attachments
  // These are the ones that could potentially be claim-related and might have attachments
  const activeEmailsNeedingRefetch = await db.emailQueue.count({
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
  });
  
  const attachmentRecords = await db.attachmentData.count();
  
  return {
    totalEmails,
    emailsWithAttachments,
    emailsWithoutAttachments: activeEmailsNeedingRefetch, // Now shows only active emails
    totalAttachments: attachmentRecords,
    activeEmailsNeedingRefetch,
  };
}
