import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

// Classification prompt for intake agent
const CLASSIFICATION_PROMPT = `You are the Intake Agent for Stefco Consultants Insurance Claims.

Your job is to determine if an incoming email is a NEW CLAIM APPOINTMENT.

You must be strict and avoid false positives.

Classify into one of:
- NEW_CLAIM: Email indicates a new claim assessment/appointment request
- IGNORE: Spam, marketing, out-of-office, or irrelevant email
- MISSING_INFO: Email seems related to claims but lacks essential information
- OTHER: Unclear or miscellaneous email

Indicators of NEW_CLAIM:
- "New assessment", "New appointment", "NUWE EIS" (Afrikaans)
- "You are appointed" or similar
- Attachments related to claims
- Insurance company correspondence about new matters
- Vehicle/property incident details

Rules:
- Only mark NEW_CLAIM if there is clear evidence of a claim appointment
- If unsure, return OTHER
- Ignore spam, replies, follow-ups, marketing

Analyze the following email and respond with ONLY valid JSON:

Subject: {subject}
From: {from}
Body:
{body}

Respond with this exact JSON structure (no markdown, no explanation):
{"classification": "NEW_CLAIM|IGNORE|MISSING_INFO|OTHER", "confidence": 0-100, "reasoning": "brief explanation"}`;

// Extraction prompt for data extraction agent
const EXTRACTION_PROMPT = `You are the Data Extraction Agent for Stefco Consultants Insurance Claims.

Extract structured claim data from the email. Be precise and do not guess.

Rules:
- NEVER guess missing data - use null for uncertain fields
- If multiple claim numbers are mentioned, select the most prominent one
- Extract dates in ISO format if possible
- Identify the primary contact person

Extract the following fields:
- claimNumber: The main claim reference number
- clientName: Full name of the client/claimant
- clientEmail: Client email address
- clientPhone: Client phone number
- claimType: MOTOR, PROPERTY, LIABILITY, THEFT, FIRE, or OTHER
- incidentDate: Date of incident (ISO format)
- incidentDescription: Brief description of the incident
- vehicleRegistration: Vehicle registration number (if applicable)
- vehicleMake: Vehicle make (if applicable)
- vehicleModel: Vehicle model (if applicable)
- propertyAddress: Property address (if applicable)
- excessAmount: Excess amount as a number
- insuranceCompany: Name of the insurance company

Analyze the following email and respond with ONLY valid JSON:

Subject: {subject}
From: {from}
Body:
{body}

Learning hints (use these to improve extraction):
{hints}

Respond with this exact JSON structure (no markdown, no explanation):
{"claimNumber": null, "clientName": null, "clientEmail": null, "clientPhone": null, "claimType": null, "incidentDate": null, "incidentDescription": null, "vehicleRegistration": null, "vehicleMake": null, "vehicleModel": null, "propertyAddress": null, "excessAmount": null, "insuranceCompany": null, "confidenceOverall": 0-100, "missingFields": []}`;

// Decision agent prompt
const DECISION_PROMPT = `You are the Claims Supervisor AI for Stefco Consultants.

You decide whether a claim can be processed automatically.

CRITICAL RULES:
- NEVER allow processing if claim_number is missing or low confidence
- NEVER allow processing if duplicate risk exists
- NEVER guess or assume
- If confidence is low, send to review

Decision thresholds:
- claimNumber confidence < 70% → REVIEW
- overall confidence < 70% → REVIEW
- missing critical fields → REVIEW

Possible decisions:
- PROCEED: High confidence, all critical fields present
- REVIEW: Medium confidence or missing fields
- REJECT: Clearly not a claim or invalid

Analyze the extraction results and respond with ONLY valid JSON:

Extraction results:
{extraction}

Classification:
{classification}

Respond with this exact JSON structure (no markdown, no explanation):
{"decision": "PROCEED|REVIEW|REJECT", "confidence": 0-100, "riskFlags": [], "reason": "explanation", "nextAction": "recommended action"}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailId, subject, from, bodyText, fromDomain } = body;

    if (!bodyText) {
      return NextResponse.json(
        { error: "Email body is required" },
        { status: 400 }
      );
    }

    // Get learning hints for this sender domain
    const learningHints = await db.learningPattern.findMany({
      where: {
        senderDomain: fromDomain || undefined,
        isActive: true,
      },
      orderBy: { confidence: "desc" },
      take: 10,
    });

    const hintsText = learningHints.length > 0
      ? learningHints.map(h => `- ${h.fieldName}: ${h.patternHint}`).join("\n")
      : "No learning hints available for this sender.";

    // Initialize ZAI
    const zai = await ZAI.create();

    // Step 1: Classification
    const classificationPrompt = CLASSIFICATION_PROMPT
      .replace("{subject}", subject || "(No Subject)")
      .replace("{from}", from || "Unknown")
      .replace("{body}", bodyText.substring(0, 4000));

    const classificationResponse = await zai.chat.completions.create({
      messages: [{ role: "user", content: classificationPrompt }],
    });

    let classification;
    try {
      // Try to parse JSON from response
      const responseText = classificationResponse.choices?.[0]?.message?.content || "";
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        classification = JSON.parse(jsonMatch[0]);
      } else {
        classification = {
          classification: "OTHER",
          confidence: 50,
          reasoning: "Failed to parse AI response",
        };
      }
    } catch {
      classification = {
        classification: "OTHER",
        confidence: 50,
        reasoning: "Failed to parse AI response",
      };
    }

    // Step 2: Extraction (only for NEW_CLAIM)
    let extraction = null;
    let decision = null;

    if (classification.classification === "NEW_CLAIM") {
      const extractionPrompt = EXTRACTION_PROMPT
        .replace("{subject}", subject || "(No Subject)")
        .replace("{from}", from || "Unknown")
        .replace("{body}", bodyText.substring(0, 4000))
        .replace("{hints}", hintsText);

      const extractionResponse = await zai.chat.completions.create({
        messages: [{ role: "user", content: extractionPrompt }],
      });

      try {
        const responseText = extractionResponse.choices?.[0]?.message?.content || "";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extraction = JSON.parse(jsonMatch[0]);
        }
      } catch {
        extraction = null;
      }

      // Step 3: Decision
      if (extraction) {
        const decisionPrompt = DECISION_PROMPT
          .replace("{extraction}", JSON.stringify(extraction, null, 2))
          .replace("{classification}", JSON.stringify(classification, null, 2));

        const decisionResponse = await zai.chat.completions.create({
          messages: [{ role: "user", content: decisionPrompt }],
        });

        try {
          const responseText = decisionResponse.choices?.[0]?.message?.content || "";
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            decision = JSON.parse(jsonMatch[0]);
          }
        } catch {
          decision = {
            decision: "REVIEW",
            confidence: 50,
            riskFlags: ["AI parsing failed"],
            reason: "Failed to parse decision response",
            nextAction: "SEND_TO_REVIEW_QUEUE",
          };
        }
      }
    }

    // Update email queue if emailId provided
    if (emailId) {
      await db.emailQueue.update({
        where: { id: emailId },
        data: {
          aiClassification: classification.classification,
          aiConfidence: classification.confidence,
          aiReasoning: classification.reasoning,
          aiExtractedData: extraction ? JSON.stringify(extraction) : null,
          status: "AI_ANALYZED",
          learningHintsCount: learningHints.length,
        },
      });

      // Create prediction record
      await db.prediction.create({
        data: {
          emailQueueId: emailId,
          predictedClass: classification.classification,
          confidence: classification.confidence,
          reasoning: classification.reasoning,
          decision: decision?.decision,
          extractedFields: extraction ? JSON.stringify(extraction) : null,
          learningHintsCount: learningHints.length,
        },
      });

      // Create audit log
      await db.auditLog.create({
        data: {
          action: "email_classified",
          entityType: "email",
          entityId: emailId,
          details: JSON.stringify({
            classification: classification.classification,
            confidence: classification.confidence,
            decision: decision?.decision,
          }),
          status: "SUCCESS",
          processedBy: "AUTO",
        },
      });
    }

    return NextResponse.json({
      classification,
      extraction,
      decision,
      learningHintsCount: learningHints.length,
    });
  } catch (error) {
    console.error("Process email error:", error);
    return NextResponse.json(
      { error: "Failed to process email", details: String(error) },
      { status: 500 }
    );
  }
}
