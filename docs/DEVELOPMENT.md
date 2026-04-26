# STEFCO Claims Dashboard - Development Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [AI Pipeline](#ai-pipeline)
6. [Learning System](#learning-system)
7. [API Reference](#api-reference)
8. [Mini-Services](#mini-services)
9. [Configuration](#configuration)
10. [Development Guide](#development-guide)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EMAIL SOURCES                             │
│                  (Insurance Companies via IMAP)                  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EMAIL POLLER SERVICE (Port 3002)              │
│  - Fetches ALL emails (read + unread)                           │
│  - Deduplicates using Message-ID headers                        │
│  - Auto-triggers AI analysis when enabled                       │
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
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LEARNING ENGINE                               │
│  - Pattern Learning per Domain                                   │
│  - Claim Number Format Learning                                  │
│  - Cross-Field Validation                                        │
│  - Negative Pattern Avoidance                                    │
│  - Bayesian Confidence Updates                                   │
│  - Prediction Tracking & Accuracy Metrics                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLAIMS DATABASE (SQLite)                      │
│  - 40+ Prisma Models                                             │
│  - Claims, Emails, Learning Patterns, Audit Logs                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | Next.js | 16.x | Full-stack React framework |
| Runtime | Bun | Latest | JavaScript runtime & package manager |
| Language | TypeScript | 5.x | Type-safe JavaScript |
| Database | SQLite | - | Embedded database |
| ORM | Prisma | 6.x | Database toolkit & ORM |
| UI Library | React | 19.x | Component library |
| UI Components | shadcn/ui | Latest | Pre-built accessible components |
| Styling | Tailwind CSS | 4.x | Utility-first CSS framework |
| Charts | Recharts | 2.x | Charting library |
| AI SDK | z-ai-web-dev-sdk | 0.0.17 | LLM & VLM integration |
| Email | imapflow | 1.3.x | IMAP client library |
| State | Zustand | 5.x | Client state management |
| Server State | TanStack Query | 5.x | Server state management |
| Forms | React Hook Form | 7.x | Form handling |
| Validation | Zod | 4.x | Schema validation |
| Icons | Lucide React | Latest | Icon library |

---

## Project Structure

```
/home/z/my-project/
├── prisma/
│   └── schema.prisma          # Database schema (40+ models)
├── src/
│   ├── app/
│   │   ├── api/               # REST API endpoints
│   │   │   ├── claims/        # Claims CRUD
│   │   │   ├── claim-feedback/# Feedback submission
│   │   │   ├── email-inbox/   # Email management
│   │   │   ├── email-poll/    # IMAP polling
│   │   │   ├── learning/      # Learning engine
│   │   │   ├── rejection-feedback/
│   │   │   ├── thread-patterns/
│   │   │   ├── attachment-analysis/
│   │   │   ├── refetch-attachments/
│   │   │   └── ...            # Other APIs
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Main SPA page
│   ├── components/
│   │   ├── layout/
│   │   │   └── app-sidebar.tsx
│   │   ├── sections/
│   │   │   ├── dashboard-section.tsx
│   │   │   ├── inbox-section.tsx
│   │   │   ├── claims-section.tsx
│   │   │   ├── learning-section.tsx
│   │   │   ├── insurance-section.tsx
│   │   │   ├── print-queue-section.tsx
│   │   │   ├── audit-log-section.tsx
│   │   │   ├── analytics-section.tsx
│   │   │   └── settings-section.tsx
│   │   ├── feedback-modal.tsx
│   │   └── ui/                # shadcn/ui components
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   ├── email-poller.ts    # IMAP email fetching
│   │   ├── attachment-extractor.ts
│   │   ├── attachment-processor.ts
│   │   ├── attachment-ai-analyzer.ts
│   │   ├── prediction-learning.ts
│   │   ├── enhanced-learning.ts
│   │   ├── extraction-patterns.ts
│   │   ├── evidence-tracker.ts
│   │   └── utils.ts
│   └── hooks/
│       └── use-toast.ts
├── mini-services/
│   └── email-poller/          # Background poller (port 3002)
├── docs/
│   ├── API.md                 # API documentation
│   └── DEVELOPMENT.md         # This file
├── db/
│   └── custom.db              # SQLite database
├── CHANGELOG.md
├── README.md
├── worklog.md
├── package.json
└── .env                       # Environment variables
```

---

## Database Schema

### Core Models

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
  claims        Claim[]
  learningPatterns LearningPattern[]
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
  claimType             String?
  incidentDate          DateTime?
  incidentDescription   String?
  vehicleRegistration   String?
  vehicleMake           String?
  vehicleModel          String?
  propertyAddress       String?
  excessAmount          Float?
  status                String   @default("NEW")
  processingStage       String   @default("INTAKE")
  classificationConfidence Float?
  extractionConfidence     Float?
  sourceEmailId        String?
  insuranceCompanyId   String?
  feedback             ClaimFeedback[]
}
```

#### EmailQueue
```prisma
model EmailQueue {
  id                String   @id @default(cuid())
  messageId         String   @unique
  subject           String?
  from              String?
  fromDomain        String?
  bodyText          String?
  bodyHtml          String?
  attachments       String?  // JSON array
  aiClassification  String?
  aiConfidence      Float?
  aiExtractedData   String?  // JSON
  status            String   @default("PENDING")
  predictions       Prediction[]
}
```

### Learning Models

#### LearningPattern
```prisma
model LearningPattern {
  id                String   @id @default(cuid())
  senderDomain      String
  fieldName         String
  patternHint       String
  exampleOriginal   String?
  exampleCorrected  String?
  confidence        Int      @default(55)
  correctionCount   Int      @default(1)
  isActive          Boolean  @default(true)
}
```

#### PredictionComparison
```prisma
model PredictionComparison {
  id                String   @id @default(cuid())
  emailQueueId      String
  claimId           String?
  senderDomain      String?
  claimType         String?
  comparisons       String   // JSON array
  totalFields       Int      @default(0)
  correctFields     Int      @default(0)
  accuracyRate      Float    @default(0)
  learningApplied   Boolean  @default(false)
}
```

#### FieldAccuracyMetric
```prisma
model FieldAccuracyMetric {
  id                String   @id @default(cuid())
  senderDomain      String
  fieldName         String
  claimType         String?
  totalPredictions  Int      @default(0)
  correctPredictions Int     @default(0)
  accuracyRate      Float    @default(0)
  recentAccuracy    Float    @default(0)
  trendDirection    String   @default("stable")
  readyForAutoClaim Boolean  @default(false)
}
```

---

## AI Pipeline

### Agent Flow

1. **Intake Agent** (`process-email/route.ts`)
   - Classifies email: NEW_CLAIM, IGNORE, MISSING_INFO, OTHER
   - Uses LLM to analyze email content
   - Returns classification with confidence score

2. **Extraction Agent** (`enhanced-extract/route.ts`)
   - Extracts structured data from email
   - Uses ensemble methods: regex, AI, template, position
   - Applies learned patterns from database

3. **Decision Agent** (`process-email/route.ts`)
   - Decides: PROCEED, REVIEW, REJECT
   - Based on confidence and completeness
   - Considers missing information

4. **Attachment Agent** (`attachment-ai-analyzer.ts`)
   - Classifies document types
   - Extracts data from PDFs/images using VLM
   - Calculates claim likelihood score

5. **Learning Agent** (`prediction-learning.ts`)
   - Stores predictions for later comparison
   - Compares predictions vs actual
   - Updates field accuracy metrics

### AI SDK Usage

```typescript
import { LLM, VLM } from 'z-ai-web-dev-sdk';

// Text-based analysis
const response = await LLM.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
});

// Image/document analysis
const visionResponse = await VLM.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Analyze this document...' },
        { type: 'image_url', image_url: { url: base64Image } }
      ]
    }
  ]
});
```

---

## Learning System

### Prediction Storage

When AI analyzes an email:
```typescript
await storePredictions(emailId, senderDomain, claimType, extractedData, confidence);
```

### Comparison Flow

When human creates/edits a claim:
```typescript
const result = await comparePredictionsVsActual(emailId, claimId, actualData);
// Returns: accuracy rate, improvements, auto-claim readiness
```

### Auto-Claim Threshold

Fields become "ready for auto-claim" when:
- 10+ predictions for that field
- 90%+ accuracy rate

### Progressive Automation Levels

| Level | Requirements | Behavior |
|-------|--------------|----------|
| MANUAL | < 10 predictions or < 70% accuracy | All emails require human review |
| SEMI_AUTO | 10+ predictions and 70%+ accuracy | AI suggests, human confirms |
| AUTO | 10+ predictions and 90%+ accuracy | Claims created automatically |

---

## API Reference

See [API.md](./API.md) for complete API documentation.

### Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/claims` | GET, POST | List/Create claims |
| `/api/claims/[id]` | GET, PUT, DELETE | Claim CRUD |
| `/api/email-inbox` | GET | List emails |
| `/api/email-inbox/bulk-archive` | POST | Bulk archive |
| `/api/email-poll` | GET, POST | Polling control |
| `/api/learning` | GET | Learning stats |
| `/api/learning?type=history` | GET | Learning history |
| `/api/claim-feedback` | POST | Submit corrections |
| `/api/rejection-feedback` | POST | Rejection feedback |
| `/api/attachment-analysis` | POST | Analyze attachments |

---

## Mini-Services

### Email Poller Service (Port 3002)

Located in `mini-services/email-poller/`

**Endpoints:**
- `GET /health` - Health check
- `POST /trigger` - Manual poll trigger

**Start:**
```bash
cd mini-services/email-poller
bun run dev
```

**Configuration:**
The service reads IMAP settings from the main database's `system_config` table.

---

## Configuration

### Environment Variables

```env
DATABASE_URL="file:./db/custom.db"
ZAI_API_KEY="your-zai-api-key"
```

### System Configuration (Database)

```sql
-- IMAP Settings
INSERT INTO system_config (key, value) VALUES 
  ('IMAP_HOST', 'imap.provider.com'),
  ('IMAP_PORT', '993'),
  ('IMAP_USER', 'email@domain.com'),
  ('IMAP_PASSWORD', 'encrypted-password'),
  ('IMAP_SSL', 'true');

-- AI Settings
INSERT INTO system_config (key, value) VALUES
  ('AUTO_ANALYZE', 'true'),
  ('AUTO_CLAIM_CREATION', 'false');
```

---

## Development Guide

### Getting Started

```bash
# Install dependencies
bun install

# Setup database
bun run db:push

# Start development server
bun run dev

# Start email poller
cd mini-services/email-poller && bun run dev
```

### Development Scripts

```bash
bun run dev        # Start dev server (port 3000)
bun run build      # Production build
bun run lint       # ESLint check
bun run db:push    # Push schema changes
bun run db:generate # Generate Prisma client
```

### Adding New Features

1. **New API Endpoint:**
   - Create `src/app/api/[endpoint]/route.ts`
   - Implement GET/POST/PUT/DELETE handlers
   - Add to API.md documentation

2. **New UI Section:**
   - Create `src/components/sections/[name]-section.tsx`
   - Add to `src/app/page.tsx` routing
   - Add navigation in `src/components/layout/app-sidebar.tsx`

3. **New Database Model:**
   - Add to `prisma/schema.prisma`
   - Run `bun run db:push`
   - Update TypeScript interfaces

4. **New AI Agent:**
   - Create in `src/lib/`
   - Use `z-ai-web-dev-sdk` for LLM/VLM calls
   - Integrate with existing pipeline

### Code Style

- TypeScript strict mode
- ESLint for linting
- Prefer existing shadcn/ui components
- Use server-side AI processing only
- Handle errors with try/catch and user-friendly messages

### Testing

Currently, the project relies on manual testing via the UI. Future versions will include:
- Unit tests with Vitest
- Integration tests for API endpoints
- E2E tests with Playwright

---

## Troubleshooting

### Common Issues

1. **Dev server not starting:**
   - Check if port 3000 is already in use
   - Run `pkill -f "next dev"` to kill existing processes

2. **Database errors:**
   - Run `bun run db:push` to sync schema
   - Check `DATABASE_URL` in `.env`

3. **AI not working:**
   - Verify `ZAI_API_KEY` is set
   - Check API quota/limits

4. **Email polling not working:**
   - Verify IMAP settings in database
   - Check email poller service is running (port 3002)

### Debug Logging

The application logs to:
- `dev.log` - Development server output
- `server.log` - Production server output
- Console - Application logs

---

## Contributing

1. Create feature branch from `main`
2. Make changes with tests
3. Update documentation (CHANGELOG.md, API.md, etc.)
4. Submit pull request

---

*Last updated: 2025-04-27 (v2.5.0)*
