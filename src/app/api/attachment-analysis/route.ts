/**
 * Attachment Analysis API
 * 
 * Provides AI-powered attachment analysis for claim detection:
 * - Document type classification (claim form, policy schedule, etc.)
 * - Data extraction from claim forms and policy schedules
 * - Claim likelihood scoring based on attachment content
 * - UNIFIED analysis combining email body + ALL attachments
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  analyzeAttachment,
  analyzeAllAttachments,
  learnFromFeedback,
  getLearnedPatterns,
  performUnifiedAnalysis,
} from "@/lib/attachment-ai-analyzer";

// GET: Retrieve attachment analysis for an email
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("emailId");
    const action = searchParams.get("action") || "get";

    if (!emailId) {
      return NextResponse.json(
        { error: "emailId parameter is required" },
        { status: 400 }
      );
    }

    if (action === "summary") {
      // Get email attachment summary
      const summary = await db.emailAttachmentSummary.findUnique({
        where: { emailQueueId: emailId },
      });

      const analyses = await db.attachmentAnalysis.findMany({
        where: { emailQueueId: emailId },
      });

      return NextResponse.json({
        summary,
        analyses,
      });
    }

    if (action === "patterns") {
      // Get learned patterns for a company
      const companyContext = searchParams.get("companyContext");
      if (!companyContext) {
        return NextResponse.json(
          { error: "companyContext parameter is required for patterns action" },
          { status: 400 }
        );
      }

      const patterns = await getLearnedPatterns(companyContext);
      return NextResponse.json({ patterns });
    }

    // Default: Get all analysis for email
    const analyses = await db.attachmentAnalysis.findMany({
      where: { emailQueueId: emailId },
    });

    return NextResponse.json({ analyses });
  } catch (error) {
    console.error("Attachment analysis GET error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve attachment analysis" },
      { status: 500 }
    );
  }
}

// POST: Analyze attachments for an email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, emailId, attachments, companyContext, feedback } = body;

    if (action === "analyze") {
      // Analyze all attachments for an email
      if (!emailId) {
        return NextResponse.json(
          { error: "emailId is required for analyze action" },
          { status: 400 }
        );
      }

      // Check if email exists
      const email = await db.emailQueue.findUnique({
        where: { id: emailId },
      });

      if (!email) {
        return NextResponse.json(
          { error: "Email not found" },
          { status: 404 }
        );
      }

      // Parse attachments from email if not provided
      let attachmentsToAnalyze = attachments;
      if (!attachmentsToAnalyze && email.attachments) {
        try {
          attachmentsToAnalyze = JSON.parse(email.attachments);
        } catch {
          attachmentsToAnalyze = [];
        }
      }

      if (!attachmentsToAnalyze || attachmentsToAnalyze.length === 0) {
        return NextResponse.json({
          success: true,
          message: "No attachments to analyze",
          summary: null,
          analyses: [],
        });
      }

      // Run analysis
      const summary = await analyzeAllAttachments(
        emailId,
        attachmentsToAnalyze,
        companyContext || email.fromDomain || undefined
      );

      // Store the summary
      await db.emailAttachmentSummary.upsert({
        where: { emailQueueId: emailId },
        create: {
          emailQueueId: emailId,
          totalAttachments: summary.totalAttachments,
          claimRelatedAttachments: summary.claimRelatedAttachments,
          hasClaimForm: summary.hasClaimForm,
          hasPolicySchedule: summary.hasPolicySchedule,
          hasSupportingDocuments: summary.hasSupportingDocuments,
          combinedClaimData: JSON.stringify(summary.combinedClaimData),
          combinedPolicyData: JSON.stringify(summary.combinedPolicyData),
          overallClaimLikelihood: summary.overallClaimLikelihood,
          isLikelyNewClaim: summary.isLikelyNewClaim,
          confidenceLevel: summary.confidenceLevel,
          assessmentReason: summary.assessmentReason,
          keyIndicators: JSON.stringify(summary.keyIndicators),
          missingInformation: JSON.stringify(summary.missingInformation),
        },
        update: {
          totalAttachments: summary.totalAttachments,
          claimRelatedAttachments: summary.claimRelatedAttachments,
          hasClaimForm: summary.hasClaimForm,
          hasPolicySchedule: summary.hasPolicySchedule,
          hasSupportingDocuments: summary.hasSupportingDocuments,
          combinedClaimData: JSON.stringify(summary.combinedClaimData),
          combinedPolicyData: JSON.stringify(summary.combinedPolicyData),
          overallClaimLikelihood: summary.overallClaimLikelihood,
          isLikelyNewClaim: summary.isLikelyNewClaim,
          confidenceLevel: summary.confidenceLevel,
          assessmentReason: summary.assessmentReason,
          keyIndicators: JSON.stringify(summary.keyIndicators),
          missingInformation: JSON.stringify(summary.missingInformation),
        },
      });

      // Update email classification if attachment analysis strongly indicates a claim
      if (summary.isLikelyNewClaim && summary.confidenceLevel === "HIGH") {
        await db.emailQueue.update({
          where: { id: emailId },
          data: {
            aiClassification: "NEW_CLAIM",
            aiConfidence: summary.overallClaimLikelihood / 100,
            aiReasoning: `Attachment analysis: ${summary.assessmentReason}`,
          },
        });
      }

      return NextResponse.json({
        success: true,
        summary: {
          ...summary,
          combinedClaimData: JSON.parse(JSON.stringify(summary.combinedClaimData)),
          combinedPolicyData: JSON.parse(JSON.stringify(summary.combinedPolicyData)),
        },
        analyses: summary.attachmentResults,
      });
    }

    if (action === "unified") {
      // UNIFIED ANALYSIS: Email body + ALL attachments together
      // This is the comprehensive analysis that checks EVERYTHING
      if (!emailId) {
        return NextResponse.json(
          { error: "emailId is required for unified analysis" },
          { status: 400 }
        );
      }

      // Get the email with all its data
      const email = await db.emailQueue.findUnique({
        where: { id: emailId },
      });

      if (!email) {
        return NextResponse.json(
          { error: "Email not found" },
          { status: 404 }
        );
      }

      // Parse attachments from email
      let attachmentsToAnalyze = attachments;
      if (!attachmentsToAnalyze && email.attachments) {
        try {
          attachmentsToAnalyze = JSON.parse(email.attachments);
        } catch {
          attachmentsToAnalyze = [];
        }
      }

      // Perform unified analysis - combines email body + ALL attachments
      const result = await performUnifiedAnalysis(
        emailId,
        {
          subject: email.subject,
          from: email.from,
          bodyText: email.bodyText,
        },
        attachmentsToAnalyze || [],
        companyContext || email.fromDomain || undefined
      );

      return NextResponse.json({
        success: true,
        unifiedAnalysis: result,
        message: `Analyzed email body + ${result.documentsAnalyzed.attachments.length} attachments`,
      });
    }

    if (action === "feedback") {
      // Learn from user feedback
      if (!emailId || !feedback) {
        return NextResponse.json(
          { error: "emailId and feedback are required for feedback action" },
          { status: 400 }
        );
      }

      await learnFromFeedback(
        emailId,
        feedback.attachmentId,
        feedback.fieldName,
        feedback.originalValue,
        feedback.correctedValue,
        companyContext
      );

      return NextResponse.json({
        success: true,
        message: "Feedback recorded successfully",
      });
    }

    if (action === "analyze-single") {
      // Analyze a single attachment
      if (!emailId || !attachments || attachments.length === 0) {
        return NextResponse.json(
          { error: "emailId and attachments are required for analyze-single action" },
          { status: 400 }
        );
      }

      const attachment = attachments[0];
      const result = await analyzeAttachment(
        emailId,
        attachment,
        companyContext
      );

      return NextResponse.json({
        success: true,
        result,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'analyze', 'unified', 'feedback', or 'analyze-single'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Attachment analysis POST error:", error);
    return NextResponse.json(
      { error: "Failed to process attachment analysis", details: String(error) },
      { status: 500 }
    );
  }
}
