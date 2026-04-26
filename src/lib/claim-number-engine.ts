/**
 * Claim Number Pattern Engine
 * 
 * PURPOSE: Different companies → different formats
 * 
 * SOURCES FOR CLAIM NUMBER:
 * 1. email subject
 * 2. email body
 * 3. attachment filenames
 * 4. attachment content
 * 
 * SCORING SYSTEM:
 * Each candidate gets:
 * - pattern match score (0-100)
 * - position score (subject > body > attachment)
 * - repetition score (how many times appeared)
 * - format match score (known company format?)
 */

import { db } from "@/lib/db";

// Source position scoring
const SOURCE_SCORES = {
  email_subject: 100,
  email_body: 70,
  attachment_filename: 60,
  attachment_content: 50,
};

// Common claim number patterns (global)
const GLOBAL_CLAIM_PATTERNS = [
  // South African patterns
  { pattern: /\b\d{10,12}\b/, description: "10-12 digit number", confidence: 70 },
  { pattern: /\b[A-Z]{2,4}[-/]?\d{6,10}\b/, description: "Letters + numbers", confidence: 75 },
  { pattern: /\b[A-Z]{2,4}[-/]\d{4}[-/]\d{4,6}\b/, description: "Prefix-year-number format", confidence: 80 },
  { pattern: /\bCLM[-]?\d{6,10}\b/i, description: "CLM prefix", confidence: 85 },
  { pattern: /\bOUT[/]?\d{6,8}[/]?\d{0,2}\b/i, description: "OUTsurance format", confidence: 90 },
  { pattern: /\bSTM[-]?\d{4}[-]?\d{5}\b/i, description: "Santam format", confidence: 90 },
  { pattern: /\bHOL[-]?\d{8,10}\b/i, description: "Hollard format", confidence: 90 },
  { pattern: /\bM\d{9,11}\b/, description: "Mutual format", confidence: 85 },
  
  // Generic patterns
  { pattern: /\b\d{2,4}[-/]\d{2,4}[-/]\d{4,8}\b/, description: "Date-like format", confidence: 60 },
  { pattern: /\b[A-Z]\d{8,12}\b/, description: "Single letter + digits", confidence: 65 },
];

// Words to exclude (not claim numbers)
const EXCLUSION_PATTERNS = [
  /\b\d{4}\b/,  // 4 digit years
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,  // Dates
  /\b\d{6}\b/,  // 6 digit numbers (often phone parts)
  /\bR\s*\d+/,  // Currency
  /\b\d{3}\s*\d{4}\b/,  // Phone format
  /\b0\d{9}\b/,  // Phone numbers starting with 0
  /\b27\d{9}\b/,  // SA phone with country code
];

export interface ClaimNumberCandidate {
  value: string;
  source: "email_subject" | "email_body" | "attachment_filename" | "attachment_content";
  sourceDetail?: string;
  patternMatchScore: number;
  positionScore: number;
  repetitionScore: number;
  formatMatchScore: number;
  totalConfidence: number;
  matchedPattern?: string;
  evidence: string;
}

/**
 * Extract all claim number candidates from multiple sources
 */
export async function extractClaimNumberCandidates(
  emailId: string,
  subject: string | null,
  body: string | null,
  attachmentData: Array<{ filename: string; content: string }> = [],
  insuranceCompanyId?: string
): Promise<ClaimNumberCandidate[]> {
  const candidates: ClaimNumberCandidate[] = [];
  
  // 1. Extract from subject
  if (subject) {
    const subjectCandidates = extractFromString(subject, "email_subject", "subject");
    candidates.push(...subjectCandidates);
  }
  
  // 2. Extract from body
  if (body) {
    const bodyCandidates = extractFromString(body, "email_body", "body");
    candidates.push(...bodyCandidates);
  }
  
  // 3. Extract from attachment filenames
  for (const attachment of attachmentData) {
    const filenameCandidates = extractFromString(
      attachment.filename,
      "attachment_filename",
      `filename: ${attachment.filename}`
    );
    candidates.push(...filenameCandidates);
    
    // 4. Extract from attachment content
    if (attachment.content) {
      const contentCandidates = extractFromString(
        attachment.content,
        "attachment_content",
        `attachment: ${attachment.filename}`
      );
      candidates.push(...contentCandidates);
    }
  }
  
  // 5. Calculate repetition scores
  const valueCounts = new Map<string, number>();
  for (const c of candidates) {
    valueCounts.set(c.value, (valueCounts.get(c.value) || 0) + 1);
  }
  
  for (const c of candidates) {
    c.repetitionScore = Math.min(100, (valueCounts.get(c.value) || 1) * 20);
  }
  
  // 6. Calculate format match scores (if we know the company)
  if (insuranceCompanyId) {
    await addFormatMatchScores(candidates, insuranceCompanyId);
  }
  
  // 7. Calculate total confidence
  for (const c of candidates) {
    c.totalConfidence = calculateTotalConfidence(c);
  }
  
  // 8. Store candidates in database
  await storeCandidates(emailId, candidates);
  
  // 9. Return sorted by confidence
  return candidates.sort((a, b) => b.totalConfidence - a.totalConfidence);
}

/**
 * Extract claim numbers from a string
 */
function extractFromString(
  text: string,
  source: ClaimNumberCandidate["source"],
  sourceDetail: string
): ClaimNumberCandidate[] {
  const candidates: ClaimNumberCandidate[] = [];
  
  for (const { pattern, description, confidence } of GLOBAL_CLAIM_PATTERNS) {
    const matches = text.matchAll(pattern);
    
    for (const match of matches) {
      const value = match[0].toUpperCase().trim();
      
      // Skip if matches exclusion pattern
      if (EXCLUSION_PATTERNS.some(ex => ex.test(value))) {
        continue;
      }
      
      // Skip duplicates
      if (candidates.some(c => c.value === value && c.source === source)) {
        continue;
      }
      
      // Get context (surrounding text)
      const start = Math.max(0, match.index! - 30);
      const end = Math.min(text.length, match.index! + match[0].length + 30);
      const evidence = text.slice(start, end);
      
      candidates.push({
        value,
        source,
        sourceDetail,
        patternMatchScore: confidence,
        positionScore: SOURCE_SCORES[source],
        repetitionScore: 0, // Calculated later
        formatMatchScore: 0, // Calculated later
        totalConfidence: 0, // Calculated later
        matchedPattern: description,
        evidence: evidence.trim(),
      });
    }
  }
  
  return candidates;
}

/**
 * Add format match scores based on known company formats
 */
async function addFormatMatchScores(
  candidates: ClaimNumberCandidate[],
  insuranceCompanyId: string
): Promise<void> {
  const formats = await db.claimNumberFormat.findMany({
    where: {
      insuranceCompanyId,
      isActive: true,
    },
  });
  
  for (const c of candidates) {
    for (const format of formats) {
      try {
        const regex = new RegExp(format.regexPattern, "i");
        if (regex.test(c.value)) {
          c.formatMatchScore = format.confidence;
          c.matchedPattern = format.formatPattern;
          break;
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }
}

/**
 * Calculate total confidence score
 */
function calculateTotalConfidence(candidate: ClaimNumberCandidate): number {
  // Weighted scoring
  const weights = {
    patternMatch: 0.25,
    position: 0.35,
    repetition: 0.15,
    formatMatch: 0.25,
  };
  
  return (
    candidate.patternMatchScore * weights.patternMatch +
    candidate.positionScore * weights.position +
    candidate.repetitionScore * weights.repetition +
    candidate.formatMatchScore * weights.formatMatch
  );
}

/**
 * Store candidates in database
 */
async function storeCandidates(
  emailId: string,
  candidates: ClaimNumberCandidate[]
): Promise<void> {
  // Clear existing candidates
  await db.claimNumberCandidate.deleteMany({
    where: { emailQueueId: emailId },
  });
  
  // Store new candidates
  for (const c of candidates) {
    await db.claimNumberCandidate.create({
      data: {
        emailQueueId: emailId,
        value: c.value,
        source: c.source,
        sourceDetail: c.sourceDetail,
        patternMatchScore: c.patternMatchScore,
        positionScore: c.positionScore,
        repetitionScore: c.repetitionScore,
        formatMatchScore: c.formatMatchScore,
        totalConfidence: c.totalConfidence,
      },
    });
  }
}

/**
 * Select best claim number from candidates
 */
export async function selectBestClaimNumber(emailId: string): Promise<{
  value: string;
  confidence: number;
  source: string;
  alternatives: ClaimNumberCandidate[];
} | null> {
  const candidates = await db.claimNumberCandidate.findMany({
    where: { emailQueueId: emailId },
    orderBy: { totalConfidence: "desc" },
  });
  
  if (candidates.length === 0) return null;
  
  const best = candidates[0];
  
  // Mark as selected
  await db.claimNumberCandidate.update({
    where: { id: best.id },
    data: { isSelected: true },
  });
  
  return {
    value: best.value,
    confidence: best.totalConfidence,
    source: best.source,
    alternatives: candidates.slice(1).map(c => ({
      value: c.value,
      source: c.source as ClaimNumberCandidate["source"],
      sourceDetail: c.sourceDetail || undefined,
      patternMatchScore: c.patternMatchScore,
      positionScore: c.positionScore,
      repetitionScore: c.repetitionScore,
      formatMatchScore: c.formatMatchScore,
      totalConfidence: c.totalConfidence,
      evidence: "",
    })),
  };
}

/**
 * Learn a new claim number format
 */
export async function learnClaimNumberFormat(
  claimNumber: string,
  insuranceCompanyId: string
): Promise<void> {
  // Parse the claim number to derive format
  const format = deriveFormat(claimNumber);
  
  // Check if format already exists
  const existing = await db.claimNumberFormat.findFirst({
    where: {
      insuranceCompanyId,
      formatPattern: format.pattern,
    },
  });
  
  if (existing) {
    // Increment match count
    await db.claimNumberFormat.update({
      where: { id: existing.id },
      data: {
        matchCount: existing.matchCount + 1,
        confidence: Math.min(100, existing.confidence + 2),
      },
    });
  } else {
    // Create new format
    await db.claimNumberFormat.create({
      data: {
        insuranceCompanyId,
        formatPattern: format.pattern,
        prefix: format.prefix,
        separator: format.separator,
        hasYear: format.hasYear,
        regexPattern: format.regex,
        example: claimNumber,
        confidence: 70,
        isActive: true,
      },
    });
  }
}

/**
 * Derive format from a claim number
 */
function deriveFormat(claimNumber: string): {
  pattern: string;
  prefix: string | null;
  separator: string | null;
  hasYear: boolean;
  regex: string;
} {
  const upper = claimNumber.toUpperCase();
  
  // Extract prefix (letters at start)
  const prefixMatch = upper.match(/^([A-Z]+)/);
  const prefix = prefixMatch ? prefixMatch[1] : null;
  
  // Find separator
  const separatorMatch = upper.match(/[-/]/);
  const separator = separatorMatch ? separatorMatch[0] : null;
  
  // Check for year pattern
  const hasYear = /\b(20\d{2}|19\d{2})\b/.test(upper);
  
  // Generate format pattern
  let pattern = "";
  if (prefix) {
    pattern += prefix;
  }
  if (separator) {
    pattern += separator;
  }
  if (hasYear) {
    pattern += "YYYY";
    if (separator) pattern += separator;
  }
  pattern += "N".repeat(upper.replace(/[^0-9]/g, "").length);
  
  // Generate regex
  let regex = "";
  if (prefix) {
    regex += prefix;
  }
  if (separator) {
    regex += `\\${separator}`;
  }
  if (hasYear) {
    regex += "(20\\d{2}|19\\d{2})";
    if (separator) regex += `\\${separator}`;
  }
  regex += "\\d{" + (upper.replace(/[^0-9]/g, "").length - (hasYear ? 4 : 0)) + ",}";
  
  return {
    pattern,
    prefix,
    separator,
    hasYear,
    regex,
  };
}

/**
 * Test if a value matches known company formats
 */
export async function testClaimNumberFormat(
  value: string,
  insuranceCompanyId?: string
): Promise<{ matches: boolean; format?: string; confidence: number }> {
  // Test against company-specific formats
  if (insuranceCompanyId) {
    const formats = await db.claimNumberFormat.findMany({
      where: { insuranceCompanyId, isActive: true },
    });
    
    for (const format of formats) {
      try {
        const regex = new RegExp(format.regexPattern, "i");
        if (regex.test(value)) {
          return {
            matches: true,
            format: format.formatPattern,
            confidence: format.confidence,
          };
        }
      } catch {
        // Invalid regex
      }
    }
  }
  
  // Test against global patterns
  for (const { pattern, description, confidence } of GLOBAL_CLAIM_PATTERNS) {
    if (pattern.test(value)) {
      return {
        matches: true,
        format: description,
        confidence,
      };
    }
  }
  
  return { matches: false, confidence: 0 };
}
