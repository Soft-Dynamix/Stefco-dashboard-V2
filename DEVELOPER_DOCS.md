# STEFCO Claims Dashboard - Developer Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Mini-Services Architecture](#mini-services-architecture)
3. [Database Schema](#database-schema)
4. [AI Pipeline](#ai-pipeline)
5. [Learning System](#learning-system)
6. [API Reference](#api-reference)
7. [Component Guide](#component-guide)
8. [Configuration](#configuration)
9. [Testing & Debugging](#testing--debugging)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EMAIL SOURCES                             │
│                  (Insurance Companies via IMAP)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL POLLER SERVICE (Port 3002)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ IMAP Fetch   │→ │ Deduplication│→ │ Domain Detect│          │
│  │ (ALL emails) │  │ (Message-ID) │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Features:                                                       │
│  - Fetches ALL emails (read + unread)                           │
│  - Deduplicates using Message-ID header                         │
│  - Auto-triggers AI analysis when enabled                       │
│  - Runs every minute (configurable)                             │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EMAIL QUEUE (DB)                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ status: PENDING → AI_ANALYZED → USER_REVIEWING → ...    │   │
│  │         ↓                                                 │   │
│  │         IGNORED (with feedback for learning)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MULTI-AGENT AI PIPELINE                      │
│                                                                  │
│  ┌────────────┐   ┌────────────┐   ┌────────────┐              │
│  │  INTAKE    │→  │ EXTRACTION │→  │  DECISION  │              │
│  │   AGENT    │   │   AGENT    │   │   AGENT    │              │
│  │            │   │            │   │            │              │
│  │ Classify:  │   │ Extract:   │   │ Decide:    │              │
│  │ NEW_CLAIM  │   │ - Claim #  │   │ PROCEED    │              │
│  │ IGNORE     │   │ - Name     │   │ REVIEW     │              │
│  │ OTHER      │   │ - Vehicle  │   │ REJECT     │              │
│  └────────────┘   └────────────┘   └────────────┘              │
│        │                │                │                      │
│        └────────────────┴────────────────┘                      │
│                         │                                        │
│                         ▼                                        │
│              ┌─────────────────────┐                            │
│              │  ENSEMBLE ENGINE    │                            │
│              │  - Regex patterns   │                            │
│              │  - AI extraction    │                            │
│              │  - Template match   │                            │
│              │  - Position-based   │                            │
│              └─────────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      USER REVIEW QUEUE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Email + AI Suggestion → User Confirms/Corrects         │   │
│  │                                                          │   │
│  │  Actions:                                                │   │
│  │  - Create Claim (accepts AI suggestion)                 │   │
│  │  - Ignore with Reason (triggers learning)               │   │
│  │  - Re-analyze (requests fresh AI analysis)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEARNING ENGINE                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Patterns   │  │  Templates   │  │  Weights     │          │
│  │  Learning    │  │  Detection   │  │  Updates     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Negative   │  │   Cross-     │  │   Active     │          │
│  │   Patterns   │  │   Field      │  │   Learning   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLAIMS DATABASE                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Claims + Feedback + Patterns + Audit Logs              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Progressive Automation Model

```
┌─────────────────────────────────────────────────────────────────┐
│                   AUTOMATION PROGRESSION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Level 0: MANUAL                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ All emails require human review and data entry         │    │
│  │ Confidence: 0-50% | Accuracy: Unknown                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                        │
│                         ▼ (5+ correct extractions)               │
│                                                                  │
│  Level 1: SEMI-AUTO                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ AI suggests values, human confirms                      │    │
│  │ Confidence: 50-75% | Accuracy: 75%+                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                         │                                        │
│                         ▼ (10+ correct extractions, 90%+ acc)    │
│                                                                  │
│  Level 2: AUTO                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Claims created automatically, sampled for QA            │    │
│  │ Confidence: 75-95% | Accuracy: 90%+                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mini-Services Architecture

The STEFCO Dashboard uses a microservices-like architecture with independent services:

### Service Overview

| Service | Port | Purpose | Entry Point |
|---------|------|---------|-------------|
| Main App | 3000 | Next.js Application | `node_modules/.bin/next dev` |
| Dev Server | 3001 | Process Manager + Health Checks | `mini-services/dev-server/index.ts` |
| Email Poller | 3002 | IMAP Polling + Auto-Analysis | `mini-services/email-poller/index.ts` |
| Chat Service | 3003 | Real-time WebSocket Messaging | `mini-services/chat-service/index.ts` |

### Email Poller Service (Port 3002)

**Location**: `mini-services/email-poller/`

**Responsibilities**:
- Connects to IMAP server every minute
- Fetches ALL emails (not just unread)
- Deduplicates using Message-ID headers
- Triggers auto-analysis when enabled
- Updates email queue status

**Key Features**:
```typescript
// Fetch ALL emails with deduplication
const messages = await client.fetch(range, { source: true, envelope: true });

// Check for duplicates before inserting
const existing = await db.emailQueue.findUnique({
  where: { messageId: emailData.messageId },
});

if (existing) continue; // Skip duplicate
```

**API Endpoints**:
- `GET /health` - Service status and config
- `GET /trigger` - Manual poll trigger

**Configuration** (read from main app):
```typescript
interface PollerConfig {
  enabled: boolean;        // EMAIL_POLLER_ENABLED
  interval: number;        // AUTO_POLL_INTERVAL (minutes)
  autoAnalyze: boolean;    // AUTO_ANALYZE_ENABLED
  autoClaim: boolean;      // AUTO_CLAIM_CREATION_ENABLED
}
```

### Chat Service (Port 3003)

**Location**: `mini-services/chat-service/`

**Responsibilities**:
- Provides real-time WebSocket communication
- Manages user sessions for live chat
- Broadcasts messages to all connected clients
- Tracks online users

**Key Features**:
```typescript
// Socket.io server with CORS support
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// User management
socket.on('join', (data) => {
  users.set(socket.id, { id: socket.id, username: data.username });
  io.emit('user-joined', { user, message: joinMessage });
});

// Message broadcasting
socket.on('message', (data) => {
  io.emit('message', createUserMessage(username, content));
});
```

**API Events**:
- `join` - User joins chat room
- `message` - Send message to all users
- `disconnect` - User leaves chat room

**Frontend Connection**:
```typescript
// Connect via Caddy gateway
const socket = io('/?XTransformPort=3003', {
  transports: ['websocket', 'polling']
});
```

### Dev Server (Port 3001)

**Location**: `mini-services/dev-server/`

**Responsibilities**:
- Starts Next.js dev server
- Starts Email Poller Service
- Provides unified health checks
- Handles graceful shutdown

**Starting Services**:
```bash
cd mini-services/dev-server && bun run dev
```

This automatically starts:
1. Next.js on port 3000
2. Email Poller on port 3002
3. Health check server on port 3001

---

## Database Schema

### Core Tables

#### InsuranceCompany
```prisma
model InsuranceCompany {
  id            String   @id @default(cuid())
  name          String   @unique
  shortName     String?
  folderName    String
  senderDomains String?  // JSON array
  contactEmail  String?
  contactPhone  String?
  isActive      Boolean  @default(true)
  
  // Relations
  claims              Claim[]
  learningPatterns    LearningPattern[]
  extractionPatterns  ExtractionPattern[]
  classificationKnowledge ClassificationKnowledge[]
}
```

#### Claim
```prisma
model Claim {
  id                    String   @id @default(cuid())
  claimNumber           String   @unique
  clientName            String?
  clientEmail           String?
  clientPhone           String?
  claimType             String?  // MOTOR, PROPERTY, LIABILITY, etc.
  incidentDate          DateTime?
  incidentDescription   String?
  vehicleRegistration   String?
  vehicleMake           String?
  vehicleModel          String?
  propertyAddress       String?
  excessAmount          Float?
  status                String   @default("NEW")
  processingStage       String   @default("INTAKE")
  
  // AI confidence scores
  classificationConfidence Float?
  extractionConfidence     Float?
  
  // Source tracking
  sourceEmailId        String?
  sourceEmailSubject   String?
  sourceEmailFrom      String?
  sourceEmailDate      DateTime?
  
  // Relationships
  insuranceCompanyId   String?
  insuranceCompany     InsuranceCompany? @relation(...)
  
  // Processing metadata
  processedBy          String?  // AUTO or user ID
  processedAt          DateTime?
  reviewedBy           String?
  reviewedAt           DateTime?
}
```

#### EmailQueue
```prisma
model EmailQueue {
  id                String   @id @default(cuid())
  messageId         String   @unique  // SHA-256 hash or IMAP Message-ID
  
  // Email content
  subject           String?
  from              String?
  fromDomain        String?
  bodyText          String?
  bodyHtml          String?
  attachments       String?  // JSON
  
  // AI analysis
  aiClassification  String?
  aiConfidence      Float?
  aiReasoning       String?
  aiExtractedData   String?  // JSON
  
  // Processing status
  status            String   @default("PENDING")
  processingRoute   String?
  
  // Learning hints
  learningHintsCount Int     @default(0)
  
  // Result tracking
  createdClaimId    String?
  ignoreReason      String?
  ignoreCategory    String?
  processedAt       DateTime?
  emailDate         DateTime?
  receivedAt        DateTime @default(now())
}
```

### Learning Tables

#### RejectionFeedback
```prisma
model RejectionFeedback {
  id                String   @id @default(cuid())
  emailQueueId      String
  
  // Classification at time of rejection
  originalClassification  String?
  originalConfidence     Float?
  
  // Why it was rejected
  rejectionCategory String   // duplicate, follow_up, spam, marketing, etc.
  rejectionReason   String?
  
  // Thread detection
  isFollowUp        Boolean  @default(false)
  relatedClaimId    String?
  threadSubject     String?
  
  // Learning hints
  suggestedRule     String?
  applyToSender     Boolean  @default(false)
  
  // Metadata
  emailSubject      String?
  emailFrom         String?
  emailFromDomain   String?
}
```

#### SenderIgnoreRule
```prisma
model SenderIgnoreRule {
  id            String   @id @default(cuid())
  senderDomain  String
  category      String   // spam, marketing, duplicate, etc.
  reason        String?
  ignoreCount   Int      @default(1)
  appliedCount  Int      @default(0)
  isActive      Boolean  @default(true)
  autoIgnore    Boolean  @default(false)  // After 3+ ignores
  lastAppliedAt DateTime?
  
  @@unique([senderDomain, category])
}
```

#### ThreadPattern
```prisma
model ThreadPattern {
  id                String   @id @default(cuid())
  senderDomain      String
  subjectPrefix     String?  // e.g., "Re:", "FWD:"
  normalizedSubject String?
  
  followUpCount     Int      @default(0)
  newClaimCount     Int      @default(0)
  isFollowUpProbability Float @default(0)
  
  @@unique([senderDomain, normalizedSubject])
}
```

---

## AI Pipeline

### Agent 1: Intake Agent (Classification)

**Purpose**: Determine if email is a new claim appointment

**Prompt Structure**:
```
You are the Intake Agent for Stefco Consultants Insurance Claims.

Classify into:
- NEW_CLAIM: New claim assessment/appointment request
- IGNORE: Spam, marketing, out-of-office, irrelevant
- MISSING_INFO: Related but lacks essential info
- OTHER: Unclear or miscellaneous

Indicators of NEW_CLAIM:
- "New assessment", "New appointment", "NUWE EIS"
- "You are appointed"
- Attachments related to claims
- Insurance company correspondence

Rules:
- Only mark NEW_CLAIM with clear evidence
- If unsure, return OTHER
```

**Output**:
```json
{
  "classification": "NEW_CLAIM",
  "confidence": 85,
  "reasoning": "Email from Santam with claim reference and vehicle details"
}
```

### Agent 2: Extraction Agent

**Purpose**: Extract structured claim data

**Methods**:

1. **Ensemble Extraction** (enhanced-extract API):
```typescript
const result = await ensembleExtract(text, "claimNumber", insuranceCompanyId);
// Combines: regex, AI, template, position methods
// Returns: { value, confidence, contributingMethods }
```

2. **AI Extraction** (LLM-based):
```
Extract the following fields:
- claimNumber: Main claim reference
- clientName: Client/claimant name
- claimType: MOTOR, PROPERTY, LIABILITY, etc.
- vehicleRegistration: Vehicle reg (if motor)
- excessAmount: Excess amount
```

3. **Attachment Extraction** (VLM-based):
```typescript
const result = await extractFromAttachment(attachment, insuranceCompanyId);
// Uses VLM to read claim documents from images
```

### Agent 3: Decision Agent

**Purpose**: Decide if claim can be processed automatically

**Decision Logic**:
```typescript
if (claimNumberConfidence >= 70 && overallConfidence >= 75) {
  return "PROCEED"; // Create claim automatically
} else if (claimNumberConfidence >= 50) {
  return "REVIEW"; // Send to review queue
} else {
  return "REJECT"; // Missing critical fields
}
```

---

## Learning System

### Pattern Learning Flow

```typescript
// 1. User creates/edits claim
await createClaim(claimData);

// 2. System learns from each field
for (const field of filledFields) {
  await learnExtractionPattern(
    insuranceCompanyId,
    field,
    originalValue,
    correctedValue,
    sourceText
  );
}

// 3. Learn claim number format
await learnClaimNumberFormat(companyId, claimNumber);

// 4. Update sender pattern accuracy
await updateSenderAccuracy(domain, wasCorrect);

// 5. Learn field relationships
await learnFieldRelationship(companyId, primaryField, primaryValue, dependentField, dependentValue);
```

### Rejection Feedback Learning

When a user clicks "Ignore with Reason":

```typescript
// 1. Store structured feedback
await db.rejectionFeedback.create({
  data: {
    emailQueueId,
    rejectionCategory,  // follow_up, duplicate, spam, etc.
    rejectionReason,
    isFollowUp,
    applyToSender,
    suggestedRule,
  }
});

// 2. Update email status
await db.emailQueue.update({
  where: { id: emailQueueId },
  data: {
    status: "IGNORED",
    ignoreReason: rejectionReason,
    ignoreCategory: rejectionCategory,
  }
});

// 3. Create sender ignore rule (if applyToSender)
if (applyToSender) {
  await db.senderIgnoreRule.upsert({
    where: { senderDomain_category: { senderDomain, category } },
    create: { senderDomain, category, reason },
    update: { ignoreCount: { increment: 1 } }
  });
}

// 4. Enable auto-ignore after 3+ ignores
if (ignoreCount >= 3) {
  await db.senderIgnoreRule.update({
    data: { autoIgnore: true }
  });
}
```

### Ensemble Extraction

```typescript
export async function ensembleExtract(
  text: string,
  field: ExtractableField,
  insuranceCompanyId: string | null
): Promise<EnsembleResult> {
  // Get confidence weights
  const weights = await getConfidenceWeights(insuranceCompanyId, field);
  
  // Run all methods
  const results = [
    await extractWithRegex(text, field, insuranceCompanyId),
    await extractWithTemplate(text, field, insuranceCompanyId),
    await extractWithPosition(text, field, insuranceCompanyId),
  ];
  
  // Combine with weighted voting
  const valueGroups = groupByNormalizedValue(results);
  
  // Return highest weighted value
  return getBestValue(valueGroups);
}
```

---

## API Reference

### Email Polling API

#### Get Polling Status
```http
GET /api/email-poll

Response:
{
  "isConfigured": true,
  "lastPoll": "2025-04-23T08:00:00Z",
  "totalQueued": 5,
  "schedulerEnabled": true,
  "pollInterval": 5,
  "autoAnalyzeEnabled": true,
  "autoClaimCreationEnabled": false
}
```

#### Trigger Manual Poll
```http
POST /api/email-poll
Content-Type: application/json

{
  "limit": 50,
  "autoAnalyze": true,
  "fullPipeline": false
}

Response:
{
  "success": true,
  "message": "Fetched 5 emails, analyzed 5",
  "fetched": 5,
  "analyzed": 5,
  "errors": []
}
```

#### Analyze Pending Emails
```http
PUT /api/email-poll
Content-Type: application/json

{
  "limit": 50,
  "createClaims": false
}

Response:
{
  "success": true,
  "message": "Analyzed 10 pending emails",
  "analyzed": 10,
  "errors": []
}
```

### Rejection Feedback API

#### Submit Feedback
```http
POST /api/rejection-feedback
Content-Type: application/json

{
  "emailQueueId": "email-id",
  "rejectionCategory": "follow_up",
  "rejectionReason": "This is a reply to an existing claim",
  "isFollowUp": true,
  "relatedClaimId": "CLM-2024-001",
  "applyToSender": true,
  "suggestedRule": "Ignore 'Re:' emails from this sender"
}

Response:
{
  "success": true,
  "feedback": {
    "id": "feedback-id",
    "emailQueueId": "email-id",
    "rejectionCategory": "follow_up",
    ...
  }
}
```

#### Get Feedback History
```http
GET /api/rejection-feedback?domain=santam.co.za&category=follow_up&limit=50

Response:
[
  {
    "id": "feedback-id",
    "rejectionCategory": "follow_up",
    "emailSubject": "RE: Claim STM-2024-001",
    "emailFrom": "claims@santam.co.za",
    "createdAt": "2025-04-23T08:00:00Z"
  },
  ...
]
```

### Claims API

#### Create Claim
```http
POST /api/claims
Content-Type: application/json

{
  "claimNumber": "STM-2024-12345",
  "clientName": "John Smith",
  "claimType": "MOTOR",
  "vehicleRegistration": "CA123456",
  "insuranceCompanyId": "company-id",
  "sourceEmailId": "email-id"
}
```

**Triggers**:
- Pattern learning for each field
- Claim number format learning
- Domain-to-company linking
- Sender pattern update

### Settings API

#### Get Settings
```http
GET /api/settings

Response:
{
  "IMAP_HOST": "mail.stefco-assess.co.za",
  "IMAP_PORT": "993",
  "IMAP_USER": "admin@stefco-assess.co.za",
  "IMAP_SSL": "true",
  "EMAIL_POLLER_ENABLED": "true",
  "AUTO_ANALYZE_ENABLED": "true",
  "AUTO_CLAIM_CREATION_ENABLED": "false",
  "AUTO_POLL_INTERVAL": "5"
}
```

#### Update Settings
```http
POST /api/settings
Content-Type: application/json

{
  "AUTO_ANALYZE_ENABLED": "true",
  "AUTO_POLL_INTERVAL": "10"
}
```

---

## Component Guide

### Main Sections

```tsx
// src/app/page.tsx
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState("dashboard");
  
  return (
    <div className="flex h-screen">
      <AppSidebar activeSection={activeSection} onNavigate={setActiveSection} />
      <main className="flex-1 overflow-auto">
        {activeSection === "dashboard" && <DashboardSection />}
        {activeSection === "inbox" && <InboxSection />}
        {activeSection === "claims" && <ClaimsSection />}
        {activeSection === "learning" && <LearningSection />}
        {activeSection === "insurance" && <InsuranceSection />}
        {activeSection === "analytics" && <AnalyticsSection />}
        {activeSection === "settings" && <SettingsSection />}
        {activeSection === "domains" && <DomainSuggestionsSection />}
      </main>
    </div>
  );
}
```

### InboxSection

**Features**:
- Email queue list with status badges
- AI classification display with confidence
- Claim creation form
- Feedback modal for rejections
- Follow-up detection indicators
- Manual poll button
- Auto-analyze status display

**Key Functions**:
```typescript
// Poll emails from IMAP
const pollEmailsNow = async () => {
  await fetch("/api/email-poll", { method: "POST", body: JSON.stringify({ limit: 50 }) });
};

// Analyze pending emails
const analyzePendingEmails = async () => {
  await fetch("/api/email-poll", { method: "PUT", body: JSON.stringify({ limit: 50 }) });
};

// Submit rejection feedback
const handleRejectionFeedback = async (feedback: RejectionFeedbackData) => {
  await fetch("/api/rejection-feedback", { method: "POST", body: JSON.stringify(feedback) });
};
```

### FeedbackModal

**Purpose**: Collect structured feedback when user ignores an email

**Categories**:
- `follow_up` - Reply to existing claim
- `duplicate` - Already processed
- `not_a_claim` - General correspondence
- `spam` - Junk email
- `marketing` - Promotional content
- `wrong_sender` - Personal address
- `already_processed` - Previously handled
- `test_email` - Test/development
- `other` - Specify in reason field

**Learning Features**:
- Auto-suggests follow-up based on subject (Re:, FWD:)
- Creates ignore rules for sender if selected
- Auto-enables auto-ignore after 3+ same-category ignores

### LearningSection

**Tabs**:
- **Patterns**: Learning patterns by sender
- **Senders**: Sender profiles with automation levels
- **Knowledge**: Classification knowledge base
- **Ignore Rules**: Auto-ignore patterns
- **Rejection Feedback**: Structured feedback history
- **Thread Detection**: Follow-up patterns

### SettingsSection

**Tabs**:
- **AI Provider**: Configure AI settings
- **Email (IMAP)**: IMAP server configuration
- **Email (SMTP)**: SMTP for sending emails
- **System**: 
  - Auto-Poll toggle
  - Poll interval (minutes)
  - Auto-Analyze toggle
  - Auto-Claim Creation toggle
  - Auto-Print toggle

---

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# AI Provider (z-ai-web-dev-sdk)
ZAI_API_KEY="your-api-key"

# Optional: Can be set in Settings UI instead
IMAP_HOST="mail.provider.com"
IMAP_PORT="993"
IMAP_USER="email@domain.com"
IMAP_PASSWORD="password"
```

### System Config (Database)

Settings stored in `SystemConfig` table:

| Key | Description | Default |
|-----|-------------|---------|
| `IMAP_HOST` | IMAP server hostname | - |
| `IMAP_PORT` | IMAP port | 993 |
| `IMAP_USER` | IMAP username | - |
| `IMAP_PASSWORD` | IMAP password | - |
| `IMAP_SSL` | Use SSL | true |
| `EMAIL_POLLER_ENABLED` | Enable auto-polling | false |
| `AUTO_POLL_INTERVAL` | Poll interval (minutes) | 5 |
| `AUTO_ANALYZE_ENABLED` | Enable auto-analysis | false |
| `AUTO_CLAIM_CREATION_ENABLED` | Enable auto-claim creation | false |
| `AUTO_PRINT_ENABLED` | Enable auto-printing | false |

---

## Testing & Debugging

### Manual Email Classification Test

```bash
curl -X POST http://localhost:3000/api/process-email \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "New Claim - STM-2024-12345",
    "from": "claims@santam.co.za",
    "bodyText": "Dear Sir/Madam, We hereby appoint you to assess..."
  }'
```

### Test Email Poller

```bash
# Check poller health
curl http://localhost:3002/health

# Trigger manual poll
curl http://localhost:3002/trigger

# Check main app health
curl http://localhost:3001/health
```

### Test Rejection Feedback

```bash
# Get an email ID
EMAIL_ID=$(curl -s "http://localhost:3000/api/email-inbox?status=AI_ANALYZED&limit=1" | jq -r '.emails[0].id')

# Submit feedback
curl -X POST http://localhost:3000/api/rejection-feedback \
  -H "Content-Type: application/json" \
  -d "{
    \"emailQueueId\": \"$EMAIL_ID\",
    \"rejectionCategory\": \"follow_up\",
    \"rejectionReason\": \"Test feedback\",
    \"isFollowUp\": true,
    \"applyToSender\": false
  }"
```

### View Learning Stats

```bash
curl http://localhost:3000/api/learning?type=stats
```

---

## Troubleshooting

### Common Issues

#### 1. Emails Not Being Fetched

**Symptoms**: Inbox stays empty, "No pending emails" message

**Solutions**:
1. Check IMAP configuration in Settings
2. Verify credentials and SSL settings
3. Check if Email Poller service is running:
   ```bash
   curl http://localhost:3002/health
   ```
4. Check main app logs:
   ```bash
   tail -f /home/z/my-project/dev.log
   ```

#### 2. Auto-Analyze Not Working

**Symptoms**: Emails fetched but not analyzed despite setting enabled

**Solutions**:
1. Verify `AUTO_ANALYZE_ENABLED` is "true" in settings
2. Ensure Email Poller service is running
3. Trigger manual analysis:
   ```bash
   curl -X PUT http://localhost:3000/api/email-poll \
     -H "Content-Type: application/json" \
     -d '{"limit": 50}'
   ```

#### 3. Feedback Submission Fails

**Symptoms**: "Failed to submit feedback" error

**Solutions**:
1. Check server logs for details
2. Verify Prisma client is synced:
   ```bash
   bunx prisma generate
   ```
3. Ensure email ID is valid and not already ignored

#### 4. Duplicate Emails Appearing

**Symptoms**: Same email appears multiple times

**Solutions**:
1. This was fixed - emails are now deduplicated by Message-ID
2. Clear duplicates from database if needed:
   ```sql
   DELETE FROM email_queue WHERE id NOT IN (
     SELECT MIN(id) FROM email_queue GROUP BY messageId
   );
   ```

#### 5. Low Extraction Confidence

**Symptoms**: AI extracts data with low confidence scores

**Solutions**:
1. Add company-specific extraction patterns
2. Verify claim number formats are seeded
3. Link sender domain to insurance company
4. Provide feedback on incorrect extractions

#### 6. Automation Level Not Progressing

**Symptoms**: Sender stays at "manual" level

**Solutions**:
1. Need 5+ correct extractions for semi-auto
2. Need 10+ correct extractions with 90%+ accuracy for auto
3. Check sender pattern stats in Learning section

### Service Management

#### Start All Services
```bash
cd /home/z/my-project/mini-services/dev-server && bun run dev
```

#### Start Email Poller Only
```bash
cd /home/z/my-project/mini-services/email-poller && bun run dev
```

#### Check Running Services
```bash
ps aux | grep bun
```

---

## Performance Optimization

### Database Indexes

```sql
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_company ON claims(insuranceCompanyId);
CREATE INDEX idx_email_status ON email_queue(status);
CREATE INDEX idx_email_domain ON email_queue(fromDomain);
CREATE INDEX idx_email_message_id ON email_queue(messageId);
CREATE INDEX idx_patterns_company_field ON extraction_patterns(insuranceCompanyId, fieldType);
```

### Caching Strategy

- Learning patterns cached per domain
- Confidence weights cached per company/field
- Template fingerprints cached for matching
- IMAP connection reused within poll cycle

### Batch Processing

```typescript
// Process emails in batches
const emails = await fetchEmails(50);
await Promise.all(emails.map(processEmail));

// Rate limit AI calls
await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
```

---

## Future Enhancements

1. **PDF Processing** - Add PDF text extraction for attachments
2. **OCR for Scanned Docs** - Integrate OCR service for images
3. **Multi-language Support** - Afrikaans, Zulu, etc.
4. **Mobile App** - React Native companion
5. **API Integrations** - Direct insurance company APIs
6. **Advanced Analytics** - ML-based insights
7. **Workflow Automation** - Custom claim flows
8. **Email Sending** - Automated responses via SMTP
9. **Calendar Integration** - Appointment scheduling
10. **Reporting** - PDF/Excel report generation

---

*Last Updated: April 2025*
