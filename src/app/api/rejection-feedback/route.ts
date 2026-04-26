import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Submit rejection feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      emailQueueId,
      rejectionCategory,
      rejectionReason,
      isFollowUp,
      relatedClaimId,
      applyToSender,
      applyToHistorical,
      suggestedRule,
    } = body;

    // Get the email details
    const email = await db.emailQueue.findUnique({
      where: { id: emailQueueId },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Normalize subject for thread detection
    const normalizedSubject = normalizeSubject(email.subject || "");

    // Store the rejection feedback
    const feedback = await db.rejectionFeedback.create({
      data: {
        emailQueueId,
        originalClassification: email.aiClassification,
        originalConfidence: email.aiConfidence,
        rejectionCategory,
        rejectionReason,
        isFollowUp: isFollowUp || false,
        relatedClaimId,
        threadSubject: normalizedSubject,
        applyToSender: applyToSender || false,
        suggestedRule,
        emailSubject: email.subject,
        emailFrom: email.from,
        emailFromDomain: email.fromDomain,
      },
    });

    // Update email status to IGNORED
    await db.emailQueue.update({
      where: { id: emailQueueId },
      data: {
        status: "IGNORED",
        ignoreReason: rejectionReason,
        ignoreCategory: rejectionCategory,
        processedAt: new Date(),
      },
    });

    // If this is a follow-up, update/create thread pattern
    if (isFollowUp && email.fromDomain && normalizedSubject) {
      await upsertThreadPattern(
        email.fromDomain,
        email.subject || "",
        normalizedSubject,
        true
      );
    }

    // If apply to sender, create/update sender ignore rule
    if (applyToSender && email.fromDomain) {
      const existingRule = await db.senderIgnoreRule.findUnique({
        where: {
          senderDomain_category: {
            senderDomain: email.fromDomain,
            category: rejectionCategory,
          },
        },
      });

      const newIgnoreCount = (existingRule?.ignoreCount || 0) + 1;
      
      // Enable auto-ignore after 3 ignores from same domain with same category
      const shouldAutoIgnore = newIgnoreCount >= 3;

      await db.senderIgnoreRule.upsert({
        where: {
          senderDomain_category: {
            senderDomain: email.fromDomain,
            category: rejectionCategory,
          },
        },
        create: {
          senderDomain: email.fromDomain,
          category: rejectionCategory,
          reason: rejectionReason || suggestedRule,
          autoIgnore: false, // First time, need more evidence
          isActive: true,
        },
        update: {
          ignoreCount: newIgnoreCount,
          reason: rejectionReason || suggestedRule,
          autoIgnore: shouldAutoIgnore, // Enable auto-ignore after 3+ ignores
          isActive: true,
        },
      });

      // Log when auto-ignore is enabled
      if (shouldAutoIgnore && !existingRule?.autoIgnore) {
        await db.auditLog.create({
          data: {
            action: "auto_ignore_enabled",
            entityType: "sender_domain",
            entityId: email.fromDomain,
            details: JSON.stringify({
              domain: email.fromDomain,
              category: rejectionCategory,
              ignoreCount: newIgnoreCount,
              reason: "Auto-ignore enabled after 3+ manual ignores",
            }),
            status: "SUCCESS",
            processedBy: "SYSTEM",
          },
        });
      }

      // If applyToHistorical is true, also ignore all historical emails from this domain
      let historicalEmailsCount = 0;
      if (applyToHistorical && email.fromDomain) {
        // Update all non-ignored, non-archived emails from this domain
        const updateResult = await db.emailQueue.updateMany({
          where: {
            fromDomain: email.fromDomain,
            status: {
              notIn: ["IGNORED", "ARCHIVED", "CLAIM_CREATED"],
            },
          },
          data: {
            status: "IGNORED",
            ignoreReason: rejectionReason || `Domain ${email.fromDomain} added to ignore list`,
            ignoreCategory: rejectionCategory,
            processedAt: new Date(),
          },
        });
        historicalEmailsCount = updateResult.count;

        // Log bulk ignore action
        if (historicalEmailsCount > 0) {
          await db.auditLog.create({
            data: {
              action: "bulk_ignore_historical_emails",
              entityType: "sender_domain",
              entityId: email.fromDomain,
              details: JSON.stringify({
                domain: email.fromDomain,
                category: rejectionCategory,
                emailsIgnored: historicalEmailsCount,
                reason: rejectionReason || "Domain added to ignore list",
              }),
              status: "SUCCESS",
              processedBy: "SYSTEM",
            },
          });
        }
      }
    }

    // Update sender pattern stats
    if (email.fromDomain) {
      await updateSenderPattern(email.fromDomain, false);
    }

    // Update classification knowledge for AI learning
    if (email.aiClassification !== "IGNORE") {
      await db.classificationKnowledge.create({
        data: {
          senderDomain: email.fromDomain || "unknown",
          subject: email.subject?.substring(0, 200),
          bodySnippet: email.bodyText?.substring(0, 200),
          originalClassification: email.aiClassification,
          correctedClassification: "IGNORE",
          confidence: email.aiConfidence,
          isActive: true,
        },
      });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        action: "email_rejected_with_feedback",
        entityType: "email",
        entityId: emailQueueId,
        details: JSON.stringify({
          category: rejectionCategory,
          isFollowUp,
          applyToSender,
          originalClassification: email.aiClassification,
        }),
        status: "SUCCESS",
      },
    });

    return NextResponse.json({ 
      success: true, 
      feedback,
      historicalEmailsIgnored: applyToHistorical && email.fromDomain ? 
        (await db.emailQueue.count({
          where: {
            fromDomain: email.fromDomain,
            status: "IGNORED",
          },
        })) - 1 : 0, // -1 because we already counted the current email
    });
  } catch (error) {
    console.error("Error submitting rejection feedback:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500 }
    );
  }
}

// GET - Get feedback history
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const where: Record<string, unknown> = {};
    if (domain) where.emailFromDomain = domain;
    if (category) where.rejectionCategory = category;

    const feedback = await db.rejectionFeedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(feedback);
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedback" },
      { status: 500 }
    );
  }
}

// Helper: Normalize subject for thread detection
function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re|fwd|fw|aw|sv|antw):\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}

// Helper: Update thread pattern
async function upsertThreadPattern(
  senderDomain: string,
  originalSubject: string,
  normalizedSubject: string,
  isFollowUp: boolean
) {
  const prefixMatch = originalSubject.match(/^(re|fwd|fw|aw|sv|antw):/i);
  const subjectPrefix = prefixMatch ? prefixMatch[1].toUpperCase() : null;

  const existing = await db.threadPattern.findUnique({
    where: {
      senderDomain_normalizedSubject: {
        senderDomain,
        normalizedSubject,
      },
    },
  });

  if (existing) {
    await db.threadPattern.update({
      where: { id: existing.id },
      data: {
        followUpCount: isFollowUp ? { increment: 1 } : existing.followUpCount,
        newClaimCount: !isFollowUp ? { increment: 1 } : existing.newClaimCount,
        isFollowUpProbability:
          (existing.followUpCount + (isFollowUp ? 1 : 0)) /
          (existing.followUpCount + existing.newClaimCount + 1),
      },
    });
  } else {
    await db.threadPattern.create({
      data: {
        senderDomain,
        subjectPrefix,
        normalizedSubject,
        followUpCount: isFollowUp ? 1 : 0,
        newClaimCount: !isFollowUp ? 1 : 0,
        isFollowUpProbability: isFollowUp ? 1 : 0,
      },
    });
  }
}

// Helper: Update sender pattern stats
async function updateSenderPattern(domain: string, isCorrect: boolean) {
  const existing = await db.senderPattern.findUnique({
    where: { senderDomain: domain },
  });

  if (existing) {
    await db.senderPattern.update({
      where: { senderDomain: domain },
      data: {
        ignoreCount: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : existing.correctCount,
        accuracyRate:
          ((existing.correctCount + (isCorrect ? 1 : 0)) /
            (existing.totalEmails + 1)) *
          100,
      },
    });
  } else {
    await db.senderPattern.create({
      data: {
        senderDomain: domain,
        totalEmails: 1,
        ignoreCount: 1,
        correctCount: isCorrect ? 1 : 0,
        accuracyRate: isCorrect ? 100 : 0,
      },
    });
  }
}
