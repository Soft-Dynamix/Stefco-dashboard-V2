/**
 * AI-Powered Attachment Analyzer for STEFCO Claims Dashboard
 * 
 * This module provides intelligent attachment analysis including:
 * 1. Document Type Classification (Claim Form, Policy Schedule, Invoice, etc.)
 * 2. Claim Form Data Extraction
 * 3. Policy Schedule Data Extraction
 * 4. Claim Likelihood Scoring based on attachments
 * 5. Learning from user feedback
 * 
 * Key Insight: Not all emails with attachments are claims.
 * Real claims typically have:
 * - Claim Form with incident details
 * - Policy Schedule with coverage info
 * - Supporting documents (photos, police reports)
 */

import ZAI from "z-ai-web-dev-sdk";
import { db } from "./db";
import pdf from "pdf-parse";
import { getClaimNumberFormatHint, getClaimNumberPatternsByDomain, validateClaimNumber } from "./claim-number-patterns";
import { findAllPossibleVins, extractVehicleDetails } from "./extraction-patterns";

// Cache ZAI instance
let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type DocumentType = 
  | "CLAIM_FORM"
  | "POLICY_SCHEDULE"
  | "INVOICE"
  | "QUOTATION"
  | "POLICE_REPORT"
  | "MEDICAL_REPORT"
  | "VEHICLE_ASSESSMENT"
  | "REPAIR_QUOTE"
  | "CORRESPONDENCE"
  | "IDENTITY_DOCUMENT"
  | "PROOF_OF_ADDRESS"
  | "BANKING_DETAILS"
  | "PHOTO_EVIDENCE"
  | "EMAIL_PRINTOUT"
  | "OTHER";

export interface DocumentClassification {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  isClaimRelated: boolean;
  importance: "HIGH" | "MEDIUM" | "LOW";
}

export interface ClaimFormData {
  // Claim Information
  claimNumber: string | null;
  claimType: "MOTOR" | "PROPERTY" | "LIABILITY" | "THEFT" | "FIRE" | "GAP" | "OTHER" | null;
  incidentDate: string | null;
  incidentTime: string | null;
  incidentLocation: string | null;
  incidentDescription: string | null;
  
  // Policy Holder Information
  policyHolderName: string | null;
  policyHolderIdNumber: string | null;
  policyHolderPhone: string | null;
  policyHolderEmail: string | null;
  policyHolderAddress: string | null;
  
  // Policy Information
  policyNumber: string | null;
  policyStartDate: string | null;
  policyEndDate: string | null;
  
  // Vehicle Information (for motor claims)
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: string | null;
  vehicleColor: string | null;
  vehicleVinNumber: string | null;
  
  // Driver Information (if different from policy holder)
  driverName: string | null;
  driverIdNumber: string | null;
  driverLicenseNumber: string | null;
  
  // Third Party Information
  thirdPartyName: string | null;
  thirdPartyVehicleReg: string | null;
  thirdPartyInsurance: string | null;
  thirdPartyPhone: string | null;
  
  // Financial Information
  excessAmount: number | null;
  estimatedDamage: number | null;
  
  // Extraction metadata
  extractionConfidence: number;
  extractedFields: string[];
}

export interface PolicyScheduleData {
  // Policy Information
  policyNumber: string | null;
  policyType: string | null;
  policyStatus: "ACTIVE" | "LAPSED" | "CANCELLED" | "PENDING" | null;
  
  // Insured Information
  insuredName: string | null;
  insuredIdNumber: string | null;
  insuredPhone: string | null;
  insuredEmail: string | null;
  insuredAddress: string | null;
  
  // Coverage Information
  coverageType: string | null;
  sumInsured: number | null;
  premium: number | null;
  excess: number | null;
  
  // Vehicle Information (for motor policies)
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  vehicleColor: string | null;
  vehicleVinNumber: string | null;
  engineNumber: string | null;
  
  // Additional Drivers
  additionalDrivers: Array<{
    name: string;
    idNumber: string;
    relationship: string;
  }>;
  
  // Benefits and Extensions
  benefits: string[];
  extensions: string[];
  
  // Important Dates
  inceptionDate: string | null;
  expiryDate: string | null;
  
  // Extraction metadata
  extractionConfidence: number;
  extractedFields: string[];
}

export interface AttachmentAnalysisResult {
  attachmentId: string;
  fileName: string;
  fileType: "PDF" | "IMAGE" | "DOC" | "OTHER";
  
  // Classification
  classification: DocumentClassification;
  
  // Extracted Data (depending on document type)
  claimFormData?: ClaimFormData;
  policyScheduleData?: PolicyScheduleData;
  rawExtractedText: string;
  
  // Overall scoring
  claimLikelihoodScore: number; // 0-100
  containsClaimNumber: boolean;
  containsPolicyNumber: boolean;
  containsVehicleReg: boolean;
  
  // Processing metadata
  processingTimeMs: number;
  processingError?: string;
}

export interface EmailAttachmentSummary {
  totalAttachments: number;
  claimRelatedAttachments: number;
  hasClaimForm: boolean;
  hasPolicySchedule: boolean;
  hasSupportingDocuments: boolean;
  
  // Combined extracted data
  combinedClaimData: Partial<ClaimFormData>;
  combinedPolicyData: Partial<PolicyScheduleData>;
  
  // Overall assessment
  overallClaimLikelihood: number; // 0-100
  isLikelyNewClaim: boolean;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  
  // Reasoning
  assessmentReason: string;
  keyIndicators: string[];
  missingInformation: string[];
  
  // Individual results
  attachmentResults: AttachmentAnalysisResult[];
}

// =============================================================================
// DOCUMENT CLASSIFICATION
// =============================================================================

const DOCUMENT_TYPE_PROMPTS: Record<DocumentType, string[]> = {
  CLAIM_FORM: [
    "claim form", "notification of claim", "claim submission", "claim intimation",
    "accident report", "incident report", "loss notification", "claim declaration"
  ],
  POLICY_SCHEDULE: [
    "policy schedule", "schedule of insurance", "certificate of insurance",
    "policy document", "insurance certificate", "cover note", "insurance schedule"
  ],
  INVOICE: [
    "invoice", "tax invoice", "statement", "bill", "account", "payment due"
  ],
  QUOTATION: [
    "quotation", "quote", "estimate", "proposal", "renewal quote"
  ],
  POLICE_REPORT: [
    "police report", "case number", "cas number", "police reference", "accident report case"
  ],
  MEDICAL_REPORT: [
    "medical report", "hospital report", "doctor's report", "medical certificate"
  ],
  VEHICLE_ASSESSMENT: [
    "assessment", "inspection report", "vehicle assessment", "damage assessment",
    "accident damage", "repair assessment"
  ],
  REPAIR_QUOTE: [
    "repair quote", "repair estimate", "body shop quote", "panel beater quote"
  ],
  CORRESPONDENCE: [
    "letter", "correspondence", "reference", "regarding", "re:"
  ],
  IDENTITY_DOCUMENT: [
    "id document", "identity document", "passport", "drivers license", "smart id"
  ],
  PROOF_OF_ADDRESS: [
    "proof of address", "proof of residence", "utility bill", "bank statement"
  ],
  BANKING_DETAILS: [
    "banking details", "bank account", "payment details", "deposit slip"
  ],
  PHOTO_EVIDENCE: [
    "photo", "image", "picture", "photograph"
  ],
  EMAIL_PRINTOUT: [
    "email", "printout", "correspondence"
  ],
  OTHER: []
};

/**
 * Classify a document using VLM
 */
export async function classifyDocument(
  imageUrl: string,
  fileName: string,
  extractedText?: string
): Promise<DocumentClassification> {
  const zai = await getZAI();
  
  // Validate image URL format
  if (!imageUrl || imageUrl.length < 50) {
    console.log(`[classifyDocument] Invalid image URL for ${fileName}: too short or empty`);
    return {
      documentType: "OTHER",
      confidence: 0,
      reasoning: "Invalid or missing image data",
      isClaimRelated: false,
      importance: "LOW"
    };
  }
  
  // Check if it's a valid data URL format
  const isValidDataUrl = imageUrl.startsWith("data:image/") || imageUrl.startsWith("data:application/pdf");
  const isValidUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");
  
  if (!isValidDataUrl && !isValidUrl) {
    console.log(`[classifyDocument] Invalid image URL format for ${fileName}: ${imageUrl.substring(0, 50)}...`);
    return {
      documentType: "OTHER",
      confidence: 0,
      reasoning: "Invalid image URL format",
      isClaimRelated: false,
      importance: "LOW"
    };
  }
  
  // Log what we're analyzing
  console.log(`[classifyDocument] Analyzing ${fileName}, data URL length: ${imageUrl.length}`);
  
  const prompt = `You are an expert insurance document classifier for South African insurance companies.

Analyze this document and classify it into one of these categories:
- CLAIM_FORM: Claim submission forms, incident reports, accident notifications
- POLICY_SCHEDULE: Insurance policy documents, certificates of insurance, schedule of coverage
- INVOICE: Bills, statements, payment requests
- QUOTATION: Quotes, estimates, proposals
- POLICE_REPORT: Police case reports, accident case numbers
- MEDICAL_REPORT: Medical reports, hospital documentation
- VEHICLE_ASSESSMENT: Vehicle damage assessments, inspection reports
- REPAIR_QUOTE: Repair estimates, body shop quotes
- CORRESPONDENCE: General letters, emails
- IDENTITY_DOCUMENT: ID cards, passports, driver's licenses
- PROOF_OF_ADDRESS: Utility bills, bank statements for address proof
- BANKING_DETAILS: Bank account details, payment information
- PHOTO_EVIDENCE: Photos of damage, accidents, vehicles
- EMAIL_PRINTOUT: Printed emails
- OTHER: Documents that don't fit other categories

Document filename: ${fileName}
${extractedText ? `Extracted text: ${extractedText}` : '(No extracted text available)'}

Consider:
1. Document structure and layout
2. Key phrases and headers
3. Presence of claim numbers, policy numbers, vehicle details
4. Document purpose and content

Respond in JSON format:
{
  "documentType": "one of the categories above",
  "confidence": 0-100,
  "reasoning": "brief explanation of classification",
  "isClaimRelated": true/false,
  "importance": "HIGH/MEDIUM/LOW"
}`;

  try {
    const response = await zai.chat.completions.createVision({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: { type: "disabled" }
    });

    const content = response.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[classifyDocument] Successfully classified ${fileName} as ${parsed.documentType}`);
      return {
        documentType: parsed.documentType || "OTHER",
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || "",
        isClaimRelated: parsed.isClaimRelated ?? false,
        importance: parsed.importance || "LOW"
      };
    }
  } catch (error) {
    console.error(`[classifyDocument] Failed to classify ${fileName}:`, error);
    
    // Return a fallback classification based on filename
    return classifyByFilename(fileName);
  }

  return {
    documentType: "OTHER",
    confidence: 0,
    reasoning: "Classification failed",
    isClaimRelated: false,
    importance: "LOW"
  };
}

/**
 * Fallback classification based on filename patterns
 */
function classifyByFilename(fileName: string): DocumentClassification {
  const lowerFileName = fileName.toLowerCase();
  
  if (lowerFileName.includes("claim") && (lowerFileName.includes("form") || lowerFileName.includes("submission"))) {
    return {
      documentType: "CLAIM_FORM",
      confidence: 40,
      reasoning: "Classified by filename pattern - recommend manual review",
      isClaimRelated: true,
      importance: "HIGH"
    };
  }
  if (lowerFileName.includes("policy") && lowerFileName.includes("schedule")) {
    return {
      documentType: "POLICY_SCHEDULE",
      confidence: 40,
      reasoning: "Classified by filename pattern - recommend manual review",
      isClaimRelated: true,
      importance: "HIGH"
    };
  }
  if (lowerFileName.includes("police") || lowerFileName.includes("cas ")) {
    return {
      documentType: "POLICE_REPORT",
      confidence: 40,
      reasoning: "Classified by filename pattern - recommend manual review",
      isClaimRelated: true,
      importance: "HIGH"
    };
  }
  if (lowerFileName.includes("invoice") || lowerFileName.includes("statement")) {
    return {
      documentType: "INVOICE",
      confidence: 40,
      reasoning: "Classified by filename pattern",
      isClaimRelated: false,
      importance: "MEDIUM"
    };
  }
  if (lowerFileName.includes("quote") || lowerFileName.includes("quotation")) {
    return {
      documentType: "QUOTATION",
      confidence: 40,
      reasoning: "Classified by filename pattern",
      isClaimRelated: false,
      importance: "MEDIUM"
    };
  }
  
  return {
    documentType: "OTHER",
    confidence: 20,
    reasoning: "Could not classify - recommend manual review",
    isClaimRelated: false,
    importance: "LOW"
  };
}

// =============================================================================
// CLAIM FORM EXTRACTION
// =============================================================================

/**
 * Extract data from a claim form using VLM
 */
export async function extractClaimFormData(
  imageUrl: string,
  fileName: string,
  companyContext?: string
): Promise<ClaimFormData> {
  const zai = await getZAI();
  
  const contextHint = companyContext 
    ? `This document is from ${companyContext}. Use their known document formats and patterns.` 
    : "";

  const prompt = `You are an expert at extracting data from South African insurance claim forms.

${contextHint}

Extract ALL information from this claim form. South African formats:
- Vehicle registrations: XX XX GP, XX-XX-GP, or XXXXXX GP format
- Phone numbers: +27 or 0 prefix, e.g., 082 123 4567
- ID numbers: 13-digit South African ID format
- Claim numbers: Various formats like STM-YYYY-NNNNN, OUT/NNNNNN/YY, etc.

Extract these fields:
1. Claim Information: claimNumber, claimType (MOTOR/PROPERTY/LIABILITY/THEFT/FIRE/GAP/OTHER), incidentDate (YYYY-MM-DD), incidentTime, incidentLocation, incidentDescription
2. Policy Holder: policyHolderName, policyHolderIdNumber, policyHolderPhone, policyHolderEmail, policyHolderAddress
3. Policy: policyNumber, policyStartDate, policyEndDate
4. Vehicle (for motor): vehicleRegistration, vehicleMake, vehicleModel, vehicleYear, vehicleColor, vehicleVinNumber
5. Driver (if different): driverName, driverIdNumber, driverLicenseNumber
6. Third Party: thirdPartyName, thirdPartyVehicleReg, thirdPartyInsurance, thirdPartyPhone
7. Financial: excessAmount (number only), estimatedDamage (number only)

Respond in JSON format with null for fields not found:
{
  "claimNumber": null,
  "claimType": null,
  "incidentDate": null,
  "incidentTime": null,
  "incidentLocation": null,
  "incidentDescription": null,
  "policyHolderName": null,
  "policyHolderIdNumber": null,
  "policyHolderPhone": null,
  "policyHolderEmail": null,
  "policyHolderAddress": null,
  "policyNumber": null,
  "policyStartDate": null,
  "policyEndDate": null,
  "vehicleRegistration": null,
  "vehicleMake": null,
  "vehicleModel": null,
  "vehicleYear": null,
  "vehicleColor": null,
  "vehicleVinNumber": null,
  "driverName": null,
  "driverIdNumber": null,
  "driverLicenseNumber": null,
  "thirdPartyName": null,
  "thirdPartyVehicleReg": null,
  "thirdPartyInsurance": null,
  "thirdPartyPhone": null,
  "excessAmount": null,
  "estimatedDamage": null,
  "extractionConfidence": 0-100,
  "extractedFields": ["list of field names that were successfully extracted"],
  "rawText": "all visible text from the document"
}`;

  try {
    const response = await zai.chat.completions.createVision({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: { type: "disabled" }
    });

    const content = response.choices?.[0]?.message?.content || "";
    return parseClaimFormResponse(content);
  } catch (error) {
    console.error("Claim form extraction error:", error);
    return getEmptyClaimFormData();
  }
}

function parseClaimFormResponse(response: string): ClaimFormData {
  const empty = getEmptyClaimFormData();
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      claimNumber: parsed.claimNumber || null,
      claimType: parsed.claimType || null,
      incidentDate: parsed.incidentDate || null,
      incidentTime: parsed.incidentTime || null,
      incidentLocation: parsed.incidentLocation || null,
      incidentDescription: parsed.incidentDescription || null,
      policyHolderName: parsed.policyHolderName || null,
      policyHolderIdNumber: parsed.policyHolderIdNumber || null,
      policyHolderPhone: parsed.policyHolderPhone || null,
      policyHolderEmail: parsed.policyHolderEmail || null,
      policyHolderAddress: parsed.policyHolderAddress || null,
      policyNumber: parsed.policyNumber || null,
      policyStartDate: parsed.policyStartDate || null,
      policyEndDate: parsed.policyEndDate || null,
      vehicleRegistration: parsed.vehicleRegistration || null,
      vehicleMake: parsed.vehicleMake || null,
      vehicleModel: parsed.vehicleModel || null,
      vehicleYear: parsed.vehicleYear || null,
      vehicleColor: parsed.vehicleColor || null,
      vehicleVinNumber: parsed.vehicleVinNumber || null,
      driverName: parsed.driverName || null,
      driverIdNumber: parsed.driverIdNumber || null,
      driverLicenseNumber: parsed.driverLicenseNumber || null,
      thirdPartyName: parsed.thirdPartyName || null,
      thirdPartyVehicleReg: parsed.thirdPartyVehicleReg || null,
      thirdPartyInsurance: parsed.thirdPartyInsurance || null,
      thirdPartyPhone: parsed.thirdPartyPhone || null,
      excessAmount: typeof parsed.excessAmount === 'number' ? parsed.excessAmount : null,
      estimatedDamage: typeof parsed.estimatedDamage === 'number' ? parsed.estimatedDamage : null,
      extractionConfidence: parsed.extractionConfidence || 50,
      extractedFields: parsed.extractedFields || []
    };
  } catch (error) {
    console.error("Failed to parse claim form response:", error);
    return empty;
  }
}

function getEmptyClaimFormData(): ClaimFormData {
  return {
    claimNumber: null,
    claimType: null,
    incidentDate: null,
    incidentTime: null,
    incidentLocation: null,
    incidentDescription: null,
    policyHolderName: null,
    policyHolderIdNumber: null,
    policyHolderPhone: null,
    policyHolderEmail: null,
    policyHolderAddress: null,
    policyNumber: null,
    policyStartDate: null,
    policyEndDate: null,
    vehicleRegistration: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleYear: null,
    vehicleColor: null,
    vehicleVinNumber: null,
    driverName: null,
    driverIdNumber: null,
    driverLicenseNumber: null,
    thirdPartyName: null,
    thirdPartyVehicleReg: null,
    thirdPartyInsurance: null,
    thirdPartyPhone: null,
    excessAmount: null,
    estimatedDamage: null,
    extractionConfidence: 0,
    extractedFields: []
  };
}

// =============================================================================
// POLICY SCHEDULE EXTRACTION
// =============================================================================

/**
 * Extract data from a policy schedule using VLM
 */
export async function extractPolicyScheduleData(
  imageUrl: string,
  fileName: string,
  companyContext?: string
): Promise<PolicyScheduleData> {
  const zai = await getZAI();
  
  const contextHint = companyContext 
    ? `This document is from ${companyContext}. Use their known document formats.` 
    : "";

  const prompt = `You are an expert at extracting data from South African insurance policy schedules.

${contextHint}

Extract ALL information from this policy schedule. South African formats:
- Vehicle registrations: XX XX GP, XX-XX-GP, or XXXXXX GP format
- Phone numbers: +27 or 0 prefix
- ID numbers: 13-digit South African ID format

Extract these fields:
1. Policy: policyNumber, policyType, policyStatus (ACTIVE/LAPSED/CANCELLED/PENDING)
2. Insured: insuredName, insuredIdNumber, insuredPhone, insuredEmail, insuredAddress
3. Coverage: coverageType, sumInsured (number), premium (number), excess (number)
4. Vehicle: vehicleRegistration, vehicleMake, vehicleModel, vehicleYear (number), vehicleColor, vehicleVinNumber, engineNumber
5. Additional Drivers: array of {name, idNumber, relationship}
6. Benefits: array of benefit names
7. Extensions: array of extension names
8. Dates: inceptionDate (YYYY-MM-DD), expiryDate (YYYY-MM-DD)

Respond in JSON format with null for fields not found:
{
  "policyNumber": null,
  "policyType": null,
  "policyStatus": null,
  "insuredName": null,
  "insuredIdNumber": null,
  "insuredPhone": null,
  "insuredEmail": null,
  "insuredAddress": null,
  "coverageType": null,
  "sumInsured": null,
  "premium": null,
  "excess": null,
  "vehicleRegistration": null,
  "vehicleMake": null,
  "vehicleModel": null,
  "vehicleYear": null,
  "vehicleColor": null,
  "vehicleVinNumber": null,
  "engineNumber": null,
  "additionalDrivers": [],
  "benefits": [],
  "extensions": [],
  "inceptionDate": null,
  "expiryDate": null,
  "extractionConfidence": 0-100,
  "extractedFields": ["list of field names that were successfully extracted"],
  "rawText": "all visible text from the document"
}`;

  try {
    const response = await zai.chat.completions.createVision({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      thinking: { type: "disabled" }
    });

    const content = response.choices?.[0]?.message?.content || "";
    return parsePolicyScheduleResponse(content);
  } catch (error) {
    console.error("Policy schedule extraction error:", error);
    return getEmptyPolicyScheduleData();
  }
}

function parsePolicyScheduleResponse(response: string): PolicyScheduleData {
  const empty = getEmptyPolicyScheduleData();
  
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return empty;
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      policyNumber: parsed.policyNumber || null,
      policyType: parsed.policyType || null,
      policyStatus: parsed.policyStatus || null,
      insuredName: parsed.insuredName || null,
      insuredIdNumber: parsed.insuredIdNumber || null,
      insuredPhone: parsed.insuredPhone || null,
      insuredEmail: parsed.insuredEmail || null,
      insuredAddress: parsed.insuredAddress || null,
      coverageType: parsed.coverageType || null,
      sumInsured: typeof parsed.sumInsured === 'number' ? parsed.sumInsured : null,
      premium: typeof parsed.premium === 'number' ? parsed.premium : null,
      excess: typeof parsed.excess === 'number' ? parsed.excess : null,
      vehicleRegistration: parsed.vehicleRegistration || null,
      vehicleMake: parsed.vehicleMake || null,
      vehicleModel: parsed.vehicleModel || null,
      vehicleYear: typeof parsed.vehicleYear === 'number' ? parsed.vehicleYear : null,
      vehicleColor: parsed.vehicleColor || null,
      vehicleVinNumber: parsed.vehicleVinNumber || null,
      engineNumber: parsed.engineNumber || null,
      additionalDrivers: parsed.additionalDrivers || [],
      benefits: parsed.benefits || [],
      extensions: parsed.extensions || [],
      inceptionDate: parsed.inceptionDate || null,
      expiryDate: parsed.expiryDate || null,
      extractionConfidence: parsed.extractionConfidence || 50,
      extractedFields: parsed.extractedFields || []
    };
  } catch (error) {
    console.error("Failed to parse policy schedule response:", error);
    return empty;
  }
}

function getEmptyPolicyScheduleData(): PolicyScheduleData {
  return {
    policyNumber: null,
    policyType: null,
    policyStatus: null,
    insuredName: null,
    insuredIdNumber: null,
    insuredPhone: null,
    insuredEmail: null,
    insuredAddress: null,
    coverageType: null,
    sumInsured: null,
    premium: null,
    excess: null,
    vehicleRegistration: null,
    vehicleMake: null,
    vehicleModel: null,
    vehicleYear: null,
    vehicleColor: null,
    vehicleVinNumber: null,
    engineNumber: null,
    additionalDrivers: [],
    benefits: [],
    extensions: [],
    inceptionDate: null,
    expiryDate: null,
    extractionConfidence: 0,
    extractedFields: []
  };
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze a single attachment
 */
export async function analyzeAttachment(
  emailId: string,
  attachment: {
    filename: string;
    content?: string; // base64 data URL or extracted text
    contentBase64?: string; // raw base64 content (without data URL prefix)
    mimeType?: string;
    contentType?: string; // alternative to mimeType
    size?: number;
  },
  companyContext?: string
): Promise<AttachmentAnalysisResult> {
  const startTime = Date.now();
  
  // Determine file type and MIME type
  const fileType = determineFileType(attachment.filename, attachment.mimeType || attachment.contentType);
  const effectiveMimeType = attachment.mimeType || attachment.contentType || getMimeTypeFromFilename(attachment.filename);
  
  let classification: DocumentClassification = {
    documentType: "OTHER",
    confidence: 0,
    reasoning: "Processing failed",
    isClaimRelated: false,
    importance: "LOW"
  };
  
  let claimFormData: ClaimFormData | undefined;
  let policyScheduleData: PolicyScheduleData | undefined;
  let rawExtractedText = "";
  let processingError: string | undefined;
  
  try {
    // Prepare image URL for VLM
    // Support both 'content' (data URL) and 'contentBase64' (raw base64) formats
    let imageUrl = attachment.content || "";
    
    // If content is not a data URL but we have contentBase64, construct the data URL
    if (!imageUrl && attachment.contentBase64) {
      imageUrl = `data:${effectiveMimeType};base64,${attachment.contentBase64}`;
    } else if (imageUrl && !imageUrl.startsWith("data:") && !imageUrl.startsWith("http")) {
      // Content exists but is not a data URL - add the prefix
      imageUrl = `data:${effectiveMimeType};base64,${imageUrl}`;
    }
    
    // Validate we have usable content
    const hasValidContent = imageUrl && 
      imageUrl.length > 50 && 
      !imageUrl.includes("undefined") &&
      (imageUrl.startsWith("data:image/") || imageUrl.startsWith("data:application/pdf"));
    
    // Skip analysis if no content provided
    if (!hasValidContent) {
      console.log(`[attachment-analysis] Skipping ${attachment.filename} - no valid content (size: ${attachment.size || 'unknown'})`);
      classification = {
        documentType: "OTHER",
        confidence: 0,
        reasoning: "No valid content available for analysis - attachment may be too large or missing",
        isClaimRelated: false,
        importance: "LOW"
      };
    }
    // Handle images with VLM
    else if (fileType === "IMAGE") {
      console.log(`[attachment-analysis] Analyzing image: ${attachment.filename} (${effectiveMimeType})`);
      
      // Classify document
      classification = await classifyDocument(imageUrl, attachment.filename, rawExtractedText);
      
      // Extract data based on document type
      if (classification.documentType === "CLAIM_FORM") {
        claimFormData = await extractClaimFormData(imageUrl, attachment.filename, companyContext);
        rawExtractedText = (claimFormData as any).rawText || "";
      } else if (classification.documentType === "POLICY_SCHEDULE") {
        policyScheduleData = await extractPolicyScheduleData(imageUrl, attachment.filename, companyContext);
        rawExtractedText = (policyScheduleData as any).rawText || "";
      }
    }
    // Handle PDFs - convert to images for VLM analysis
    else if (fileType === "PDF") {
      console.log(`[attachment-analysis] Processing PDF: ${attachment.filename}`);
      
      try {
        // For PDFs, we need to use a different approach
        // Option 1: Use PDF text extraction + VLM for page images
        // Option 2: Use LLM with extracted text for classification
        
        // Use LLM-based analysis for PDFs (more reliable than trying to convert to images)
        const pdfAnalysis = await analyzePdfWithLlm(imageUrl, attachment.filename, companyContext);
        classification = pdfAnalysis.classification;
        rawExtractedText = pdfAnalysis.extractedText;
        
        if (classification.documentType === "CLAIM_FORM" && pdfAnalysis.claimData) {
          claimFormData = pdfAnalysis.claimData;
        } else if (classification.documentType === "POLICY_SCHEDULE" && pdfAnalysis.policyData) {
          policyScheduleData = pdfAnalysis.policyData;
        }
      } catch (pdfError) {
        console.error(`[attachment-analysis] PDF analysis failed for ${attachment.filename}:`, pdfError);
        classification = {
          documentType: "OTHER",
          confidence: 20,
          reasoning: `PDF analysis failed: ${pdfError}. Manual review recommended.`,
          isClaimRelated: false,
          importance: "MEDIUM"
        };
        processingError = String(pdfError);
      }
    } else {
      // For non-image/PDF, use basic text extraction
      rawExtractedText = attachment.content || "";
      classification = {
        documentType: "OTHER",
        confidence: 50,
        reasoning: "Non-image document type",
        isClaimRelated: false,
        importance: "LOW"
      };
    }
  } catch (error) {
    processingError = String(error);
    console.error("Attachment analysis error:", error);
  }
  
  const processingTimeMs = Date.now() - startTime;
  
  // Calculate claim likelihood score
  const claimLikelihoodScore = calculateClaimLikelihood(classification, claimFormData, policyScheduleData);
  
  // Check for key indicators
  const containsClaimNumber = !!(claimFormData?.claimNumber || policyScheduleData?.policyNumber);
  const containsPolicyNumber = !!(claimFormData?.policyNumber || policyScheduleData?.policyNumber);
  const containsVehicleReg = !!(claimFormData?.vehicleRegistration || policyScheduleData?.vehicleRegistration);
  
  // Store in database
  const stored = await db.attachmentAnalysis.create({
    data: {
      emailQueueId: emailId,
      fileName: attachment.filename,
      fileType,
      fileSize: attachment.size,
      documentType: classification.documentType,
      documentConfidence: classification.confidence,
      isClaimRelated: classification.isClaimRelated,
      importance: classification.importance,
      claimLikelihoodScore,
      containsClaimNumber,
      containsPolicyNumber,
      containsVehicleReg,
      rawExtractedText: rawExtractedText, // Full text - no truncation needed (SQLite can handle large strings)
      claimFormData: claimFormData ? JSON.stringify(claimFormData) : null,
      policyScheduleData: policyScheduleData ? JSON.stringify(policyScheduleData) : null,
      processingTimeMs,
      processingError,
    }
  });
  
  return {
    attachmentId: stored.id,
    fileName: attachment.filename,
    fileType,
    classification,
    claimFormData,
    policyScheduleData,
    rawExtractedText,
    claimLikelihoodScore,
    containsClaimNumber,
    containsPolicyNumber,
    containsVehicleReg,
    processingTimeMs,
    processingError
  };
}

/**
 * Analyze all attachments for an email
 */
export async function analyzeAllAttachments(
  emailId: string,
  attachments: Array<{
    filename: string;
    content?: string;
    mimeType?: string;
    size?: number;
  }>,
  companyContext?: string
): Promise<EmailAttachmentSummary> {
  const results: AttachmentAnalysisResult[] = [];
  
  for (const attachment of attachments) {
    const result = await analyzeAttachment(emailId, attachment, companyContext);
    results.push(result);
  }
  
  // Calculate summary
  const claimRelatedAttachments = results.filter(r => r.classification.isClaimRelated).length;
  const hasClaimForm = results.some(r => r.classification.documentType === "CLAIM_FORM");
  const hasPolicySchedule = results.some(r => r.classification.documentType === "POLICY_SCHEDULE");
  const hasSupportingDocuments = results.some(r => 
    ["POLICE_REPORT", "MEDICAL_REPORT", "VEHICLE_ASSESSMENT", "REPAIR_QUOTE", "PHOTO_EVIDENCE"].includes(r.classification.documentType)
  );
  
  // Combine extracted data
  const combinedClaimData = combineClaimFormData(results);
  const combinedPolicyData = combinePolicyScheduleData(results);
  
  // Calculate overall claim likelihood
  const overallClaimLikelihood = calculateOverallClaimLikelihood(results, {
    hasClaimForm,
    hasPolicySchedule,
    hasSupportingDocuments
  });
  
  // Determine if this is likely a new claim
  const isLikelyNewClaim = overallClaimLikelihood >= 60;
  const confidenceLevel: "HIGH" | "MEDIUM" | "LOW" = 
    overallClaimLikelihood >= 80 ? "HIGH" :
    overallClaimLikelihood >= 60 ? "MEDIUM" : "LOW";
  
  // Generate reasoning
  const { assessmentReason, keyIndicators, missingInformation } = generateAssessmentReason(
    results,
    { hasClaimForm, hasPolicySchedule, hasSupportingDocuments },
    combinedClaimData,
    combinedPolicyData
  );
  
  return {
    totalAttachments: results.length,
    claimRelatedAttachments,
    hasClaimForm,
    hasPolicySchedule,
    hasSupportingDocuments,
    combinedClaimData,
    combinedPolicyData,
    overallClaimLikelihood,
    isLikelyNewClaim,
    confidenceLevel,
    assessmentReason,
    keyIndicators,
    missingInformation,
    attachmentResults: results
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function determineFileType(fileName: string, mimeType?: string): "PDF" | "IMAGE" | "DOC" | "OTHER" {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  if (mimeType?.includes("pdf") || ext === "pdf") return "PDF";
  if (mimeType?.includes("image") || ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "IMAGE";
  if (mimeType?.includes("document") || mimeType?.includes("word") || ["doc", "docx", "rtf"].includes(ext)) return "DOC";
  
  return "OTHER";
}

/**
 * Get MIME type from filename extension
 */
function getMimeTypeFromFilename(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  const mimeTypes: Record<string, string> = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "webp": "image/webp",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Analyze PDF using LLM with extracted text content
 * Extracts text from PDF and uses LLM for intelligent analysis
 */
async function analyzePdfWithLlm(
  dataUrl: string,
  fileName: string,
  companyContext?: string
): Promise<{
  classification: DocumentClassification;
  extractedText: string;
  claimData?: ClaimFormData;
  policyData?: PolicyScheduleData;
}> {
  const zai = await getZAI();
  
  // Extract base64 content from data URL
  const base64Match = dataUrl.match(/base64,(.+)/);
  const base64Content = base64Match ? base64Match[1] : "";
  
  console.log(`[analyzePdfWithLlm] Processing PDF: ${fileName} (${base64Content.length} chars base64)`);
  
  // Extract text from PDF
  let pdfText = "";
  try {
    if (base64Content) {
      const pdfBuffer = Buffer.from(base64Content, 'base64');
      const pdfData = await pdf(pdfBuffer);
      pdfText = pdfData.text || "";
      console.log(`[analyzePdfWithLlm] Extracted ${pdfText.length} chars of text from PDF`);
    }
  } catch (pdfError) {
    console.error(`[analyzePdfWithLlm] Failed to extract PDF text:`, pdfError);
  }
  
  // No truncation - extract ALL text from PDF for comprehensive analysis
  // Vehicle details could be anywhere in the document
  const fullText = pdfText;
  
  // Use LLM to analyze the PDF content
  const classificationPrompt = `You are an expert insurance document analyzer for South African insurance companies.

Analyze this PDF document and extract ALL relevant information.

Document filename: ${fileName}
${companyContext ? `Source: ${companyContext}` : ''}

${pdfText ? `--- PDF TEXT CONTENT ---
${fullText}
--- END PDF TEXT ---` : '(No text could be extracted from this PDF - analyze based on filename only)'}

=== CRITICAL: EXTRACT FROM ALL DOCUMENT TYPES ===

**ALWAYS EXTRACT VEHICLE DETAILS FROM ANY DOCUMENT THAT CONTAINS THEM:**
- VIN NUMBER / CHASSIS NUMBER (17 characters, no I, O, Q)
  * Look for: "VIN", "Vin", "VIN No", "VIN Number", "Chassis", "Chassis No", "Chassis Number", "Vehicle ID"
  * Also look for standalone 17-char alphanumeric sequences
- REGISTRATION NUMBER (SA format: XX XX GP, XX-XX-GP, XXXXXX GP)
  * Look for: "Reg", "Reg No", "Registration", "Vehicle Reg", "VRM"
- VEHICLE MAKE (Toyota, VW, BMW, Mercedes, Ford, etc.)
- VEHICLE MODEL (Corolla, Polo, X3, C-Class, Ranger, etc.)
- VEHICLE YEAR (Year of Manufacture)
- VEHICLE COLOR
- ENGINE NUMBER (if present)
- ODOMETER reading (if present)

**DO NOT SKIP vehicle details extraction regardless of document type!**

=== DOCUMENT-TYPE-SPECIFIC EXTRACTION ===

**IF THIS IS A QUOTATION:**
- Extract ALL vehicle details (VIN, Reg, Make, Model, Year, Color, Engine)
- Extract CLIENT/CUSTOMER name and contact details
- Extract QUOTATION number, QUOTE date
- Extract PREMIUM amount, EXCESS amount, SUM INSURED
- Extract any VEHICLE EXTRAS or ACCESSORIES listed

**IF THIS IS A CLAIM FORM:**
- Extract ALL vehicle details (VIN, Reg, Make, Model, Year, Color, Engine)
- Extract INCIDENT DATE (date of accident/event)
- Extract INCIDENT LOCATION and DESCRIPTION
- Extract DRIVER DETAILS if different from policy holder
- Extract THIRD PARTY DETAILS if applicable

**IF THIS IS A POLICY SCHEDULE:**
- Extract ALL vehicle details (VIN, Reg, Make, Model, Year, Color, Engine)
- Extract SUM INSURED amount
- Extract EXCESS amount
- Extract PREMIUM amount
- Extract VEHICLE EXTRAS / SPECIFIED ITEMS
- Extract BENEFITS and EXTENSIONS

**IF THIS IS AN INVOICE:**
- Extract ALL vehicle details if present (VIN, Reg, Make, Model, Year)
- Extract invoice number, date, amounts

**IF THIS IS A POLICE REPORT:**
- Extract ALL vehicle details involved (VIN, Reg, Make, Model, Year)
- Extract CASE NUMBER (CAS number)
- Extract incident date and location

**IF THIS IS A VEHICLE ASSESSMENT or REPAIR QUOTE:**
- Extract ALL vehicle identification (VIN, Reg, Make, Model, Year, Engine)
- Extract damage description
- Extract repair costs/estimates

**IF THIS IS CORRESPONDENCE or OTHER:**
- Still extract ANY vehicle details found (VIN, Reg, Make, Model, Year)
- Extract any claim or policy numbers
- Extract sender/recipient information

=== CRITICAL EXTRACTION RULES ===
1. VIN/CHASSIS NUMBERS: Must be exactly 17 alphanumeric characters (no I, O, Q)
   - Search the ENTIRE document for any 17-character sequence matching [A-HJ-NPR-Z0-9]{17}
   - These often appear in tables, vehicle details sections, or fine print
2. VEHICLE REGISTRATIONS: Look for South African formats throughout the document
   - Common patterns: "BJ 51 NW GP", "BJ51NWGP", "CA 123 456", etc.
3. DO NOT SKIP any section - scan tables, headers, footers, fine print
4. If a value has multiple labels (e.g., "Chassis No" vs "VIN"), still extract it

Your tasks:
1. Classify the document type
2. Extract ALL key information based on document type
3. Look for South African formats:
   - Vehicle registrations: XX XX GP, XX-XX-GP format
   - Phone numbers: +27 or 0 prefix (082 123 4567)
   - ID numbers: 13-digit SA ID format
   - Claim numbers: Various formats (STM-YYYY-NNNNN, OUT/NNNNNN/YY, etc.)
   - Policy numbers: Company-specific formats
   - VIN numbers: 17-character vehicle identification numbers (may be labeled as "Chassis Number" or "VIN")

Respond in JSON format:
{
  "documentType": "CLAIM_FORM|POLICY_SCHEDULE|INVOICE|QUOTATION|POLICE_REPORT|MEDICAL_REPORT|VEHICLE_ASSESSMENT|REPAIR_QUOTE|CORRESPONDENCE|IDENTITY_DOCUMENT|PROOF_OF_ADDRESS|BANKING_DETAILS|PHOTO_EVIDENCE|OTHER",
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "isClaimRelated": true/false,
  "importance": "HIGH|MEDIUM|LOW",
  "keyFindings": {
    "claimNumber": "found or null",
    "policyNumber": "found or null",
    "quotationNumber": "found or null",
    "vehicleRegistration": "found or null",
    "vehicleVinNumber": "17-char VIN/Chassis Number or null - EXTRACT THIS EVEN IF IT'S HIDDEN IN A TABLE",
    "engineNumber": "found or null",
    "claimType": "MOTOR|PROPERTY|LIABILITY|THEFT|FIRE|GAP|OTHER|null",
    "incidentDate": "YYYY-MM-DD or null",
    "incidentTime": "HH:MM or null",
    "incidentLocation": "found or null",
    "incidentDescription": "brief description or null",
    "policyHolderName": "found or null",
    "policyHolderIdNumber": "found or null",
    "policyHolderPhone": "found or null",
    "policyHolderEmail": "found or null",
    "driverName": "if different from policy holder or null",
    "driverIdNumber": "found or null",
    "thirdPartyName": "found or null",
    "thirdPartyVehicleReg": "found or null",
    "vehicleMake": "found or null - e.g., Toyota, VW, BMW",
    "vehicleModel": "found or null - e.g., Corolla, Polo",
    "vehicleYear": "found or null",
    "vehicleColor": "found or null",
    "vehicleExtras": ["list of any vehicle extras/accessories found"],
    "insuredName": "found or null",
    "clientName": "for quotations - the customer/client name",
    "sumInsured": number or null,
    "excess": number or null,
    "premium": number or null,
    "benefits": ["list of benefits"],
    "extensions": ["list of extensions"],
    "specifiedItems": ["list of specified/extras items"],
    "inceptionDate": "YYYY-MM-DD or null",
    "expiryDate": "YYYY-MM-DD or null",
    "quotationDate": "YYYY-MM-DD or null",
    "policeCaseNumber": "CAS number or null"
  },
  "extractedText": "key text snippets from the document",
  "allNumbersFound": ["list of all claim/policy/reference numbers found"]
}`;

  try {
    // Use regular LLM for PDF analysis
    const response = await zai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: classificationPrompt
        }
      ],
    });

    const content = response.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const classification: DocumentClassification = {
        documentType: parsed.documentType || "OTHER",
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || "",
        isClaimRelated: parsed.isClaimRelated ?? false,
        importance: parsed.importance || "LOW"
      };
      
      // Build claim data from findings
      let claimData: ClaimFormData | undefined;
      let policyData: PolicyScheduleData | undefined;
      
      const findings = parsed.keyFindings || {};
      
      if (classification.documentType === "CLAIM_FORM" || findings.claimNumber) {
        claimData = {
          ...getEmptyClaimFormData(),
          claimNumber: findings.claimNumber || null,
          policyNumber: findings.policyNumber || null,
          claimType: findings.claimType || null,
          incidentDate: findings.incidentDate || null,
          incidentTime: findings.incidentTime || null,
          incidentLocation: findings.incidentLocation || null,
          incidentDescription: findings.incidentDescription || null,
          policyHolderName: findings.policyHolderName || null,
          policyHolderIdNumber: findings.policyHolderIdNumber || null,
          policyHolderPhone: findings.policyHolderPhone || null,
          policyHolderEmail: findings.policyHolderEmail || null,
          vehicleRegistration: findings.vehicleRegistration || null,
          vehicleMake: findings.vehicleMake || null,
          vehicleModel: findings.vehicleModel || null,
          vehicleYear: findings.vehicleYear || null,
          vehicleColor: findings.vehicleColor || null,
          vehicleVinNumber: findings.vehicleVinNumber || null,
          driverName: findings.driverName || null,
          driverIdNumber: findings.driverIdNumber || null,
          thirdPartyName: findings.thirdPartyName || null,
          thirdPartyVehicleReg: findings.thirdPartyVehicleReg || null,
          extractionConfidence: classification.confidence,
          extractedFields: Object.keys(findings).filter(k => findings[k] !== null && findings[k] !== undefined)
        };
      }
      
      if (classification.documentType === "POLICY_SCHEDULE" || classification.documentType === "QUOTATION" || (findings.policyNumber && !findings.claimNumber)) {
        policyData = {
          ...getEmptyPolicyScheduleData(),
          policyNumber: findings.policyNumber || null,
          insuredName: findings.insuredName || findings.policyHolderName || null,
          vehicleRegistration: findings.vehicleRegistration || null,
          vehicleMake: findings.vehicleMake || null,
          vehicleModel: findings.vehicleModel || null,
          vehicleYear: findings.vehicleYear ? parseInt(findings.vehicleYear) : null,
          vehicleColor: findings.vehicleColor || null,
          vehicleVinNumber: findings.vehicleVinNumber || null,
          engineNumber: findings.engineNumber || null,
          sumInsured: findings.sumInsured || null,
          excess: findings.excess || null,
          premium: findings.premium || null,
          benefits: findings.benefits || [],
          extensions: findings.extensions || [],
          inceptionDate: findings.inceptionDate || null,
          expiryDate: findings.expiryDate || null,
          extractionConfidence: classification.confidence,
          extractedFields: Object.keys(findings).filter(k => findings[k] !== null && findings[k] !== undefined)
        };
      }
      
      // POST-PROCESSING: Use helper functions to find VINs and vehicle details that LLM might have missed
      if (pdfText) {
        // Find all possible VINs in the extracted text
        const foundVins = findAllPossibleVins(pdfText);
        if (foundVins.length > 0) {
          // If LLM didn't find a VIN, use the first one found
          const vinToUse = foundVins[0];
          if (!findings.vehicleVinNumber) {
            console.log(`[analyzePdfWithLlm] Post-processing found VIN: ${vinToUse} (LLM missed it)`);
            if (claimData) {
              claimData.vehicleVinNumber = vinToUse;
              claimData.extractedFields.push('vehicleVinNumber');
            }
            if (policyData) {
              policyData.vehicleVinNumber = vinToUse;
              policyData.extractedFields.push('vehicleVinNumber');
            }
          } else {
            console.log(`[analyzePdfWithLlm] LLM found VIN: ${findings.vehicleVinNumber}, also found: ${foundVins.join(', ')}`);
          }
        }
        
        // Extract additional vehicle details if missing
        const vehicleDetails = extractVehicleDetails(pdfText);
        if (policyData) {
          if (!policyData.vehicleMake && vehicleDetails.make) {
            console.log(`[analyzePdfWithLlm] Post-processing found vehicle make: ${vehicleDetails.make}`);
            policyData.vehicleMake = vehicleDetails.make;
            policyData.extractedFields.push('vehicleMake');
          }
          if (!policyData.vehicleYear && vehicleDetails.year) {
            console.log(`[analyzePdfWithLlm] Post-processing found vehicle year: ${vehicleDetails.year}`);
            policyData.vehicleYear = parseInt(vehicleDetails.year);
            policyData.extractedFields.push('vehicleYear');
          }
          if (!policyData.vehicleColor && vehicleDetails.color) {
            console.log(`[analyzePdfWithLlm] Post-processing found vehicle color: ${vehicleDetails.color}`);
            policyData.vehicleColor = vehicleDetails.color;
            policyData.extractedFields.push('vehicleColor');
          }
          if (!policyData.engineNumber && vehicleDetails.engineNumber) {
            console.log(`[analyzePdfWithLlm] Post-processing found engine number: ${vehicleDetails.engineNumber}`);
            policyData.engineNumber = vehicleDetails.engineNumber;
            policyData.extractedFields.push('engineNumber');
          }
        }
        if (claimData) {
          if (!claimData.vehicleMake && vehicleDetails.make) {
            claimData.vehicleMake = vehicleDetails.make;
            claimData.extractedFields.push('vehicleMake');
          }
          if (!claimData.vehicleYear && vehicleDetails.year) {
            claimData.vehicleYear = vehicleDetails.year;
            claimData.extractedFields.push('vehicleYear');
          }
          if (!claimData.vehicleColor && vehicleDetails.color) {
            claimData.vehicleColor = vehicleDetails.color;
            claimData.extractedFields.push('vehicleColor');
          }
        }
      }
      
      console.log(`[analyzePdfWithLlm] Classified ${fileName} as ${classification.documentType} (confidence: ${classification.confidence}%)`);
      console.log(`[analyzePdfWithLlm] Extracted fields: ${Object.keys(findings).filter(k => findings[k] !== null).join(', ')}`);
      
      return {
        classification,
        extractedText: pdfText || `Filename: ${fileName}`,
        claimData,
        policyData
      };
    }
  } catch (error) {
    console.error(`[analyzePdfWithLlm] LLM analysis failed for ${fileName}:`, error);
  }
  
  // Fallback: Use basic classification based on filename
  return classifyPdfByFilename(fileName);
}

/**
 * Classify PDF by filename patterns
 */
function classifyPdfByFilename(fileName: string): {
  classification: DocumentClassification;
  extractedText: string;
  claimData?: ClaimFormData;
  policyData?: PolicyScheduleData;
} {
  const lowerFileName = fileName.toLowerCase();
  let documentType: DocumentType = "OTHER";
  let isClaimRelated = false;
  let importance: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  let confidence = 30;
  let policyNumber: string | null = null;
  let claimNumber: string | null = null;
  
  // Extract potential policy/claim numbers from filename
  const policyMatch = fileName.match(/([A-Z]{2,5}[A-Z]?\d{6,12})/i);
  if (policyMatch) {
    policyNumber = policyMatch[1];
  }
  
  const claimMatch = fileName.match(/(STM|OUT|HOL|OMN|DIS|AF|PSG)[-_]?\d{4,6}[-_]?\d{4,8}/i);
  if (claimMatch) {
    claimNumber = claimMatch[0];
  }
  
  if (lowerFileName.includes("claim") && (lowerFileName.includes("form") || lowerFileName.includes("submission"))) {
    documentType = "CLAIM_FORM";
    isClaimRelated = true;
    importance = "HIGH";
    confidence = 50;
  } else if (lowerFileName.includes("policy") || lowerFileName.includes("schedule") || policyNumber) {
    documentType = "POLICY_SCHEDULE";
    isClaimRelated = true;
    importance = "HIGH";
    confidence = policyNumber ? 60 : 40;
  } else if (lowerFileName.includes("police") || lowerFileName.includes("cas ")) {
    documentType = "POLICE_REPORT";
    isClaimRelated = true;
    importance = "HIGH";
    confidence = 50;
  } else if (lowerFileName.includes("invoice") || lowerFileName.includes("statement")) {
    documentType = "INVOICE";
    importance = "MEDIUM";
    confidence = 50;
  } else if (lowerFileName.includes("quote") || lowerFileName.includes("quotation")) {
    documentType = "QUOTATION";
    confidence = 50;
  } else if (policyNumber) {
    // If we found a policy number pattern, likely a policy document
    documentType = "POLICY_SCHEDULE";
    isClaimRelated = true;
    importance = "HIGH";
    confidence = 55;
  }
  
  const classification: DocumentClassification = {
    documentType,
    confidence,
    reasoning: `Classified based on filename pattern. ${policyNumber ? `Policy number detected: ${policyNumber}. ` : ''}Recommend manual review for confirmation.`,
    isClaimRelated,
    importance
  };
  
  let claimData: ClaimFormData | undefined;
  let policyData: PolicyScheduleData | undefined;
  
  if (documentType === "CLAIM_FORM") {
    claimData = {
      ...getEmptyClaimFormData(),
      claimNumber,
      policyNumber,
      extractionConfidence: confidence,
      extractedFields: [claimNumber ? 'claimNumber' : '', policyNumber ? 'policyNumber' : ''].filter(Boolean)
    };
  } else if (documentType === "POLICY_SCHEDULE") {
    policyData = {
      ...getEmptyPolicyScheduleData(),
      policyNumber,
      extractionConfidence: confidence,
      extractedFields: policyNumber ? ['policyNumber'] : []
    };
  }
  
  console.log(`[classifyPdfByFilename] Classified ${fileName} as ${documentType} (policy#: ${policyNumber}, claim#: ${claimNumber})`);
  
  return {
    classification,
    extractedText: `Filename: ${fileName}. Detected policy number: ${policyNumber || 'none'}`,
    claimData,
    policyData
  };
}

function calculateClaimLikelihood(
  classification: DocumentClassification,
  claimFormData?: ClaimFormData,
  policyScheduleData?: PolicyScheduleData
): number {
  if (!classification.isClaimRelated) return 0;
  
  let score = 0;
  
  // Document type base score
  if (classification.documentType === "CLAIM_FORM") score += 50;
  else if (classification.documentType === "POLICY_SCHEDULE") score += 20;
  else if (classification.importance === "HIGH") score += 30;
  else if (classification.importance === "MEDIUM") score += 15;
  
  // Claim form data boosts
  if (claimFormData) {
    if (claimFormData.claimNumber) score += 15;
    if (claimFormData.policyNumber) score += 10;
    if (claimFormData.vehicleRegistration) score += 5;
    if (claimFormData.incidentDate) score += 5;
    if (claimFormData.policyHolderName) score += 5;
  }
  
  // Policy schedule data boosts
  if (policyScheduleData) {
    if (policyScheduleData.policyNumber) score += 10;
    if (policyScheduleData.vehicleRegistration) score += 5;
  }
  
  return Math.min(100, score);
}

function calculateOverallClaimLikelihood(
  results: AttachmentAnalysisResult[],
  indicators: { hasClaimForm: boolean; hasPolicySchedule: boolean; hasSupportingDocuments: boolean }
): number {
  if (results.length === 0) return 0;
  
  // Weight attachments by type
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  for (const result of results) {
    // Max contribution per attachment is 100
    maxPossibleScore += 100;
    
    // If we have a claim form, it gets the highest weight
    if (result.classification.documentType === "CLAIM_FORM") {
      totalScore += result.claimLikelihoodScore * 1.5; // Boost claim forms
    } else if (result.classification.documentType === "POLICY_SCHEDULE") {
      totalScore += result.claimLikelihoodScore * 1.2; // Policy schedules also important
    } else if (result.classification.isClaimRelated) {
      totalScore += result.claimLikelihoodScore;
    } else {
      totalScore += result.claimLikelihoodScore * 0.3; // Non-claim related still contributes
    }
  }
  
  // Normalize to 0-100
  let baseScore = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  
  // Bonus for having key document combinations
  if (indicators.hasClaimForm && indicators.hasPolicySchedule) {
    baseScore = Math.min(100, baseScore + 20); // Strong indicator
  } else if (indicators.hasClaimForm) {
    baseScore = Math.min(100, baseScore + 10);
  }
  
  if (indicators.hasSupportingDocuments) {
    baseScore = Math.min(100, baseScore + 5);
  }
  
  return Math.round(baseScore);
}

function combineClaimFormData(results: AttachmentAnalysisResult[]): Partial<ClaimFormData> {
  const combined: Partial<ClaimFormData> = {};
  
  for (const result of results) {
    if (result.claimFormData) {
      for (const key of Object.keys(result.claimFormData) as Array<keyof ClaimFormData>) {
        const value = result.claimFormData[key];
        if (value !== null && value !== undefined && !(combined[key])) {
          (combined as any)[key] = value;
        }
      }
    }
  }
  
  return combined;
}

function combinePolicyScheduleData(results: AttachmentAnalysisResult[]): Partial<PolicyScheduleData> {
  const combined: Partial<PolicyScheduleData> = {};
  
  for (const result of results) {
    if (result.policyScheduleData) {
      for (const key of Object.keys(result.policyScheduleData) as Array<keyof PolicyScheduleData>) {
        const value = result.policyScheduleData[key];
        if (value !== null && value !== undefined && !(combined[key])) {
          (combined as any)[key] = value;
        }
      }
    }
  }
  
  return combined;
}

function generateAssessmentReason(
  results: AttachmentAnalysisResult[],
  indicators: { hasClaimForm: boolean; hasPolicySchedule: boolean; hasSupportingDocuments: boolean },
  combinedClaimData: Partial<ClaimFormData>,
  combinedPolicyData: Partial<PolicyScheduleData>
): { assessmentReason: string; keyIndicators: string[]; missingInformation: string[] } {
  const keyIndicators: string[] = [];
  const missingInformation: string[] = [];
  
  // Check for key indicators
  if (indicators.hasClaimForm) keyIndicators.push("Contains claim form");
  if (indicators.hasPolicySchedule) keyIndicators.push("Contains policy schedule");
  if (indicators.hasSupportingDocuments) keyIndicators.push("Contains supporting documents");
  
  if (combinedClaimData.claimNumber) keyIndicators.push(`Claim number found: ${combinedClaimData.claimNumber}`);
  if (combinedClaimData.policyNumber || combinedPolicyData.policyNumber) {
    keyIndicators.push(`Policy number found: ${combinedClaimData.policyNumber || combinedPolicyData.policyNumber}`);
  }
  if (combinedClaimData.vehicleRegistration || combinedPolicyData.vehicleRegistration) {
    keyIndicators.push(`Vehicle registration: ${combinedClaimData.vehicleRegistration || combinedPolicyData.vehicleRegistration}`);
  }
  if (combinedClaimData.policyHolderName || combinedPolicyData.insuredName) {
    keyIndicators.push(`Insured: ${combinedClaimData.policyHolderName || combinedPolicyData.insuredName}`);
  }
  
  // Check for missing information
  if (!combinedClaimData.claimNumber && !combinedPolicyData.policyNumber) {
    missingInformation.push("No claim number identified");
  }
  if (!combinedClaimData.policyNumber && !combinedPolicyData.policyNumber) {
    missingInformation.push("No policy number identified");
  }
  if (!combinedClaimData.policyHolderName && !combinedPolicyData.insuredName) {
    missingInformation.push("No policy holder name identified");
  }
  if (!combinedClaimData.vehicleRegistration && !combinedPolicyData.vehicleRegistration) {
    // Only for motor claims
    if (combinedClaimData.claimType === "MOTOR") {
      missingInformation.push("No vehicle registration identified");
    }
  }
  if (!combinedClaimData.incidentDate) {
    missingInformation.push("No incident date identified");
  }
  
  // Generate assessment reason
  let assessmentReason = "";
  
  if (indicators.hasClaimForm && indicators.hasPolicySchedule) {
    assessmentReason = "High likelihood of new claim: Email contains both a claim form and policy schedule, which is typical for new claim submissions.";
  } else if (indicators.hasClaimForm) {
    assessmentReason = "Likely a new claim: Email contains a claim form with incident details.";
  } else if (indicators.hasPolicySchedule && !indicators.hasClaimForm) {
    assessmentReason = "Possible policy document submission without claim form. May be a policy inquiry or renewal, not a new claim.";
  } else if (indicators.hasSupportingDocuments) {
    assessmentReason = "Contains supporting documents but no claim form. May be additional documentation for an existing claim.";
  } else {
    assessmentReason = "Attachments do not indicate a clear new claim submission. May be correspondence or other documents.";
  }
  
  return { assessmentReason, keyIndicators, missingInformation };
}

// =============================================================================
// LEARNING FUNCTIONS
// =============================================================================

/**
 * Learn from user feedback on extracted data
 */
export async function learnFromFeedback(
  emailId: string,
  attachmentId: string,
  fieldName: string,
  originalValue: string | null,
  correctedValue: string,
  companyContext?: string
): Promise<void> {
  // Store the correction
  await db.attachmentLearning.create({
    data: {
      emailQueueId: emailId,
      attachmentAnalysisId: attachmentId,
      fieldName,
      originalValue,
      correctedValue,
      companyContext,
      learnedAt: new Date()
    }
  });
  
  // Update the attachment analysis with corrected data
  const analysis = await db.attachmentAnalysis.findUnique({
    where: { id: attachmentId }
  });
  
  if (analysis) {
    if (analysis.claimFormData) {
      const claimData = JSON.parse(analysis.claimFormData);
      if (fieldName in claimData) {
        claimData[fieldName] = correctedValue;
        await db.attachmentAnalysis.update({
          where: { id: attachmentId },
          data: { claimFormData: JSON.stringify(claimData) }
        });
      }
    }
    
    if (analysis.policyScheduleData) {
      const policyData = JSON.parse(analysis.policyScheduleData);
      if (fieldName in policyData) {
        policyData[fieldName] = correctedValue;
        await db.attachmentAnalysis.update({
          where: { id: attachmentId },
          data: { policyScheduleData: JSON.stringify(policyData) }
        });
      }
    }
  }
}

/**
 * Get learned patterns for a company
 */
export async function getLearnedPatterns(companyContext: string): Promise<Array<{
  fieldName: string;
  patterns: Array<{ original: string; corrected: string; count: number }>;
}>> {
  const learnings = await db.attachmentLearning.findMany({
    where: { companyContext },
    orderBy: { learnedAt: 'desc' },
    take: 100
  });
  
  // Group by field name
  const fieldGroups = new Map<string, Map<string, { original: string; corrected: string; count: number }>>();
  
  for (const learning of learnings) {
    if (!fieldGroups.has(learning.fieldName)) {
      fieldGroups.set(learning.fieldName, new Map());
    }
    
    const fieldMap = fieldGroups.get(learning.fieldName)!;
    const key = `${learning.originalValue || ''}:${learning.correctedValue}`;
    
    if (fieldMap.has(key)) {
      fieldMap.get(key)!.count++;
    } else {
      fieldMap.set(key, {
        original: learning.originalValue || '',
        corrected: learning.correctedValue,
        count: 1
      });
    }
  }
  
  // Convert to array format
  return Array.from(fieldGroups.entries()).map(([fieldName, patterns]) => ({
    fieldName,
    patterns: Array.from(patterns.values()).sort((a, b) => b.count - a.count)
  }));
}

// =============================================================================
// UNIFIED EMAIL + ATTACHMENT ANALYSIS
// =============================================================================

/**
 * Unified analysis result that combines email content + all attachments
 */
export interface UnifiedAnalysisResult {
  // Classification
  classification: "NEW_CLAIM" | "IGNORE" | "MISSING_INFO" | "OTHER";
  confidence: number;
  reasoning: string;
  
  // Combined extracted data from email body + ALL attachments
  extractedData: {
    claimNumber: string | null;
    policyNumber: string | null;
    claimType: "MOTOR" | "PROPERTY" | "LIABILITY" | "THEFT" | "FIRE" | "GAP" | "OTHER" | null;
    incidentDate: string | null;
    incidentLocation: string | null;
    incidentDescription: string | null;
    
    // Client/Policy Holder info
    clientName: string | null;
    clientIdNumber: string | null;
    clientPhone: string | null;
    clientEmail: string | null;
    clientAddress: string | null;
    
    // Vehicle info (for motor claims)
    vehicleRegistration: string | null;
    vehicleMake: string | null;
    vehicleModel: string | null;
    vehicleYear: string | null;
    vehicleColor: string | null;
    vehicleVinNumber: string | null;
    
    // Driver info (if different from policy holder)
    driverName: string | null;
    driverIdNumber: string | null;
    
    // Third party info
    thirdPartyName: string | null;
    thirdPartyVehicleReg: string | null;
    
    // Financial info
    excessAmount: number | null;
    estimatedDamage: number | null;
    sumInsured: number | null;
    premium: number | null;
    
    // Policy extras
    benefits: string[];
    extensions: string[];
    specifiedItems: string[];
    
    // Insurance company
    insuranceCompany: string | null;
    
    // Policy dates
    policyInceptionDate: string | null;
    policyExpiryDate: string | null;
    
    // Police report
    policeCaseNumber: string | null;
    
    // PROPERTY claim fields
    propertyAddress: string | null;
    propertyType: string | null;
    damageDescription: string | null;
    estimatedValue: number | null;
    
    // THEFT claim fields
    stolenItems: Array<{ description: string; value: number }>;
    dateOfDiscovery: string | null;
    securityMeasures: string | null;
    
    // LIABILITY claim fields
    witnessNames: string[];
    injuriesReported: boolean | null;
    
    // FIRE claim fields
    fireReportNumber: string | null;
    causeOfFire: string | null;
    extentOfDamage: string | null;
    
    // GAP claim fields
    originalVehicleValue: number | null;
    settlementAmount: number | null;
    financeOutstanding: number | null;
    dateOfTotalLoss: string | null;
  };
  
  // Claim type identification
  claimTypeIdentified: string;
  claimTypeReasoning: string;
  
  // Source tracking - where each piece of data came from
  dataSources: {
    claimNumber: "email_body" | "attachment" | null;
    policyNumber: "email_body" | "attachment" | null;
    clientName: "email_body" | "attachment" | null;
    vehicleRegistration: "email_body" | "attachment" | null;
    [key: string]: "email_body" | "attachment" | null;
  };
  
  // Key indicators found across all sources
  keyIndicators: string[];
  
  // Missing critical information
  missingInformation: string[];
  
  // Document breakdown
  documentsAnalyzed: {
    emailBody: boolean;
    attachments: Array<{
      fileName: string;
      documentType: string;
      isClaimRelated: boolean;
      keyFindings: string[];
    }>;
  };
  
  // Overall assessment
  overallClaimLikelihood: number;
  isReadyForProcessing: boolean;
  recommendedAction: "CREATE_CLAIM" | "REQUEST_INFO" | "MANUAL_REVIEW" | "IGNORE";
}

/**
 * Perform unified analysis of email + all attachments
 * This is the main function that analyzes EVERYTHING together
 */
export async function performUnifiedAnalysis(
  emailId: string,
  emailData: {
    subject: string | null;
    from: string | null;
    bodyText: string | null;
  },
  attachments: Array<{
    filename: string;
    content?: string;
    contentBase64?: string;
    mimeType?: string;
    size?: number;
  }>,
  companyContext?: string
): Promise<UnifiedAnalysisResult> {
  const zai = await getZAI();
  console.log(`[unified-analysis] Starting unified analysis for email ${emailId}`);
  console.log(`[unified-analysis] Email subject: ${emailData.subject}`);
  console.log(`[unified-analysis] Attachments to process: ${attachments.length}`);
  
  // Step 1: Analyze ALL attachments first
  const attachmentResults: AttachmentAnalysisResult[] = [];
  for (const attachment of attachments) {
    try {
      const result = await analyzeAttachment(emailId, attachment, companyContext);
      attachmentResults.push(result);
      console.log(`[unified-analysis] Processed attachment: ${attachment.filename} -> ${result.classification.documentType}`);
    } catch (error) {
      console.error(`[unified-analysis] Failed to analyze attachment ${attachment.filename}:`, error);
    }
  }
  
  // Step 2: Gather all extracted text from attachments
  // NO TRUNCATION - We need ALL text to find vehicle details, VINs, claim numbers etc.
  const attachmentTexts = attachmentResults.map(r => ({
    fileName: r.fileName,
    documentType: r.classification.documentType,
    text: r.rawExtractedText, // Full text - no truncation
    claimData: r.claimFormData,
    policyData: r.policyScheduleData
  }));
  
  // Step 3: Create unified analysis prompt with ALL data
  const attachmentSummary = attachmentTexts.map(a => 
    `\n--- ATTACHMENT: ${a.fileName} (${a.documentType}) ---\n${a.text || '(No text extracted)'}`
  ).join('\n');
  
  const combinedClaimData = combineClaimFormData(attachmentResults);
  const combinedPolicyData = combinePolicyScheduleData(attachmentResults);
  
  // Get claim number format hints from learned patterns
  const claimNumberHint = await getClaimNumberFormatHint(companyContext, emailData.from?.split('@')[1]);
  
  // Build document-type-specific extraction hints
  const documentTypeHints = attachmentResults.map(r => {
    const hints: string[] = [];
    const docType = r.classification.documentType;
    
    if (docType === "QUOTATION") {
      hints.push("QUOTATION: Extract VIN NUMBER/CHASSIS NUMBER and REGISTRATION NUMBER - these identify the correct vehicle on the policy schedule");
      hints.push("Look for labels: 'Chassis No:', 'Chassis Number:', 'VIN:', 'VIN No:', 'VIN Number:'");
      hints.push("Look for: vehicle details, make, model, year, VIN/chassis number, registration number");
    } else if (docType === "CLAIM_FORM") {
      hints.push("CLAIM FORM: Extract INCIDENT DATE, claim details, driver info, third party info");
      hints.push("Look for: incident date/time/location, description of event, driver details, third party details");
    } else if (docType === "POLICY_SCHEDULE") {
      hints.push("POLICY SCHEDULE: Extract SUM INSURED, COVERAGE DETAILS, VEHICLE EXTRAS");
      hints.push("Look for: sum insured amount, excess, premium, benefits, extensions, specified items");
    } else if (docType === "POLICE_REPORT") {
      hints.push("POLICE REPORT: Extract CASE NUMBER, incident details, parties involved");
    }
    
    return `${r.fileName} (${docType}): ${hints.join('. ')}`;
  }).join('\n');

  const unifiedPrompt = `You are the Unified Claims Analysis AI for STEFCO Consultants.

Analyze ALL available information from this email and its attachments to produce ONE comprehensive assessment.

=== EMAIL CONTENT ===
Subject: ${emailData.subject || '(No Subject)'}
From: ${emailData.from || 'Unknown'}
Body:
${emailData.bodyText || '(No body text)'}

=== ATTACHMENTS (${attachments.length} files) ===
${attachmentSummary || '(No attachments)'}

=== DOCUMENT-SPECIFIC EXTRACTION GUIDANCE ===
${documentTypeHints || 'No specific guidance available'}

=== PRE-EXTRACTED DATA FROM ATTACHMENTS ===
Claim Data: ${JSON.stringify(combinedClaimData, null, 2)}
Policy Data: ${JSON.stringify(combinedPolicyData, null, 2)}

=== LEARNED CLAIM NUMBER PATTERNS ===
${claimNumberHint}

=== YOUR TASK - TWO PHASE ANALYSIS ===

**PHASE 1: IDENTIFY CLAIM TYPE FIRST**
Determine the claim type by analyzing:
- Email subject (often contains claim type indicators)
- Document types present (vehicle-related docs = MOTOR)
- Keywords in content ("accident", "theft", "fire", "property damage", "liability")

**PHASE 2: APPLY CLAIM-TYPE-SPECIFIC EXTRACTION RULES**

=== CLAIM TYPE EXTRACTION RULES ===

**MOTOR CLAIMS - Required Information:**
- Vehicle Registration Number (SA format: XX XX GP, XX-XX-GP)
- Vehicle VIN Number (17 characters) - also labeled as "Chassis No" or "Chassis Number"
- Vehicle Make, Model, Year, Color
- Driver Name and ID (if different from policy holder)
- Incident Date, Time, Location
- Third Party Details (name, vehicle reg, insurance)
- Source Priority for VIN/Reg: QUOTATION → POLICY_SCHEDULE → CLAIM_FORM

**PROPERTY CLAIMS - Required Information:**
- Property Address (full address)
- Property Type (house, apartment, commercial, etc.)
- Damage Description (detailed)
- Estimated Value / Sum Insured
- Incident Date
- Photos of damage (if attached)

**THEFT CLAIMS - Required Information:**
- Police Case Number (CAS number)
- Date/Time of Discovery
- List of Stolen Items with values
- Security Measures in place
- Proof of Ownership (receipts, photos)

**LIABILITY CLAIMS - Required Information:**
- Third Party Name and Contact Details
- Incident Description (detailed)
- Witness Information
- Location of Incident
- Any injuries reported

**FIRE CLAIMS - Required Information:**
- Fire Department Report Number
- Cause of Fire (if known)
- Extent of Damage
- Affected Areas/Items
- Incident Date

**GAP CLAIMS - Required Information:**
- Original Vehicle Value
- Insurance Settlement Amount
- Finance/Loan Amount Outstanding
- Vehicle Details
- Date of Total Loss

=== UNIVERSAL RULES FOR ALL CLAIM TYPES ===
- Cross-reference data between email body and ALL attachments
- If email body mentions a claim number but attachment has more details, combine them
- If there are conflicts, prefer attachment data for claim details
- Be thorough - check ALL attachments for relevant information
- South African formats: vehicle reg (XX XX GP, XX-XX-GP), phone (+27/0 prefix), ID (13 digits)
- VIN/Chassis Number: Look for labels "Chassis No:", "Chassis Number:", "VIN:", "VIN No:" - these are the same thing (17 alphanumeric characters)

=== MISSING INFORMATION CHECKLIST BY CLAIM TYPE ===

For MOTOR claims, flag as missing if not found:
- vehicleRegistration OR vehicleVinNumber
- incidentDate
- driverName (or policyHolderName)

For PROPERTY claims, flag as missing if not found:
- clientAddress (property address)
- incidentDescription (damage details)
- incidentDate

For THEFT claims, flag as missing if not found:
- policeCaseNumber
- incidentDescription (what was stolen)
- incidentDate

For LIABILITY claims, flag as missing if not found:
- thirdPartyName
- incidentDescription
- incidentDate

For FIRE claims, flag as missing if not found:
- incidentDate
- incidentDescription (damage extent)
- incidentLocation

For GAP claims, flag as missing if not found:
- vehicleRegistration OR vehicleVinNumber
- sumInsured (settlement)
- incidentDate

Respond in JSON format:
{
  "classification": "NEW_CLAIM|IGNORE|MISSING_INFO|OTHER",
  "confidence": 0-100,
  "reasoning": "Comprehensive explanation considering ALL sources",
  "claimTypeIdentified": "MOTOR|PROPERTY|LIABILITY|THEFT|FIRE|GAP|OTHER",
  "claimTypeReasoning": "Why this claim type was identified",
  "extractedData": {
    // Universal fields
    "claimNumber": "from email or attachment or null",
    "policyNumber": "from email or attachment or null",
    "claimType": "MOTOR|PROPERTY|LIABILITY|THEFT|FIRE|GAP|OTHER|null",
    "incidentDate": "YYYY-MM-DD or null",
    "incidentTime": "HH:MM or null",
    "incidentLocation": "location or null",
    "incidentDescription": "description from any source or null",
    "clientName": "name from email or attachment or null",
    "clientIdNumber": "SA ID number or null",
    "clientPhone": "phone or null",
    "clientEmail": "email or null",
    "clientAddress": "address or null",
    "insuranceCompany": "company name or null",
    "policyInceptionDate": "YYYY-MM-DD or null",
    "policyExpiryDate": "YYYY-MM-DD or null",
    "policeCaseNumber": "CAS number or null",
    
    // MOTOR claim fields
    "vehicleRegistration": "SA vehicle reg or null",
    "vehicleMake": "make or null",
    "vehicleModel": "model or null",
    "vehicleYear": "year or null",
    "vehicleColor": "color or null",
    "vehicleVinNumber": "17-char VIN/Chassis Number or null",
    "driverName": "if different from policy holder or null",
    "driverIdNumber": "SA ID or null",
    "thirdPartyName": "third party name or null",
    "thirdPartyVehicleReg": "third party vehicle reg or null",
    "excessAmount": number or null,
    "estimatedDamage": number or null,
    "sumInsured": number or null,
    "premium": number or null,
    "benefits": ["list of benefits from policy schedule"],
    "extensions": ["list of extensions from policy schedule"],
    "specifiedItems": ["list of specified/extras items from policy schedule"],
    
    // PROPERTY claim fields
    "propertyAddress": "full property address or null",
    "propertyType": "house|apartment|commercial|industrial|other|null",
    "damageDescription": "detailed damage description or null",
    "estimatedValue": number or null,
    
    // THEFT claim fields
    "stolenItems": [{"description": "item", "value": number}],
    "dateOfDiscovery": "YYYY-MM-DD or null",
    "securityMeasures": "description of security or null",
    
    // LIABILITY claim fields
    "witnessNames": ["witness names"],
    "injuriesReported": true/false,
    
    // FIRE claim fields
    "fireReportNumber": "fire department report number or null",
    "causeOfFire": "known cause or null",
    "extentOfDamage": "description or null",
    
    // GAP claim fields
    "originalVehicleValue": number or null,
    "settlementAmount": number or null,
    "financeOutstanding": number or null,
    "dateOfTotalLoss": "YYYY-MM-DD or null"
  },
  "dataSources": {
    "claimNumber": "email_body|attachment|null",
    "policyNumber": "email_body|attachment|null",
    "clientName": "email_body|attachment|null",
    "vehicleRegistration": "email_body|attachment|null",
    "vehicleVinNumber": "email_body|attachment|null"
  },
  "keyIndicators": ["list of all claim indicators found"],
  "missingInformation": ["list of critical missing info"],
  "overallClaimLikelihood": 0-100,
  "isReadyForProcessing": true/false,
  "recommendedAction": "CREATE_CLAIM|REQUEST_INFO|MANUAL_REVIEW|IGNORE"
}`;

  try {
    const response = await zai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: unifiedPrompt }]
    });
    
    const content = response.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const extractedData = parsed.extractedData || {};
      
      const result: UnifiedAnalysisResult = {
        classification: parsed.classification || "OTHER",
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || "Unable to determine classification",
        claimTypeIdentified: parsed.claimTypeIdentified || extractedData.claimType || "OTHER",
        claimTypeReasoning: parsed.claimTypeReasoning || "Claim type identified from available information",
        extractedData: {
          // Universal fields
          claimNumber: extractedData.claimNumber || null,
          policyNumber: extractedData.policyNumber || null,
          claimType: extractedData.claimType || null,
          incidentDate: extractedData.incidentDate || null,
          incidentTime: extractedData.incidentTime || null,
          incidentLocation: extractedData.incidentLocation || null,
          incidentDescription: extractedData.incidentDescription || null,
          clientName: extractedData.clientName || null,
          clientIdNumber: extractedData.clientIdNumber || null,
          clientPhone: extractedData.clientPhone || null,
          clientEmail: extractedData.clientEmail || null,
          clientAddress: extractedData.clientAddress || null,
          insuranceCompany: extractedData.insuranceCompany || null,
          policyInceptionDate: extractedData.policyInceptionDate || null,
          policyExpiryDate: extractedData.policyExpiryDate || null,
          policeCaseNumber: extractedData.policeCaseNumber || null,
          // Motor fields
          vehicleRegistration: extractedData.vehicleRegistration || null,
          vehicleMake: extractedData.vehicleMake || null,
          vehicleModel: extractedData.vehicleModel || null,
          vehicleYear: extractedData.vehicleYear || null,
          vehicleColor: extractedData.vehicleColor || null,
          vehicleVinNumber: extractedData.vehicleVinNumber || null,
          driverName: extractedData.driverName || null,
          driverIdNumber: extractedData.driverIdNumber || null,
          thirdPartyName: extractedData.thirdPartyName || null,
          thirdPartyVehicleReg: extractedData.thirdPartyVehicleReg || null,
          excessAmount: extractedData.excessAmount || null,
          estimatedDamage: extractedData.estimatedDamage || null,
          sumInsured: extractedData.sumInsured || null,
          premium: extractedData.premium || null,
          benefits: extractedData.benefits || [],
          extensions: extractedData.extensions || [],
          specifiedItems: extractedData.specifiedItems || [],
          // Property fields
          propertyAddress: extractedData.propertyAddress || null,
          propertyType: extractedData.propertyType || null,
          damageDescription: extractedData.damageDescription || null,
          estimatedValue: extractedData.estimatedValue || null,
          // Theft fields
          stolenItems: extractedData.stolenItems || [],
          dateOfDiscovery: extractedData.dateOfDiscovery || null,
          securityMeasures: extractedData.securityMeasures || null,
          // Liability fields
          witnessNames: extractedData.witnessNames || [],
          injuriesReported: extractedData.injuriesReported || null,
          // Fire fields
          fireReportNumber: extractedData.fireReportNumber || null,
          causeOfFire: extractedData.causeOfFire || null,
          extentOfDamage: extractedData.extentOfDamage || null,
          // GAP fields
          originalVehicleValue: extractedData.originalVehicleValue || null,
          settlementAmount: extractedData.settlementAmount || null,
          financeOutstanding: extractedData.financeOutstanding || null,
          dateOfTotalLoss: extractedData.dateOfTotalLoss || null
        },
        dataSources: parsed.dataSources || {},
        keyIndicators: parsed.keyIndicators || [],
        missingInformation: parsed.missingInformation || [],
        documentsAnalyzed: {
          emailBody: !!(emailData.bodyText),
          attachments: attachmentResults.map(r => ({
            fileName: r.fileName,
            documentType: r.classification.documentType,
            isClaimRelated: r.classification.isClaimRelated,
            keyFindings: r.claimFormData ? Object.entries(r.claimFormData)
              .filter(([k, v]) => v !== null && v !== undefined)
              .map(([k, v]) => `${k}: ${v}`) : []
          }))
        },
        overallClaimLikelihood: parsed.overallClaimLikelihood || 0,
        isReadyForProcessing: parsed.isReadyForProcessing || false,
        recommendedAction: parsed.recommendedAction || "MANUAL_REVIEW"
      };
      
      // Store the unified analysis result
      await db.emailQueue.update({
        where: { id: emailId },
        data: {
          aiClassification: result.classification,
          aiConfidence: result.confidence,
          aiReasoning: result.reasoning,
          aiExtractedData: JSON.stringify(result.extractedData)
        }
      });
      
      // Store predictions for later learning comparison
      await storePredictionsForLearning(emailId, result, emailData.from);
      
      // Update or create attachment summary
      const hasClaimForm = attachmentResults.some(r => r.classification.documentType === "CLAIM_FORM");
      const hasPolicySchedule = attachmentResults.some(r => r.classification.documentType === "POLICY_SCHEDULE");
      const hasSupportingDocuments = attachmentResults.some(r => 
        ["POLICE_REPORT", "MEDICAL_REPORT", "VEHICLE_ASSESSMENT", "REPAIR_QUOTE", "PHOTO_EVIDENCE"].includes(r.classification.documentType)
      );
      
      await db.emailAttachmentSummary.upsert({
        where: { emailQueueId: emailId },
        create: {
          emailQueueId: emailId,
          totalAttachments: attachments.length,
          claimRelatedAttachments: attachmentResults.filter(r => r.classification.isClaimRelated).length,
          hasClaimForm,
          hasPolicySchedule,
          hasSupportingDocuments,
          combinedClaimData: JSON.stringify(result.extractedData),
          combinedPolicyData: JSON.stringify(combinedPolicyData),
          overallClaimLikelihood: result.overallClaimLikelihood,
          isLikelyNewClaim: result.classification === "NEW_CLAIM",
          confidenceLevel: result.confidence >= 80 ? "HIGH" : result.confidence >= 60 ? "MEDIUM" : "LOW",
          assessmentReason: result.reasoning,
          keyIndicators: JSON.stringify(result.keyIndicators),
          missingInformation: JSON.stringify(result.missingInformation)
        },
        update: {
          totalAttachments: attachments.length,
          claimRelatedAttachments: attachmentResults.filter(r => r.classification.isClaimRelated).length,
          hasClaimForm,
          hasPolicySchedule,
          hasSupportingDocuments,
          combinedClaimData: JSON.stringify(result.extractedData),
          overallClaimLikelihood: result.overallClaimLikelihood,
          isLikelyNewClaim: result.classification === "NEW_CLAIM",
          confidenceLevel: result.confidence >= 80 ? "HIGH" : result.confidence >= 60 ? "MEDIUM" : "LOW",
          assessmentReason: result.reasoning,
          keyIndicators: JSON.stringify(result.keyIndicators),
          missingInformation: JSON.stringify(result.missingInformation)
        }
      });
      
      console.log(`[unified-analysis] Complete: ${result.classification} (${result.confidence}% confidence)`);
      console.log(`[unified-analysis] Key indicators: ${result.keyIndicators.join(', ')}`);
      
      return result;
    }
  } catch (error) {
    console.error("[unified-analysis] Failed:", error);
  }
  
  // Fallback result
  return {
    classification: "OTHER",
    confidence: 0,
    reasoning: "Failed to perform unified analysis",
    claimTypeIdentified: "OTHER",
    claimTypeReasoning: "Analysis failed - could not determine claim type",
    extractedData: {
      // Universal fields
      claimNumber: null,
      policyNumber: null,
      claimType: null,
      incidentDate: null,
      incidentTime: null,
      incidentLocation: null,
      incidentDescription: null,
      clientName: null,
      clientIdNumber: null,
      clientPhone: null,
      clientEmail: null,
      clientAddress: null,
      insuranceCompany: null,
      policyInceptionDate: null,
      policyExpiryDate: null,
      policeCaseNumber: null,
      // Motor fields
      vehicleRegistration: null,
      vehicleMake: null,
      vehicleModel: null,
      vehicleYear: null,
      vehicleColor: null,
      vehicleVinNumber: null,
      driverName: null,
      driverIdNumber: null,
      thirdPartyName: null,
      thirdPartyVehicleReg: null,
      excessAmount: null,
      estimatedDamage: null,
      sumInsured: null,
      premium: null,
      benefits: [],
      extensions: [],
      specifiedItems: [],
      // Property fields
      propertyAddress: null,
      propertyType: null,
      damageDescription: null,
      estimatedValue: null,
      // Theft fields
      stolenItems: [],
      dateOfDiscovery: null,
      securityMeasures: null,
      // Liability fields
      witnessNames: [],
      injuriesReported: null,
      // Fire fields
      fireReportNumber: null,
      causeOfFire: null,
      extentOfDamage: null,
      // GAP fields
      originalVehicleValue: null,
      settlementAmount: null,
      financeOutstanding: null,
      dateOfTotalLoss: null
    },
    dataSources: {},
    keyIndicators: [],
    missingInformation: ["Analysis failed"],
    documentsAnalyzed: {
      emailBody: !!(emailData.bodyText),
      attachments: attachmentResults.map(r => ({
        fileName: r.fileName,
        documentType: r.classification.documentType,
        isClaimRelated: r.classification.isClaimRelated,
        keyFindings: []
      }))
    },
    overallClaimLikelihood: 0,
    isReadyForProcessing: false,
    recommendedAction: "MANUAL_REVIEW"
  };
}

/**
 * Store predictions for later learning comparison
 */
async function storePredictionsForLearning(
  emailId: string,
  result: UnifiedAnalysisResult,
  fromEmail?: string | null
): Promise<void> {
  try {
    // Build predictions array from extracted data
    const predictions: Array<{
      field: string;
      predicted: string | number | null;
      confidence: number;
      source: string;
    }> = [];
    
    for (const [field, value] of Object.entries(result.extractedData)) {
      if (value !== null && value !== undefined && value !== "") {
        predictions.push({
          field,
          predicted: typeof value === "object" ? JSON.stringify(value) : String(value),
          confidence: result.confidence,
          source: result.dataSources[field] || "attachment"
        });
      }
    }
    
    // Store prediction record
    await db.prediction.create({
      data: {
        emailQueueId: emailId,
        predictedClass: result.classification,
        confidence: result.confidence,
        extractedFields: JSON.stringify(predictions),
        reasoning: result.reasoning,
        decision: result.recommendedAction
      }
    });
    
    console.log(`[prediction-learning] Stored ${predictions.length} predictions for email ${emailId}`);
  } catch (error) {
    console.error("[prediction-learning] Failed to store predictions:", error);
  }
}
