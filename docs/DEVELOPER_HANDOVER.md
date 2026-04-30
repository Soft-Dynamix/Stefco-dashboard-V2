# STEFCO Claims Dashboard - Developer Handover Document

**Version:** 2.5.0  
**Date:** 2025-04-27  
**Author:** AI Development Team  
**Project:** STEFCO Claims Dashboard

---

## Executive Summary

STEFCO Claims Dashboard is a comprehensive AI-powered insurance claims processing system designed for South African insurance companies. The system automatically processes claim emails, extracts claim details using AI/LLM technology, and continuously learns from user corrections to improve accuracy over time.

### Key Metrics
- **Total API Endpoints:** 30+
- **Database Models:** 40+
- **AI Agents:** 8 active agents
- **Insurance Companies Supported:** 40+ South African insurers
- **Learning Records:** 119+ records captured

---

## 1. Project Architecture

### 1.1 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Next.js (App Router) | 16.1.3 |
| Runtime | Bun | Latest |
| Language | TypeScript | 5.x |
| Database | SQLite with Prisma ORM | Latest |
| UI Library | React | 19.x |
| UI Components | shadcn/ui (New York style) | Latest |
| Styling | Tailwind CSS | 4.x |
| AI SDK | z-ai-web-dev-sdk | Latest |
| Email Processing | imapflow | Latest |
| PDF Processing | pdf-parse, pdfjs-dist | Latest |

### 1.2 Project Structure

```
/home/z/my-project/
├── src/
│   ├── app/
│   │   ├── api/                    # REST API routes
│   │   │   ├── attachment-analysis/    # AI document analysis
│   │   │   ├── claims/                 # Claims CRUD
│   │   │   ├── claim-feedback/         # Field corrections
│   │   │   ├── dashboard/              # Dashboard stats
│   │   │   ├── domain-suggestions/     # Domain-to-company mapping
│   │   │   ├── email-inbox/            # Email management
│   │   │   ├── email-poll/             # IMAP polling
│   │   │   ├── enhanced-extract/       # Ensemble extraction
│   │   │   ├── extraction-patterns/    # Pattern management
│   │   │   ├── insurance/              # Insurance companies
│   │   │   ├── learning/               # Learning engine
│   │   │   ├── process-email/          # Email classification
│   │   │   ├── rejection-feedback/     # Rejection handling
│   │   │   ├── refetch-attachments/    # Attachment refetch
│   │   │   └── thread-patterns/        # Follow-up detection
│   │   ├── layout.tsx              # Root layout with sidebar
│   │   └── page.tsx                # Single-page application
│   ├── components/
│   │   ├── layout/                 # App sidebar, navigation
│   │   ├── sections/               # Main UI sections
│   │   │   ├── dashboard-section.tsx
│   │   │   ├── inbox-section.tsx
│   │   │   ├── claims-section.tsx
│   │   │   ├── learning-section.tsx
│   │   │   ├── insurance-section.tsx
│   │   │   ├── analytics-section.tsx
│   │   │   ├── settings-section.tsx
│   │   │   └── print-queue-section.tsx
│   │   ├── feedback-modal.tsx      # Rejection feedback UI
│   │   ├── pdf-viewer.tsx          # PDF display component
│   │   └── ui/                     # shadcn/ui components
│   └── lib/
│       ├── db.ts                   # Prisma client singleton
│       ├── email-poller.ts         # IMAP email fetching
│       ├── attachment-extractor.ts # MIME parsing
│       ├── attachment-processor.ts # VLM processing
│       ├── attachment-ai-analyzer.ts # Document analysis
│       ├── attachment-intelligence.ts # Extraction patterns
│       ├── extraction-patterns.ts  # Pattern matching utilities
│       ├── enhanced-learning.ts    # Learning engine core
│       └── utils.ts                # Utility functions
├── prisma/
│   └── schema.prisma               # Database schema (40+ models)
├── db/
│   └── custom.db                   # SQLite database file
├── mini-services/
│   └── email-poller/               # Background polling service
├── docs/
│   ├── API.md                      # API documentation
│   └── DEVELOPER_HANDOVER.md       # This document
├── worklog.md                      # Development history
├── README.md                       # Project overview
├── CHANGELOG.md                    # Version history
├── Caddyfile                       # Gateway configuration
└── package.json                    # Dependencies
```

---

## 2. Core Systems

### 2.1 Email Processing Pipeline

**Flow:**
```
IMAP Server → Email Poller → Email Queue → AI Classification → Claim/Ignore → Learning
```

**Key Files:**
- `src/lib/email-poller.ts` - IMAP connection, email fetching, decoding
- `src/app/api/email-poll/route.ts` - Manual poll trigger
- `src/app/api/process-email/route.ts` - AI classification
- `src/app/api/email-inbox/route.ts` - Queue management

**Important Details:**
- Emails are deduplicated using Message-ID headers
- Quoted-printable and base64 encoding handled automatically
- Attachment content stored as base64 for AI analysis
- Password-protected PDFs handled gracefully with user notification

### 2.2 AI Analysis System

**Multi-Agent Pipeline:**
1. **Classification Agent** - Determines if email is a new claim, follow-up, spam, etc.
2. **Extraction Agent** - Extracts claim number, policy holder, vehicle details
3. **Document Agent** - Classifies and extracts from attachments
4. **Decision Agent** - Determines confidence and recommends actions

**Key Files:**
- `src/lib/attachment-ai-analyzer.ts` - Document classification & extraction
- `src/lib/attachment-processor.ts` - VLM-based processing
- `src/lib/attachment-intelligence.ts` - Pattern matching
- `src/app/api/enhanced-extract/route.ts` - Ensemble extraction

**AI Models Used:**
- LLM for text analysis and classification
- VLM for image/PDF document analysis

### 2.3 Learning Engine

**Learning Types:**
1. **Classification Knowledge** - When AI classification is corrected
2. **Ignore Rules** - Auto-ignore patterns for non-claim emails
3. **Thread Patterns** - Follow-up email detection
4. **Domain Profiles** - Sender domain intelligence
5. **Field Predictions** - Field extraction accuracy tracking

**Key Files:**
- `src/lib/enhanced-learning.ts` - Core learning engine
- `src/app/api/learning/route.ts` - Learning stats and history
- `src/app/api/rejection-feedback/route.ts` - Feedback collection
- `src/app/api/thread-patterns/route.ts` - Follow-up detection

**Learning Flow:**
```
User Correction → Feedback API → Pattern Creation → Storage → Next Email (Improved)
```

### 2.4 Claims Management

**Features:**
- Full CRUD operations
- Status workflow (New → Processing → Reviewed → Finalized)
- Bulk operations support
- Print queue integration
- Audit logging

**Key Files:**
- `src/app/api/claims/route.ts` - Claims API
- `src/components/sections/claims-section.tsx` - Claims UI
- `src/app/api/claim-feedback/route.ts` - Field corrections

---

## 3. Database Schema

### 3.1 Core Models

```prisma
// Primary entities
model Claim { ... }           // Central claim record
model EmailQueue { ... }      // Emails awaiting processing
model InsuranceCompany { ... } // Insurance company registry
model Prediction { ... }      // AI predictions

// Learning models
model LearningPattern { ... }       // Extraction patterns per sender
model ClassificationKnowledge { ... } // Classification corrections
model SenderPattern { ... }         // Aggregated sender statistics
model SenderIgnoreRule { ... }      // Auto-ignore rules
model ThreadPattern { ... }         // Follow-up detection
model DomainProfile { ... }         // Domain intelligence
model RejectionFeedback { ... }     // Email rejection history
model PredictionComparison { ... }  // Prediction vs actual tracking
```

### 3.2 Database Operations

```bash
# Push schema changes
bun run db:push

# View database
# Use Prisma Studio or SQLite tools

# Database location
db/custom.db
```

---

## 4. API Reference

### 4.1 Email Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/email-inbox` | List queued emails (paginated) |
| GET | `/api/email-inbox/[id]` | Get email details |
| PUT | `/api/email-inbox/[id]` | Update email status |
| DELETE | `/api/email-inbox/[id]` | Delete email |
| POST | `/api/email-inbox/bulk-archive` | Archive multiple emails |
| POST | `/api/email-poll` | Trigger IMAP poll |
| POST | `/api/process-email` | AI classification |

### 4.2 Claims Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/claims` | List claims (paginated) |
| POST | `/api/claims` | Create claim |
| GET | `/api/claims/[id]` | Get claim details |
| PUT | `/api/claims/[id]` | Update claim |
| DELETE | `/api/claims/[id]` | Delete claim |

### 4.3 Learning Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/learning` | Learning statistics |
| GET | `/api/learning?type=history` | Learning history |
| GET | `/api/learning?type=patterns` | All patterns |
| GET | `/api/learning?type=senders` | Sender profiles |
| GET | `/api/learning?type=autoignore` | Auto-ignore rules |
| PUT | `/api/learning` | Toggle auto-ignore |

### 4.4 Attachment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/refetch-attachments` | Get attachment stats |
| POST | `/api/refetch-attachments` | Batch refetch attachments |
| POST | `/api/attachment-analysis` | Analyze attachments |

---

## 5. Environment Configuration

### 5.1 Required Environment Variables

```env
# Database
DATABASE_URL="file:./db/custom.db"

# AI Provider (z-ai-web-dev-sdk)
ZAI_API_KEY="your-api-key-here"

# IMAP Configuration (stored in database, set via UI)
# IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD, IMAP_SSL
```

### 5.2 Configuration via UI

Navigate to Settings section to configure:
- IMAP connection settings
- Email polling interval
- Auto-archive rules
- Notification preferences

---

## 6. Development Workflow

### 6.1 Getting Started

```bash
# Clone and install
cd /home/z/my-project
bun install

# Setup database
bun run db:push

# Start development server
bun run dev

# Run linting
bun run lint
```

### 6.2 Common Tasks

**Restart Development Server:**
```bash
# Kill existing processes
pkill -f "next dev"

# Start fresh
cd /home/z/my-project && bun run dev
```

**Add New Insurance Company:**
1. Navigate to Insurance Companies section in UI
2. Click "Add Company"
3. Enter details (name, domain, claim format)
4. System automatically creates extraction patterns

**Add New API Endpoint:**
1. Create `src/app/api/[endpoint]/route.ts`
2. Export async GET/POST/PUT/DELETE functions
3. Use `db` from `@/lib/db` for database access

**Add New UI Section:**
1. Create component in `src/components/sections/[name]-section.tsx`
2. Add navigation item in `src/components/layout/app-sidebar.tsx`
3. Add route handling in `src/app/page.tsx`

---

## 7. Known Issues & Solutions

### 7.1 Sandbox Environment Limitations

**Issue:** Background processes get killed after inactivity  
**Symptom:** Preview shows Z icon instead of dashboard  
**Solution:** Restart the development server manually

```bash
cd /home/z/my-project && bun run dev
```

### 7.2 PDF Processing

**Issue:** Password-protected PDFs cannot be analyzed  
**Symptom:** "PDF is password-protected" message in UI  
**Solution:** Request unlocked version from sender; system handles gracefully

### 7.3 Turbopack Cache

**Issue:** Changes not reflected after code modification  
**Symptom:** Old code still running  
**Solution:** Restart development server to clear cache

---

## 8. Testing

### 8.1 Manual Testing Checklist

- [ ] Email polling from IMAP server
- [ ] Email classification (New Claim, Follow-up, Spam)
- [ ] Claim extraction accuracy
- [ ] Attachment analysis
- [ ] Learning from corrections
- [ ] Bulk operations
- [ ] Print queue functionality
- [ ] Audit logging

### 8.2 API Testing

```bash
# Test dashboard endpoint
curl http://localhost:3000/api/dashboard

# Test learning stats
curl http://localhost:3000/api/learning

# Test claims list
curl http://localhost:3000/api/claims
```

---

## 9. Deployment

### 9.1 Production Build

```bash
# Build for production
bun run build

# Start production server
bun run start
```

### 9.2 Docker Deployment

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
RUN bun run db:push
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### 9.3 Gateway Configuration

The Caddyfile provides reverse proxy configuration:
- Port 81 exposed externally
- Forwards to Next.js on port 3000
- Supports XTransformPort query parameter for mini-services

---

## 10. Security Considerations

1. **API Keys:** Stored in environment variables, never in code
2. **IMAP Credentials:** Stored encrypted in database
3. **Input Validation:** All API endpoints validate inputs
4. **Audit Logging:** All actions logged with user/timestamp
5. **Email Rendering:** HTML emails rendered in sandboxed iframe

---

## 11. Support & Maintenance

### 11.1 Monitoring Points

- API response times (target: <500ms)
- AI analysis success rate (target: >95%)
- Learning pattern accuracy (target: >90%)
- Email processing queue size

### 11.2 Backup Strategy

- SQLite database: Regular file backups
- Email attachments: Stored in database as base64
- Learning patterns: Part of database backup

### 11.3 Contact

For technical support or feature requests, contact the development team at Soft-Dynamix.

---

## 12. Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| 2.5.0 | 2025-04-27 | Learning history, prediction tracking, field accuracy metrics |
| 2.4.0 | 2025-04-27 | Attachment refetch system, MIME parsing, IMAP batch refetch |
| 2.3.0 | 2025-04-27 | AI document analysis, claim likelihood scoring |
| 2.2.0 | 2025-04-26 | Bulk email operations, HTML email rendering |
| 2.1.0 | 2025-04-25 | Enhanced learning engine, pattern management |
| 2.0.0 | 2025-04-24 | Initial release, core functionality |

---

**Document End**

*This handover document provides comprehensive information for developers taking over the STEFCO Claims Dashboard project. For detailed API documentation, see docs/API.md. For development history, see worklog.md.*
