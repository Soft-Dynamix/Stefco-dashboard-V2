import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get("range") || "30";

    const days = parseInt(range);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get daily stats
    const dailyStats = await db.dailyStats.findMany({
      where: {
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: "asc" },
    });

    // Get claims over time
    const claimsOverTime = await db.claim.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      _count: true,
    });

    // Get claims by insurance company
    const claimsByInsurance = await db.claim.groupBy({
      by: ["insuranceCompanyId"],
      _count: true,
    });

    // Get insurance companies for names
    const insuranceCompanies = await db.insuranceCompany.findMany({
      select: { id: true, name: true },
    });

    const insuranceMap = new Map(
      insuranceCompanies.map((ic) => [ic.id, ic.name])
    );

    const claimsByInsuranceNamed = claimsByInsurance.map((c) => ({
      name: insuranceMap.get(c.insuranceCompanyId) || "Unknown",
      count: c._count,
    }));

    // Get processing times (average days between created and processed)
    const processedClaims = await db.claim.findMany({
      where: {
        processedAt: { not: null },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        processedAt: true,
      },
    });

    const avgProcessingTime = processedClaims.length > 0
      ? processedClaims.reduce((acc, c) => {
          if (c.processedAt) {
            const days = (c.processedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
            return acc + days;
          }
          return acc;
        }, 0) / processedClaims.length
      : 0;

    // Get classification accuracy over time
    const feedbackStats = await db.claimFeedback.groupBy({
      by: ["feedbackType"],
      _count: true,
    });

    return NextResponse.json({
      dailyStats,
      claimsByInsurance: claimsByInsuranceNamed,
      avgProcessingTime: avgProcessingTime.toFixed(1),
      feedbackStats: feedbackStats.map((f) => ({
        type: f.feedbackType,
        count: f._count,
      })),
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
