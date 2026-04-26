import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { learnExtractionPattern, ExtractableField } from "@/lib/extraction-patterns";
import { comparePredictionsVsActual, checkAutoClaimReadiness } from "@/lib/prediction-learning";
import { learnClaimNumberPattern, learnFromClaimNumberCorrection } from "@/lib/claim-number-patterns";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status && status !== "all") {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { claimNumber: { contains: search } },
        { clientName: { contains: search } },
        { vehicleRegistration: { contains: search } },
      ];
    }

    const [claims, total] = await Promise.all([
      db.claim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          insuranceCompany: {
            select: { id: true, name: true, folderName: true },
          },
        },
      }),
      db.claim.count({ where }),
    ]);

    return NextResponse.json({
      claims,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Claims GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch claims" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const claim = await db.claim.create({
      data: {
        claimNumber: body.claimNumber,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        claimType: body.claimType,
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : null,
        incidentDescription: body.incidentDescription,
        vehicleRegistration: body.vehicleRegistration,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        propertyAddress: body.propertyAddress,
        excessAmount: body.excessAmount ? parseFloat(body.excessAmount) : null,
        insuranceCompanyId: body.insuranceCompanyId,
        status: body.status || "NEW",
        processedBy: "MANUAL",
        sourceEmailId: body.sourceEmailId,
        sourceEmailSubject: body.sourceEmailSubject,
        sourceEmailFrom: body.sourceEmailFrom,
        sourceEmailDate: body.sourceEmailDate ? new Date(body.sourceEmailDate) : null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "claim_created",
        entityType: "claim",
        entityId: claim.id,
        details: JSON.stringify({ claimNumber: claim.claimNumber }),
        status: "SUCCESS",
        processedBy: "MANUAL",
        claimId: claim.id,
      },
    });

    // ====== LEARNING INTEGRATION ======
    // Learn from the claim data if we have source text and company
    
    if (body.sourceText && body.insuranceCompanyId) {
      // Learn extraction patterns for each field that was filled
      const fieldsToLearn: Array<{ field: string; value: string | null }> = [
        { field: "claimNumber", value: body.claimNumber },
        { field: "policyNumber", value: body.policyNumber },
        { field: "clientName", value: body.clientName },
        { field: "clientEmail", value: body.clientEmail },
        { field: "clientPhone", value: body.clientPhone },
        { field: "vehicleRegistration", value: body.vehicleRegistration },
        { field: "vehicleMake", value: body.vehicleMake },
        { field: "vehicleModel", value: body.vehicleModel },
        { field: "excessAmount", value: body.excessAmount ? String(body.excessAmount) : null },
      ];

      for (const { field, value } of fieldsToLearn) {
        if (value) {
          await learnExtractionPattern(
            body.insuranceCompanyId,
            field as ExtractableField,
            null, // Original value - we don't have AI extraction to compare
            value,
            body.sourceText,
            body.sourceEmailId
          ).catch(err => console.error(`Failed to learn ${field}:`, err));
        }
      }
    }

    // Learn claim number format using the new pattern learning system
    if (body.claimNumber && body.insuranceCompanyId) {
      await learnClaimNumberPattern(body.insuranceCompanyId, body.claimNumber)
        .catch(err => console.error("Failed to learn claim number pattern:", err));
    }

    // Learn from claim number correction if AI predicted differently
    if (body.claimNumber && body.insuranceCompanyId && body.originalClaimNumber && body.originalClaimNumber !== body.claimNumber) {
      await learnFromClaimNumberCorrection(body.insuranceCompanyId, body.originalClaimNumber, body.claimNumber)
        .catch(err => console.error("Failed to learn from claim number correction:", err));
      console.log(`[claims] Learned from claim number correction: ${body.originalClaimNumber} -> ${body.claimNumber}`);
    }

    // Update sender pattern stats if we know the domain
    if (body.sourceEmailDomain && body.insuranceCompanyId) {
      await updateSenderPatternOnClaim(body.sourceEmailDomain, body.insuranceCompanyId)
        .catch(err => console.error("Failed to update sender pattern:", err));
    }

    // Link domain to company if not already linked
    if (body.sourceEmailDomain && body.insuranceCompanyId) {
      await linkDomainToCompany(body.sourceEmailDomain, body.insuranceCompanyId)
        .catch(err => console.error("Failed to link domain:", err));
    }

    // ====== PREDICTION LEARNING FEEDBACK ======
    // Compare AI predictions against actual claim data
    if (body.sourceEmailId) {
      const actualData = {
        claimNumber: body.claimNumber,
        policyNumber: body.policyNumber,
        claimType: body.claimType,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        clientAddress: body.propertyAddress,
        vehicleRegistration: body.vehicleRegistration,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        incidentDate: body.incidentDate,
        incidentDescription: body.incidentDescription,
        excessAmount: body.excessAmount,
      };
      
      // Compare predictions vs actual (triggers learning)
      const learningResult = await comparePredictionsVsActual(body.sourceEmailId, claim.id, actualData)
        .catch(err => console.error("Failed to compare predictions:", err));
      
      if (learningResult) {
        console.log(`[claims] Learning result: ${learningResult.correctFields}/${learningResult.totalFields} correct (${learningResult.accuracyRate.toFixed(1)}%)`);
        
        // Check if domain is now ready for auto-claim
        if (body.sourceEmailDomain) {
          const autoReady = await checkAutoClaimReadiness(body.sourceEmailDomain);
          if (autoReady) {
            console.log(`[claims] Domain ${body.sourceEmailDomain} is now ready for auto-claim!`);
          }
        }
      }
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Claims POST error:", error);
    return NextResponse.json(
      { error: "Failed to create claim" },
      { status: 500 }
    );
  }
}

// Update sender pattern when a claim is created
async function updateSenderPatternOnClaim(
  senderDomain: string,
  insuranceCompanyId: string
): Promise<void> {
  try {
    const pattern = await db.senderPattern.findUnique({
      where: { senderDomain },
    });

    if (pattern) {
      await db.senderPattern.update({
        where: { id: pattern.id },
        data: {
          newClaimCount: { increment: 1 },
          correctCount: { increment: 1 },
          accuracyRate: ((pattern.correctCount + 1) / (pattern.correctCount + pattern.correctedCount + 1)) * 100,
        },
      });
    } else {
      // Create new sender pattern
      await db.senderPattern.create({
        data: {
          senderDomain,
          totalEmails: 1,
          newClaimCount: 1,
          correctCount: 1,
          accuracyRate: 100,
          automationLevel: "manual",
        },
      });
    }
  } catch (error) {
    console.error("Failed to update sender pattern:", error);
  }
}

// Link domain to company if not already linked
async function linkDomainToCompany(
  senderDomain: string,
  insuranceCompanyId: string
): Promise<void> {
  try {
    // Check if domain suggestion exists
    const suggestion = await db.domainSuggestion.findUnique({
      where: { senderDomain },
    });

    if (suggestion && suggestion.status === "pending") {
      // Auto-approve the suggestion
      await db.domainSuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: "auto_approved",
          linkedCompanyId: insuranceCompanyId,
          reviewedAt: new Date(),
        },
      });
    }

    // Also update the company's sender domains
    const company = await db.insuranceCompany.findUnique({
      where: { id: insuranceCompanyId },
    });

    if (company) {
      const existingDomains = company.senderDomains 
        ? JSON.parse(company.senderDomains) as string[] 
        : [];
      
      if (!existingDomains.includes(senderDomain)) {
        existingDomains.push(senderDomain);
        await db.insuranceCompany.update({
          where: { id: insuranceCompanyId },
          data: { senderDomains: JSON.stringify(existingDomains) },
        });
      }
    }
  } catch (error) {
    console.error("Failed to link domain to company:", error);
  }
}
