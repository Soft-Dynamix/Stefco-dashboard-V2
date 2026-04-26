/**
 * AI Prediction Learning System
 * 
 * This module implements the feedback loop learning:
 * 1. AI makes educated guesses based on analysis + historical patterns
 * 2. Store predictions with confidence scores
 * 3. Compare predictions vs actual when human creates claim
 * 4. Track accuracy metrics per field per domain
 * 5. Learn from corrections and improve over time
 * 6. Auto-create claims when accuracy threshold is met
 */

import { db } from "./db";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface FieldPrediction {
  field: string;
  predicted: string | number | null;
  confidence: number;
  source: "email_body" | "attachment" | "historical_pattern";
}

export interface PredictionRecord {
  emailId: string;
  senderDomain: string | null;
  claimType: string | null;
  predictions: FieldPrediction[];
  overallConfidence: number;
}

export interface FieldComparison {
  field: string;
  predicted: string | number | null;
  actual: string | number | null;
  confidence: number;
  isCorrect: boolean;
  errorType?: "missing" | "wrong" | "extra";
}

export interface LearningResult {
  totalFields: number;
  correctFields: number;
  accuracyRate: number;
  improvements: Array<{
    field: string;
    oldAccuracy: number;
    newAccuracy: number;
    trend: "improving" | "declining" | "stable";
  }>;
  autoClaimReady: boolean;
}

// =============================================================================
// PREDICTION STORAGE
// =============================================================================

/**
 * Store AI predictions for later comparison
 */
export async function storePredictions(
  emailId: string,
  senderDomain: string | null,
  claimType: string | null,
  extractedData: Record<string, any>,
  confidence: number
): Promise<void> {
  // Build predictions array from extracted data
  const predictions: FieldPrediction[] = [];
  
  for (const [field, value] of Object.entries(extractedData)) {
    if (value !== null && value !== undefined && value !== "") {
      predictions.push({
        field,
        predicted: typeof value === "object" ? JSON.stringify(value) : String(value),
        confidence: confidence,
        source: "attachment" // Could be refined based on dataSources
      });
    }
  }
  
  // Store in prediction record
  await db.prediction.create({
    data: {
      emailQueueId: emailId,
      predictedClass: claimType || "UNKNOWN",
      confidence: confidence,
      extractedFields: JSON.stringify(predictions),
      reasoning: `Claim type: ${claimType || "Unknown"}`
    }
  });
  
  console.log(`[prediction-learning] Stored ${predictions.length} predictions for email ${emailId}`);
}

// =============================================================================
// PREDICTION COMPARISON
// =============================================================================

/**
 * Compare AI predictions against actual claim data
 * Called when a human creates/edits a claim
 */
export async function comparePredictionsVsActual(
  emailId: string,
  claimId: string,
  actualData: Record<string, any>
): Promise<LearningResult> {
  // Get the original predictions
  const prediction = await db.prediction.findFirst({
    where: { emailQueueId: emailId },
    orderBy: { createdAt: "desc" }
  });
  
  if (!prediction) {
    console.log(`[prediction-learning] No predictions found for email ${emailId}`);
    return {
      totalFields: 0,
      correctFields: 0,
      accuracyRate: 0,
      improvements: [],
      autoClaimReady: false
    };
  }
  
  // Get email for sender domain
  const email = await db.emailQueue.findUnique({
    where: { id: emailId }
  });
  
  const senderDomain = email?.fromDomain || null;
  const claimType = actualData.claimType || prediction.predictedClass;
  
  // Parse stored predictions
  const storedPredictions: FieldPrediction[] = prediction.extractedFields 
    ? JSON.parse(prediction.extractedFields) 
    : [];
  
  // Compare each field
  const comparisons: FieldComparison[] = [];
  
  for (const pred of storedPredictions) {
    const actualValue = actualData[pred.field];
    const predictedValue = pred.predicted;
    
    const isCorrect = compareValues(predictedValue, actualValue);
    
    comparisons.push({
      field: pred.field,
      predicted: predictedValue,
      actual: actualValue ?? null,
      confidence: pred.confidence,
      isCorrect,
      errorType: isCorrect ? undefined : (actualValue ? "wrong" : "extra")
    });
  }
  
  // Also check for fields that were predicted as null but have actual values
  const predictedFields = new Set(storedPredictions.map(p => p.field));
  for (const [field, value] of Object.entries(actualData)) {
    if (!predictedFields.has(field) && value !== null && value !== undefined && value !== "") {
      comparisons.push({
        field,
        predicted: null,
        actual: value,
        confidence: 0,
        isCorrect: false,
        errorType: "missing"
      });
    }
  }
  
  // Calculate overall accuracy
  const totalFields = comparisons.length;
  const correctFields = comparisons.filter(c => c.isCorrect).length;
  const accuracyRate = totalFields > 0 ? (correctFields / totalFields) * 100 : 0;
  
  // Store comparison record
  await db.predictionComparison.create({
    data: {
      emailQueueId: emailId,
      claimId,
      senderDomain,
      claimType,
      comparisons: JSON.stringify(comparisons),
      totalFields,
      correctFields,
      accuracyRate
    }
  });
  
  // Update field-level accuracy metrics
  const improvements = await updateFieldAccuracyMetrics(senderDomain, claimType, comparisons);
  
  // Check if auto-claim is ready for this domain
  const autoClaimReady = await checkAutoClaimReadiness(senderDomain);
  
  console.log(`[prediction-learning] Comparison complete: ${correctFields}/${totalFields} correct (${accuracyRate.toFixed(1)}%)`);
  
  return {
    totalFields,
    correctFields,
    accuracyRate,
    improvements,
    autoClaimReady
  };
}

/**
 * Compare two values for equality (with normalization)
 */
function compareValues(predicted: any, actual: any): boolean {
  if (predicted === null || predicted === undefined || predicted === "") {
    return actual === null || actual === undefined || actual === "";
  }
  
  if (actual === null || actual === undefined || actual === "") {
    return false;
  }
  
  // Normalize strings for comparison
  const normalize = (v: any): string => {
    if (typeof v === "number") return v.toString();
    if (typeof v !== "string") return JSON.stringify(v);
    return v.toLowerCase().trim().replace(/\s+/g, " ");
  };
  
  return normalize(predicted) === normalize(actual);
}

// =============================================================================
// ACCURACY METRICS UPDATE
// =============================================================================

/**
 * Update field-level accuracy metrics after a comparison
 */
async function updateFieldAccuracyMetrics(
  senderDomain: string | null,
  claimType: string | null,
  comparisons: FieldComparison[]
): Promise<Array<{ field: string; oldAccuracy: number; newAccuracy: number; trend: string }>> {
  if (!senderDomain) return [];
  
  const improvements: Array<{ field: string; oldAccuracy: number; newAccuracy: number; trend: string }> = [];
  
  for (const comparison of comparisons) {
    // Get existing metric
    const existing = await db.fieldAccuracyMetric.findUnique({
      where: {
        senderDomain_fieldName_claimType: {
          senderDomain,
          fieldName: comparison.field,
          claimType
        }
      }
    });
    
    const oldAccuracy = existing?.accuracyRate || 0;
    const oldTotal = existing?.totalPredictions || 0;
    const oldCorrect = existing?.correctPredictions || 0;
    
    // Calculate new totals
    const newTotal = oldTotal + 1;
    const newCorrect = oldCorrect + (comparison.isCorrect ? 1 : 0);
    const newAccuracy = (newCorrect / newTotal) * 100;
    
    // Calculate recent accuracy (last 10)
    const recentAccuracy = await calculateRecentAccuracy(senderDomain, comparison.field, claimType);
    
    // Determine trend
    const trend = newAccuracy > oldAccuracy + 2 ? "improving" 
                : newAccuracy < oldAccuracy - 2 ? "declining" 
                : "stable";
    
    // Check if ready for auto-claim
    const readyForAutoClaim = newAccuracy >= 90 && newTotal >= 10;
    
    // Upsert metric
    await db.fieldAccuracyMetric.upsert({
      where: {
        senderDomain_fieldName_claimType: {
          senderDomain,
          fieldName: comparison.field,
          claimType
        }
      },
      create: {
        senderDomain,
        fieldName: comparison.field,
        claimType,
        totalPredictions: newTotal,
        correctPredictions: newCorrect,
        correctedCount: comparison.isCorrect ? 0 : 1,
        accuracyRate: newAccuracy,
        recentAccuracy,
        trendDirection: trend,
        avgConfidence: comparison.confidence,
        readyForAutoClaim,
        lastPredictionAt: new Date(),
        lastCorrectionAt: comparison.isCorrect ? undefined : new Date()
      },
      update: {
        totalPredictions: newTotal,
        correctPredictions: newCorrect,
        correctedCount: { increment: comparison.isCorrect ? 0 : 1 },
        accuracyRate: newAccuracy,
        recentAccuracy,
        trendDirection: trend,
        avgConfidence: (existing?.avgConfidence || 0 + comparison.confidence) / 2,
        readyForAutoClaim,
        lastPredictionAt: new Date(),
        lastCorrectionAt: comparison.isCorrect ? undefined : new Date()
      }
    });
    
    // If incorrect, create learning pattern
    if (!comparison.isCorrect && comparison.actual !== null) {
      await createLearningPattern(senderDomain, comparison, claimType);
    }
    
    improvements.push({
      field: comparison.field,
      oldAccuracy,
      newAccuracy,
      trend
    });
  }
  
  return improvements;
}

/**
 * Calculate recent accuracy (last N predictions)
 */
async function calculateRecentAccuracy(
  senderDomain: string,
  fieldName: string,
  claimType: string | null,
  lookback: number = 10
): Promise<number> {
  const recentComparisons = await db.predictionComparison.findMany({
    where: {
      senderDomain,
      claimType
    },
    orderBy: { createdAt: "desc" },
    take: lookback
  });
  
  let correct = 0;
  let total = 0;
  
  for (const comp of recentComparisons) {
    const comparisons: FieldComparison[] = JSON.parse(comp.comparisons);
    const fieldComp = comparisons.find(c => c.field === fieldName);
    if (fieldComp) {
      total++;
      if (fieldComp.isCorrect) correct++;
    }
  }
  
  return total > 0 ? (correct / total) * 100 : 0;
}

// =============================================================================
// LEARNING PATTERN CREATION
// =============================================================================

/**
 * Create a learning pattern from a correction
 */
async function createLearningPattern(
  senderDomain: string,
  comparison: FieldComparison,
  claimType: string | null
): Promise<void> {
  // Check if pattern already exists
  const existing = await db.learningPattern.findUnique({
    where: {
      senderDomain_fieldName: {
        senderDomain,
        fieldName: comparison.field
      }
    }
  });
  
  if (existing) {
    // Update existing pattern
    await db.learningPattern.update({
      where: { id: existing.id },
      data: {
        confidence: Math.min(95, existing.confidence + 5),
        correctionCount: { increment: 1 },
        exampleOriginal: comparison.predicted ? String(comparison.predicted) : null,
        exampleCorrected: comparison.actual ? String(comparison.actual) : null
      }
    });
  } else {
    // Create new pattern
    await db.learningPattern.create({
      data: {
        senderDomain,
        fieldName: comparison.field,
        patternHint: `For ${comparison.field}: expected "${comparison.actual}" but predicted "${comparison.predicted}"`,
        exampleOriginal: comparison.predicted ? String(comparison.predicted) : null,
        exampleCorrected: comparison.actual ? String(comparison.actual) : null,
        confidence: 55,
        correctionCount: 1
      }
    });
  }
  
  console.log(`[prediction-learning] Created learning pattern for ${comparison.field} on ${senderDomain}`);
}

// =============================================================================
// AUTO-CLAIM THRESHOLD CHECKING
// =============================================================================

/**
 * Check if a domain is ready for auto-claim creation
 */
export async function checkAutoClaimReadiness(senderDomain: string | null): Promise<boolean> {
  if (!senderDomain) return false;
  
  // Get all field metrics for this domain
  const metrics = await db.fieldAccuracyMetric.findMany({
    where: {
      senderDomain,
      totalPredictions: { gte: 10 } // At least 10 predictions
    }
  });
  
  if (metrics.length === 0) return false;
  
  // Check if critical fields have high accuracy
  const criticalFields = ["claimNumber", "policyNumber", "clientName", "claimType"];
  const criticalMetrics = metrics.filter(m => criticalFields.includes(m.fieldName));
  
  // All critical fields must have 90%+ accuracy
  const allCriticalReady = criticalMetrics.length >= 3 && 
    criticalMetrics.every(m => m.accuracyRate >= 90);
  
  // Average accuracy must be 85%+
  const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracyRate, 0) / metrics.length;
  const avgReady = avgAccuracy >= 85;
  
  // Update sender profile if ready
  if (allCriticalReady && avgReady) {
    await db.senderPattern.update({
      where: { senderDomain },
      data: {
        automationLevel: "auto",
        accuracyRate: avgAccuracy / 100,
        confidenceScore: avgAccuracy
      }
    });
    
    console.log(`[prediction-learning] Domain ${senderDomain} is ready for auto-claim!`);
    return true;
  }
  
  return false;
}

/**
 * Get historical patterns for a domain to improve predictions
 */
export async function getHistoricalPatterns(
  senderDomain: string
): Promise<Record<string, { pattern: string; confidence: number }>> {
  const patterns = await db.learningPattern.findMany({
    where: {
      senderDomain,
      isActive: true,
      confidence: { gte: 60 }
    },
    orderBy: { confidence: "desc" }
  });
  
  const result: Record<string, { pattern: string; confidence: number }> = {};
  
  for (const pattern of patterns) {
    result[pattern.fieldName] = {
      pattern: pattern.patternHint || "",
      confidence: pattern.confidence
    };
  }
  
  return result;
}

/**
 * Get field accuracy summary for a domain
 */
export async function getFieldAccuracySummary(
  senderDomain: string
): Promise<Array<{
  field: string;
  accuracy: number;
  predictions: number;
  ready: boolean;
}>> {
  const metrics = await db.fieldAccuracyMetric.findMany({
    where: { senderDomain }
  });
  
  return metrics.map(m => ({
    field: m.fieldName,
    accuracy: m.accuracyRate,
    predictions: m.totalPredictions,
    ready: m.readyForAutoClaim
  }));
}

/**
 * Get overall domain learning progress
 */
export async function getDomainLearningProgress(
  senderDomain: string
): Promise<{
  totalPredictions: number;
  overallAccuracy: number;
  fieldsLearned: number;
  fieldsReady: number;
  autoClaimReady: boolean;
  progress: number; // 0-100
}> {
  const metrics = await db.fieldAccuracyMetric.findMany({
    where: { senderDomain }
  });
  
  const senderPattern = await db.senderPattern.findUnique({
    where: { senderDomain }
  });
  
  const totalPredictions = metrics.reduce((sum, m) => sum + m.totalPredictions, 0);
  const overallAccuracy = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.accuracyRate, 0) / metrics.length 
    : 0;
  const fieldsLearned = metrics.length;
  const fieldsReady = metrics.filter(m => m.readyForAutoClaim).length;
  const autoClaimReady = await checkAutoClaimReadiness(senderDomain);
  
  // Calculate progress (need 10+ predictions per field, 90%+ accuracy)
  const progress = Math.min(100, 
    (totalPredictions / 100) * 30 + // 30% from volume
    (overallAccuracy / 100) * 50 +  // 50% from accuracy
    (fieldsReady / 10) * 20          // 20% from fields ready
  );
  
  return {
    totalPredictions,
    overallAccuracy,
    fieldsLearned,
    fieldsReady,
    autoClaimReady,
    progress
  };
}
