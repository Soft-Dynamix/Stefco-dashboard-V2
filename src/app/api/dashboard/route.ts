import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get counts
    const [
      totalClaims,
      pendingClaims,
      completedClaims,
      emailQueuePending,
      emailQueueAnalyzed,
      insuranceCompanies,
      learningPatterns,
      senderProfiles,
    ] = await Promise.all([
      db.claim.count(),
      db.claim.count({ where: { status: "NEW" } }),
      db.claim.count({ where: { status: "COMPLETED" } }),
      db.emailQueue.count({ where: { status: "PENDING" } }),
      db.emailQueue.count({ where: { status: "AI_ANALYZED" } }),
      db.insuranceCompany.count({ where: { isActive: true } }),
      db.learningPattern.count({ where: { isActive: true } }),
      db.senderPattern.count(),
    ]);

    // Get recent claims
    const recentClaims = await db.claim.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        insuranceCompany: {
          select: { name: true },
        },
      },
    });

    // Get claims by status
    const claimsByStatus = await db.claim.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get claims by type
    const claimsByType = await db.claim.groupBy({
      by: ["claimType"],
      _count: true,
    });

    // Get recent activity
    const recentActivity = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    // Get print queue status
    const printQueueStats = await db.printQueueItem.groupBy({
      by: ["printStatus"],
      _count: true,
    });

    // Calculate accuracy
    const totalFeedback = await db.claimFeedback.count();
    const correctFeedback = await db.claimFeedback.count({
      where: { feedbackType: "confirmed" },
    });
    const accuracyRate = totalFeedback > 0 ? (correctFeedback / totalFeedback) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalClaims,
        pendingClaims,
        completedClaims,
        emailQueuePending,
        emailQueueAnalyzed,
        insuranceCompanies,
        learningPatterns,
        senderProfiles,
        accuracyRate: accuracyRate.toFixed(1),
      },
      recentClaims,
      claimsByStatus: claimsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      claimsByType: claimsByType.map((t) => ({
        type: t.claimType || "Unknown",
        count: t._count,
      })),
      recentActivity,
      printQueueStats: printQueueStats.map((p) => ({
        status: p.printStatus,
        count: p._count,
      })),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
