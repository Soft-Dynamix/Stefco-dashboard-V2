/**
 * Evidence Tracking System
 * 
 * PURPOSE: Every extracted field must store HOW it was found
 * 
 * OUTPUT FOR EACH FIELD:
 * {
 *   value: "1234567890",
 *   source: "attachment",
 *   confidence: 92,
 *   evidence: "text snippet where found",
 *   patternUsed: "regex pattern that matched"
 * }
 * 
 * This makes debugging possible and learning accurate.
 */

import { db } from "@/lib/db";

export interface EvidenceRecord {
  fieldName: string;
  value: string;
  source: "email_subject" | "email_body" | "attachment" | "signature" | "ai_inference";
  sourceDetail?: string;
  evidenceText?: string;
  positionStart?: number;
  positionEnd?: number;
  confidence: number;
  patternUsed?: string;
  isSelected: boolean;
  rejectionReason?: string;
}

export interface FieldEvidence {
  fieldName: string;
  finalValue: string | null;
  finalConfidence: number;
  selectedSource: string;
  allEvidence: EvidenceRecord[];
  selectionReason: string;
}

/**
 * Record evidence for an extracted field
 */
export async function recordEvidence(
  emailId: string,
  evidence: EvidenceRecord
): Promise<void> {
  await db.extractedEvidence.create({
    data: {
      emailQueueId: emailId,
      fieldName: evidence.fieldName,
      value: evidence.value,
      source: evidence.source,
      sourceDetail: evidence.sourceDetail,
      evidenceText: evidence.evidenceText, // Full evidence text - no truncation
      positionStart: evidence.positionStart,
      positionEnd: evidence.positionEnd,
      confidence: evidence.confidence,
      patternUsed: evidence.patternUsed,
      isSelected: evidence.isSelected,
      rejectionReason: evidence.rejectionReason,
    },
  });
}

/**
 * Record multiple evidence records at once
 */
export async function recordBulkEvidence(
  emailId: string,
  evidences: EvidenceRecord[]
): Promise<void> {
  for (const evidence of evidences) {
    await recordEvidence(emailId, evidence);
  }
}

/**
 * Get all evidence for a field
 */
export async function getFieldEvidence(emailId: string, fieldName: string): Promise<EvidenceRecord[]> {
  const records = await db.extractedEvidence.findMany({
    where: { emailQueueId: emailId, fieldName },
    orderBy: { confidence: "desc" },
  });
  
  return records.map(r => ({
    fieldName: r.fieldName,
    value: r.value,
    source: r.source as EvidenceRecord["source"],
    sourceDetail: r.sourceDetail || undefined,
    evidenceText: r.evidenceText || undefined,
    positionStart: r.positionStart || undefined,
    positionEnd: r.positionEnd || undefined,
    confidence: r.confidence,
    patternUsed: r.patternUsed || undefined,
    isSelected: r.isSelected,
    rejectionReason: r.rejectionReason || undefined,
  }));
}

/**
 * Get all evidence for an email
 */
export async function getAllEvidence(emailId: string): Promise<Map<string, EvidenceRecord[]>> {
  const records = await db.extractedEvidence.findMany({
    where: { emailQueueId: emailId },
    orderBy: [{ fieldName: "asc" }, { confidence: "desc" }],
  });
  
  const grouped = new Map<string, EvidenceRecord[]>();
  
  for (const r of records) {
    const evidence: EvidenceRecord = {
      fieldName: r.fieldName,
      value: r.value,
      source: r.source as EvidenceRecord["source"],
      sourceDetail: r.sourceDetail || undefined,
      evidenceText: r.evidenceText || undefined,
      positionStart: r.positionStart || undefined,
      positionEnd: r.positionEnd || undefined,
      confidence: r.confidence,
      patternUsed: r.patternUsed || undefined,
      isSelected: r.isSelected,
      rejectionReason: r.rejectionReason || undefined,
    };
    
    const existing = grouped.get(r.fieldName) || [];
    existing.push(evidence);
    grouped.set(r.fieldName, existing);
  }
  
  return grouped;
}

/**
 * Select the best evidence for a field
 */
export async function selectBestEvidence(
  emailId: string,
  fieldName: string,
  preferredSource?: string
): Promise<EvidenceRecord | null> {
  const evidences = await getFieldEvidence(emailId, fieldName);
  
  if (evidences.length === 0) return null;
  
  // Sort by confidence and source priority
  const sourcePriority = {
    email_subject: 100,
    attachment: 80,
    email_body: 70,
    signature: 60,
    ai_inference: 50,
  };
  
  let best = evidences[0];
  
  for (const e of evidences) {
    const eScore = e.confidence + (sourcePriority[e.source] || 0) * 0.3;
    const bestScore = best.confidence + (sourcePriority[best.source] || 0) * 0.3;
    
    if (eScore > bestScore) {
      best = e;
    }
  }
  
  // Mark as selected
  await db.extractedEvidence.updateMany({
    where: { emailQueueId: emailId, fieldName },
    data: { isSelected: false },
  });
  
  await db.extractedEvidence.updateMany({
    where: { emailQueueId: emailId, fieldName, value: best.value },
    data: { isSelected: true },
  });
  
  return best;
}

/**
 * Build field evidence summary
 */
export async function buildFieldEvidenceSummary(
  emailId: string,
  fieldName: string
): Promise<FieldEvidence> {
  const evidences = await getFieldEvidence(emailId, fieldName);
  const selected = evidences.find(e => e.isSelected) || evidences[0];
  
  return {
    fieldName,
    finalValue: selected?.value || null,
    finalConfidence: selected?.confidence || 0,
    selectedSource: selected?.source || "ai_inference",
    allEvidence: evidences,
    selectionReason: buildSelectionReason(selected, evidences),
  };
}

/**
 * Build human-readable selection reason
 */
function buildSelectionReason(selected: EvidenceRecord | undefined, all: EvidenceRecord[]): string {
  if (!selected) return "No evidence found";
  
  const reasons: string[] = [];
  
  // Confidence-based reason
  if (selected.confidence >= 90) {
    reasons.push(`High confidence match (${selected.confidence}%)`);
  } else if (selected.confidence >= 70) {
    reasons.push(`Good confidence match (${selected.confidence}%)`);
  } else {
    reasons.push(`Lower confidence match (${selected.confidence}%)`);
  }
  
  // Source-based reason
  reasons.push(`found in ${selected.source.replace("_", " ")}`);
  
  // Pattern-based reason
  if (selected.patternUsed) {
    reasons.push(`matched pattern: ${selected.patternUsed}`);
  }
  
  // Alternative count
  if (all.length > 1) {
    reasons.push(`selected from ${all.length} candidates`);
  }
  
  return reasons.join(", ");
}

/**
 * Create evidence record from extraction
 */
export function createEvidenceRecord(
  fieldName: string,
  value: string,
  source: EvidenceRecord["source"],
  confidence: number,
  options?: {
    sourceDetail?: string;
    evidenceText?: string;
    patternUsed?: string;
    positionStart?: number;
    positionEnd?: number;
  }
): EvidenceRecord {
  return {
    fieldName,
    value,
    source,
    sourceDetail: options?.sourceDetail,
    evidenceText: options?.evidenceText,
    confidence,
    patternUsed: options?.patternUsed,
    positionStart: options?.positionStart,
    positionEnd: options?.positionEnd,
    isSelected: false,
  };
}

/**
 * Create evidence from email subject
 */
export function createSubjectEvidence(
  fieldName: string,
  value: string,
  subject: string,
  confidence: number,
  patternUsed?: string
): EvidenceRecord {
  const index = subject.toLowerCase().indexOf(value.toLowerCase());
  
  return createEvidenceRecord(fieldName, value, "email_subject", confidence, {
    sourceDetail: "subject",
    evidenceText: subject,
    patternUsed,
    positionStart: index >= 0 ? index : undefined,
    positionEnd: index >= 0 ? index + value.length : undefined,
  });
}

/**
 * Create evidence from email body
 */
export function createBodyEvidence(
  fieldName: string,
  value: string,
  body: string,
  confidence: number,
  patternUsed?: string
): EvidenceRecord {
  const index = body.toLowerCase().indexOf(value.toLowerCase());
  const contextStart = Math.max(0, index - 50);
  const contextEnd = Math.min(body.length, index + value.length + 50);
  
  return createEvidenceRecord(fieldName, value, "email_body", confidence, {
    sourceDetail: "body",
    evidenceText: body.slice(contextStart, contextEnd),
    patternUsed,
    positionStart: index >= 0 ? index : undefined,
    positionEnd: index >= 0 ? index + value.length : undefined,
  });
}

/**
 * Create evidence from attachment
 */
export function createAttachmentEvidence(
  fieldName: string,
  value: string,
  attachmentName: string,
  attachmentContent: string,
  confidence: number,
  patternUsed?: string
): EvidenceRecord {
  const index = attachmentContent.toLowerCase().indexOf(value.toLowerCase());
  const contextStart = Math.max(0, index - 50);
  const contextEnd = Math.min(attachmentContent.length, index + value.length + 50);
  
  return createEvidenceRecord(fieldName, value, "attachment", confidence, {
    sourceDetail: `attachment: ${attachmentName}`,
    evidenceText: attachmentContent.slice(contextStart, contextEnd),
    patternUsed,
    positionStart: index >= 0 ? index : undefined,
    positionEnd: index >= 0 ? index + value.length : undefined,
  });
}

/**
 * Create evidence from AI inference
 */
export function createAIInferenceEvidence(
  fieldName: string,
  value: string,
  reasoning: string,
  confidence: number
): EvidenceRecord {
  return createEvidenceRecord(fieldName, value, "ai_inference", confidence, {
    sourceDetail: "AI extraction",
    evidenceText: reasoning,
  });
}

/**
 * Record rejection of evidence
 */
export async function rejectEvidence(
  emailId: string,
  fieldName: string,
  value: string,
  reason: string
): Promise<void> {
  await db.extractedEvidence.updateMany({
    where: { emailQueueId: emailId, fieldName, value },
    data: {
      isSelected: false,
      rejectionReason: reason,
    },
  });
}

/**
 * Get evidence history for learning
 */
export async function getEvidenceHistory(
  fieldName: string,
  domain?: string,
  limit: number = 50
): Promise<Array<{
  value: string;
  source: string;
  confidence: number;
  wasCorrect: boolean;
}>> {
  // Get historical evidence with correction info
  const records = await db.extractedEvidence.findMany({
    where: {
      fieldName,
      isSelected: true,
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  });
  
  // Check which were corrected
  const results: Array<{ value: string; source: string; confidence: number; wasCorrect: boolean }> = [];
  
  for (const record of records) {
    const correction = await db.fieldExtractionResult.findFirst({
      where: {
        fieldName,
        finalValue: record.value,
        wasCorrected: true,
      },
    });
    
    results.push({
      value: record.value,
      source: record.source,
      confidence: record.confidence,
      wasCorrect: !correction,
    });
  }
  
  return results;
}

/**
 * Calculate source reliability for a field
 */
export async function calculateSourceReliability(
  fieldName: string
): Promise<Record<string, number>> {
  const history = await getEvidenceHistory(fieldName, undefined, 100);
  
  const sourceCounts: Record<string, { total: number; correct: number }> = {};
  
  for (const h of history) {
    if (!sourceCounts[h.source]) {
      sourceCounts[h.source] = { total: 0, correct: 0 };
    }
    sourceCounts[h.source].total++;
    if (h.wasCorrect) {
      sourceCounts[h.source].correct++;
    }
  }
  
  const reliability: Record<string, number> = {};
  
  for (const [source, counts] of Object.entries(sourceCounts)) {
    reliability[source] = counts.total > 0 
      ? (counts.correct / counts.total) * 100 
      : 50;
  }
  
  return reliability;
}
