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

    if (type === "history") {
      // Get all types of learning records
      const [
        predictionComparisons,
        classificationKnowledge,
        senderIgnoreRules,
        threadPatterns,
        domainProfiles,
        rejectionFeedbacks,
      ] = await Promise.all([
        // 1. Prediction Comparisons - Field extraction predictions vs actual
        db.predictionComparison.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // 2. Classification Knowledge - When AI classification was corrected
        db.classificationKnowledge.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // 3. Sender Ignore Rules - Auto-ignore rules learned
        db.senderIgnoreRule.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // 4. Thread Patterns - Follow-up detection patterns
        db.threadPattern.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // 5. Domain Profiles - Domain intelligence
        db.domainProfile.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        // 6. Rejection Feedback - Email rejection history
        db.rejectionFeedback.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);

      // Transform all learning records into unified format
      const allLearningRecords = [
        // Prediction Comparisons
        ...predictionComparisons.map(comp => ({
          id: comp.id,
          type: "field_prediction",
          typeName: "Field Prediction",
          typeNameShort: "Field",
          createdAt: comp.createdAt,
          domain: comp.senderDomain || "Unknown",
          description: `Predicted fields for ${comp.claimType || "claim"} - ${comp.accuracyRate.toFixed(0)}% accuracy`,
          details: {
            accuracy: comp.accuracyRate,
            correctFields: comp.correctFields,
            totalFields: comp.totalFields,
            learningApplied: comp.learningApplied,
          },
          icon: "Brain",
          color: "blue",
        })),
        // Classification Knowledge
        ...classificationKnowledge.map(ck => ({
          id: ck.id,
          type: "classification_correction",
          typeName: "Classification Correction",
          typeNameShort: "Classification",
          createdAt: ck.createdAt,
          domain: ck.senderDomain,
          description: ck.originalClassification
            ? `"${ck.originalClassification}" → "${ck.correctedClassification}"`
            : `Classification: "${ck.correctedClassification}"`,
          details: {
            originalClassification: ck.originalClassification,
            correctedClassification: ck.correctedClassification,
            subject: ck.subject?.substring(0, 100),
          },
          icon: "Tags",
          color: "amber",
        })),
        // Ignore Rules
        ...senderIgnoreRules.map(rule => ({
          id: rule.id,
          type: "ignore_rule",
          typeName: "Ignore Rule",
          typeNameShort: "Ignore",
          createdAt: rule.createdAt,
          domain: rule.senderDomain,
          description: `${rule.category}: ${rule.reason || 'Auto-ignore'} (${rule.ignoreCount} ignores)`,
          details: {
            category: rule.category,
            reason: rule.reason,
            ignoreCount: rule.ignoreCount,
            autoIgnore: rule.autoIgnore,
          },
          icon: "Ban",
          color: "red",
        })),
        // Thread Patterns
        ...threadPatterns.map(tp => ({
          id: tp.id,
          type: "thread_pattern",
          typeName: "Thread Pattern",
          typeNameShort: "Thread",
          createdAt: tp.createdAt,
          domain: tp.senderDomain,
          description: `${tp.subjectPrefix || 'Re:'} → ${(tp.isFollowUpProbability * 100).toFixed(0)}% follow-up probability`,
          details: {
            subjectPrefix: tp.subjectPrefix,
            followUpCount: tp.followUpCount,
            newClaimCount: tp.newClaimCount,
            isFollowUpProbability: tp.isFollowUpProbability,
          },
          icon: "MessageSquare",
          color: "teal",
        })),
        // Domain Profiles
        ...domainProfiles.map(dp => ({
          id: dp.id,
          type: "domain_profile",
          typeName: "Domain Profile",
          typeNameShort: "Domain",
          createdAt: dp.createdAt,
          domain: dp.domain,
          description: `${dp.automationLevel} - ${dp.accuracyRate.toFixed(0)}% accuracy (${dp.successfulClaims} claims)`,
          details: {
            automationLevel: dp.automationLevel,
            confidenceScore: dp.confidenceScore,
            accuracyRate: dp.accuracyRate,
            totalEmails: dp.totalEmails,
            successfulClaims: dp.successfulClaims,
          },
          icon: "Globe",
          color: "emerald",
        })),
        // Rejection Feedback
        ...rejectionFeedbacks.map(rf => ({
          id: rf.id,
          type: "rejection_feedback",
          typeName: "Rejection Feedback",
          typeNameShort: "Rejection",
          createdAt: rf.createdAt,
          domain: rf.emailFromDomain || "Unknown",
          description: `${rf.rejectionCategory}: ${rf.rejectionReason || 'No reason'}${rf.isFollowUp ? ' (follow-up)' : ''}`,
          details: {
            rejectionCategory: rf.rejectionCategory,
            rejectionReason: rf.rejectionReason,
            isFollowUp: rf.isFollowUp,
            relatedClaimId: rf.relatedClaimId,
            emailSubject: rf.emailSubject?.substring(0, 100),
          },
          icon: "XCircle",
          color: "purple",
        })),
      ];

      // Sort by date descending
      allLearningRecords.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Pagination
      const page = parseInt(searchParams.get("page") || "1");
      const limit = parseInt(searchParams.get("limit") || "50");
      const skip = (page - 1) * limit;
      const totalRecords = allLearningRecords.length;
      const totalPages = Math.ceil(totalRecords / limit);
      const paginatedRecords = allLearningRecords.slice(skip, skip + limit);

      // Type counts
      const typeCounts = {
        fieldPrediction: predictionComparisons.length,
        classificationCorrection: classificationKnowledge.length,
        ignoreRule: senderIgnoreRules.length,
        threadPattern: threadPatterns.length,
        domainProfile: domainProfiles.length,
        rejectionFeedback: rejectionFeedbacks.length,
      };

      // Get field accuracy metrics
      const fieldMetrics = await db.fieldAccuracyMetric.findMany({
        orderBy: [
          { senderDomain: "asc" },
          { accuracyRate: "desc" },
        ],
      });

      return NextResponse.json({
        comparisons: paginatedRecords,
        allLearningRecords: paginatedRecords,
        totalComparisons: totalRecords,
        currentPage: page,
        totalPages,
        fieldMetrics,
        overallAccuracy: 0,
        accuracyTrend: [],
        fieldsReadyForAuto: 0,
        totalFields: fieldMetrics.length,
        typeCounts,
        summary: {
          totalPredictions: 0,
          totalCorrect: 0,
          overallAccuracy: 0,
          comparisonsCount: totalRecords,
          fieldsLearned: fieldMetrics.length,
          fieldsReadyForAuto: 0,
          improvingFields: 0,
          decliningFields: 0,
          stableFields: 0,
          typeCounts,
        }
      });
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
