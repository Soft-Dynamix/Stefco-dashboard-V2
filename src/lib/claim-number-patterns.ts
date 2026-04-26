/**
 * Claim Number Pattern Learning & Matching
 * 
 * This module handles:
 * 1. Detecting patterns from claim numbers (prefix, separators, year, length)
 * 2. Storing patterns per insurance company
 * 3. Applying patterns when extracting claim numbers
 * 4. Learning from user corrections
 * 5. Validating and auto-correcting extracted claim numbers
 */

import { db } from "./db";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface ClaimNumberPattern {
  prefix: string;           // e.g., "STM", "OUT", "HOL"
  separator: string;        // e.g., "-", "/", ""
  format: string;           // e.g., "PREFIX-YYYY-NNNNN"
  hasYear: boolean;
  yearPosition: number;     // 1, 2, or 3 (position in format)
  numberLength: number;     // Length of sequential number
  regexPattern: string;     // Full regex
  example: string;
  confidence: number;       // 0-100
  matchCount: number;
}

export interface ExtractedClaimNumber {
  value: string;
  confidence: number;
  pattern?: ClaimNumberPattern;
  isValid: boolean;
  adjustments?: string[];
}

// =============================================================================
// CLAIM NUMBER PATTERN DETECTION
// =============================================================================

/**
 * Detect pattern from a claim number
 */
export function detectClaimNumberPattern(claimNumber: string): ClaimNumberPattern | null {
  if (!claimNumber || claimNumber.length < 5) return null;

  // Common SA insurance claim number formats
  const patterns = [
    // Santam: STM-2024-12345
    { regex: /^([A-Z]{2,4})-(\d{4})-(\d{4,8})$/i, format: "PREFIX-YYYY-NNNNN", sep: "-", hasYear: true, yearPos: 2 },
    // OUTsurance: OUT/123456/24
    { regex: /^([A-Z]{2,4})\/(\d{5,8})\/(\d{2})$/i, format: "PREFIX/NNNNNN/YY", sep: "/", hasYear: true, yearPos: 3 },
    // Hollard: HOL-12345678
    { regex: /^([A-Z]{2,4})-(\d{5,10})$/i, format: "PREFIX-NNNNNNNN", sep: "-", hasYear: false, yearPos: 0 },
    // Old Mutual: OMN-2024-12345
    { regex: /^([A-Z]{2,4})[-/](\d{4})[-/](\d{4,8})$/i, format: "PREFIX-YYYY-NNNNN", sep: "-", hasYear: true, yearPos: 2 },
    // Discovery: DIS12345678
    { regex: /^([A-Z]{2,4})(\d{5,10})$/i, format: "PREFIXNNNNNNNN", sep: "", hasYear: false, yearPos: 0 },
    // Generic with year: CLM-2024-00123
    { regex: /^([A-Z]{2,4})[-/](\d{4})[-/](\d{3,8})$/i, format: "PREFIX-YYYY-NNNNN", sep: "-", hasYear: true, yearPos: 2 },
    // Generic without year: CLM-123456
    { regex: /^([A-Z]{2,4})[-/](\d{5,10})$/i, format: "PREFIX-NNNNNN", sep: "-", hasYear: false, yearPos: 0 },
    // Numeric only with separators: 2024/12345
    { regex: /^(\d{4})[-/](\d{4,8})$/i, format: "YYYY-NNNNN", sep: "-", hasYear: true, yearPos: 1 },
  ];

  for (const pattern of patterns) {
    const match = claimNumber.match(pattern.regex);
    if (match) {
      const prefix = match[1].toUpperCase();
      const separator = pattern.sep;
      
      // Build regex pattern for future matching
      let regexPattern: string;
      if (pattern.hasYear) {
        if (pattern.yearPos === 2) {
          // PREFIX-YYYY-NNNNN
          regexPattern = `^${prefix}${separator ? '[' + separator + ']' : ''}(\\d{4})${separator ? '[' + separator + ']' : ''}(\\d{4,8})$`;
        } else {
          // PREFIX/NNNNNN/YY
          regexPattern = `^${prefix}${separator ? '[' + separator + ']' : ''}(\\d{5,8})${separator ? '[' + separator + ']' : ''}(\\d{2})$`;
        }
      } else {
        regexPattern = `^${prefix}${separator ? '[' + separator + ']' : ''}(\\d{5,10})$`;
      }

      return {
        prefix,
        separator,
        format: pattern.format.replace("PREFIX", prefix),
        hasYear: pattern.hasYear,
        yearPosition: pattern.yearPos,
        numberLength: match[match.length - 1]?.length || 5,
        regexPattern,
        example: claimNumber.toUpperCase(),
        confidence: 70,
        matchCount: 1
      };
    }
  }

  // Try to detect prefix only
  const prefixMatch = claimNumber.match(/^([A-Z]{2,4})[-/]?(\d)/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    const numbers = claimNumber.replace(/[^0-9]/g, '');
    
    return {
      prefix,
      separator: claimNumber.includes("/") ? "/" : claimNumber.includes("-") ? "-" : "",
      format: `${prefix}-XXXXX`,
      hasYear: /\d{4}/.test(claimNumber),
      yearPosition: /\d{4}/.test(claimNumber) ? 2 : 0,
      numberLength: numbers.length,
      regexPattern: `^${prefix}[-/]?(\\d{4,10})$`,
      example: claimNumber.toUpperCase(),
      confidence: 50,
      matchCount: 1
    };
  }

  return null;
}

// =============================================================================
// PATTERN STORAGE & RETRIEVAL
// =============================================================================

/**
 * Learn a claim number pattern for an insurance company
 */
export async function learnClaimNumberPattern(
  insuranceCompanyId: string,
  claimNumber: string
): Promise<void> {
  const pattern = detectClaimNumberPattern(claimNumber);
  if (!pattern) {
    console.log(`[claim-pattern] Could not detect pattern from: ${claimNumber}`);
    return;
  }

  try {
    // Check if this pattern already exists
    const existing = await db.claimNumberFormat.findFirst({
      where: {
        insuranceCompanyId,
        formatPattern: pattern.format
      }
    });

    if (existing) {
      // Increment match count and boost confidence
      await db.claimNumberFormat.update({
        where: { id: existing.id },
        data: {
          matchCount: { increment: 1 },
          confidence: Math.min(95, existing.confidence + 2),
          example: claimNumber.toUpperCase()
        }
      });
      console.log(`[claim-pattern] Updated existing pattern: ${pattern.format} (confidence: ${Math.min(95, existing.confidence + 2)}%)`);
    } else {
      // Create new pattern
      await db.claimNumberFormat.create({
        data: {
          insuranceCompanyId,
          formatPattern: pattern.format,
          prefix: pattern.prefix,
          separator: pattern.separator,
          hasYear: pattern.hasYear,
          yearPosition: pattern.yearPosition,
          numberLength: pattern.numberLength,
          regexPattern: pattern.regexPattern,
          example: pattern.example,
          confidence: pattern.confidence
        }
      });
      console.log(`[claim-pattern] Learned new pattern: ${pattern.format} for company ${insuranceCompanyId}`);
    }
  } catch (error) {
    console.error("[claim-pattern] Failed to learn pattern:", error);
  }
}

/**
 * Get all learned patterns for an insurance company
 */
export async function getClaimNumberPatterns(
  insuranceCompanyId: string
): Promise<ClaimNumberPattern[]> {
  const patterns = await db.claimNumberFormat.findMany({
    where: {
      insuranceCompanyId,
      isActive: true,
      confidence: { gte: 50 }
    },
    orderBy: [
      { confidence: "desc" },
      { matchCount: "desc" }
    ]
  });

  return patterns.map(p => ({
    prefix: p.prefix || "",
    separator: p.separator || "",
    format: p.formatPattern,
    hasYear: p.hasYear,
    yearPosition: p.yearPosition || 0,
    numberLength: p.numberLength || 5,
    regexPattern: p.regexPattern,
    example: p.example || "",
    confidence: p.confidence,
    matchCount: p.matchCount
  }));
}

/**
 * Get patterns by domain (looks up company from domain)
 */
export async function getClaimNumberPatternsByDomain(
  senderDomain: string
): Promise<ClaimNumberPattern[]> {
  // Find company for this domain
  const company = await db.insuranceCompany.findFirst({
    where: {
      senderDomains: { contains: senderDomain }
    }
  });

  if (!company) {
    // Check domain suggestions
    const suggestion = await db.domainSuggestion.findUnique({
      where: { senderDomain }
    });
    
    if (suggestion?.linkedCompanyId) {
      return getClaimNumberPatterns(suggestion.linkedCompanyId);
    }
    
    return [];
  }

  return getClaimNumberPatterns(company.id);
}

// =============================================================================
// PATTERN MATCHING & VALIDATION
// =============================================================================

/**
 * Extract and validate claim number using learned patterns
 */
export async function extractClaimNumberWithPatterns(
  text: string,
  insuranceCompanyId?: string,
  senderDomain?: string
): Promise<ExtractedClaimNumber | null> {
  // Get patterns for this company/domain
  let patterns: ClaimNumberPattern[] = [];
  
  if (insuranceCompanyId) {
    patterns = await getClaimNumberPatterns(insuranceCompanyId);
  } else if (senderDomain) {
    patterns = await getClaimNumberPatternsByDomain(senderDomain);
  }

  // Try to match using learned patterns first
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regexPattern, "gi");
    const match = text.match(regex);
    
    if (match) {
      const value = match[0].toUpperCase();
      return {
        value,
        confidence: pattern.confidence,
        pattern,
        isValid: true,
        adjustments: []
      };
    }
  }

  // No pattern matched - try generic extraction
  const genericPatterns = [
    // Standard format with prefix: STM-2024-12345
    /\b([A-Z]{2,4})[-/](\d{4})[-/](\d{4,8})\b/gi,
    // Format with slash: OUT/123456/24
    /\b([A-Z]{2,4})\/(\d{5,8})\/(\d{2})\b/gi,
    // Simple format: HOL-12345678
    /\b([A-Z]{2,4})[-/](\d{5,10})\b/gi,
    // No separator: DIS12345678
    /\b([A-Z]{2,4})(\d{6,10})\b/gi,
  ];

  for (const regex of genericPatterns) {
    const match = text.match(regex);
    if (match) {
      const value = match[0].toUpperCase().replace(/[^A-Z0-9\-\/]/g, "");
      return {
        value,
        confidence: 40,
        pattern: undefined,
        isValid: false,
        adjustments: ["Extracted using generic pattern - recommend verification"]
      };
    }
  }

  return null;
}

/**
 * Validate and potentially adjust a claim number using learned patterns
 */
export async function validateClaimNumber(
  claimNumber: string,
  insuranceCompanyId?: string,
  senderDomain?: string
): Promise<ExtractedClaimNumber> {
  let patterns: ClaimNumberPattern[] = [];
  
  if (insuranceCompanyId) {
    patterns = await getClaimNumberPatterns(insuranceCompanyId);
  } else if (senderDomain) {
    patterns = await getClaimNumberPatternsByDomain(senderDomain);
  }

  const adjustments: string[] = [];
  let adjustedValue = claimNumber.toUpperCase();
  let isValid = false;
  let matchedPattern: ClaimNumberPattern | undefined;
  let confidence = 50;

  // Try each pattern
  for (const pattern of patterns) {
    const regex = new RegExp(`^${pattern.regexPattern}$`, "i");
    
    if (regex.test(claimNumber)) {
      // Exact match
      isValid = true;
      matchedPattern = pattern;
      confidence = pattern.confidence;
      break;
    }

    // Try to adjust the claim number to match the pattern
    const adjusted = tryAdjustToPattern(claimNumber, pattern);
    if (adjusted) {
      adjustedValue = adjusted;
      adjustments.push(`Adjusted to match pattern: ${pattern.format}`);
      isValid = true;
      matchedPattern = pattern;
      confidence = pattern.confidence - 10; // Slightly lower confidence for adjusted
      break;
    }
  }

  // Check if we need to add standard formatting
  if (!isValid && patterns.length > 0) {
    const bestPattern = patterns[0];
    
    // Try to fix common issues
    const fixed = fixCommonClaimNumberIssues(claimNumber, bestPattern);
    if (fixed !== claimNumber) {
      adjustedValue = fixed;
      adjustments.push(`Fixed formatting to match expected pattern: ${bestPattern.format}`);
      confidence = 40;
    }
  }

  return {
    value: adjustedValue,
    confidence,
    pattern: matchedPattern,
    isValid,
    adjustments
  };
}

/**
 * Try to adjust a claim number to match a pattern
 */
function tryAdjustToPattern(claimNumber: string, pattern: ClaimNumberPattern): string | null {
  // Remove any non-alphanumeric characters except the separator
  let cleaned = claimNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  // Check if it starts with the expected prefix
  if (!cleaned.startsWith(pattern.prefix)) {
    // Maybe the prefix is missing
    if (cleaned.match(/^\d/)) {
      cleaned = pattern.prefix + cleaned;
    } else {
      return null;
    }
  }

  // Reconstruct with proper separator
  const numbers = cleaned.replace(pattern.prefix, "");
  
  if (pattern.hasYear) {
    // Format: PREFIX-YYYY-NNNNN or PREFIX/NNNNNN/YY
    if (pattern.yearPosition === 2) {
      // PREFIX-YYYY-NNNNN
      const yearMatch = numbers.match(/^(\d{4})(\d+)$/);
      if (yearMatch) {
        return `${pattern.prefix}${pattern.separator}${yearMatch[1]}${pattern.separator}${yearMatch[2]}`;
      }
    } else if (pattern.yearPosition === 3) {
      // PREFIX/NNNNNN/YY
      const numMatch = numbers.match(/^(\d{5,8})(\d{2})$/);
      if (numMatch) {
        return `${pattern.prefix}${pattern.separator}${numMatch[1]}${pattern.separator}${numMatch[2]}`;
      }
    }
  } else {
    // Format: PREFIX-NNNNNNNN
    return `${pattern.prefix}${pattern.separator}${numbers}`;
  }

  return null;
}

/**
 * Fix common claim number formatting issues
 */
function fixCommonClaimNumberIssues(claimNumber: string, pattern: ClaimNumberPattern): string {
  let fixed = claimNumber.toUpperCase();

  // Fix double separators
  fixed = fixed.replace(/[-\/]{2,}/g, pattern.separator || "-");

  // Fix missing leading zeros in number
  if (pattern.numberLength) {
    const parts = fixed.split(/[-\/]/);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length < pattern.numberLength) {
        parts[parts.length - 1] = lastPart.padStart(pattern.numberLength, "0");
        fixed = parts.join(pattern.separator || "-");
      }
    }
  }

  // Fix lowercase
  fixed = fixed.toUpperCase();

  // Fix O -> 0 in numbers (common OCR error)
  fixed = fixed.replace(/([0-9])O/g, "$10");
  fixed = fixed.replace(/O([0-9])/g, "0$1");

  return fixed;
}

// =============================================================================
// LEARNING FROM CORRECTIONS
// =============================================================================

/**
 * Learn from a user correction to a claim number
 */
export async function learnFromClaimNumberCorrection(
  insuranceCompanyId: string,
  originalExtracted: string,
  correctedValue: string
): Promise<void> {
  // Learn the corrected pattern
  await learnClaimNumberPattern(insuranceCompanyId, correctedValue);

  // Analyze the difference
  const originalPattern = detectClaimNumberPattern(originalExtracted);
  const correctedPattern = detectClaimNumberPattern(correctedValue);

  if (originalPattern && correctedPattern) {
    // Check what was wrong
    const issues: string[] = [];

    if (originalPattern.prefix !== correctedPattern.prefix) {
      issues.push(`Prefix wrong: expected ${correctedPattern.prefix}, got ${originalPattern.prefix}`);
    }

    if (originalPattern.separator !== correctedPattern.separator) {
      issues.push(`Separator wrong: expected '${correctedPattern.separator}', got '${originalPattern.separator}'`);
    }

    if (originalPattern.hasYear !== correctedPattern.hasYear) {
      issues.push(`Year detection wrong`);
    }

    if (issues.length > 0) {
      console.log(`[claim-pattern] Learned from correction: ${issues.join(", ")}`);
    }
  }

  // Update any patterns that might have matched the original incorrectly
  const wrongPatterns = await db.claimNumberFormat.findMany({
    where: {
      insuranceCompanyId,
      confidence: { gte: 50 }
    }
  });

  for (const wp of wrongPatterns) {
    const regex = new RegExp(`^${wp.regexPattern}$`, "i");
    if (regex.test(originalExtracted) && !regex.test(correctedValue)) {
      // This pattern matched the wrong value - reduce confidence
      await db.claimNumberFormat.update({
        where: { id: wp.id },
        data: {
          confidence: Math.max(30, wp.confidence - 5)
        }
      });
      console.log(`[claim-pattern] Reduced confidence for incorrect pattern: ${wp.formatPattern}`);
    }
  }
}

/**
 * Get a hint for the AI about expected claim number format
 */
export async function getClaimNumberFormatHint(
  insuranceCompanyId?: string,
  senderDomain?: string
): Promise<string> {
  let patterns: ClaimNumberPattern[] = [];
  
  if (insuranceCompanyId) {
    patterns = await getClaimNumberPatterns(insuranceCompanyId);
  } else if (senderDomain) {
    patterns = await getClaimNumberPatternsByDomain(senderDomain);
  }

  if (patterns.length === 0) {
    return "Claim numbers vary by company. Look for patterns like: PREFIX-YYYY-NNNNN or PREFIX/NNNNNN/YY";
  }

  const examples = patterns.slice(0, 3).map(p => p.example).join(", ");
  const formats = patterns.slice(0, 3).map(p => p.format).join(" or ");

  return `Expected claim number format: ${formats}. Examples: ${examples}`;
}
