# STEFCO Claims Dashboard

An AI-powered insurance claims processing system with intelligent learning capabilities for South African insurance companies.

## Overview

STEFCO Claims Dashboard is a comprehensive claims management platform that automatically processes insurance claim emails, extracts claim details using AI, and learns from user corrections to improve accuracy over time.

## Key Features

### Core Functionality
- **Multi-Agent AI Pipeline** - Classification, extraction, and decision agents
- **Email Processing** - IMAP email polling with automatic classification
- **Claims Management** - Full CRUD operations with status tracking
- **Learning Engine** - Pattern learning from user corrections
- **Attachment Processing** - VLM-based extraction from images/PDFs

### Learning History (v2.5.0)
- **Prediction Tracking** - Store AI predictions when analyzing emails
- **Comparison System** - Compare AI predictions vs human corrections
- **Field Accuracy Metrics** - Per-field accuracy tracking with trends
- **Auto-Claim Readiness** - Track progress toward 90% accuracy threshold
- **Learning Insights** - Summary cards showing improving/declining fields
- **Historical View** - See what AI has learned over time

### Attachment Intelligence (v2.4.0)
- **Attachment Refetch System** - Retrieve attachments for historical emails
- **MIME Parsing** - Extract attachments from raw email source
- **IMAP Integration** - Batch refetch attachments from mail server
- **Smart Marking** - Emails without attachments marked to prevent re-processing
- **Badge Tracking** - Real-time count of emails needing attachment refetch

### Document Analysis (v2.3.0)
- **AI Document Classification** - Classifies attachments into 15 document types
- **Claim Form Extraction** - Extracts claim number, policy holder, vehicle details
- **Policy Schedule Extraction** - Extracts policy numbers, coverage, insured items
- **Claim Likelihood Scoring** - Scores emails 0-100 based on attachment content
- **Smart Detection** - Distinguishes between actual claims and other documents
- **Learning from Corrections** - Improves accuracy from user feedback

### Email Management (v2.2.0)
- **Bulk Email Operations** - Select multiple emails and archive/unarchive at once
- **HTML Email Rendering** - View original email formatting with images, tables, signatures
- **Email Pagination** - 50 emails per page with navigation
- **Email Archive** - Archive processed emails to keep inbox organized
- **Auto-Analysis** - Emails automatically analyzed when fetched
- **Deduplication** - Prevents duplicate emails using Message-ID headers
- **AI Auto-fill** - Smart suggestions when ignoring emails

### AI & Learning Features
- **Ensemble Extraction** - Combines regex, AI, template, and position methods
- **Cross-Field Validation** - Learns field relationships (e.g., MOTOR claims need vehicle registration)
- **Negative Pattern Learning** - Avoids repeating extraction mistakes
- **Email Template Detection** - Learns document structures for faster extraction
- **Active Learning** - Identifies uncertain fields and generates clarification questions
- **Bayesian Confidence Updates** - Probabilistic weight adjustment based on actual performance

### Automation Levels
- **Manual** - All emails require human review
- **Semi-Auto** - AI suggests, human confirms
- **Auto** - Claims created automatically for trusted senders

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Database | Prisma ORM + SQLite |
| UI | React 19 + shadcn/ui + Tailwind CSS |
| AI | z-ai-web-dev-sdk (LLM + VLM) |
| Email | IMAP (imapflow) |

## Project Structure

```
src/
├── app/
│   ├── api/                    # REST API endpoints
│   │   ├── claims/             # Claims CRUD
│   │   ├── claim-feedback/     # Field corrections with learning
│   │   ├── enhanced-extract/   # Ensemble extraction API
│   │   ├── email-inbox/        # Email inbox with bulk operations
│   │   ├── email-poll/         # IMAP email polling
│   │   ├── learning/           # Learning engine stats
│   │   ├── rejection-feedback/ # Structured feedback collection
│   │   ├── thread-patterns/    # Follow-up detection
│   │   ├── domain-suggestions/ # Domain-to-company mapping
│   │   ├── extraction-patterns/# Pattern management
│   │   └── ...                 # Other APIs
│   ├── layout.tsx              # Main application layout
│   └── page.tsx                # Single-page app
├── components/
│   ├── layout/                 # Navigation sidebar
│   ├── sections/               # Main UI sections
│   │   ├── dashboard-section.tsx
│   │   ├── inbox-section.tsx   # Email inbox with bulk operations
│   │   ├── claims-section.tsx
│   │   ├── learning-section.tsx
│   │   └── ...                 # Other sections
│   ├── feedback-modal.tsx      # AI-powered rejection feedback
│   └── ui/                     # shadcn/ui components
└── lib/
    ├── db.ts                   # Prisma client
    ├── email-poller.ts         # IMAP email fetching with decoding
    ├── attachment-extractor.ts # MIME parsing & IMAP refetch
    ├── extraction-patterns.ts  # Pattern learning utilities
    ├── attachment-processor.ts # VLM attachment extraction
    ├── attachment-ai-analyzer.ts # AI document classification & extraction
    └── enhanced-learning.ts    # Advanced learning engine

prisma/
└── schema.prisma               # Database schema (40+ models)

mini-services/
└── email-poller/               # Background email polling service
```

## Database Models

### Core Models
- `InsuranceCompany` - Insurance company registry with domain mappings
- `Claim` - Central claim record with all extracted data
- `EmailQueue` - Emails awaiting processing
- `Prediction` - AI predictions with confidence scores

### Learning Models
- `LearningPattern` - Learned extraction patterns per sender
- `ExtractionPattern` - Company-specific extraction patterns
- `ClaimNumberFormat` - Claim number formats per company
- `SenderPattern` - Aggregated statistics per sender domain
- `SenderLearningProfile` - Progressive automation tracking

### Enhanced Learning Models
- `GlobalPattern` - Patterns shared across companies
- `EmailTemplate` - Detected email structures
- `FieldRelationship` - Cross-field dependencies
- `NegativePattern` - False positives to avoid
- `ConfidenceWeight` - Per-method confidence weights
- `ExtractionSession` - Multi-field consistency tracking

## API Endpoints

### Claims
```
GET    /api/claims          # List claims with pagination
POST   /api/claims          # Create claim (triggers learning)
GET    /api/claims/[id]     # Get claim details
PUT    /api/claims/[id]     # Update claim
```

### Email Processing
```
GET    /api/email-inbox     # List queued emails with pagination
POST   /api/email-inbox/bulk-archive # Bulk archive emails
GET    /api/email-inbox/[id]# Get email details
PUT    /api/email-inbox/[id]# Update email status
POST   /api/email-poll      # Trigger manual poll
POST   /api/process-email   # AI classification & extraction
POST   /api/enhanced-extract # Ensemble extraction with attachments
POST   /api/attachment-analysis # AI document analysis
```

### Attachment Management (v2.4.0)
```
GET    /api/refetch-attachments # Get attachment statistics
POST   /api/refetch-attachments # Batch refetch attachments from IMAP
```

### Attachment Analysis (v2.3.0)
```
POST   /api/attachment-analysis # Analyze attachments for claim detection
GET    /api/attachment-analysis # Get analysis results
```

### Learning
```
GET    /api/learning        # Learning statistics
GET    /api/learning?type=history # Learning history with predictions
GET    /api/learning?type=patterns # All learning patterns
GET    /api/learning?type=senders  # All sender profiles
GET    /api/learning?type=autoignore # Auto-ignore rules
POST   /api/claim-feedback  # Submit corrections (triggers learning)
GET    /api/extraction-patterns # List patterns
POST   /api/extraction-patterns # Create pattern
```

### Learning History (v2.5.0)
```
GET    /api/learning?type=history&page=1&limit=20
# Returns:
# - comparisons: Prediction vs actual records
# - fieldMetrics: Per-field accuracy by domain
# - accuracyTrend: Daily accuracy over last 7 days
# - summary: Overall statistics and counts
```

### Feedback & Thread Detection
```
POST   /api/rejection-feedback # Submit rejection feedback
GET    /api/thread-patterns    # List thread patterns
POST   /api/thread-patterns    # Check follow-up probability
```

## Learning System Architecture

### Learning Flow
1. **Email Arrives** → Domain detected → Company matched
2. **Ensemble Extract** → Multiple methods combined
3. **Process Attachments** → VLM extracts from images
4. **Validate Fields** → Check learned relationships
5. **Active Learning** → Identify uncertain fields
6. **User Reviews** → Apply corrections
7. **Learn Everything**:
   - Extraction patterns per field
   - Claim number formats
   - Field relationships
   - Email templates
   - Negative patterns
   - Bayesian confidence weights
8. **Next Email** → Higher accuracy extraction

### Expected Accuracy Improvement
| Stage | Before Enhancement | After Enhancement |
|-------|-------------------|-------------------|
| First extraction | 40-50% | 60-70% |
| After 5 corrections | 60% | 75-80% |
| After 10 corrections | 70% | 85-90% |
| After 20 corrections | 75% | 92-95% |
| Time to auto-approve | 30+ emails | 10-15 emails |

## South African Insurance Support

Pre-seeded with 40+ SA insurance company domain patterns:

| Company | Domain Pattern | Claim Number Format |
|---------|---------------|---------------------|
| Santam | santam.co.za | STM-YYYY-NNNNN |
| Outsurance | outsurance.co.za | OUT/NNNNNN/YY |
| Hollard | hollard.co.za | HOL-NNNNNNNN |
| Old Mutual | oldmutual.co.za | OMN-YYYY-NNNNN |
| Alexander Forbes | alexanderforbes.co.za | AF-NNNNNN |
| ... | ... | ... |

## Installation

### Prerequisites
- Node.js 18+
- Bun runtime
- SQLite

### Setup

```bash
# Clone repository
git clone https://github.com/Soft-Dynamix/Stefco-dashboard-V2.git
cd Stefco-dashboard-V2

# Install dependencies
bun install

# Setup database
bun run db:push

# Start development server
bun run dev
```

### Configuration

Configure in Settings UI or directly in database:

```sql
-- IMAP Settings
INSERT INTO system_config (key, value) VALUES 
  ('IMAP_HOST', 'imap.yourprovider.com'),
  ('IMAP_PORT', '993'),
  ('IMAP_USER', 'your@email.com'),
  ('IMAP_PASSWORD', 'your-password'),
  ('IMAP_SSL', 'true');

-- AI Provider (configured via environment)
-- Set ZAI_API_KEY environment variable
```

## Background Services

### Email Poller Service
Located in `mini-services/email-poller/`:

```bash
# Start background poller
cd mini-services/email-poller
bun install
bun run dev
```

Runs on port 3002 with endpoints:
- `GET /health` - Health check
- `POST /trigger` - Manual poll trigger

## Development

### Scripts
```bash
bun run dev      # Start development server
bun run build    # Production build
bun run lint     # ESLint check
bun run db:push  # Push schema changes
```

### Adding New Insurance Companies

1. Add via UI in Insurance Companies section
2. Or seed via API:
```bash
curl -X POST http://localhost:3000/api/insurance-knowledge \
  -H "Content-Type: application/json" \
  -d '{"action": "seed"}'
```

### Custom Extraction Patterns

Add patterns in Insurance → Extraction Patterns tab:

```json
{
  "fieldType": "claimNumber",
  "patternType": "regex",
  "patternValue": "COMP-\\d{4}-\\d{5}",
  "description": "Company claim number format"
}
```

## Deployment

### Production Build
```bash
bun run build
bun run start
```

### Environment Variables
```env
DATABASE_URL="file:./dev.db"
ZAI_API_KEY="your-api-key"
```

### Docker (Optional)
```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
RUN bun run db:push
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## Recent Changes

### v2.5.0 (2025-04-27)
- **Learning History**: New tab showing AI learning progress over time
- **Prediction Tracking**: Store AI predictions for later comparison
- **Field Accuracy Metrics**: Per-field accuracy with trend indicators
- **Auto-Claim Readiness**: Track progress toward 90% accuracy threshold
- **Learning Insights**: Summary cards showing improving/declining fields
- **Historical Comparisons**: View predicted vs actual values per field

### v2.4.0 (2025-04-27)
- **Attachment Refetch System**: Retrieve attachments for historical emails
- **MIME Parsing Module**: Extract attachments from raw email source
- **IMAP Batch Refetch**: Process multiple emails at once
- **Smart Marking**: Emails without attachments marked to prevent re-processing
- **Badge Tracking**: Real-time count of emails needing refetch
- **Bug Fix**: Badge count now properly decreases after refetch operations

### v2.3.0 (2025-04-27)
- **AI-Powered Attachment Analysis**: Intelligent document processing for claim detection
- **Document Classification**: Classifies attachments into 15 types (CLAIM_FORM, POLICY_SCHEDULE, etc.)
- **Claim Form Extraction**: Extracts claim numbers, policy holder info, vehicle details
- **Policy Schedule Extraction**: Extracts policy numbers, coverage, insured items
- **Claim Likelihood Scoring**: Scores emails 0-100 based on attachment content
- **Attachments Tab**: New UI for viewing and analyzing email attachments
- **Learning System**: Improves accuracy from user feedback on extracted data

### v2.2.0 (2025-04-26)
- **Bulk Email Operations**: Select multiple emails with checkboxes, archive/unarchive in bulk
- **HTML Email Rendering**: Toggle between formatted HTML and plain text views
- **AI Auto-fill**: Smart category and reason suggestions when ignoring emails
- **Quoted-Printable Decoding**: Proper display of encoded email content

### Improvements
- Larger email dialog (95vw × 92vh) for better content visibility
- Improved typography with sans-serif font and better spacing
- Explicit close button in email dialog header

### Bug Fixes
- Fixed quoted-printable encoding artifacts (`=20`, `=A0`, etc.)
- Fixed bulk archive API using wrong Prisma model
- Fixed email HTML not rendering properly

## Documentation

- [CHANGELOG.md](./CHANGELOG.md) - Version history and release notes
- [worklog.md](./worklog.md) - Detailed development history
- [docs/API.md](./docs/API.md) - API endpoint documentation

## Security Considerations

- All AI processing happens server-side
- API keys stored in environment variables
- IMAP credentials stored encrypted in database
- Audit logging for all actions
- Input validation on all API endpoints
- Sandboxed iframe for HTML email rendering

## License

Proprietary - STEFCO Consultants

## Support

For issues and feature requests, contact the development team.

---

Built with ❤️ for STEFCO Consultants Insurance Claims Processing
