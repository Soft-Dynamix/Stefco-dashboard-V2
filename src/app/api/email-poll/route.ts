import { NextRequest, NextResponse } from "next/server";
import { fetchEmails, getPollingStatus, fetchAndAnalyzeEmails, autoAnalyzeEmails, autoCreateClaims, runFullAutomationPipeline } from "@/lib/email-poller";
import { db } from "@/lib/db";

// GET - Get polling status
export async function GET() {
  try {
    const status = await getPollingStatus();
    
    // Get scheduler status from system config
    const schedulerConfig = await db.systemConfig.findUnique({
      where: { key: "EMAIL_POLLER_ENABLED" },
    });
    
    const intervalConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_POLL_INTERVAL" },
    });

    const autoAnalyzeConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_ANALYZE_ENABLED" },
    });

    const autoClaimConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_CLAIM_CREATION_ENABLED" },
    });

    // Get automation stats
    const domainStats = await db.domainProfile.groupBy({
      by: ['automationLevel'],
      _count: { id: true },
    });

    const automationStats = {
      manual: domainStats.find(d => d.automationLevel === 'manual')?._count.id || 0,
      semi: domainStats.find(d => d.automationLevel === 'semi')?._count.id || 0,
      auto: domainStats.find(d => d.automationLevel === 'auto')?._count.id || 0,
    };

    return NextResponse.json({
      ...status,
      schedulerEnabled: schedulerConfig?.value === "true",
      pollInterval: parseInt(intervalConfig?.value || "5"),
      // Auto-analyze is enabled by default (only disabled if explicitly set to "false")
      autoAnalyzeEnabled: autoAnalyzeConfig?.value !== "false",
      autoClaimCreationEnabled: autoClaimConfig?.value === "true",
      automationStats,
    });
  } catch (error) {
    console.error("Failed to get polling status:", error);
    return NextResponse.json(
      { error: "Failed to get polling status" },
      { status: 500 }
    );
  }
}

// POST - Trigger manual email poll
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;
    const autoAnalyze = body.autoAnalyze !== false; // Default to true
    const fullPipeline = body.fullPipeline === true; // Run full automation pipeline

    // Check settings - AUTO_ANALYZE is enabled by default (only skip if explicitly disabled)
    const autoAnalyzeConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_ANALYZE_ENABLED" },
    });
    const autoClaimConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_CLAIM_CREATION_ENABLED" },
    });

    // Auto-analyze by default unless explicitly set to "false"
    const shouldAutoAnalyze = autoAnalyze && autoAnalyzeConfig?.value !== "false";
    const shouldAutoCreateClaims = autoClaimConfig?.value === "true";

    // Run full automation pipeline if requested and enabled
    if (fullPipeline && shouldAutoAnalyze && shouldAutoCreateClaims) {
      const result = await runFullAutomationPipeline(limit);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Fetched ${result.fetched}, analyzed ${result.analyzed}, created ${result.claimsCreated} claims`
          : "Automation pipeline failed",
        fetched: result.fetched,
        analyzed: result.analyzed,
        claimsCreated: result.claimsCreated,
        errors: result.errors,
      });
    }

    // Standard fetch + analyze flow
    if (shouldAutoAnalyze) {
      const result = await fetchAndAnalyzeEmails(limit);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Fetched ${result.fetched} emails, analyzed ${result.analyzed}`
          : "Failed to fetch emails",
        fetched: result.fetched,
        analyzed: result.analyzed,
        errors: result.errors,
      });
    } else {
      const result = await fetchEmails(limit);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Fetched ${result.fetched} new emails`
          : "Failed to fetch emails",
        fetched: result.fetched,
        analyzed: 0,
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error("Email poll error:", error);
    return NextResponse.json(
      { error: "Failed to poll emails", details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Analyze pending emails only
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;
    const createClaims = body.createClaims === true;

    if (createClaims) {
      // Auto-create claims from analyzed emails
      const result = await autoCreateClaims(limit);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Created ${result.created} claims, skipped ${result.skipped}`
          : "Failed to create claims",
        created: result.created,
        skipped: result.skipped,
        errors: result.errors,
      });
    }

    // Just analyze
    const result = await autoAnalyzeEmails(limit);
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Analyzed ${result.analyzed} pending emails`
        : "Failed to analyze emails",
      analyzed: result.analyzed,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Auto-analyze error:", error);
    return NextResponse.json(
      { error: "Failed to analyze emails", details: String(error) },
      { status: 500 }
    );
  }
}
