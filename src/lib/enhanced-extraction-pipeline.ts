/**
 * Enhanced Extraction Pipeline v3.0
 * 
 * FLOW:
 * Email Intake
 *   ↓
 * Domain Intelligence ← NEW
 *   ↓
 * Intake Agent
 *   ↓
 * Preprocessing
 *   ↓
 * Attachment Processing ← NEW
 *   ↓
 * Extraction Agent (enhanced)
 *   ↓
 * Cross-Validation Engine ← NEW
 *   ↓
 * Decision Agent (enhanced)
 *   ↓
 * Review / Process
 *   ↓
 * Learning System (enhanced)
 */

import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import {
  getDomainProfile,
  getExtractionHints,
  DomainProfileData,
} from "@/lib/domain-intelligence";
import {
  processAttachments,
  ProcessedAttachmentsResult,
  getEmailAttachmentData,
} from "@/lib/attachment-intelligence";
import {
  extractClaimNumberCandidates,
  selectBestClaimNumber,
  testClaimNumberFormat,
} from "@/lib/claim-number-engine";
import { validateExtraction, ValidationResult } from "@/lib/cross-validation";
import {
  recordEvidence,
  selectBestEvidence,
  createBodyEvidence,
  createAttachmentEvidence,
  createAIInferenceEvidence,
  EvidenceRecord,
  buildFieldEvidenceSummary,
} from "@/lib/evidence-tracker";

// Cache ZAI instance
let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface EnhancedExtractionResult {
  // Extracted fields with confidence breakdown
  fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
    sources: string[];  // Where this was found
    evidence: string;  // Text snippet
  }>;
  
  // Confidence breakdown per field
  confidenceBreakdown: Record<string, number>;
  
  // Cross-source conflicts
  conflicts: Array<{
    fieldName: string;
    severity: string;
    description: string;
  }>;
  
  // Validation result
  validation: {
    isValid: boolean;
    confidenceAdjustment: number;
    recommendedActions: string[];
  };
  
  // Domain intelligence applied
  domainIntelligence: {
    domain: string;
    company: string | null;
    automationLevel: string;
    patternsApplied: string[];
  };
  
  // Attachment summary
  attachmentSummary: {
    hasAttachments: boolean;
    attachmentsWithData: number;
    overallConfidence: number;
  };
  
  // Claim number candidates
  claimNumberCandidates: Array<{
    value: string;
    confidence: number;
    source: string;
  }>;
  
  // Overall metrics
  overallConfidence: number;
  needsReview: boolean;
  reviewReasons: string[];
}

/**
 * Main extraction pipeline
 */
export async function runEnhancedExtraction(
  emailId: string,
  emailData: {
    subject?: string | null;
    from?: string | null;
    fromDomain?: string | null;
    bodyText?: string | null;
    attachments?: Array<{
      filename: string;
      content?: string;
      mimeType?: string;
    }>;
  }
): Promise<EnhancedExtractionResult> {
  const reviewReasons: string[] = [];
  const patternsApplied: string[] = [];
  
  // 1. DOMAIN INTELLIGENCE LAYER
  const domainProfile = emailData.fromDomain
    ? await getDomainProfile(emailData.fromDomain)
    : null;
  
  const extractionHints = emailData.fromDomain
    ? await getExtractionHints(emailData.fromDomain)
    : {
        claimNumberPatterns: [],
        expectedKeywords: [],
        attachmentTypes: [],
        companyHints: {},
        automationLevel: "manual",
      };
  
  if (domainProfile) {
    patternsApplied.push(...domainProfile.claimNumberFormats);
    if (domainProfile.emailKeywords.length > 0) {
      patternsApplied.push(`keywords: ${domainProfile.emailKeywords.slice(0, 3).join(", ")}`);
    }
  }
  
  // 2. ATTACHMENT INTELLIGENCE LAYER
  let attachmentResult: ProcessedAttachmentsResult = {
    attachments: [],
    combinedText: "",
    overallConfidence: 0,
    hasAttachments: false,
    attachmentsWithData: 0,
  };
  
  if (emailData.attachments && emailData.attachments.length > 0) {
    attachmentResult = await processAttachments(
      emailId,
      emailData.attachments,
      extractionHints.companyHints.name
    );
    
    // If attachments exist but no data extracted → flag for review
    if (attachmentResult.hasAttachments && attachmentResult.attachmentsWithData === 0) {
      reviewReasons.push("Attachments present but no data extracted");
    }
  }
  
  // 3. CLAIM NUMBER PATTERN ENGINE
  const claimNumberCandidates = await extractClaimNumberCandidates(
    emailId,
    emailData.subject,
    emailData.bodyText,
    emailData.attachments?.map(a => ({
      filename: a.filename,
      content: a.content || "",
    })) || [],
    extractionHints.companyHints.id
  );
  
  // 4. ENHANCED EXTRACTION AGENT
  const extractedFields = await runEnhancedExtractionAgent(
    emailData,
    attachmentResult,
    claimNumberCandidates,
    extractionHints
  );
  
  // 5. EVIDENCE TRACKING
  await storeAllEvidence(emailId, extractedFields);
  
  // 6. CROSS-VALIDATION ENGINE
  const validationResult = await validateExtraction(
    emailId,
    emailData,
    extractedFields,
    attachmentResult.attachments,
    extractionHints.companyHints.id ? {
      id: extractionHints.companyHints.id,
      name: extractionHints.companyHints.name || "",
    } : undefined
  );
  
  if (!validationResult.isValid) {
    reviewReasons.push(...validationResult.recommendedActions);
  }
  
  // 7. BUILD RESULT
  const fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
    sources: string[];
    evidence: string;
  }> = {};
  
  const confidenceBreakdown: Record<string, number> = {};
  
  for (const [fieldName, data] of Object.entries(extractedFields)) {
    fields[fieldName] = {
      value: data.value,
      confidence: data.confidence + validationResult.confidenceAdjustment,
      source: data.source,
      sources: data.sources,
      evidence: data.evidence || "",
    };
    confidenceBreakdown[fieldName] = data.confidence;
  }
  
  // Calculate overall confidence
  const confidences = Object.values(confidenceBreakdown);
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length + validationResult.confidenceAdjustment
    : 0;
  
  // Determine if needs review
  const needsReview = reviewReasons.length > 0 ||
    overallConfidence < 70 ||
    !fields.claimNumber?.value ||
    extractionHints.automationLevel === "manual";
  
  // 8. STORE FIELD EXTRACTION RESULTS
  await storeFieldResults(emailId, fields);
  
  // 9. UPDATE EMAIL QUEUE
  await db.emailQueue.update({
    where: { id: emailId },
    data: {
      aiExtractedData: JSON.stringify(fields),
      aiConfidence: overallConfidence,
      status: "AI_ANALYZED",
      processedAt: new Date(),
    },
  });
  
  return {
    fields,
    confidenceBreakdown,
    conflicts: validationResult.conflicts.map(c => ({
      fieldName: c.fieldName,
      severity: c.severity,
      description: c.recommendation,
    })),
    validation: {
      isValid: validationResult.isValid,
      confidenceAdjustment: validationResult.confidenceAdjustment,
      recommendedActions: validationResult.recommendedActions,
    },
    domainIntelligence: {
      domain: emailData.fromDomain || "unknown",
      company: extractionHints.companyHints.name || null,
      automationLevel: extractionHints.automationLevel,
      patternsApplied,
    },
    attachmentSummary: {
      hasAttachments: attachmentResult.hasAttachments,
      attachmentsWithData: attachmentResult.attachmentsWithData,
      overallConfidence: attachmentResult.overallConfidence,
    },
    claimNumberCandidates: claimNumberCandidates.slice(0, 5).map(c => ({
      value: c.value,
      confidence: c.totalConfidence,
      source: c.source,
    })),
    overallConfidence,
    needsReview,
    reviewReasons,
  };
}

/**
 * Run enhanced extraction agent combining all methods
 */
async function runEnhancedExtractionAgent(
  emailData: {
    subject?: string | null;
    from?: string | null;
    fromDomain?: string | null;
    bodyText?: string | null;
  },
  attachmentResult: ProcessedAttachmentsResult,
  claimNumberCandidates: Array<{ value: string; totalConfidence: number; source: string; evidence: string }>,
  extractionHints: Awaited<ReturnType<typeof getExtractionHints>>
): Promise<Record<string, {
  value: string | null;
  confidence: number;
  source: string;
  sources: string[];
  evidence: string;
  patternUsed?: string;
}>> {
  const fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
    sources: string[];
    evidence: string;
    patternUsed?: string;
  }> = {};
  
  // Claim Number - use pattern engine results
  if (claimNumberCandidates.length > 0) {
    const best = claimNumberCandidates[0];
    fields.claimNumber = {
      value: best.value,
      confidence: best.totalConfidence,
      source: best.source,
      sources: claimNumberCandidates.slice(0, 3).map(c => c.source),
      evidence: best.evidence,
    };
  } else {
    fields.claimNumber = { value: null, confidence: 0, source: "", sources: [], evidence: "" };
  }
  
  // Client Name - check email body + attachments
  fields.clientName = await extractFieldWithEnsemble(
    "clientName",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.clientNames,
    })),
    extractionHints
  );
  
  // Vehicle Registration - especially important for MOTOR claims
  fields.vehicleRegistration = await extractFieldWithEnsemble(
    "vehicleRegistration",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.vehicleRegs,
    })),
    extractionHints
  );
  
  // Policy Number
  fields.policyNumber = await extractFieldWithEnsemble(
    "policyNumber",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.policyNumbers,
    })),
    extractionHints
  );
  
  // Client Email
  fields.clientEmail = await extractFieldWithEnsemble(
    "clientEmail",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.emailAddresses,
    })),
    extractionHints
  );
  
  // Client Phone
  fields.clientPhone = await extractFieldWithEnsemble(
    "clientPhone",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.phoneNumbers,
    })),
    extractionHints
  );
  
  // Property Address
  fields.propertyAddress = await extractFieldWithEnsemble(
    "propertyAddress",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.addresses,
    })),
    extractionHints
  );
  
  // Excess Amount
  fields.excessAmount = await extractFieldWithEnsemble(
    "excessAmount",
    emailData.bodyText || "",
    attachmentResult.attachments.map(a => ({
      source: `attachment:${a.fileName}`,
      text: a.rawText,
      candidates: a.monetaryAmounts,
    })),
    extractionHints
  );
  
  // Insurance Company - from domain intelligence
  fields.insuranceCompany = {
    value: extractionHints.companyHints.name || null,
    confidence: extractionHints.companyHints.name ? 95 : 0,
    source: emailData.fromDomain ? `domain:${emailData.fromDomain}` : "",
    sources: emailData.fromDomain ? [`domain:${emailData.fromDomain}`] : [],
    evidence: "",
  };
  
  // Claim Type - infer from data
  fields.claimType = inferClaimType(fields, attachmentResult);
  
  // Use AI for any missing fields
  const missingFields = Object.entries(fields)
    .filter(([_, v]) => !v.value)
    .map(([k]) => k);
  
  if (missingFields.length > 0) {
    const aiExtraction = await runAIExtraction(
      emailData.subject || "",
      emailData.bodyText || "",
      attachmentResult.combinedText,
      missingFields
    );
    
    for (const [fieldName, data] of Object.entries(aiExtraction)) {
      if (!fields[fieldName]?.value && data.value) {
        fields[fieldName] = {
          value: data.value,
          confidence: data.confidence,
          source: "ai_inference",
          sources: ["ai"],
          evidence: data.reasoning || "",
        };
      }
    }
  }
  
  return fields;
}

/**
 * Extract field using ensemble method
 */
async function extractFieldWithEnsemble(
  fieldName: string,
  emailBody: string,
  attachmentSources: Array<{
    source: string;
    text: string;
    candidates: Array<{ value: string; confidence: number; context?: string }>;
  }>,
  hints: Awaited<ReturnType<typeof getExtractionHints>>
): Promise<{
  value: string | null;
  confidence: number;
  source: string;
  sources: string[];
  evidence: string;
}> {
  const candidates: Array<{
    value: string;
    confidence: number;
    source: string;
    evidence: string;
  }> = [];
  
  // 1. Regex extraction from email body
  // (Would use domain-specific patterns here)
  
  // 2. Candidates from attachments (already extracted)
  for (const attachment of attachmentSources) {
    for (const candidate of attachment.candidates) {
      candidates.push({
        value: candidate.value,
        confidence: candidate.confidence,
        source: attachment.source,
        evidence: candidate.context || "",
      });
    }
  }
  
  // 3. Select best candidate
  if (candidates.length === 0) {
    return { value: null, confidence: 0, source: "", sources: [], evidence: "" };
  }
  
  // Sort by confidence
  candidates.sort((a, b) => b.confidence - a.confidence);
  
  const best = candidates[0];
  
  return {
    value: best.value,
    confidence: best.confidence,
    source: best.source,
    sources: candidates.slice(0, 3).map(c => c.source),
    evidence: best.evidence,
  };
}

/**
 * Run AI extraction for missing fields
 */
async function runAIExtraction(
  subject: string,
  body: string,
  attachmentText: string,
  missingFields: string[]
): Promise<Record<string, { value: string; confidence: number; reasoning?: string }>> {
  if (missingFields.length === 0) return {};
  
  const zai = await getZAI();
  
  const prompt = `Extract the following missing fields from this insurance claim email.

MISSING FIELDS TO EXTRACT:
${missingFields.join(", ")}

EMAIL SUBJECT:
${subject}

EMAIL BODY:
${body.slice(0, 2000)}

ATTACHMENT CONTENT:
${attachmentText.slice(0, 2000)}

Respond with JSON only:
{
  "fieldName": {
    "value": "extracted value or null",
    "confidence": 0-100,
    "reasoning": "brief explanation"
  }
}`;

  try {
    const response = await zai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });
    
    const text = response.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("AI extraction error:", error);
  }
  
  return {};
}

/**
 * Infer claim type from extracted data
 */
function inferClaimType(
  fields: Record<string, { value: string | null }>,
  attachmentResult: ProcessedAttachmentsResult
): { value: string | null; confidence: number; source: string; sources: string[]; evidence: string } {
  // If vehicle registration exists → MOTOR
  if (fields.vehicleRegistration?.value) {
    return {
      value: "MOTOR",
      confidence: 85,
      source: "inference",
      sources: ["vehicle_registration_present"],
      evidence: "Vehicle registration detected",
    };
  }
  
  // If property address exists → PROPERTY
  if (fields.propertyAddress?.value) {
    return {
      value: "PROPERTY",
      confidence: 80,
      source: "inference",
      sources: ["property_address_present"],
      evidence: "Property address detected",
    };
  }
  
  // Default
  return {
    value: "OTHER",
    confidence: 50,
    source: "default",
    sources: [],
    evidence: "Unable to determine claim type",
  };
}

/**
 * Store all evidence records
 */
async function storeAllEvidence(
  emailId: string,
  fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
    sources: string[];
    evidence: string;
  }>
): Promise<void> {
  for (const [fieldName, data] of Object.entries(fields)) {
    if (data.value) {
      await recordEvidence(emailId, {
        fieldName,
        value: data.value,
        source: data.source as EvidenceRecord["source"],
        confidence: data.confidence,
        evidenceText: data.evidence,
        isSelected: true,
      });
    }
  }
}

/**
 * Store field extraction results
 */
async function storeFieldResults(
  emailId: string,
  fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
  }>
): Promise<void> {
  for (const [fieldName, data] of Object.entries(fields)) {
    await db.fieldExtractionResult.upsert({
      where: {
        emailQueueId_fieldName: {
          emailQueueId: emailId,
          fieldName,
        },
      },
      update: {
        finalValue: data.value,
        finalConfidence: data.confidence,
        selectedSource: data.source,
      },
      create: {
        emailQueueId: emailId,
        fieldName,
        finalValue: data.value,
        finalConfidence: data.confidence,
        selectedSource: data.source,
      },
    });
  }
}

/**
 * Get extraction result for an email
 */
export async function getExtractionResult(emailId: string): Promise<EnhancedExtractionResult | null> {
  const email = await db.emailQueue.findUnique({
    where: { id: emailId },
  });
  
  if (!email) return null;
  
  const attachmentData = await getEmailAttachmentData(emailId);
  const fieldResults = await db.fieldExtractionResult.findMany({
    where: { emailQueueId: emailId },
  });
  
  const fields: Record<string, {
    value: string | null;
    confidence: number;
    source: string;
    sources: string[];
    evidence: string;
  }> = {};
  
  for (const result of fieldResults) {
    fields[result.fieldName] = {
      value: result.finalValue,
      confidence: result.finalConfidence,
      source: result.selectedSource || "",
      sources: [],
      evidence: "",
    };
  }
  
  return {
    fields,
    confidenceBreakdown: Object.fromEntries(
      fieldResults.map(r => [r.fieldName, r.finalConfidence])
    ),
    conflicts: [],
    validation: {
      isValid: true,
      confidenceAdjustment: 0,
      recommendedActions: [],
    },
    domainIntelligence: {
      domain: email.fromDomain || "unknown",
      company: null,
      automationLevel: "manual",
      patternsApplied: [],
    },
    attachmentSummary: {
      hasAttachments: attachmentData.length > 0,
      attachmentsWithData: attachmentData.filter(a => a.claimNumbers.length > 0).length,
      overallConfidence: attachmentData.reduce((sum, a) => sum + a.extractionConfidence, 0) / Math.max(1, attachmentData.length),
    },
    claimNumberCandidates: [],
    overallConfidence: email.aiConfidence || 0,
    needsReview: false,
    reviewReasons: [],
  };
}
