import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Fetch domain suggestions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    const suggestions = await db.domainSuggestion.findMany({
      where: status === "all" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get stats
    const stats = await db.domainSuggestion.groupBy({
      by: ["status"],
      _count: true,
    });

    return NextResponse.json({
      suggestions,
      stats: stats.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error("Error fetching domain suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}

// POST - Create or update domain suggestion from detected domain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      senderDomain,
      detectedCompanyName,
      detectedFromEmail,
      detectedFromName,
      emailSubject,
      confidenceScore,
    } = body;

    if (!senderDomain) {
      return NextResponse.json(
        { error: "senderDomain is required" },
        { status: 400 }
      );
    }

    // Check if domain is already known (linked to insurance company)
    const existingCompany = await db.insuranceCompany.findFirst({
      where: {
        senderDomains: { contains: senderDomain },
        isActive: true,
      },
    });

    if (existingCompany) {
      return NextResponse.json({
        message: "Domain already linked to insurance company",
        company: existingCompany,
        alreadyKnown: true,
      });
    }

    // Check for existing suggestion
    const existingSuggestion = await db.domainSuggestion.findUnique({
      where: { senderDomain },
    });

    if (existingSuggestion) {
      // Update counts and add sample subject
      const existingSubjects = existingSuggestion.sampleSubjects
        ? JSON.parse(existingSuggestion.sampleSubjects)
        : [];

      const newSubjects = emailSubject
        ? [...new Set([...existingSubjects, emailSubject])].slice(0, 10)
        : existingSubjects;

      const updated = await db.domainSuggestion.update({
        where: { senderDomain },
        data: {
          emailCount: { increment: 1 },
          sampleSubjects: JSON.stringify(newSubjects),
          confidenceScore: Math.max(
            existingSuggestion.confidenceScore,
            confidenceScore || 0
          ),
          detectedCompanyName:
            detectedCompanyName || existingSuggestion.detectedCompanyName,
        },
      });

      return NextResponse.json({ suggestion: updated, updated: true });
    }

    // Try to match with known insurance domain patterns
    const domainKnowledge = await db.insuranceDomainKnowledge.findFirst({
      where: {
        OR: [
          { domainPattern: senderDomain },
          { domainPattern: senderDomain.replace(/^[^.]+\./, "*.") },
        ],
        isActive: true,
      },
    });

    // Try to find similar company name
    let suggestedCompanyId: string | null = null;
    let suggestedCompanyName: string | null = null;

    if (domainKnowledge) {
      suggestedCompanyName = domainKnowledge.companyName;

      // Check if company exists
      const existingCompany = await db.insuranceCompany.findFirst({
        where: {
          OR: [
            { name: { contains: domainKnowledge.companyName } },
            { shortName: domainKnowledge.shortName || "" },
          ],
        },
      });

      if (existingCompany) {
        suggestedCompanyId = existingCompany.id;
      }
    } else if (detectedCompanyName) {
      suggestedCompanyName = detectedCompanyName;

      // Check for similar company
      const similarCompany = await db.insuranceCompany.findFirst({
        where: {
          OR: [
            { name: { contains: detectedCompanyName } },
            { shortName: { contains: detectedCompanyName } },
          ],
        },
      });

      if (similarCompany) {
        suggestedCompanyId = similarCompany.id;
      }
    }

    // Create new suggestion
    const suggestion = await db.domainSuggestion.create({
      data: {
        senderDomain,
        detectedCompanyName,
        detectedFromEmail,
        detectedFromName,
        suggestedCompanyId,
        suggestedCompanyName: suggestedCompanyName || extractCompanyFromDomain(senderDomain),
        confidenceScore: confidenceScore || (domainKnowledge ? 85 : 50),
        sampleSubjects: emailSubject ? JSON.stringify([emailSubject]) : null,
        status: domainKnowledge && confidenceScore && confidenceScore > 80 ? "auto_approved" : "pending",
      },
    });

    return NextResponse.json({ suggestion, created: true });
  } catch (error) {
    console.error("Error creating domain suggestion:", error);
    return NextResponse.json(
      { error: "Failed to create suggestion" },
      { status: 500 }
    );
  }
}

// PUT - Approve or reject suggestion
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { suggestionId, action, companyId, newCompanyName } = body;

    if (!suggestionId || !action) {
      return NextResponse.json(
        { error: "suggestionId and action are required" },
        { status: 400 }
      );
    }

    const suggestion = await db.domainSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      let linkedCompanyId = companyId;

      // Create new company if needed
      if (!linkedCompanyId && newCompanyName) {
        const newCompany = await db.insuranceCompany.create({
          data: {
            name: newCompanyName,
            shortName: newCompanyName.substring(0, 3).toUpperCase(),
            folderName: newCompanyName.toLowerCase().replace(/\s+/g, "-"),
            senderDomains: JSON.stringify([suggestion.senderDomain]),
          },
        });
        linkedCompanyId = newCompany.id;
      } else if (linkedCompanyId) {
        // Add domain to existing company
        const company = await db.insuranceCompany.findUnique({
          where: { id: linkedCompanyId },
        });

        if (company) {
          const existingDomains = company.senderDomains
            ? JSON.parse(company.senderDomains)
            : [];
          const updatedDomains = [...new Set([...existingDomains, suggestion.senderDomain])];

          await db.insuranceCompany.update({
            where: { id: linkedCompanyId },
            data: {
              senderDomains: JSON.stringify(updatedDomains),
            },
          });
        }
      }

      // Update suggestion status
      const updated = await db.domainSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: "approved",
          linkedCompanyId,
          reviewedAt: new Date(),
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          action: "domain_suggestion_approved",
          entityType: "domain_suggestion",
          entityId: suggestionId,
          details: JSON.stringify({
            domain: suggestion.senderDomain,
            companyId: linkedCompanyId,
          }),
          status: "SUCCESS",
        },
      });

      return NextResponse.json({ suggestion: updated, approved: true });
    }

    if (action === "reject") {
      const updated = await db.domainSuggestion.update({
        where: { id: suggestionId },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
        },
      });

      // Create sender ignore rule for rejected domains
      await db.senderIgnoreRule.upsert({
        where: {
          senderDomain_category: {
            senderDomain: suggestion.senderDomain,
            category: "wrong_sender",
          },
        },
        create: {
          senderDomain: suggestion.senderDomain,
          category: "wrong_sender",
          reason: "Domain rejected as not an insurance company",
          ignoreCount: 1,
        },
        update: {
          ignoreCount: { increment: 1 },
        },
      });

      return NextResponse.json({ suggestion: updated, rejected: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error updating domain suggestion:", error);
    return NextResponse.json(
      { error: "Failed to update suggestion" },
      { status: 500 }
    );
  }
}

// Helper: Extract company name from domain
function extractCompanyFromDomain(domain: string): string {
  // Remove common prefixes
  const cleaned = domain
    .replace(/^(mail\.|email\.|claims\.|notifications\.|noreply\.)/i, "")
    .replace(/\.(co\.za|com|co\.uk|org|net)$/i, "");

  // Convert to title case
  return cleaned
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
