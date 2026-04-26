/**
 * Learning Feedback API
 * 
 * Compares AI predictions against actual claim data
 * Updates field accuracy metrics
 * Triggers learning from corrections
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { comparePredictionsVsActual, getDomainLearningProgress } from "@/lib/prediction-learning";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailId, claimId, actualData } = body;

    if (!emailId || !claimId || !actualData) {
      return NextResponse.json(
        { error: "Missing required fields: emailId, claimId, actualData" },
        { status: 400 }
      );
    }

    // Compare predictions vs actual
    const result = await comparePredictionsVsActual(emailId, claimId, actualData);

    // Get email for sender domain
    const email = await db.emailQueue.findUnique({
      where: { id: emailId }
    });

    // Get learning progress for this domain
    let progress = null;
    if (email?.fromDomain) {
      progress = await getDomainLearningProgress(email.fromDomain);
    }

    // Create audit log
    await db.auditLogs.create({
      data: {
        action: "LEARNING_FEEDBACK",
        entityType: "claim",
        entityId: claimId,
        details: JSON.stringify({
          emailId,
          accuracyRate: result.accuracyRate,
          correctFields: result.correctFields,
          totalFields: result.totalFields,
          autoClaimReady: result.autoClaimReady
        }),
        status: "completed"
      }
    });

    return NextResponse.json({
      success: true,
      comparison: {
        totalFields: result.totalFields,
        correctFields: result.correctFields,
        accuracyRate: result.accuracyRate
      },
      improvements: result.improvements,
      autoClaimReady: result.autoClaimReady,
      progress
    });

  } catch (error) {
    console.error("Learning feedback error:", error);
    return NextResponse.json(
      { error: "Failed to process learning feedback", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    if (!domain) {
      return NextResponse.json(
        { error: "Missing domain parameter" },
        { status: 400 }
      );
    }

    const progress = await getDomainLearningProgress(domain);

    return NextResponse.json({
      domain,
      ...progress
    });

  } catch (error) {
    console.error("Get learning progress error:", error);
    return NextResponse.json(
      { error: "Failed to get learning progress" },
      { status: 500 }
    );
  }
}
