import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "stats";

    if (type === "stats") {
      const [
        totalPatterns,
        totalKnowledge,
        totalSenderProfiles,
        totalIgnoreRules,
        totalRejectionFeedback,
        totalThreadPatterns,
        avgConfidence,
      ] = await Promise.all([
        db.learningPattern.count({ where: { isActive: true } }),
        db.classificationKnowledge.count({ where: { isActive: true } }),
        db.senderPattern.count(),
        db.senderIgnoreRule.count({ where: { isActive: true } }),
        db.rejectionFeedback.count(),
        db.threadPattern.count({ where: { isActive: true } }),
        db.learningPattern.aggregate({
          _avg: { confidence: true },
        }),
      ]);

      // Get automation level distribution
      const automationLevels = await db.senderPattern.groupBy({
        by: ["automationLevel"],
        _count: true,
      });

      // Get top sender domains
      const topSenders = await db.senderPattern.findMany({
        take: 10,
        orderBy: { totalEmails: "desc" },
      });

      // Get recent learning patterns
      const recentPatterns = await db.learningPattern.findMany({
        take: 10,
        orderBy: { updatedAt: "desc" },
        include: {
          insuranceCompany: {
            select: { name: true },
          },
        },
      });

      return NextResponse.json({
        stats: {
          totalPatterns,
          totalKnowledge,
          totalSenderProfiles,
          totalIgnoreRules,
          totalRejectionFeedback,
          totalThreadPatterns,
          avgConfidence: avgConfidence._avg.confidence || 0,
        },
        automationLevels: automationLevels.map((a) => ({
          level: a.automationLevel,
          count: a._count,
        })),
        topSenders,
        recentPatterns,
      });
    }

    if (type === "patterns") {
      const patterns = await db.learningPattern.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          insuranceCompany: {
            select: { name: true },
          },
        },
      });
      return NextResponse.json(patterns);
    }

    if (type === "senders") {
      const senders = await db.senderPattern.findMany({
        orderBy: { totalEmails: "desc" },
      });
      return NextResponse.json(senders);
    }

    if (type === "knowledge") {
      const knowledge = await db.classificationKnowledge.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          insuranceCompany: {
            select: { name: true },
          },
        },
      });
      return NextResponse.json(knowledge);
    }

    if (type === "ignore-rules") {
      const rules = await db.senderIgnoreRule.findMany({
        orderBy: { ignoreCount: "desc" },
      });
      return NextResponse.json(rules);
    }

    if (type === "autoignore") {
      const rules = await db.senderIgnoreRule.findMany({
        where: { isActive: true },
        orderBy: [
          { autoIgnore: "desc" },
          { ignoreCount: "desc" },
        ],
      });
      return NextResponse.json(rules);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Learning GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch learning data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.type === "pattern") {
      const pattern = await db.learningPattern.create({
        data: {
          senderDomain: body.senderDomain,
          insuranceCompanyId: body.insuranceCompanyId,
          fieldName: body.fieldName,
          patternHint: body.patternHint,
          exampleOriginal: body.exampleOriginal,
          exampleCorrected: body.exampleCorrected,
          confidence: body.confidence || 55,
        },
      });
      return NextResponse.json(pattern);
    }

    if (body.type === "knowledge") {
      const knowledge = await db.classificationKnowledge.create({
        data: {
          senderDomain: body.senderDomain,
          subject: body.subject,
          bodySnippet: body.bodySnippet,
          originalClassification: body.originalClassification,
          correctedClassification: body.correctedClassification,
          confidence: body.confidence,
          insuranceCompanyId: body.insuranceCompanyId,
        },
      });
      return NextResponse.json(knowledge);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Learning POST error:", error);
    return NextResponse.json(
      { error: "Failed to create learning data" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.ruleId) {
      // Toggle auto-ignore for a specific rule
      const rule = await db.senderIgnoreRule.update({
        where: { id: body.ruleId },
        data: { autoIgnore: body.autoIgnore },
      });
      
      // Create audit log
      await db.auditLog.create({
        data: {
          action: body.autoIgnore ? "auto_ignore_enabled" : "auto_ignore_disabled",
          entityType: "sender_ignore_rule",
          entityId: body.ruleId,
          details: JSON.stringify({
            domain: rule.senderDomain,
            category: rule.category,
            autoIgnore: body.autoIgnore,
          }),
          status: "SUCCESS",
          processedBy: "USER",
        },
      });
      
      return NextResponse.json(rule);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Learning PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update learning data" },
      { status: 500 }
    );
  }
}
