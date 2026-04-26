/**
 * Domain Intelligence Layer
 * 
 * PURPOSE: Build predictability per sender/company
 * 
 * This layer serves as the PRIMARY SIGNAL for extraction bias.
 * If domain is known → bias extraction toward known patterns
 * If unknown → fallback to AI
 * 
 * Flow:
 * 1. Email arrives → Extract domain
 * 2. Look up domain profile
 * 3. If known: Get patterns, keywords, formats
 * 4. If unknown: Flag for review, use generic extraction
 */

import { db } from "@/lib/db";

// Domain profile structure
export interface DomainProfileData {
  domain: string;
  insuranceCompanyId?: string;
  claimNumberFormats: string[];
  emailKeywords: string[];
  attachmentTypes: string[];
  signaturePatterns: string[];
  clientNamePatterns: string[];
  vehicleRegPatterns: string[];
  addressPatterns: string[];
  confidenceScore: number;
  automationLevel: "manual" | "semi" | "auto";
}

// Source position scoring (higher is better)
const SOURCE_POSITION_SCORES = {
  email_subject: 100,
  email_body: 70,
  attachment_filename: 50,
  attachment_content: 40,
  signature: 30,
};

/**
 * Get domain profile - creates if not exists
 */
export async function getDomainProfile(domain: string): Promise<DomainProfileData | null> {
  const normalizedDomain = domain.toLowerCase().trim();
  
  const profile = await db.domainProfile.findUnique({
    where: { domain: normalizedDomain },
  });
  
  if (!profile) {
    // Try to auto-detect from insurance domain knowledge
    const knownDomain = await db.insuranceDomainKnowledge.findFirst({
      where: {
        domainPattern: normalizedDomain,
        isActive: true,
      },
    });
    
    if (knownDomain) {
      // Create new profile from known domain
      return await createDomainProfileFromKnowledge(normalizedDomain, knownDomain.companyName);
    }
    
    return null;
  }
  
  return {
    domain: profile.domain,
    insuranceCompanyId: profile.insuranceCompanyId || undefined,
    claimNumberFormats: safeJsonParse(profile.claimNumberFormats, []),
    emailKeywords: safeJsonParse(profile.emailKeywords, []),
    attachmentTypes: safeJsonParse(profile.attachmentTypes, []),
    signaturePatterns: safeJsonParse(profile.signaturePatterns, []),
    clientNamePatterns: safeJsonParse(profile.clientNamePatterns, []),
    vehicleRegPatterns: safeJsonParse(profile.vehicleRegPatterns, []),
    addressPatterns: safeJsonParse(profile.addressPatterns, []),
    confidenceScore: profile.confidenceScore,
    automationLevel: profile.automationLevel as "manual" | "semi" | "auto",
  };
}

/**
 * Create domain profile from known insurance knowledge
 */
async function createDomainProfileFromKnowledge(domain: string, companyName: string): Promise<DomainProfileData> {
  // Find the insurance company
  const company = await db.insuranceCompany.findFirst({
    where: {
      OR: [
        { name: { contains: companyName, mode: "insensitive" } },
        { shortName: { contains: companyName, mode: "insensitive" } },
      ],
    },
  });
  
  // Get claim number formats for this company
  const formats = company ? await db.claimNumberFormat.findMany({
    where: { insuranceCompanyId: company.id, isActive: true },
  }) : [];
  
  const profile = await db.domainProfile.create({
    data: {
      domain,
      insuranceCompanyId: company?.id,
      claimNumberFormats: JSON.stringify(formats.map(f => f.regexPattern)),
      emailKeywords: JSON.stringify(["new claim", "appointment", "nuwe eis"]),
      attachmentTypes: JSON.stringify(["PDF", "JPG", "PNG"]),
      confidenceScore: 50, // Start with medium confidence
      automationLevel: "manual",
    },
  });
  
  return {
    domain: profile.domain,
    insuranceCompanyId: profile.insuranceCompanyId || undefined,
    claimNumberFormats: safeJsonParse(profile.claimNumberFormats, []),
    emailKeywords: safeJsonParse(profile.emailKeywords, []),
    attachmentTypes: safeJsonParse(profile.attachmentTypes, []),
    signaturePatterns: [],
    clientNamePatterns: [],
    vehicleRegPatterns: [],
    addressPatterns: [],
    confidenceScore: profile.confidenceScore,
    automationLevel: "manual",
  };
}

/**
 * Get extraction hints for a domain
 * These hints are passed to ALL agents for bias
 */
export async function getExtractionHints(domain: string): Promise<{
  claimNumberPatterns: string[];
  expectedKeywords: string[];
  attachmentTypes: string[];
  companyHints: { id?: string; name?: string };
  automationLevel: string;
}> {
  const profile = await getDomainProfile(domain);
  
  if (!profile) {
    return {
      claimNumberPatterns: [],
      expectedKeywords: [],
      attachmentTypes: [],
      companyHints: {},
      automationLevel: "manual",
    };
  }
  
  let companyName: string | undefined;
  if (profile.insuranceCompanyId) {
    const company = await db.insuranceCompany.findUnique({
      where: { id: profile.insuranceCompanyId },
    });
    companyName = company?.name;
  }
  
  return {
    claimNumberPatterns: profile.claimNumberFormats,
    expectedKeywords: profile.emailKeywords,
    attachmentTypes: profile.attachmentTypes,
    companyHints: {
      id: profile.insuranceCompanyId,
      name: companyName,
    },
    automationLevel: profile.automationLevel,
  };
}

/**
 * Learn a new pattern for a domain
 */
export async function learnDomainPattern(
  domain: string,
  patternType: keyof DomainProfileData,
  pattern: string
): Promise<void> {
  const normalizedDomain = domain.toLowerCase().trim();
  
  let profile = await db.domainProfile.findUnique({
    where: { domain: normalizedDomain },
  });
  
  if (!profile) {
    // Create new profile
    profile = await db.domainProfile.create({
      data: {
        domain: normalizedDomain,
      },
    });
  }
  
  // Get current patterns
  const currentPatterns = safeJsonParse(
    profile[patternType as keyof typeof profile] as string,
    []
  ) as string[];
  
  // Add new pattern if not exists
  if (!currentPatterns.includes(pattern)) {
    currentPatterns.push(pattern);
    
    await db.domainProfile.update({
      where: { domain: normalizedDomain },
      data: {
        [patternType]: JSON.stringify(currentPatterns),
        updatedAt: new Date(),
      },
    });
  }
}

/**
 * Update domain statistics after successful claim
 */
export async function recordSuccessfulExtraction(domain: string): Promise<void> {
  const normalizedDomain = domain.toLowerCase().trim();
  
  const profile = await db.domainProfile.findUnique({
    where: { domain: normalizedDomain },
  });
  
  if (!profile) return;
  
  const newTotal = profile.totalEmails + 1;
  const newSuccessful = profile.successfulClaims + 1;
  const newAccuracy = (newSuccessful / newTotal) * 100;
  
  // Determine automation level based on accuracy and count
  let newLevel: "manual" | "semi" | "auto" = "manual";
  if (newTotal >= 20 && newAccuracy >= 90) {
    newLevel = "auto";
  } else if (newTotal >= 5 && newAccuracy >= 70) {
    newLevel = "semi";
  }
  
  await db.domainProfile.update({
    where: { domain: normalizedDomain },
    data: {
      totalEmails: newTotal,
      successfulClaims: newSuccessful,
      accuracyRate: newAccuracy,
      confidenceScore: Math.min(100, profile.confidenceScore + 5),
      automationLevel: newLevel,
      lastClaimAt: new Date(),
    },
  });
}

/**
 * Record a correction (reduces confidence)
 */
export async function recordCorrection(domain: string): Promise<void> {
  const normalizedDomain = domain.toLowerCase().trim();
  
  const profile = await db.domainProfile.findUnique({
    where: { domain: normalizedDomain },
  });
  
  if (!profile) return;
  
  const newTotal = profile.totalEmails + 1;
  const newCorrected = profile.correctedClaims + 1;
  const newAccuracy = profile.successfulClaims > 0 
    ? (profile.successfulClaims / newTotal) * 100 
    : 0;
  
  // Downgrade automation if accuracy drops
  let newLevel: "manual" | "semi" | "auto" = profile.automationLevel as "manual" | "semi" | "auto";
  if (newAccuracy < 70 && newLevel === "auto") {
    newLevel = "semi";
  }
  if (newAccuracy < 50 && newLevel !== "manual") {
    newLevel = "manual";
  }
  
  await db.domainProfile.update({
    where: { domain: normalizedDomain },
    data: {
      totalEmails: newTotal,
      correctedClaims: newCorrected,
      accuracyRate: newAccuracy,
      confidenceScore: Math.max(0, profile.confidenceScore - 10),
      automationLevel: newLevel,
    },
  });
}

/**
 * Get position score for a source
 */
export function getSourcePositionScore(source: string): number {
  return SOURCE_POSITION_SCORES[source as keyof typeof SOURCE_POSITION_SCORES] || 0;
}

/**
 * Check if domain should auto-process
 */
export async function shouldAutoProcess(domain: string): Promise<boolean> {
  const profile = await getDomainProfile(domain);
  
  if (!profile) return false;
  
  return profile.automationLevel === "auto" && profile.confidenceScore >= 90;
}

/**
 * Get all domains needing review (low confidence)
 */
export async function getDomainsNeedingReview(): Promise<DomainProfileData[]> {
  const profiles = await db.domainProfile.findMany({
    where: {
      OR: [
        { confidenceScore: { lt: 50 } },
        { automationLevel: "manual", totalEmails: { gte: 3 } },
      ],
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  
  return profiles.map(p => ({
    domain: p.domain,
    insuranceCompanyId: p.insuranceCompanyId || undefined,
    claimNumberFormats: safeJsonParse(p.claimNumberFormats, []),
    emailKeywords: safeJsonParse(p.emailKeywords, []),
    attachmentTypes: safeJsonParse(p.attachmentTypes, []),
    signaturePatterns: safeJsonParse(p.signaturePatterns, []),
    clientNamePatterns: safeJsonParse(p.clientNamePatterns, []),
    vehicleRegPatterns: safeJsonParse(p.vehicleRegPatterns, []),
    addressPatterns: safeJsonParse(p.addressPatterns, []),
    confidenceScore: p.confidenceScore,
    automationLevel: p.automationLevel as "manual" | "semi" | "auto",
  }));
}

// Helper
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
