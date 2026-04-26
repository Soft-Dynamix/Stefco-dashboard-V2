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
 * VIN is 17 alphanumeric characters (no I, O, Q), but may have spaces/dashes
 * This function is flexible - it handles VINs in any format
 */
export function findAllPossibleVins(text: string): string[] {
  const vins: string[] = [];
  const seen = new Set<string>();
  
  // Helper to clean and validate a VIN
  const cleanAndValidateVin = (rawVin: string): string | null => {
    // Remove spaces, dashes, and common separators
    const cleaned = rawVin.replace(/[\s\-._]/g, '').toUpperCase();
    // VIN must be exactly 17 alphanumeric chars (no I, O, Q)
    if (cleaned.length !== 17) return null;
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) return null;
    // Must have both letters and numbers to be valid
    const hasLetters = /[A-HJ-NPR-Z]/.test(cleaned);
    const hasNumbers = /[0-9]/.test(cleaned);
    if (!hasLetters || !hasNumbers) return null;
    return cleaned;
  };
  
  // Pattern 1: Look for any labeled VIN/Chassis values
  // The label might be followed by various formats (with spaces, dashes, etc.)
  const labeledPatterns = [
    // VIN with various labels and formats
    /(?:VIN|Vin|vin|V\.?I\.?N\.?)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
    // Chassis with various labels (common in SA)
    /(?:CHASSIS|Chassis|chassis|Chassis\s*No|Chassis\s*Number)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
    // Vehicle ID
    /(?:Vehicle\s*ID|VehicleID|Vehicle\s*Identification)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
    // Afrikaans labels
    /(?:Kasnommer|Onderstel|Voertuignommer)\s*(?:No|Number|#|Nr\.?|:)?\s*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
    // Short form labels
    /(?:VIN:|Chassis:|Chassis\s*No:)\s*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
  ];
  
  for (const pattern of labeledPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        const cleaned = cleanAndValidateVin(match[1]);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          vins.push(cleaned);
        }
      }
    }
  }
  
  // Pattern 2: Find any 17-char sequences that look like VINs
  // This catches VINs without labels
  // Look for sequences with possible separators
  const standalonePatterns = [
    // Continuous 17-char alphanumeric
    /\b([A-HJ-NPR-Z0-9]{17})\b/g,
    // With spaces (e.g., "AHT 286 CZ0 J1234567" or "AHT286CZ0J1234567")
    /\b([A-HJ-NPR-Z0-9]{1,4}[\s\-][A-HJ-NPR-Z0-9]{1,4}[\s\-]?[A-HJ-NPR-Z0-9]{1,4}[\s\-]?[A-HJ-NPR-Z0-9]{1,4})\b/g,
    // With dashes (e.g., "AHT-286-CZ0-J1234567")
    /\b([A-HJ-NPR-Z0-9]{1,5}-[A-HJ-NPR-Z0-9]{1,5}-[A-HJ-NPR-Z0-9]{1,5}-?[A-HJ-NPR-Z0-9]{0,5})\b/g,
  ];
  
  for (const pattern of standalonePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        const cleaned = cleanAndValidateVin(match[1]);
        if (cleaned && !seen.has(cleaned)) {
          seen.add(cleaned);
          vins.push(cleaned);
        }
      }
    }
  }
  
  return vins;
}

/**
 * Extract vehicle details from text (make, model, year, etc.)
 * Searches for labeled fields first, then falls back to pattern matching
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
      // Try multiple VIN patterns - flexible format with spaces/dashes
      pattern: /(?:vin|chassis)\s*(?:no|number|#|nr\.?|#)?[:\s]*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/i,
      description: "VIN/Chassis number pattern (17 alphanumeric characters, flexible format)",
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
      // For VIN, clean the value (remove spaces/dashes)
      let value = match[1].trim();
      if (fieldType === "vehicleVinNumber") {
        value = value.replace(/[\s\-._]/g, '').toUpperCase();
        // Validate it's 17 chars
        if (value.length !== 17 || !/^[A-HJ-NPR-Z0-9]{17}$/.test(value)) {
          value = ""; // Invalid, try other patterns
        }
      }
      if (value) {
        return {
          field: fieldType,
          value,
          confidence: 50,
          pattern: fallback.pattern.source,
          source: "fallback",
        };
      }
    }
    
    // For VIN, try alternative patterns if labeled pattern didn't match
    if (fieldType === "vehicleVinNumber") {
      // Helper to clean and validate VIN
      const cleanVin = (raw: string): string | null => {
        const cleaned = raw.replace(/[\s\-._]/g, '').toUpperCase();
        if (cleaned.length !== 17) return null;
        if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned)) return null;
        if (!/[A-HJ-NPR-Z]/.test(cleaned) || !/[0-9]/.test(cleaned)) return null;
        return cleaned;
      };
      
      // Try various VIN patterns
      const vinPatterns = [
        // Pattern with various labels (flexible format)
        /(?:VIN|Vin|vin|CHASSIS|Chassis|chassis)\s*(?:No|Number|#|Nr\.?|#)?[:\s]*([A-HJ-NPR-Z0-9][\s\-_A-HJ-NPR-Z0-9]{16,25})/gi,
        // Standalone VIN in text (continuous)
        /\b([A-HJ-NPR-Z0-9]{17})\b/g,
        // With spaces (e.g., "AHT 286 CZ0 J1234567")
        /\b([A-HJ-NPR-Z0-9]{1,4}[\s\-][A-HJ-NPR-Z0-9]{1,4}[\s\-]?[A-HJ-NPR-Z0-9]{1,4}[\s\-]?[A-HJ-NPR-Z0-9]{1,4})\b/g,
        // With dashes
        /\b([A-HJ-NPR-Z0-9]{1,5}-[A-HJ-NPR-Z0-9]{1,5}-[A-HJ-NPR-Z0-9]{1,5}-?[A-HJ-NPR-Z0-9]{0,5})\b/g,
      ];
      
      for (const vPattern of vinPatterns) {
        const vMatch = text.match(vPattern);
        if (vMatch && vMatch[1]) {
          const cleaned = cleanVin(vMatch[1]);
          if (cleaned) {
            return {
              field: fieldType,
              value: cleaned,
              confidence: 40,
              pattern: vPattern.source,
              source: "fallback_alt",
            };
          }
        }
      }
      
      // Last resort: use findAllPossibleVins function for comprehensive search
      const allVins = findAllPossibleVins(text);
      if (allVins.length > 0) {
        return {
          field: fieldType,
          value: allVins[0],
          confidence: 30,
          pattern: "findAllPossibleVins",
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
