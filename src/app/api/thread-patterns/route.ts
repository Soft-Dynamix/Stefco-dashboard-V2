import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Get thread patterns
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const minProbability = parseFloat(searchParams.get("minProbability") || "0");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    const where: Record<string, unknown> = { isActive: true };
    if (domain) where.senderDomain = domain;
    if (minProbability > 0) {
      where.isFollowUpProbability = { gte: minProbability };
    }

    const patterns = await db.threadPattern.findMany({
      where,
      orderBy: [
        { followUpCount: "desc" },
        { isFollowUpProbability: "desc" },
      ],
      take: limit,
    });

    return NextResponse.json(patterns);
  } catch (error) {
    console.error("Error fetching thread patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch thread patterns" },
      { status: 500 }
    );
  }
}

// POST - Check if a subject is likely a follow-up
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderDomain, subject } = body;

    if (!senderDomain || !subject) {
      return NextResponse.json(
        { error: "senderDomain and subject are required" },
        { status: 400 }
      );
    }

    // Normalize subject
    const normalizedSubject = normalizeSubject(subject);
    const prefixMatch = subject.match(/^(re|fwd|fw|aw|sv|antw):/i);
    const hasReplyPrefix = !!prefixMatch;

    // Check for existing pattern
    const existingPattern = await db.threadPattern.findUnique({
      where: {
        senderDomain_normalizedSubject: {
          senderDomain,
          normalizedSubject,
        },
      },
    });

    // Calculate follow-up probability
    let isFollowUpProbability = 0;
    let isKnownThread = false;

    if (existingPattern) {
      isFollowUpProbability = existingPattern.isFollowUpProbability;
      isKnownThread = true;
    } else if (hasReplyPrefix) {
      // Default probability for reply prefixes without training data
      isFollowUpProbability = 0.7;
    }

    // Get sender-level follow-up stats
    const senderPatterns = await db.threadPattern.findMany({
      where: { senderDomain, isActive: true },
    });

    const senderFollowUpRate = senderPatterns.length > 0
      ? senderPatterns.reduce((sum, p) => sum + p.isFollowUpProbability, 0) / senderPatterns.length
      : 0.5;

    return NextResponse.json({
      isLikelyFollowUp: isFollowUpProbability > 0.6,
      isKnownThread,
      isFollowUpProbability,
      hasReplyPrefix,
      normalizedSubject,
      senderFollowUpRate,
      recommendation: isFollowUpProbability > 0.8
        ? "Strong indication this is a follow-up"
        : isFollowUpProbability > 0.6
        ? "Likely a follow-up email"
        : hasReplyPrefix
        ? "Has reply prefix but unknown pattern"
        : "Unknown - proceed with normal classification",
    });
  } catch (error) {
    console.error("Error checking thread pattern:", error);
    return NextResponse.json(
      { error: "Failed to check thread pattern" },
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
