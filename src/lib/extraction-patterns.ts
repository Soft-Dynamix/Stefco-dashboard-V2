import { db } from "./db";

// Field types that can be extracted
export type ExtractableField =
  | "claimNumber"
  | "policyNumber"
  | "clientName"
  | "clientEmail"
  | "clientPhone"
  | "vehicleRegistration"
  | "vehicleVinNumber"
  | "vehicleMake"
  | "vehicleModel"
  | "vehicleYear"
  | "vehicleColor"
  | "engineNumber"
  | "propertyAddress"
  | "excessAmount"
  | "incidentDate"
  | "incidentDescription"
  | "claimType";

/**
 * Aggressively scan text for any VIN/Chassis number patterns
 * This function finds ALL potential VINs in text, even without labels
 */
export function findAllPossibleVins(text: string): string[] {
  const vins: string[] = [];
  
  // Pattern 1: With labels (higher priority)
  const labeledPattern = /(?:VIN|Vin|vin|CHASSIS|Chassis|chassis|Vehicle\s*ID)\s*(?:No|Number|#|Nr\.?|#)?[:\s]*([A-HJ-NPR-Z0-9]{17})/gi;
  let match;
  while ((match = labeledPattern.exec(text)) !== null) {
    if (match[1] && !vins.includes(match[1].toUpperCase())) {
      vins.push(match[1].toUpperCase());
    }
  }
  
  // Pattern 2: Standalone 17-char alphanumeric sequences (lower priority)
  const standalonePattern = /\b([A-HJ-NPR-Z0-9]{17})\b/g;
  while ((match = standalonePattern.exec(text)) !== null) {
    if (match[1] && !vins.includes(match[1].toUpperCase())) {
      vins.push(match[1].toUpperCase());
    }
  }
  
  return vins;
}

/**
 * Extract vehicle details from text (make, model, year, etc.)
 */
export function extractVehicleDetails(text: string): {
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
  
  // Common vehicle makes
  const makes = [
    "Toyota", "Volkswagen", "VW", "BMW", "Mercedes", "Mercedes-Benz", "Ford",
    "Honda", "Nissan", "Mazda", "Hyundai", "Kia", "Audi", "Volvo", "Lexus",
    "Isuzu", "Mitsubishi", "Subaru", "Suzuki", "Renault", "Peugeot", "Jeep",
    "Land Rover", "Jaguar", "Porsche", "Mini", "Fiat", "Chevrolet", "Opel",
    "Chery", "Haval", "GWM", "Mahindra"
  ];
  
  // Try to find make
  for (const make of makes) {
    const makePattern = new RegExp(`\\b(${make})\\b`, "i");
    if (makePattern.test(text)) {
      result.make = make;
      break;
    }
  }
  
  // Try to find year (4 digits between 1990 and current year + 1)
  const currentYear = new Date().getFullYear();
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
  
  // Try to find engine number (usually alphanumeric, 6-12 chars)
  const enginePattern = /(?:Engine|Eng)\s*(?:No|Number|#|Nr\.?)?[:\s]*([A-Z0-9]{6,12})/i;
  const engineMatch = text.match(enginePattern);
  if (engineMatch) {
    result.engineNumber = engineMatch[1].toUpperCase();
  }
  
  // Try to find color
  const colors = [
    "White", "Black", "Silver", "Grey", "Gray", "Blue", "Red", "Green",
    "Yellow", "Gold", "Bronze", "Brown", "Beige", "Orange", "Purple", "Maroon"
  ];
  for (const color of colors) {
    const colorPattern = new RegExp(`\\b${color}\\b`, "i");
    if (colorPattern.test(text)) {
      result.color = color;
      break;
    }
  }
  
  return result;
}

// Extraction result
export interface ExtractionResult {
  field: ExtractableField;
  value: string | null;
  confidence: number;
  pattern?: string;
  source?: string;
}

// Learn extraction pattern from a correction
export async function learnExtractionPattern(
  insuranceCompanyId: string | null,
  fieldType: ExtractableField,
  originalValue: string | null,
  correctedValue: string,
  sourceText: string,
  emailQueueId?: string
): Promise<void> {
  if (!correctedValue || correctedValue.trim() === "") return;

  // Try to find the corrected value in the source text
  const valueIndex = sourceText.indexOf(correctedValue);
  if (valueIndex === -1) return;

  // Get context around the value
  const contextSize = 50;
  const contextBefore = sourceText.substring(Math.max(0, valueIndex - contextSize), valueIndex);
  const contextAfter = sourceText.substring(
    valueIndex + correctedValue.length,
    Math.min(sourceText.length, valueIndex + correctedValue.length + contextSize)
  );

  // Generate pattern hint from context
  const patternHint = generatePatternHint(contextBefore, correctedValue, contextAfter, fieldType);

  // Store the example for learning
  await db.extractionExample.create({
    data: {
      insuranceCompanyId,
      fieldType,
      sourceText: sourceText.substring(Math.max(0, valueIndex - 100), valueIndex + correctedValue.length + 100),
      extractedValue: correctedValue,
      contextBefore: contextBefore || null,
      contextAfter: contextAfter || null,
      learnedFrom: originalValue ? "user_correction" : "initial_extraction",
      verified: true,
      emailQueueId,
    },
  });

  // If we have a company, try to create/update a pattern
  if (insuranceCompanyId) {
    await updateOrCreatePattern(insuranceCompanyId, fieldType, correctedValue, sourceText, contextBefore, contextAfter);
  }
}

// Generate a pattern hint from context
function generatePatternHint(
  before: string,
  value: string,
  after: string,
  fieldType: ExtractableField
): string {
  // Look for label patterns before the value
  const labelPatterns: Record<string, RegExp[]> = {
    claimNumber: [
      /claim\s*(?:no|number|#|ref(?:erence)?)?[:\s]*$/i,
      /ref(?:erence)?[:\s]*$/i,
      /case\s*(?:no|number)?[:\s]*$/i,
    ],
    policyNumber: [
      /policy\s*(?:no|number|#)?[:\s]*$/i,
      /pol\s*(?:no|number)?[:\s]*$/i,
    ],
    clientName: [
      /(?:client|insured|claimant|name)[:\s]*$/i,
      /dear\s+$/i,
    ],
    vehicleRegistration: [
      /(?:vehicle|reg(?:istration)?)\s*(?:no|number|#)?[:\s]*$/i,
      /reg[:\s]*$/i,
    ],
    vehicleVinNumber: [
      /(?:vin|chassis)\s*(?:no|number|#)?[:\s]*$/i,
      /chassis[:\s]*$/i,
      /vin[:\s]*$/i,
    ],
    excessAmount: [
      /excess[:\s]*$/i,
      /(?:first\s+)?amount[:\s]*$/i,
    ],
  };

  const patterns = labelPatterns[fieldType] || [];

  for (const pattern of patterns) {
    if (pattern.test(before)) {
      return `Look for "${pattern.source}" followed by value`;
    }
  }

  return `Value found after "${before.slice(-20)}"`;
}

// Update or create extraction pattern
async function updateOrCreatePattern(
  insuranceCompanyId: string,
  fieldType: string,
  value: string,
  sourceText: string,
  contextBefore: string,
  contextAfter: string
): Promise<void> {
  // Get existing examples for this company/field
  const examples = await db.extractionExample.findMany({
    where: {
      insuranceCompanyId,
      fieldType,
    },
    take: 20,
  });

  // If we have enough examples, try to generate a pattern
  if (examples.length >= 3) {
    const generatedPattern = generatePatternFromExamples(examples, fieldType);

    if (generatedPattern) {
      // Check if pattern already exists
      const existing = await db.extractionPattern.findFirst({
        where: {
          insuranceCompanyId,
          fieldType,
          patternValue: generatedPattern.regex,
        },
      });

      if (existing) {
        // Update confidence
        await db.extractionPattern.update({
          where: { id: existing.id },
          data: {
            confidence: Math.min(95, existing.confidence + 2),
            successCount: { increment: 1 },
          },
        });
      } else {
        // Create new pattern
        await db.extractionPattern.create({
          data: {
            insuranceCompanyId,
            fieldType,
            patternType: "regex",
            patternValue: generatedPattern.regex,
            description: generatedPattern.description,
            exampleMatch: value,
            confidence: 70,
            isSystemPattern: true,
          },
        });
      }
    }
  }
}

// Generate regex pattern from examples
function generatePatternFromExamples(
  examples: Array<{
    extractedValue: string;
    contextBefore: string | null;
    contextAfter: string | null;
  }>,
  fieldType: string
): { regex: string; description: string } | null {
  // Group by common prefix patterns
  const prefixGroups: Record<string, number> = {};

  for (const example of examples) {
    const before = example.contextBefore || "";
    // Look for label at end of context
    const labelMatch = before.match(/([A-Za-z]{2,}(?:\s+(?:no|number|#|ref))?[:\s]*)$/i);
    if (labelMatch) {
      const label = labelMatch[1].toLowerCase().trim();
      prefixGroups[label] = (prefixGroups[label] || 0) + 1;
    }
  }

  // Find most common prefix
  const sortedPrefixes = Object.entries(prefixGroups).sort((a, b) => b[1] - a[1]);
  if (sortedPrefixes.length > 0 && sortedPrefixes[0][1] >= 2) {
    const commonPrefix = sortedPrefixes[0][0];
    const escaped = commonPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Generate value pattern based on field type
    const valuePatterns: Record<string, string> = {
      claimNumber: "([A-Z]{2,4}[-/]?\\d{2,4}[-/]?\\d{4,8})",
      policyNumber: "([A-Z]{2,4}[-/]?\\d{6,12})",
      clientName: "([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)",
      vehicleRegistration: "([A-Z]{2,3}\\d{3}[A-Z]{0,2}|\\d{3}[A-Z]{3}\\d{2})",
      vehicleVinNumber: "([A-HJ-NPR-Z0-9]{17})",
      excessAmount: "(R?\\s*[\\d,]+\\.?\\d{0,2})",
    };

    const valuePattern = valuePatterns[fieldType] || "(\\S+)";

    return {
      regex: `${escaped}\\s*${valuePattern}`,
      description: `Look for "${commonPrefix}" followed by ${fieldType}`,
    };
  }

  return null;
}

// Extract fields using learned patterns
export async function extractWithPatterns(
  text: string,
  insuranceCompanyId: string | null
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = [];

  // Get patterns for this company
  const patterns = await db.extractionPattern.findMany({
    where: {
      insuranceCompanyId: insuranceCompanyId || null,
      isActive: true,
    },
    orderBy: [
      { priority: "desc" },
      { confidence: "desc" },
    ],
  });

  // Group by field type
  const patternsByField: Record<string, typeof patterns> = {};
  for (const pattern of patterns) {
    if (!patternsByField[pattern.fieldType]) {
      patternsByField[pattern.fieldType] = [];
    }
    patternsByField[pattern.fieldType].push(pattern);
  }

  // Extract each field
  for (const [field, fieldPatterns] of Object.entries(patternsByField)) {
    const result = extractField(text, field, fieldPatterns);
    if (result.value) {
      results.push(result);
    }
  }

  // Also use fallback extraction for missing fields
  const extractedFields = results.map((r) => r.field);
  const missingFields: ExtractableField[] = [
    "claimNumber",
    "policyNumber",
    "clientName",
    "vehicleRegistration",
    "vehicleVinNumber",
    "excessAmount",
  ].filter((f) => !extractedFields.includes(f)) as ExtractableField[];

  for (const field of missingFields) {
    const fallback = fallbackExtraction(text, field);
    if (fallback.value) {
      results.push(fallback);
    }
  }

  return results;
}

// Extract a single field using patterns
function extractField(
  text: string,
  fieldType: string,
  patterns: Array<{
    id: string;
    patternValue: string;
    confidence: number;
    successCount: number;
  }>
): ExtractionResult {
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.patternValue, "im");
      const match = text.match(regex);
      if (match && match[1]) {
        return {
          field: fieldType as ExtractableField,
          value: match[1].trim(),
          confidence: pattern.confidence,
          pattern: pattern.patternValue,
        };
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return {
    field: fieldType as ExtractableField,
    value: null,
    confidence: 0,
  };
}

// Fallback extraction using common patterns
function fallbackExtraction(text: string, fieldType: ExtractableField): ExtractionResult {
  const fallbackPatterns: Record<string, { pattern: RegExp; description: string }> = {
    claimNumber: {
      pattern: /(?:claim|case|ref(?:erence)?)\s*(?:no|number|#)?[:\s]*([A-Z]{2,4}[-/]\d{2,4}[-/]\d{4,8})/i,
      description: "Generic claim number pattern",
    },
    policyNumber: {
      pattern: /(?:policy|pol)\s*(?:no|number|#)?[:\s]*([A-Z]{0,4}[-/]?\d{6,12})/i,
      description: "Generic policy number pattern",
    },
    clientName: {
      pattern: /(?:client|insured|name|dear)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      description: "Generic name pattern",
    },
    vehicleRegistration: {
      pattern: /(?:vehicle|reg(?:istration)?)\s*(?:no|number|#)?[:\s]*([A-Z]{2,3}\d{3}[A-Z]{0,2}|\d{3}[A-Z]{3}\d{2})/i,
      description: "SA vehicle registration pattern",
    },
    vehicleVinNumber: {
      // Try multiple VIN patterns - first with label, then standalone
      pattern: /(?:vin|chassis)\s*(?:no|number|#|nr\.?|#)?[:\s]*([A-HJ-NPR-Z0-9]{17})/i,
      description: "VIN/Chassis number pattern (17 alphanumeric characters)",
    },
    excessAmount: {
      pattern: /excess[:\s]*(R?\s*[\d,]+\.?\d{0,2})/i,
      description: "Generic excess amount pattern",
    },
  };

  const fallback = fallbackPatterns[fieldType];
  if (fallback) {
    const match = text.match(fallback.pattern);
    if (match && match[1]) {
      return {
        field: fieldType,
        value: match[1].trim(),
        confidence: 50,
        pattern: fallback.pattern.source,
        source: "fallback",
      };
    }
    
    // For VIN, try alternative patterns if labeled pattern didn't match
    if (fieldType === "vehicleVinNumber") {
      // Try to find any standalone 17-character VIN-like sequence
      const vinPatterns = [
        // Pattern with various labels
        /(?:VIN|Vin|vin|CHASSIS|Chassis|chassis)\s*(?:No|Number|#|Nr\.?|#)?[:\s]*([A-HJ-NPR-Z0-9]{17})/i,
        // Standalone VIN in text (must be word-bounded)
        /\b([A-HJ-NPR-Z0-9]{17})\b/g,
      ];
      
      for (const vPattern of vinPatterns) {
        const vMatch = text.match(vPattern);
        if (vMatch && vMatch[1]) {
          return {
            field: fieldType,
            value: vMatch[1].trim().toUpperCase(),
            confidence: 40, // Slightly lower confidence for unlabeled VINs
            pattern: vPattern.source,
            source: "fallback_alt",
          };
        }
      }
      
      // Last resort: find ALL 17-char alphanumeric sequences and return the most likely VIN
      const allPossibleVins = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/g);
      if (allPossibleVins && allPossibleVins.length > 0) {
        // Return the first one found
        return {
          field: fieldType,
          value: allPossibleVins[0].toUpperCase(),
          confidence: 30,
          pattern: "\\b[A-HJ-NPR-Z0-9]{17}\\b",
          source: "fallback_aggressive",
        };
      }
    }
  }

  return {
    field: fieldType,
    value: null,
    confidence: 0,
    source: "fallback",
  };
}

// Seed default patterns for a company
export async function seedDefaultPatterns(
  insuranceCompanyId: string,
  companyName: string
): Promise<void> {
  // Generate default patterns based on company name
  const prefix = companyName.substring(0, 3).toUpperCase();

  const defaultPatterns: Array<{
    fieldType: string;
    patternValue: string;
    description: string;
    exampleMatch: string;
  }> = [
    {
      fieldType: "claimNumber",
      patternValue: `${prefix}[-/](\\d{4})[-/](\\d{5,8})`,
      description: `${companyName} claim number format`,
      exampleMatch: `${prefix}-2024-12345`,
    },
    {
      fieldType: "policyNumber",
      patternValue: `(?:policy|pol)[:\\s]*([A-Z]{0,4}\\d{6,10})`,
      description: `Generic policy number pattern`,
      exampleMatch: `POL12345678`,
    },
  ];

  for (const pattern of defaultPatterns) {
    await db.extractionPattern.upsert({
      where: {
        insuranceCompanyId_fieldType_patternValue: {
          insuranceCompanyId,
          fieldType: pattern.fieldType,
          patternValue: pattern.patternValue,
        },
      },
      create: {
        insuranceCompanyId,
        fieldType: pattern.fieldType,
        patternType: "regex",
        patternValue: pattern.patternValue,
        description: pattern.description,
        exampleMatch: pattern.exampleMatch,
        confidence: 65,
        isSystemPattern: true,
      },
      update: {},
    });
  }
}
