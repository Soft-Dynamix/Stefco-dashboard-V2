import { ImapFlow } from "imapflow";
import { db } from "./db";
import crypto from "crypto";
import ZAI from "z-ai-web-dev-sdk";

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  ssl: boolean;
  tls: boolean;
}

interface EmailMessage {
  messageId: string;
  subject: string | null;
  from: string | null;
  fromDomain: string | null;
  to: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
  date: Date | null;
}

// Get IMAP config from database settings
export async function getImapConfig(): Promise<ImapConfig | null> {
  try {
    const configs = await db.systemConfig.findMany({
      where: {
        key: {
          in: ["IMAP_HOST", "IMAP_PORT", "IMAP_USER", "IMAP_PASSWORD", "IMAP_SSL", "IMAP_TLS"],
        },
      },
    });

    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const host = configMap.get("IMAP_HOST");
    const user = configMap.get("IMAP_USER");
    const password = configMap.get("IMAP_PASSWORD");

    if (!host || !user || !password) {
      return null;
    }

    return {
      host,
      port: parseInt(configMap.get("IMAP_PORT") || "993"),
      user,
      password,
      ssl: configMap.get("IMAP_SSL") !== "false",
      tls: true,
    };
  } catch (error) {
    console.error("Failed to get IMAP config:", error);
    return null;
  }
}

// Generate unique message ID hash
function generateMessageId(subject: string, body: string, from: string): string {
  const content = `${subject}:${body}:${from}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

// Extract domain from email address
function extractDomain(email: string | null): string | null {
  if (!email) return null;
  const match = email.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : null;
}

// Check if domain is known (linked to insurance company or has suggestion)
async function checkAndCreateDomainSuggestion(
  domain: string,
  fromEmail: string | null,
  fromName: string | null,
  subject: string | null,
  bodyText: string | null
): Promise<void> {
  if (!domain) return;

  // Check if domain is already linked to an insurance company
  const existingCompany = await db.insuranceCompany.findFirst({
    where: {
      senderDomains: { contains: domain },
      isActive: true,
    },
  });

  if (existingCompany) return;

  // Check if suggestion already exists
  const existingSuggestion = await db.domainSuggestion.findUnique({
    where: { senderDomain: domain },
  });

  if (existingSuggestion) {
    // Update email count
    const existingSubjects = existingSuggestion.sampleSubjects
      ? JSON.parse(existingSuggestion.sampleSubjects)
      : [];
    const newSubjects = subject
      ? [...new Set([...existingSubjects, subject])].slice(0, 10)
      : existingSubjects;

    await db.domainSuggestion.update({
      where: { senderDomain: domain },
      data: {
        emailCount: { increment: 1 },
        sampleSubjects: JSON.stringify(newSubjects),
      },
    });
    return;
  }

  // Try to detect company name from email body or signature
  const detectedCompanyName = detectCompanyName(bodyText, fromName, domain);

  // Check against known insurance domain patterns
  const domainKnowledge = await db.insuranceDomainKnowledge.findFirst({
    where: {
      OR: [
        { domainPattern: domain },
        { domainPattern: domain.replace(/^[^.]+\./, "*.") },
      ],
      isActive: true,
    },
  });

  // Check for similar company
  let suggestedCompanyId: string | null = null;
  let suggestedCompanyName: string | null = null;

  if (domainKnowledge) {
    suggestedCompanyName = domainKnowledge.companyName;
    const similarCompany = await db.insuranceCompany.findFirst({
      where: {
        OR: [
          { name: { contains: domainKnowledge.companyName } },
          { shortName: domainKnowledge.shortName || "" },
        ],
      },
    });
    if (similarCompany) suggestedCompanyId = similarCompany.id;
  } else if (detectedCompanyName) {
    suggestedCompanyName = detectedCompanyName;
    const similarCompany = await db.insuranceCompany.findFirst({
      where: {
        OR: [
          { name: { contains: detectedCompanyName } },
          { shortName: { contains: detectedCompanyName } },
        ],
      },
    });
    if (similarCompany) suggestedCompanyId = similarCompany.id;
  } else {
    // Extract from domain
    suggestedCompanyName = extractCompanyFromDomain(domain);
  }

  // Create suggestion
  await db.domainSuggestion.create({
    data: {
      senderDomain: domain,
      detectedCompanyName,
      detectedFromEmail: fromEmail,
      detectedFromName: fromName,
      suggestedCompanyId,
      suggestedCompanyName,
      confidenceScore: domainKnowledge ? 85 : (detectedCompanyName ? 60 : 40),
      sampleSubjects: subject ? JSON.stringify([subject]) : null,
      status: domainKnowledge ? "auto_approved" : "pending",
    },
  });
}

// Detect company name from email content
function detectCompanyName(
  bodyText: string | null,
  fromName: string | null,
  domain: string
): string | null {
  if (!bodyText) return null;

  // Common patterns in insurance emails
  const patterns = [
    // Signature patterns
    /(?:Regards|Thanks|Thank you|Sincerely|Best regards|Kind regards)[,\s]*\n+([A-Za-z\s&]+(?:Insurance|Assurance|Underwriters|Risk|Financial|Services|Pty|Ltd)[A-Za-z\s&]*)/i,
    // Company header patterns
    /^([A-Za-z\s&]+(?:Insurance|Assurance|Underwriters|Risk|Financial|Services|Pty|Ltd)[A-Za-z\s&]*)/im,
    // "From company name" patterns
    /from[:\s]+([A-Za-z\s&]+(?:Insurance|Assurance))/i,
    // Copyright footer
    /©\s*\d{4}\s+([A-Za-z\s&]+(?:Insurance|Assurance|Pty|Ltd))/i,
    // Disclaimer company name
    /This (?:email|message) is from ([A-Za-z\s&]+(?:Insurance|Assurance|Pty|Ltd))/i,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common false positives
      if (
        name.length > 3 &&
        name.length < 100 &&
        !name.toLowerCase().includes("confidential") &&
        !name.toLowerCase().includes("intended recipient")
      ) {
        return name;
      }
    }
  }

  // Extract from sender name if it looks like a company
  if (fromName) {
    const companyKeywords = ["insurance", "assurance", "underwriters", "risk", "claims"];
    for (const keyword of companyKeywords) {
      if (fromName.toLowerCase().includes(keyword)) {
        return fromName;
      }
    }
  }

  return null;
}

// Extract company name from domain
function extractCompanyFromDomain(domain: string): string {
  const cleaned = domain
    .replace(/^(mail\.|email\.|claims\.|notifications\.|noreply\.|no-reply\.)/i, "")
    .replace(/\.(co\.za|com|co\.uk|org|net)$/i, "");

  return cleaned
    .split(/[.-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Parse email address to get just the email part
function parseEmailAddress(address: string | null): string | null {
  if (!address) return null;
  // Handle formats like "Name <email@domain.com>" or just "email@domain.com"
  const match = address.match(/<([^>]+)>/) || address.match(/([^\s<>]+@[^\s<>]+)/);
  return match ? match[1] : address;
}

// Fetch emails from IMAP server
export async function fetchEmails(limit: number = 50): Promise<{
  success: boolean;
  fetched: number;
  errors: string[];
}> {
  const config = await getImapConfig();
  
  if (!config) {
    return {
      success: false,
      fetched: 0,
      errors: ["IMAP not configured. Please set up IMAP settings."],
    };
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.ssl,
    auth: {
      user: config.user,
      pass: config.password,
    },
    logger: false,
  });

  const errors: string[] = [];
  let fetched = 0;

  try {
    await client.connect();
    
    const mailbox = await client.mailboxOpen("INBOX");
    
    // Get ALL messages (including read ones), sorted by date descending
    // We'll fetch from newest to oldest and stop at the limit
    const messages = [];
    
    // Fetch all messages with their sequence numbers
    const totalMessages = mailbox.exists || 0;
    
    if (totalMessages === 0) {
      await client.logout();
      return { success: true, fetched: 0, errors: [] };
    }
    
    // Fetch from the most recent messages (highest sequence numbers = newest)
    const startSeq = Math.max(1, totalMessages - limit + 1);
    const fetchRange = `${startSeq}:${totalMessages}`;
    
    for await (const message of client.fetch(
      fetchRange,
      { source: true, envelope: true, bodyStructure: true }
    )) {
      messages.push(message);
    }

    // Process each message
    for (const msg of messages.slice(0, limit)) {
      try {
        const envelope = msg.envelope;
        const source = msg.source?.toString("utf-8") || "";
        
        // Extract body text
        let bodyText = "";
        let bodyHtml = "";
        
        // Simple extraction - in production you'd want proper MIME parsing
        const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|\r\nContent-|$)/i);
        const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|\r\nContent-|$)/i);

        // Decode quoted-printable encoding
        const decodeQuotedPrintable = (str: string): string => {
          return str
            .replace(/=\r\n/g, "") // Remove soft line breaks
            .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))); // Decode hex chars
        };

        if (textMatch) bodyText = decodeQuotedPrintable(textMatch[1]);
        if (htmlMatch) bodyHtml = decodeQuotedPrintable(htmlMatch[1]);

        const from = envelope.from?.[0]?.address || envelope.from?.[0]?.name || null;
        const fromEmail = parseEmailAddress(envelope.from?.[0]?.address || envelope.sender?.[0]?.address || null);
        
        // Use the actual Message-ID from email header if available, otherwise generate one
        const headerMessageId = source.match(/Message-ID:\s*<([^>]+)>/i)?.[1];
        const emailMessageId = headerMessageId || generateMessageId(
          envelope.subject || "(No Subject)",
          bodyText || source.substring(0, 500),
          fromEmail || ""
        );
        
        const emailData: EmailMessage = {
          messageId: emailMessageId,
          subject: envelope.subject || null,
          from: fromEmail,
          fromDomain: extractDomain(fromEmail),
          to: envelope.to?.[0]?.address || null,
          bodyText: bodyText || source.substring(0, 5000),
          bodyHtml: bodyHtml || null,
          attachments: [],
          date: envelope.date || null,
        };

        // Check for duplicates FIRST - skip if already in database
        const existing = await db.emailQueue.findUnique({
          where: { messageId: emailData.messageId },
        });

        if (existing) {
          continue; // Skip duplicate - email already processed
        }

        // Check for auto-ignore rules first
        let autoIgnored = false;
        let autoIgnoreCategory: string | null = null;
        let autoIgnoreReason: string | null = null;

        if (emailData.fromDomain) {
          const autoIgnoreRule = await db.senderIgnoreRule.findFirst({
            where: {
              senderDomain: emailData.fromDomain,
              autoIgnore: true,
              isActive: true,
            },
          });

          if (autoIgnoreRule) {
            autoIgnored = true;
            autoIgnoreCategory = autoIgnoreRule.category;
            autoIgnoreReason = autoIgnoreRule.reason;
          }
        }

        // Determine processing route based on sender profile
        let processingRoute = "manual_review";
        if (emailData.fromDomain && !autoIgnored) {
          const senderProfile = await db.senderPattern.findUnique({
            where: { senderDomain: emailData.fromDomain },
          });
          
          if (senderProfile) {
            if (senderProfile.automationLevel === "auto") {
              processingRoute = "auto_create";
            } else if (senderProfile.automationLevel === "semi_auto") {
              processingRoute = "ai_suggest";
            }
          }
        }

        // Insert into email queue (auto-ignored or pending)
        await db.emailQueue.create({
          data: {
            messageId: emailData.messageId,
            subject: emailData.subject,
            from: emailData.from,
            fromDomain: emailData.fromDomain,
            to: emailData.to,
            bodyText: emailData.bodyText?.substring(0, 50000),
            bodyHtml: emailData.bodyHtml?.substring(0, 100000),
            attachments: emailData.attachments.length > 0 ? JSON.stringify(emailData.attachments) : null,
            emailDate: emailData.date,
            status: autoIgnored ? "IGNORED" : "PENDING",
            processingRoute: autoIgnored ? "auto_ignored" : processingRoute,
            ignoreReason: autoIgnoreReason,
            ignoreCategory: autoIgnoreCategory,
            processedAt: autoIgnored ? new Date() : null,
            aiClassification: autoIgnored ? "IGNORE" : null,
            aiConfidence: autoIgnored ? 100 : null,
            aiReasoning: autoIgnored ? `Auto-ignored: ${autoIgnoreReason}` : null,
          },
        });

        // Update auto-ignore rule stats if applied
        if (autoIgnored && emailData.fromDomain) {
          await db.senderIgnoreRule.updateMany({
            where: {
              senderDomain: emailData.fromDomain,
              autoIgnore: true,
              isActive: true,
            },
            data: {
              appliedCount: { increment: 1 },
              lastAppliedAt: new Date(),
            },
          });
        }

        // Check and create domain suggestion for unknown domains
        const fromName = envelope.from?.[0]?.name || null;
        await checkAndCreateDomainSuggestion(
          emailData.fromDomain,
          emailData.from,
          fromName,
          emailData.subject,
          emailData.bodyText
        );

        fetched++;
      } catch (msgError) {
        errors.push(`Failed to process message: ${msgError}`);
      }
    }

    await client.logout();

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "email_poll_completed",
        entityType: "system",
        details: JSON.stringify({ fetched, errors: errors.length }),
        status: errors.length > 0 ? "WARNING" : "SUCCESS",
        processedBy: "AUTO",
      },
    });

    return { success: true, fetched, errors };
  } catch (error) {
    const errorMsg = `IMAP connection failed: ${error}`;
    errors.push(errorMsg);
    
    // Create audit log for failure
    await db.auditLog.create({
      data: {
        action: "email_poll_failed",
        entityType: "system",
        details: JSON.stringify({ error: errorMsg }),
        status: "ERROR",
        processedBy: "AUTO",
      },
    });

    return { success: false, fetched, errors };
  }
}

// Get polling status
export async function getPollingStatus(): Promise<{
  isConfigured: boolean;
  lastPoll: Date | null;
  nextPoll: Date | null;
  totalQueued: number;
}> {
  const config = await getImapConfig();
  
  const lastPollLog = await db.auditLog.findFirst({
    where: { action: "email_poll_completed" },
    orderBy: { createdAt: "desc" },
  });

  const totalQueued = await db.emailQueue.count({
    where: { status: "PENDING" },
  });

  return {
    isConfigured: config !== null,
    lastPoll: lastPollLog?.createdAt || null,
    nextPoll: null, // Will be set by scheduler
    totalQueued,
  };
}

// Auto-analyze pending emails using AI with learning hints
export async function autoAnalyzeEmails(limit: number = 50): Promise<{
  success: boolean;
  analyzed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let analyzed = 0;

  try {
    // Auto-analysis is enabled by default - no need to check database setting
    // Get pending emails
    const pendingEmails = await db.emailQueue.findMany({
      where: { status: "PENDING" },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    if (pendingEmails.length === 0) {
      return { success: true, analyzed: 0, errors: [] };
    }

    const zai = await ZAI.create();

    for (const email of pendingEmails) {
      try {
        // Get learning hints for this sender domain
        const learningHints = await db.learningPattern.findMany({
          where: {
            senderDomain: email.fromDomain || undefined,
            isActive: true,
          },
          orderBy: { confidence: "desc" },
          take: 10,
        });

        const hintsText = learningHints.length > 0
          ? learningHints.map(h => `- ${h.fieldName}: ${h.patternHint}`).join("\n")
          : "No learning hints available for this sender.";

        // Get sender pattern for automation level
        const senderPattern = await db.senderPattern.findUnique({
          where: { senderDomain: email.fromDomain || "" },
        });

        // Classification prompt
        const classificationPrompt = `You are the Intake Agent for Stefco Consultants Insurance Claims.

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

Subject: ${email.subject || "(No Subject)"}
From: ${email.from || "Unknown"}
Body:
${(email.bodyText || "").substring(0, 4000)}

Respond with this exact JSON structure (no markdown, no explanation):
{"classification": "NEW_CLAIM|IGNORE|MISSING_INFO|OTHER", "confidence": 0-100, "reasoning": "brief explanation"}`;

        const classificationResponse = await zai.chat.completions.create({
          messages: [{ role: "user", content: classificationPrompt }],
        });

        let classification;
        try {
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

        // Extraction (only for NEW_CLAIM)
        let extraction = null;
        let decision = null;

        if (classification.classification === "NEW_CLAIM") {
          const extractionPrompt = `You are the Data Extraction Agent for Stefco Consultants Insurance Claims.

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

Subject: ${email.subject || "(No Subject)"}
From: ${email.from || "Unknown"}
Body:
${(email.bodyText || "").substring(0, 4000)}

Learning hints (use these to improve extraction):
${hintsText}

Respond with this exact JSON structure (no markdown, no explanation):
{"claimNumber": null, "clientName": null, "clientEmail": null, "clientPhone": null, "claimType": null, "incidentDate": null, "incidentDescription": null, "vehicleRegistration": null, "vehicleMake": null, "vehicleModel": null, "propertyAddress": null, "excessAmount": null, "insuranceCompany": null, "confidenceOverall": 0-100, "missingFields": []}`;

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

          // Decision
          if (extraction) {
            const decisionPrompt = `You are the Claims Supervisor AI for Stefco Consultants.

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
${JSON.stringify(extraction, null, 2)}

Classification:
${JSON.stringify(classification, null, 2)}

Respond with this exact JSON structure (no markdown, no explanation):
{"decision": "PROCEED|REVIEW|REJECT", "confidence": 0-100, "riskFlags": [], "reason": "explanation", "nextAction": "recommended action"}`;

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

        // Update email queue
        // If AI classifies as IGNORE, automatically set status to IGNORED
        const newStatus = classification.classification === "IGNORE" ? "IGNORED" : "AI_ANALYZED";
        
        await db.emailQueue.update({
          where: { id: email.id },
          data: {
            aiClassification: classification.classification,
            aiConfidence: classification.confidence,
            aiReasoning: classification.reasoning,
            aiExtractedData: extraction ? JSON.stringify(extraction) : null,
            status: newStatus,
            ignoreReason: classification.classification === "IGNORE" ? classification.reasoning : null,
            ignoreCategory: classification.classification === "IGNORE" ? "ai_classified" : null,
            processedAt: classification.classification === "IGNORE" ? new Date() : null,
            learningHintsCount: learningHints.length,
          },
        });

        // Create prediction record
        await db.prediction.create({
          data: {
            emailQueueId: email.id,
            predictedClass: classification.classification,
            confidence: classification.confidence,
            reasoning: classification.reasoning,
            decision: decision?.decision,
            extractedFields: extraction ? JSON.stringify(extraction) : null,
            learningHintsCount: learningHints.length,
          },
        });

        analyzed++;
        
        // Add delay between AI calls to avoid rate limiting (2 seconds)
        if (analyzed < pendingEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (emailError) {
        errors.push(`Failed to analyze email ${email.id}: ${emailError}`);
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "auto_analysis_completed",
        entityType: "system",
        details: JSON.stringify({ analyzed, errors: errors.length }),
        status: errors.length > 0 ? "WARNING" : "SUCCESS",
        processedBy: "AUTO",
      },
    });

    return { success: true, analyzed, errors };
  } catch (error) {
    errors.push(`Auto-analysis failed: ${error}`);
    return { success: false, analyzed, errors };
  }
}

// Fetch and auto-analyze emails in one call
export async function fetchAndAnalyzeEmails(limit: number = 50): Promise<{
  success: boolean;
  fetched: number;
  analyzed: number;
  errors: string[];
}> {
  // First fetch emails
  const fetchResult = await fetchEmails(limit);
  
  if (!fetchResult.success) {
    return {
      success: false,
      fetched: fetchResult.fetched,
      analyzed: 0,
      errors: fetchResult.errors,
    };
  }

  // Then auto-analyze
  const analyzeResult = await autoAnalyzeEmails(limit);

  return {
    success: true,
    fetched: fetchResult.fetched,
    analyzed: analyzeResult.analyzed,
    errors: [...fetchResult.errors, ...analyzeResult.errors],
  };
}

// Auto-create claims for emails from domains with "auto" automation level
// This is the FINAL stage of full automation
export async function autoCreateClaims(limit: number = 50): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let created = 0;
  let skipped = 0;

  try {
    // Check if auto-claim creation is enabled
    const autoClaimConfig = await db.systemConfig.findUnique({
      where: { key: "AUTO_CLAIM_CREATION_ENABLED" },
    });

    if (autoClaimConfig?.value !== "true") {
      return {
        success: true,
        created: 0,
        skipped: 0,
        errors: ["Auto-claim creation is disabled. Enable it in Settings."],
      };
    }

    // Get analyzed emails that are ready for claim creation
    // Only from domains with "auto" automation level
    const analyzedEmails = await db.emailQueue.findMany({
      where: {
        status: "AI_ANALYZED",
        aiClassification: "NEW_CLAIM",
        fromDomain: { not: null },
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
    });

    if (analyzedEmails.length === 0) {
      return { success: true, created: 0, skipped: 0, errors: [] };
    }

    for (const email of analyzedEmails) {
      try {
        if (!email.fromDomain) {
          skipped++;
          continue;
        }

        // Check if this domain has "auto" automation level
        const senderPattern = await db.senderPattern.findUnique({
          where: { senderDomain: email.fromDomain },
        });

        // Check domain profile for automation level
        const domainProfile = await db.domainProfile.findUnique({
          where: { domain: email.fromDomain },
        });

        // Determine if we can auto-process
        const canAutoProcess = 
          (senderPattern?.automationLevel === "auto" && (senderPattern.accuracyRate ?? 0) >= 90) ||
          (domainProfile?.automationLevel === "auto" && domainProfile.confidenceScore >= 90);

        if (!canAutoProcess) {
          // Domain not ready for auto-processing
          skipped++;
          continue;
        }

        // Parse extracted data
        let extractedData: Record<string, unknown> = {};
        if (email.aiExtractedData) {
          try {
            extractedData = JSON.parse(email.aiExtractedData);
          } catch {
            errors.push(`Failed to parse extracted data for email ${email.id}`);
            skipped++;
            continue;
          }
        }

        // Verify we have required fields
        const claimNumber = extractedData.claimNumber as string | null;
        if (!claimNumber) {
          skipped++;
          continue;
        }

        // Check for duplicate claim
        const existingClaim = await db.claim.findUnique({
          where: { claimNumber },
        });

        if (existingClaim) {
          // Mark email as duplicate
          await db.emailQueue.update({
            where: { id: email.id },
            data: {
              status: "IGNORED",
              ignoreReason: "Duplicate claim number",
              ignoreCategory: "duplicate",
            },
          });
          skipped++;
          continue;
        }

        // Find or create insurance company
        let insuranceCompanyId: string | null = null;
        const companyName = extractedData.insuranceCompany as string | null;
        
        if (companyName) {
          let company = await db.insuranceCompany.findFirst({
            where: {
              OR: [
                { name: { contains: companyName, mode: "insensitive" } },
                { shortName: { contains: companyName, mode: "insensitive" } },
              ],
            },
          });

          if (!company && domainProfile?.insuranceCompanyId) {
            company = await db.insuranceCompany.findUnique({
              where: { id: domainProfile.insuranceCompanyId },
            });
          }

          if (company) {
            insuranceCompanyId = company.id;
          }
        } else if (domainProfile?.insuranceCompanyId) {
          insuranceCompanyId = domainProfile.insuranceCompanyId;
        }

        // Create the claim automatically
        const newClaim = await db.claim.create({
          data: {
            claimNumber,
            clientName: extractedData.clientName as string || null,
            clientEmail: extractedData.clientEmail as string || null,
            clientPhone: extractedData.clientPhone as string || null,
            claimType: extractedData.claimType as string || null,
            incidentDate: extractedData.incidentDate 
              ? new Date(extractedData.incidentDate as string) 
              : null,
            incidentDescription: extractedData.incidentDescription as string || null,
            vehicleRegistration: extractedData.vehicleRegistration as string || null,
            vehicleMake: extractedData.vehicleMake as string || null,
            vehicleModel: extractedData.vehicleModel as string || null,
            propertyAddress: extractedData.propertyAddress as string || null,
            excessAmount: typeof extractedData.excessAmount === 'number' 
              ? extractedData.excessAmount 
              : null,
            insuranceCompanyId,
            sourceEmailId: email.id,
            sourceEmailSubject: email.subject,
            sourceEmailFrom: email.from,
            sourceEmailDate: email.emailDate,
            processingStage: "PROCESSED",
            processedBy: "AUTO",
            processedAt: new Date(),
            classificationConfidence: email.aiConfidence,
            extractionConfidence: typeof extractedData.confidenceOverall === 'number'
              ? extractedData.confidenceOverall
              : null,
          },
        });

        // Update email status
        await db.emailQueue.update({
          where: { id: email.id },
          data: {
            status: "CLAIM_CREATED",
            createdClaimId: newClaim.id,
            processedAt: new Date(),
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            action: "claim_auto_created",
            entityType: "claim",
            entityId: newClaim.id,
            details: JSON.stringify({
              claimNumber,
              emailId: email.id,
              domain: email.fromDomain,
              confidence: email.aiConfidence,
            }),
            status: "SUCCESS",
            processedBy: "AUTO",
            claimId: newClaim.id,
          },
        });

        // Record successful extraction for learning
        if (domainProfile) {
          await db.domainProfile.update({
            where: { domain: email.fromDomain },
            data: {
              successfulClaims: { increment: 1 },
              lastClaimAt: new Date(),
            },
          });
        }

        created++;
      } catch (emailError) {
        errors.push(`Failed to create claim for email ${email.id}: ${emailError}`);
        skipped++;
      }
    }

    // Create audit log for batch
    if (created > 0) {
      await db.auditLog.create({
        data: {
          action: "auto_claim_batch_completed",
          entityType: "system",
          details: JSON.stringify({ created, skipped, errors: errors.length }),
          status: errors.length > 0 ? "WARNING" : "SUCCESS",
          processedBy: "AUTO",
        },
      });
    }

    return { success: true, created, skipped, errors };
  } catch (error) {
    errors.push(`Auto-claim creation failed: ${error}`);
    return { success: false, created, skipped, errors };
  }
}

// Full automation pipeline: Fetch → Analyze → Create Claims
export async function runFullAutomationPipeline(limit: number = 50): Promise<{
  success: boolean;
  fetched: number;
  analyzed: number;
  claimsCreated: number;
  errors: string[];
}> {
  // Step 1: Fetch emails
  const fetchResult = await fetchEmails(limit);
  
  if (!fetchResult.success) {
    return {
      success: false,
      fetched: fetchResult.fetched,
      analyzed: 0,
      claimsCreated: 0,
      errors: fetchResult.errors,
    };
  }

  // Step 2: Auto-analyze
  const analyzeResult = await autoAnalyzeEmails(limit);

  // Step 3: Auto-create claims for auto-level domains
  const claimResult = await autoCreateClaims(limit);

  return {
    success: true,
    fetched: fetchResult.fetched,
    analyzed: analyzeResult.analyzed,
    claimsCreated: claimResult.created,
    errors: [...fetchResult.errors, ...analyzeResult.errors, ...claimResult.errors],
  };
}
