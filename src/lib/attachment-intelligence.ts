/**
 * Attachment Intelligence Layer
 * 
 * PURPOSE: Extract data from attachments - where most systems fail
 * 
 * STEP-BY-STEP PROCESS:
 * 1. Classify attachments (PDF → parse text, Image → OCR, Other → store only)
 * 2. Extract raw text from each attachment
 * 3. Identify candidate data from EACH attachment
 * 4. Return structured output with confidence
 * 
 * OUTPUT:
 * {
 *   attachment_data: [
 *     {
 *       claim_numbers: [],
 *       client_names: [],
 *       vehicle_regs: [],
 *       addresses: [],
 *       confidence: 0
 *     }
 *   ]
 * }
 */

import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

// Cache ZAI instance
let zaiInstance: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export interface AttachmentCandidate {
  value: string;
  confidence: number;
  context: string;
}

export interface AttachmentExtractionResult {
  attachmentId: string;
  fileName: string;
  fileType: "PDF" | "IMAGE" | "DOC" | "OTHER";
  rawText: string;
  claimNumbers: AttachmentCandidate[];
  clientNames: AttachmentCandidate[];
  policyNumbers: AttachmentCandidate[];
  vehicleRegs: AttachmentCandidate[];
  vinNumbers: AttachmentCandidate[]; // VIN/Chassis numbers
  vehicleDetails: {
    make: string | null;
    model: string | null;
    year: string | null;
    color: string | null;
    engineNumber: string | null;
  };
  addresses: AttachmentCandidate[];
  phoneNumbers: AttachmentCandidate[];
  emailAddresses: AttachmentCandidate[];
  monetaryAmounts: AttachmentCandidate[];
  dates: AttachmentCandidate[];
  extractionConfidence: number;
  processingTimeMs: number;
  processingError?: string;
}

export interface ProcessedAttachmentsResult {
  attachments: AttachmentExtractionResult[];
  combinedText: string;
  overallConfidence: number;
  hasAttachments: boolean;
  attachmentsWithData: number;
}

/**
 * Process all attachments for an email
 */
export async function processAttachments(
  emailId: string,
  attachments: Array<{
    filename: string;
    content?: string; // base64 or extracted text
    mimeType?: string;
    size?: number;
  }>,
  companyContext?: string
): Promise<ProcessedAttachmentsResult> {
  const startTime = Date.now();
  const results: AttachmentExtractionResult[] = [];
  let combinedText = "";
  
  if (!attachments || attachments.length === 0) {
    return {
      attachments: [],
      combinedText: "",
      overallConfidence: 0,
      hasAttachments: false,
      attachmentsWithData: 0,
    };
  }
  
  for (const attachment of attachments) {
    const result = await processSingleAttachment(
      emailId,
      attachment.filename,
      attachment.content,
      attachment.mimeType,
      companyContext
    );
    
    results.push(result);
    
    if (result.rawText) {
      combinedText += `\n--- Attachment: ${attachment.filename} ---\n${result.rawText}\n`;
    }
  }
  
  // Calculate overall confidence
  const confidences = results.map(r => r.extractionConfidence).filter(c => c > 0);
  const overallConfidence = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  
  const attachmentsWithData = results.filter(r => 
    r.claimNumbers.length > 0 || 
    r.clientNames.length > 0 ||
    r.vehicleRegs.length > 0
  ).length;
  
  return {
    attachments: results,
    combinedText,
    overallConfidence,
    hasAttachments: true,
    attachmentsWithData,
  };
}

/**
 * Process a single attachment
 */
async function processSingleAttachment(
  emailId: string,
  fileName: string,
  content: string | undefined,
  mimeType: string | undefined,
  companyContext?: string
): Promise<AttachmentExtractionResult> {
  const startTime = Date.now();
  
  // Determine file type
  const fileType = determineFileType(fileName, mimeType);
  
  let rawText = "";
  let processingError: string | undefined;
  
  try {
    switch (fileType) {
      case "PDF":
        rawText = await extractFromPDF(content, fileName);
        break;
      case "IMAGE":
        rawText = await extractFromImage(content, fileName, companyContext);
        break;
      case "DOC":
        rawText = await extractFromDocument(content, fileName);
        break;
      default:
        rawText = content || "";
    }
  } catch (error) {
    processingError = String(error);
  }
  
  // Extract candidates from the text
  const candidates = rawText ? extractCandidates(rawText, fileName) : {
    claimNumbers: [],
    clientNames: [],
    policyNumbers: [],
    vehicleRegs: [],
    vinNumbers: [],
    vehicleDetails: { make: null, model: null, year: null, color: null, engineNumber: null },
    addresses: [],
    phoneNumbers: [],
    emailAddresses: [],
    monetaryAmounts: [],
    dates: [],
  };
  
  const processingTimeMs = Date.now() - startTime;
  
  // Calculate extraction confidence
  const extractionConfidence = calculateExtractionConfidence(candidates, rawText);
  
  // Store in database
  const stored = await db.attachmentData.create({
    data: {
      emailQueueId: emailId,
      fileName,
      fileType,
      fileSize: content?.length,
      rawText: rawText, // Full text - no truncation needed (SQLite can handle large strings)
      claimNumbers: JSON.stringify(candidates.claimNumbers),
      clientNames: JSON.stringify(candidates.clientNames),
      policyNumbers: JSON.stringify(candidates.policyNumbers),
      vehicleRegs: JSON.stringify(candidates.vehicleRegs),
      vinNumbers: JSON.stringify(candidates.vinNumbers),
      vehicleDetails: JSON.stringify(candidates.vehicleDetails),
      addresses: JSON.stringify(candidates.addresses),
      phoneNumbers: JSON.stringify(candidates.phoneNumbers),
      emailAddresses: JSON.stringify(candidates.emailAddresses),
      monetaryAmounts: JSON.stringify(candidates.monetaryAmounts),
      dates: JSON.stringify(candidates.dates),
      extractionConfidence,
      processingTimeMs,
      processingError,
    },
  });
  
  return {
    attachmentId: stored.id,
    fileName,
    fileType,
    rawText,
    ...candidates,
    extractionConfidence,
    processingTimeMs,
    processingError,
  };
}

/**
 * Determine file type from filename and mime type
 */
function determineFileType(fileName: string, mimeType?: string): "PDF" | "IMAGE" | "DOC" | "OTHER" {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  if (mimeType?.includes("pdf") || ext === "pdf") return "PDF";
  if (mimeType?.includes("image") || ["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "IMAGE";
  if (mimeType?.includes("document") || mimeType?.includes("word") || ["doc", "docx", "rtf"].includes(ext)) return "DOC";
  
  return "OTHER";
}

/**
 * Extract text from PDF
 */
async function extractFromPDF(content: string | undefined, fileName: string): Promise<string> {
  // If content is already extracted text, return it
  if (content && !content.startsWith("data:") && content.length > 50) {
    return content;
  }
  
  // For PDFs, we need to use AI to extract text from images
  // This is a simplified version - in production, use pdf-parse or similar
  const zai = await getZAI();
  
  const prompt = `Extract all text from this PDF document. Focus on:
- Claim numbers
- Client names
- Vehicle registrations
- Addresses
- Phone numbers
- Policy numbers
- Monetary amounts
- Dates

Return the extracted text in a clean format.`;

  try {
    const response = await zai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });
    
    return response.choices?.[0]?.message?.content || "";
  } catch {
    return content || "";
  }
}

/**
 * Extract text from image using VLM
 */
async function extractFromImage(
  content: string | undefined,
  fileName: string,
  companyContext?: string
): Promise<string> {
  const zai = await getZAI();
  
  const contextHint = companyContext 
    ? `This document is from ${companyContext}. ` 
    : "";
  
  const prompt = `${contextHint}Extract all visible text from this image. This is an insurance claim document.

Focus on extracting:
1. Claim numbers (look for patterns like STM-XXXX-XXXXX, numbers with prefixes)
2. Client/policyholder names
3. Vehicle registration numbers (South African format: XX XX GP or similar)
4. Addresses
5. Phone numbers
6. Email addresses
7. Policy numbers
8. Monetary amounts (excess, premiums, claim amounts)
9. Dates (incident dates, report dates)

Return the extracted information in a structured format. If you find a claim number, make sure to highlight it clearly.`;

  try {
    // Use vision API for image extraction
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: content || "" } },
          ],
        },
      ],
    });
    
    return response.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("Image extraction error:", error);
    return "";
  }
}

/**
 * Extract text from document (DOC, DOCX)
 */
async function extractFromDocument(content: string | undefined, fileName: string): Promise<string> {
  // For documents, if content is already text, return it
  if (content && !content.startsWith("data:")) {
    return content;
  }
  
  // Otherwise, use AI to extract
  return extractFromPDF(content, fileName);
}

/**
 * Extract candidates from text
 */
function extractCandidates(
  text: string,
  source: string
): {
  claimNumbers: AttachmentCandidate[];
  clientNames: AttachmentCandidate[];
  policyNumbers: AttachmentCandidate[];
  vehicleRegs: AttachmentCandidate[];
  vinNumbers: AttachmentCandidate[];
  vehicleDetails: {
    make: string | null;
    model: string | null;
    year: string | null;
    color: string | null;
    engineNumber: string | null;
  };
  addresses: AttachmentCandidate[];
  phoneNumbers: AttachmentCandidate[];
  emailAddresses: AttachmentCandidate[];
  monetaryAmounts: AttachmentCandidate[];
  dates: AttachmentCandidate[];
} {
  return {
    claimNumbers: extractClaimNumbers(text),
    clientNames: extractNames(text),
    policyNumbers: extractPolicyNumbers(text),
    vehicleRegs: extractVehicleRegs(text),
    vinNumbers: extractVinNumbers(text),
    vehicleDetails: extractVehicleDetailsFromText(text),
    addresses: extractAddresses(text),
    phoneNumbers: extractPhoneNumbers(text),
    emailAddresses: extractEmails(text),
    monetaryAmounts: extractMonetary(text),
    dates: extractDates(text),
  };
}

/**
 * Extract claim numbers with confidence
 */
function extractClaimNumbers(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  // South African patterns
  const patterns = [
    { regex: /\b(STM[-/]?\d{4}[-/]?\d{5})\b/gi, confidence: 95 },
    { regex: /\b(OUT[/]?\d{6,8}[/]?\d{0,2})\b/gi, confidence: 95 },
    { regex: /\b(HOL[-]?\d{8,10})\b/gi, confidence: 95 },
    { regex: /\b(CLM[-]?\d{6,10})\b/gi, confidence: 90 },
    { regex: /\b([A-Z]{2,4}[-/]?\d{6,10})\b/g, confidence: 80 },
    { regex: /\b(\d{10,12})\b/g, confidence: 70 },
  ];
  
  for (const { regex, confidence } of patterns) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      const start = Math.max(0, match.index! - 30);
      const end = Math.min(text.length, match.index! + match[0].length + 30);
      
      candidates.push({
        value: match[1].toUpperCase(),
        confidence,
        context: text.slice(start, end),
      });
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract names with confidence
 */
function extractNames(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  // Pattern for names (Title + First Last)
  const namePattern = /\b(Mr|Mrs|Ms|Dr|Prof)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g;
  const matches = text.matchAll(namePattern);
  
  for (const match of matches) {
    candidates.push({
      value: match[2],
      confidence: 85,
      context: match[0],
    });
  }
  
  // Pattern for "Client: Name" or "Insured: Name"
  const labelPattern = /\b(Client|Insured|Policy\s*Holder|Claimant|Name)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/gi;
  const labelMatches = text.matchAll(labelPattern);
  
  for (const match of labelMatches) {
    candidates.push({
      value: match[2],
      confidence: 90,
      context: match[0],
    });
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract policy numbers
 */
function extractPolicyNumbers(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  const patterns = [
    { regex: /\bPolicy\s*(?:Number|No|#)?\s*:?\s*([A-Z0-9][-/A-Z0-9]{5,15})\b/gi, confidence: 90 },
    { regex: /\bPOL[-/]?\d{6,10}\b/gi, confidence: 85 },
  ];
  
  for (const { regex, confidence } of patterns) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      candidates.push({
        value: match[1] || match[0],
        confidence,
        context: match[0],
      });
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract South African vehicle registrations
 */
function extractVehicleRegs(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  // SA format: XX XX GP or XX-XX-GP or XXXXXX GP
  const saPattern = /\b([A-Z]{2,3}[-\s]?[A-Z0-9]{2,3}[-\s]?(GP|EC|WC|KZN|NC|NW|FS|L|MP))\b/gi;
  const matches = text.matchAll(saPattern);
  
  for (const match of matches) {
    candidates.push({
      value: match[1].toUpperCase(),
      confidence: 90,
      context: match[0],
    });
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract VIN/Chassis numbers
 * VIN is 17 alphanumeric characters (no I, O, Q)
 * Multiple patterns to catch various formats
 */
function extractVinNumbers(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  const seen = new Set<string>();
  
  // Pattern 1: With labels (higher confidence)
  const labeledPatterns = [
    // Standard VIN labels
    { regex: /(?:VIN|Vin|vin)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 95 },
    // Chassis labels (commonly used in South Africa)
    { regex: /(?:CHASSIS|Chassis|chassis)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 95 },
    // Vehicle ID labels
    { regex: /(?:Vehicle\s*ID|VehicleID|V\.?I\.?N\.?)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 90 },
    // Afrikaans labels
    { regex: /(?:Kasnommer|Onderstel)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 90 },
    // Short labels with colon
    { regex: /(?:VIN:|Chassis:|Chassis\s*No:)\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 95 },
    // In tables with various formats
    { regex: /(?:VIN|Chassis)\s*[:\s]+\s*([A-HJ-NPR-Z0-9]{17})/gi, confidence: 90 },
  ];
  
  for (const { regex, confidence } of labeledPatterns) {
    const matches = text.matchAll(regex);
    for (const match of matches) {
      const vin = match[1].toUpperCase();
      if (!seen.has(vin)) {
        seen.add(vin);
        candidates.push({
          value: vin,
          confidence,
          context: match[0],
        });
      }
    }
  }
  
  // Pattern 2: Standalone 17-char alphanumeric sequences (lower confidence)
  const standalonePattern = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
  const standaloneMatches = text.matchAll(standalonePattern);
  for (const match of standaloneMatches) {
    const vin = match[1].toUpperCase();
    if (!seen.has(vin)) {
      // Validate it looks like a real VIN (must have both letters and numbers)
      const hasLetters = /[A-HJ-NPR-Z]/.test(vin);
      const hasNumbers = /[0-9]/.test(vin);
      if (hasLetters && hasNumbers) {
        seen.add(vin);
        candidates.push({
          value: vin,
          confidence: 70, // Lower confidence for unlabeled VINs
          context: match[0],
        });
      }
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract vehicle details (make, model, year, color, engine number)
 * Searches the entire text for vehicle-related information
 */
function extractVehicleDetailsFromText(text: string): {
  make: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  engineNumber: string | null;
} {
  const result = {
    make: null as string | null,
    model: null as string | null,
    year: null as string | null,
    color: null as string | null,
    engineNumber: null as string | null,
  };
  
  // Common vehicle makes (expanded list)
  const makes = [
    "Toyota", "Volkswagen", "VW", "BMW", "Mercedes", "Mercedes-Benz", "Ford",
    "Honda", "Nissan", "Mazda", "Hyundai", "Kia", "Audi", "Volvo", "Lexus",
    "Isuzu", "Mitsubishi", "Subaru", "Suzuki", "Renault", "Peugeot", "Jeep",
    "Land Rover", "Jaguar", "Porsche", "Mini", "Fiat", "Chevrolet", "Opel",
    "Chery", "Haval", "GWM", "Mahindra", "Datsun", "Daihatsu", "BYD"
  ];
  
  // Try to find make - look for labels first
  const makeLabelPattern = /(?:Make|Vehicle\s*Make|Manufacturer)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-Za-z]+)/i;
  const makeLabelMatch = text.match(makeLabelPattern);
  if (makeLabelMatch) {
    const foundMake = makes.find(m => m.toLowerCase() === makeLabelMatch[1].toLowerCase());
    if (foundMake) {
      result.make = foundMake;
    }
  }
  
  // If not found with label, search for makes in text
  if (!result.make) {
    for (const make of makes) {
      const makePattern = new RegExp(`\\b(${make})\\b`, "i");
      if (makePattern.test(text)) {
        result.make = make;
        break;
      }
    }
  }
  
  // Try to find year (4 digits between 1990 and current year + 1)
  const currentYear = new Date().getFullYear();
  
  // Look for labeled year first
  const yearLabelPattern = /(?:Year|Vehicle\s*Year|Year\s*of\s*Manufacture|Mfg\s*Year)\s*(?:No|Number|#|Nr\.?|:)?\s*(\d{4})/i;
  const yearLabelMatch = text.match(yearLabelPattern);
  if (yearLabelMatch) {
    const yearNum = parseInt(yearLabelMatch[1]);
    if (yearNum >= 1990 && yearNum <= currentYear + 1) {
      result.year = yearLabelMatch[1];
    }
  }
  
  // If not found with label, search for year patterns
  if (!result.year) {
    const yearPattern = /\b((?:19[89]\d|20[0-2]\d))\b/g;
    const yearMatches = text.match(yearPattern);
    if (yearMatches) {
      for (const y of yearMatches) {
        const yearNum = parseInt(y);
        if (yearNum >= 1990 && yearNum <= currentYear + 1) {
          result.year = y;
          break;
        }
      }
    }
  }
  
  // Try to find engine number with various patterns
  const enginePatterns = [
    /(?:Engine|Eng)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-Z0-9]{6,12})/gi,
    /(?:Motor\s*No|Motor\s*Number)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-Z0-9]{6,12})/gi,
  ];
  
  for (const enginePattern of enginePatterns) {
    const engineMatch = text.match(enginePattern);
    if (engineMatch && engineMatch[1]) {
      result.engineNumber = engineMatch[1].toUpperCase();
      break;
    }
  }
  
  // Try to find color with various patterns
  const colors = [
    "White", "Black", "Silver", "Grey", "Gray", "Blue", "Red", "Green",
    "Yellow", "Gold", "Bronze", "Brown", "Beige", "Orange", "Purple", "Maroon",
    "Navy", "Teal", "Cyan", "Magenta", "Pink", "Cream", "Charcoal"
  ];
  
  // Look for labeled color first
  const colorLabelPattern = /(?:Color|Colour|Vehicle\s*Color)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-Za-z]+)/i;
  const colorLabelMatch = text.match(colorLabelPattern);
  if (colorLabelMatch) {
    const foundColor = colors.find(c => c.toLowerCase() === colorLabelMatch[1].toLowerCase());
    if (foundColor) {
      result.color = foundColor;
    }
  }
  
  // If not found with label, search for colors in text
  if (!result.color) {
    for (const color of colors) {
      const colorPattern = new RegExp(`\\b${color}\\b`, "i");
      if (colorPattern.test(text)) {
        result.color = color;
        break;
      }
    }
  }
  
  return result;
}

/**
 * Extract addresses
 */
function extractAddresses(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  // Look for SA address patterns
  const patterns = [
    /\b(\d+[^,]+,\s*[^,]+,\s*\d{4})\b/g,  // Street, Suburb, Code
    /\b(P\.?O\.?\s*Box\s*\d+)/gi,  // PO Box
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      candidates.push({
        value: match[1] || match[0],
        confidence: 75,
        context: match[0],
      });
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract phone numbers
 */
function extractPhoneNumbers(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  const patterns = [
    /\b((?:\+27|0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/g,  // SA mobile/landline
    /\b((?:\+27|0)[\s-]?\d{2}[\s-]?\d{4}[\s-]?\d{4})\b/g,  // Alternative format
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      candidates.push({
        value: match[1].replace(/[\s-]/g, ""),
        confidence: 85,
        context: match[0],
      });
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract email addresses
 */
function extractEmails(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  const pattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const matches = text.matchAll(pattern);
  
  for (const match of matches) {
    candidates.push({
      value: match[1].toLowerCase(),
      confidence: 95,
      context: match[0],
    });
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract monetary amounts
 */
function extractMonetary(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  const patterns = [
    /\bR\s*([\d,]+\.?\d*)\b/g,  // R format
    /\b([\d,]+\.?\d*)\s*(?:Rand|ZAR)\b/gi,  // Rand/ZAR format
    /\bExcess\s*:?\s*R?\s*([\d,]+\.?\d*)\b/gi,  // Excess amount
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const amount = match[1].replace(/,/g, "");
      const numAmount = parseFloat(amount);
      
      if (numAmount > 0 && numAmount < 10000000) {  // Reasonable range
        candidates.push({
          value: amount,
          confidence: 80,
          context: match[0],
        });
      }
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Extract dates
 */
function extractDates(text: string): AttachmentCandidate[] {
  const candidates: AttachmentCandidate[] = [];
  
  const patterns = [
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g,  // DD/MM/YYYY
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,  // YYYY/MM/DD
    /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\b/gi,  // DD Mon YYYY
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      candidates.push({
        value: match[1],
        confidence: 75,
        context: match[0],
      });
    }
  }
  
  return deduplicateCandidates(candidates);
}

/**
 * Deduplicate candidates keeping highest confidence
 */
function deduplicateCandidates(candidates: AttachmentCandidate[]): AttachmentCandidate[] {
  const seen = new Map<string, AttachmentCandidate>();
  
  for (const c of candidates) {
    const key = c.value.toLowerCase();
    if (!seen.has(key) || seen.get(key)!.confidence < c.confidence) {
      seen.set(key, c);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Calculate extraction confidence for an attachment
 */
function calculateExtractionConfidence(
  candidates: ReturnType<typeof extractCandidates>,
  text: string
): number {
  let score = 0;
  
  // Has claim number (most important)
  if (candidates.claimNumbers.length > 0) score += 40;
  
  // Has client name
  if (candidates.clientNames.length > 0) score += 20;
  
  // Has vehicle reg (for motor claims)
  if (candidates.vehicleRegs.length > 0) score += 15;
  
  // Has contact info
  if (candidates.phoneNumbers.length > 0) score += 10;
  if (candidates.emailAddresses.length > 0) score += 5;
  
  // Has amounts or dates
  if (candidates.monetaryAmounts.length > 0) score += 5;
  if (candidates.dates.length > 0) score += 5;
  
  return Math.min(100, score);
}

/**
 * Get attachment data for an email
 */
export async function getEmailAttachmentData(emailId: string): Promise<AttachmentExtractionResult[]> {
  const data = await db.attachmentData.findMany({
    where: { emailQueueId: emailId },
  });
  
  return data.map(d => ({
    attachmentId: d.id,
    fileName: d.fileName,
    fileType: d.fileType as "PDF" | "IMAGE" | "DOC" | "OTHER",
    rawText: d.rawText || "",
    claimNumbers: safeJsonParse(d.claimNumbers, []),
    clientNames: safeJsonParse(d.clientNames, []),
    policyNumbers: safeJsonParse(d.policyNumbers, []),
    vehicleRegs: safeJsonParse(d.vehicleRegs, []),
    vinNumbers: safeJsonParse(d.vinNumbers, []),
    vehicleDetails: safeJsonParse(d.vehicleDetails, { make: null, model: null, year: null, color: null, engineNumber: null }),
    addresses: safeJsonParse(d.addresses, []),
    phoneNumbers: safeJsonParse(d.phoneNumbers, []),
    emailAddresses: safeJsonParse(d.emailAddresses, []),
    monetaryAmounts: safeJsonParse(d.monetaryAmounts, []),
    dates: safeJsonParse(d.dates, []),
    extractionConfidence: d.extractionConfidence,
    processingTimeMs: d.processingTimeMs || 0,
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
