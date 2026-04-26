/**
 * Cross-Validation Engine
 * 
 * PURPOSE: Prevent wrong data by validating across multiple sources
 * 
 * CHECKS:
 * 1. Claim number consistency: IF email != attachment → flag conflict
 * 2. Client name consistency: IF multiple names found → flag
 * 3. Company validation: IF domain ≠ extracted company → flag
 * 
 * OUTPUT:
 * {
 *   validated: true,
 *   conflicts: [],
 *   confidence_adjusted: 0
 * }
 */

import { db } from "@/lib/db";

export interface ValidationConflict {
  fieldName: string;
  conflictType: "mismatch" | "multiple" | "missing";
  severity: "high" | "medium" | "low";
  values: Array<{
    value: string;
    source: string;
    confidence: number;
  }>;
  recommendation: string;
}

export interface ValidationResult {
  isValid: boolean;
  conflicts: ValidationConflict[];
  confidenceAdjustment: number;
  autoResolvable: boolean;
  recommendedActions: string[];
}

/**
 * Validate extracted data across multiple sources
 */
export async function validateExtraction(
  emailId: string,
  emailData: {
    subject?: string;
    body?: string;
    fromDomain?: string;
  },
  extractedData: Record<string, {
    value: string | null;
    source: string;
    confidence: number;
  }>,
  attachmentData: Array<{
    fileName: string;
    claimNumbers: Array<{ value: string; confidence: number }>;
    clientNames: Array<{ value: string; confidence: number }>;
    vehicleRegs: Array<{ value: string; confidence: number }>;
    [key: string]: unknown;
  }>,
  companyContext?: {
    id: string;
    name: string;
    domain?: string;
  }
): Promise<ValidationResult> {
  const conflicts: ValidationConflict[] = [];
  const recommendedActions: string[] = [];
  
  // 1. Validate claim number
  const claimNumberConflicts = await validateClaimNumber(
    emailId,
    extractedData.claimNumber,
    attachmentData,
    companyContext
  );
  conflicts.push(...claimNumberConflicts);
  
  // 2. Validate client name
  const nameConflicts = await validateClientName(
    emailId,
    extractedData.clientName,
    attachmentData
  );
  conflicts.push(...nameConflicts);
  
  // 3. Validate company/domain match
  if (companyContext && emailData.fromDomain) {
    const companyConflicts = await validateCompanyMatch(
      emailId,
      emailData.fromDomain,
      companyContext,
      extractedData.insuranceCompany
    );
    conflicts.push(...companyConflicts);
  }
  
  // 4. Validate vehicle registration (if motor claim)
  if (extractedData.claimType?.value === "MOTOR") {
    const vehicleConflicts = await validateVehicleReg(
      emailId,
      extractedData.vehicleRegistration,
      attachmentData
    );
    conflicts.push(...vehicleConflicts);
  }
  
  // 5. Cross-field validation
  const crossFieldConflicts = validateCrossFieldRelationships(extractedData);
  conflicts.push(...crossFieldConflicts);
  
  // Calculate confidence adjustment
  const confidenceAdjustment = calculateConfidenceAdjustment(conflicts);
  
  // Determine if auto-resolvable
  const autoResolvable = conflicts.every(
    c => c.severity === "low" || c.conflictType === "multiple"
  );
  
  // Generate recommendations
  for (const conflict of conflicts) {
    recommendedActions.push(conflict.recommendation);
  }
  
  // Store conflicts in database
  await storeConflicts(emailId, conflicts);
  
  return {
    isValid: conflicts.filter(c => c.severity === "high").length === 0,
    conflicts,
    confidenceAdjustment,
    autoResolvable,
    recommendedActions: [...new Set(recommendedActions)],
  };
}

/**
 * Validate claim number across sources
 */
async function validateClaimNumber(
  emailId: string,
  claimNumberData: { value: string | null; source: string; confidence: number } | undefined,
  attachmentData: Array<{
    fileName: string;
    claimNumbers: Array<{ value: string; confidence: number }>;
  }>,
  companyContext?: { id: string; name: string }
): Promise<ValidationConflict[]> {
  const conflicts: ValidationConflict[] = [];
  const allClaimNumbers: Array<{ value: string; source: string; confidence: number }> = [];
  
  // Add email claim number
  if (claimNumberData?.value) {
    allClaimNumbers.push({
      value: claimNumberData.value,
      source: claimNumberData.source,
      confidence: claimNumberData.confidence,
    });
  }
  
  // Add attachment claim numbers
  for (const attachment of attachmentData) {
    for (const cn of attachment.claimNumbers) {
      allClaimNumbers.push({
        value: cn.value,
        source: `attachment:${attachment.fileName}`,
        confidence: cn.confidence,
      });
    }
  }
  
  // Check for conflicts
  if (allClaimNumbers.length === 0) {
    conflicts.push({
      fieldName: "claimNumber",
      conflictType: "missing",
      severity: "high",
      values: [],
      recommendation: "No claim number found in email or attachments. Manual review required.",
    });
  } else if (allClaimNumbers.length > 1) {
    // Check if values match
    const uniqueValues = new Set(allClaimNumbers.map(c => c.value.toUpperCase()));
    
    if (uniqueValues.size > 1) {
      // Multiple different claim numbers found
      conflicts.push({
        fieldName: "claimNumber",
        conflictType: "mismatch",
        severity: "high",
        values: allClaimNumbers,
        recommendation: "Multiple different claim numbers found. Select the correct one based on confidence and source reliability.",
      });
    } else {
      // Same claim number in multiple sources (good!)
      // No conflict, but record for evidence
    }
  }
  
  // Validate against company format
  if (companyContext && claimNumberData?.value) {
    const format = await db.claimNumberFormat.findFirst({
      where: {
        insuranceCompanyId: companyContext.id,
        isActive: true,
      },
    });
    
    if (format) {
      try {
        const regex = new RegExp(format.regexPattern, "i");
        if (!regex.test(claimNumberData.value)) {
          conflicts.push({
            fieldName: "claimNumber",
            conflictType: "mismatch",
            severity: "medium",
            values: [{
              value: claimNumberData.value,
              source: claimNumberData.source,
              confidence: claimNumberData.confidence,
            }],
            recommendation: `Claim number format doesn't match expected format for ${companyContext.name}. Expected format: ${format.formatPattern}`,
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }
  
  return conflicts;
}

/**
 * Validate client name across sources
 */
async function validateClientName(
  emailId: string,
  nameData: { value: string | null; source: string; confidence: number } | undefined,
  attachmentData: Array<{
    fileName: string;
    clientNames: Array<{ value: string; confidence: number }>;
  }>
): Promise<ValidationConflict[]> {
  const conflicts: ValidationConflict[] = [];
  const allNames: Array<{ value: string; source: string; confidence: number }> = [];
  
  if (nameData?.value) {
    allNames.push({
      value: nameData.value,
      source: nameData.source,
      confidence: nameData.confidence,
    });
  }
  
  for (const attachment of attachmentData) {
    for (const name of attachment.clientNames) {
      allNames.push({
        value: name.value,
        source: `attachment:${attachment.fileName}`,
        confidence: name.confidence,
      });
    }
  }
  
  if (allNames.length > 1) {
    // Check for name variations (case-insensitive comparison)
    const uniqueNames = new Map<string, typeof allNames[0]>();
    
    for (const name of allNames) {
      const normalized = name.value.toLowerCase().replace(/[^a-z\s]/g, "").trim();
      const existing = uniqueNames.get(normalized);
      
      if (!existing || existing.confidence < name.confidence) {
        uniqueNames.set(normalized, name);
      }
    }
    
    if (uniqueNames.size > 1) {
      conflicts.push({
        fieldName: "clientName",
        conflictType: "multiple",
        severity: "medium",
        values: Array.from(uniqueNames.values()),
        recommendation: "Multiple different names found. Verify which is the policyholder.",
      });
    }
  }
  
  return conflicts;
}

/**
 * Validate company/domain match
 */
async function validateCompanyMatch(
  emailId: string,
  emailDomain: string,
  companyContext: { id: string; name: string; domain?: string },
  extractedCompany: { value: string | null; source: string; confidence: number } | undefined
): Promise<ValidationConflict[]> {
  const conflicts: ValidationConflict[] = [];
  
  // Check if extracted company name matches domain company
  if (extractedCompany?.value && extractedCompany.value !== companyContext.name) {
    conflicts.push({
      fieldName: "insuranceCompany",
      conflictType: "mismatch",
      severity: "medium",
      values: [
        { value: companyContext.name, source: `domain:${emailDomain}`, confidence: 95 },
        { value: extractedCompany.value, source: extractedCompany.source, confidence: extractedCompany.confidence },
      ],
      recommendation: `Domain suggests ${companyContext.name} but extracted ${extractedCompany.value}. Verify company.`,
    });
  }
  
  return conflicts;
}

/**
 * Validate vehicle registration for motor claims
 */
async function validateVehicleReg(
  emailId: string,
  vehicleRegData: { value: string | null; source: string; confidence: number } | undefined,
  attachmentData: Array<{
    fileName: string;
    vehicleRegs: Array<{ value: string; confidence: number }>;
  }>
): Promise<ValidationConflict[]> {
  const conflicts: ValidationConflict[] = [];
  
  if (!vehicleRegData?.value && attachmentData.every(a => a.vehicleRegs.length === 0)) {
    conflicts.push({
      fieldName: "vehicleRegistration",
      conflictType: "missing",
      severity: "medium",
      values: [],
      recommendation: "Motor claim but no vehicle registration found. Check attachments.",
    });
  }
  
  return conflicts;
}

/**
 * Validate cross-field relationships
 * e.g., MOTOR claim should have vehicleReg, PROPERTY should have address
 */
function validateCrossFieldRelationships(
  extractedData: Record<string, { value: string | null; source: string; confidence: number }>
): ValidationConflict[] {
  const conflicts: ValidationConflict[] = [];
  
  const claimType = extractedData.claimType?.value;
  
  if (claimType === "MOTOR") {
    if (!extractedData.vehicleRegistration?.value) {
      conflicts.push({
        fieldName: "vehicleRegistration",
        conflictType: "missing",
        severity: "medium",
        values: [],
        recommendation: "Motor claim should have vehicle registration.",
      });
    }
  }
  
  if (claimType === "PROPERTY") {
    if (!extractedData.propertyAddress?.value) {
      conflicts.push({
        fieldName: "propertyAddress",
        conflictType: "missing",
        severity: "low",
        values: [],
        recommendation: "Property claim should have address.",
      });
    }
  }
  
  // Validate contact info
  if (!extractedData.clientEmail?.value && !extractedData.clientPhone?.value) {
    conflicts.push({
      fieldName: "clientContact",
      conflictType: "missing",
      severity: "low",
      values: [],
      recommendation: "No contact information found for client.",
    });
  }
  
  return conflicts;
}

/**
 * Calculate confidence adjustment based on conflicts
 */
function calculateConfidenceAdjustment(conflicts: ValidationConflict[]): number {
  let adjustment = 0;
  
  for (const conflict of conflicts) {
    switch (conflict.severity) {
      case "high":
        adjustment -= 30;
        break;
      case "medium":
        adjustment -= 15;
        break;
      case "low":
        adjustment -= 5;
        break;
    }
  }
  
  return adjustment;
}

/**
 * Store conflicts in database
 */
async function storeConflicts(emailId: string, conflicts: ValidationConflict[]): Promise<void> {
  // Clear existing conflicts
  await db.validationConflict.deleteMany({
    where: { emailQueueId: emailId },
  });
  
  // Store new conflicts
  for (const conflict of conflicts) {
    await db.validationConflict.create({
      data: {
        emailQueueId: emailId,
        fieldName: conflict.fieldName,
        values: JSON.stringify(conflict.values),
        conflictType: conflict.conflictType,
        severity: conflict.severity,
      },
    });
  }
}

/**
 * Get conflicts for an email
 */
export async function getEmailConflicts(emailId: string): Promise<ValidationConflict[]> {
  const stored = await db.validationConflict.findMany({
    where: { emailQueueId: emailId },
  });
  
  return stored.map(s => ({
    fieldName: s.fieldName,
    conflictType: s.conflictType as "mismatch" | "multiple" | "missing",
    severity: s.severity as "high" | "medium" | "low",
    values: safeJsonParse(s.values, []),
    recommendation: s.resolution || "Review and resolve conflict",
  }));
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  emailId: string,
  fieldName: string,
  resolvedValue: string,
  resolvedBy: string = "AUTO"
): Promise<void> {
  await db.validationConflict.updateMany({
    where: { emailQueueId: emailId, fieldName },
    data: {
      resolution: "resolved",
      resolvedValue,
      resolvedBy,
      resolvedAt: new Date(),
    },
  });
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
