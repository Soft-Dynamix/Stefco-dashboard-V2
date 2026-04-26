# STEFCO Claims Dashboard - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2025-04-27

### Added
- **Learning History Feature** - Track what the AI has learned over time
  - Learning History tab in Learning Engine section
  - Summary cards: Overall Accuracy, Correct Predictions, Fields Learned, Improving/Declining counts
  - Prediction Comparison table showing AI predictions vs human corrections
  - Field Accuracy Metrics with trend indicators (Improving/Declining/Stable)
  - Auto-claim readiness tracking (90%+ accuracy threshold)
  - Expandable field-level details showing predicted vs actual values
  - Pagination for history records

- **Learning History API** - New endpoint for learning data
  - GET /api/learning?type=history - Retrieve learning history
  - Prediction comparisons with pagination
  - Field accuracy metrics grouped by domain
  - Accuracy trend over last 7 days
  - Summary statistics

- **Prediction Learning System** - Backend learning infrastructure
  - Store AI predictions when analyzing emails
  - Compare predictions vs actual when claims created
  - Track field-level accuracy per domain
  - Auto-claim readiness detection
  - Learning pattern creation from corrections

### Changed
- Enhanced learning-section.tsx with comprehensive learning history UI
- Regenerated Prisma client to include PredictionComparison and FieldAccuracyMetric models

### Technical
- PredictionComparison model stores AI vs human comparisons
- FieldAccuracyMetric tracks per-field accuracy with trends
- Learning applied flag for tracking which comparisons improved the model

## [2.4.0] - 2025-04-27

### Added
- **Attachment Refetch System** - Retrieve attachments for historical emails
  - "Refetch Attachments" button in Email Inbox
  - Badge showing count of emails needing attachment refetch
  - Batch processing via IMAP for old emails without attachments
  - Automatic marking of emails that have no attachments (NO_ATTACHMENTS marker)
  - Handles emails that no longer exist in IMAP gracefully
  - Audit logging for refetch operations

- **Attachment Extraction Module** - New `attachment-extractor.ts` library
  - MIME boundary parsing for multipart emails
  - Base64 and quoted-printable decoding
  - Content-Disposition header parsing for filenames
  - Support for embedded images, PDFs, and documents
  - IMAP integration for refetch operations

- **Refetch Attachments API** - New endpoint for attachment management
  - GET /api/refetch-attachments - Get attachment statistics
  - POST /api/refetch-attachments - Batch refetch attachments
  - Supports single email refetch by ID or Message-ID

### Changed
- Email poller now extracts attachments during initial email fetch
- Attachments tab shows "Email has been checked" for emails with no attachments
- Badge count properly decreases after refetch operations

### Fixed
- Refetch attachments badge stuck at same count after clicking
- Emails without attachments being re-processed repeatedly
- Unmatched emails (not found in IMAP) now marked as checked
- Memory leaks in attachment extraction process

### Technical Details
- Uses "NO_ATTACHMENTS" marker to distinguish between:
  - `null` - Email hasn't been checked for attachments
  - `"[]"` - Legacy empty array (treated as unchecked)
  - `"NO_ATTACHMENTS"` - Checked, confirmed no attachments
  - JSON array - Has actual attachments

## [2.3.0] - 2025-04-27

### Added
- **AI-Powered Attachment Analysis** - Intelligent document processing for claim detection
  - Document type classification (15 types: CLAIM_FORM, POLICY_SCHEDULE, INVOICE, etc.)
  - Claim form data extraction using VLM (Vision Language Model)
  - Policy schedule data extraction (policy numbers, coverage, insured items)
  - Claim likelihood scoring based on attachment content (0-100)
  - Learning system for user feedback on extracted data
  - South African specific patterns (vehicle regs, phone numbers, ID numbers)

- **Attachments Tab in Email Details** - New UI for attachment viewing
  - List of attachments with file type icons
  - "Claim Document" badges for likely claim-related files
  - "Analyze Attachments" button for on-demand AI analysis
  - Claim detection hints showing likely claim documents
  - File type indicators (PDF, Image, DOC)

- **Attachment Analysis API** - New endpoint for document processing
  - POST /api/attachment-analysis - Analyze attachments
  - GET /api/attachment-analysis - Retrieve results
  - Feedback submission for learning

- **Email Processing Integration** - Attachments considered in classification
  - Attachment name detection for claim-related files
  - Confidence boost when claim documents detected
  - Attachment summary placeholder created for all emails

### Database
- `AttachmentAnalysis` model - Stores per-attachment AI analysis results
- `AttachmentLearning` model - Records user corrections for learning
- `EmailAttachmentSummary` model - Email-level summary for claim detection

### Document Types Classified
- `CLAIM_FORM` - Claim submission forms, incident reports (HIGH relevance)
- `POLICY_SCHEDULE` - Insurance policy documents, certificates (HIGH relevance)
- `POLICE_REPORT` - Police case reports, accident case numbers (HIGH relevance)
- `MEDICAL_REPORT` - Medical reports, hospital documentation (MEDIUM relevance)
- `VEHICLE_ASSESSMENT` - Vehicle damage assessments (MEDIUM relevance)
- `REPAIR_QUOTE` - Repair estimates, body shop quotes (MEDIUM relevance)
- `PHOTO_EVIDENCE` - Photos of damage, accidents (MEDIUM relevance)
- Plus 8 more document types

### Key Insight Implemented
Not all emails with attachments are claims. Real claims typically have:
- Claim Form with incident details
- Policy Schedule with coverage info
- Supporting documents (photos, police reports)

The system now analyzes attachment content, not just filenames, to determine if an email is truly a new claim.

## [2.2.0] - 2025-04-26

### Added
- **Bulk Email Operations** - Select and process multiple emails at once
  - Checkbox selection in email table
  - Select all functionality
  - Bulk archive/unarchive operations
  - Bulk action bar with selection count
  - Visual highlighting for selected emails

- **Email Body HTML Rendering** - Display original email formatting
  - HTML/Text toggle for email body view
  - Sandboxed iframe for secure HTML rendering
  - Support for images, signatures, and formatted tables
  - Proper rendering of invoices and complex emails

- **AI Auto-fill for Ignore Modal** - Smart suggestions for rejection
  - Automatic category detection based on email patterns
  - Reason field pre-populated based on AI analysis
  - "AI Suggested" badge indicator
  - Subject pattern recognition (Re:, FWD:, follow-up detection)

- **Quoted-Printable Email Decoding** - Proper email content display
  - Backend decoding for newly polled emails
  - Frontend fallback for existing emails
  - Fixes `=20`, `=A0`, and other encoding artifacts

### Changed
- Email dialog now uses 95vw × 92vh for better content visibility
- Email body text changed to sans-serif font for better readability
- Improved line height and letter spacing for email content
- Added explicit close button in email dialog header

### Fixed
- Email body showing raw quoted-printable encoding (`=20`, `=A0`, etc.)
- Email HTML not rendering properly (tables, images, signatures)
- Bulk archive API using wrong Prisma model name
- Email dialog width being constrained by shadcn default classes

## [2.1.0] - 2025-04-26

### Added
- **Email Archive System** - Archive emails to keep inbox organized
  - Archive/Unarchive functionality in email details
  - "Archived" filter in status dropdown
  - Special archive badge with icon
  - Archived emails hidden from main inbox but accessible via filter

- **Email Pagination** - Improved handling of large email volumes
  - 50 emails per page with Previous/Next navigation
  - Email count display (Showing X-Y of Z emails)
  - Page indicator (Page X of Y)

- **Auto-Analysis Enabled by Default** - Emails automatically analyzed when fetched
  - No manual configuration required
  - AI classification runs immediately after email fetch

- **Email Deduplication** - Prevents duplicate emails using Message-ID
  - SHA-256 hash fallback for emails without Message-ID
  - Unique constraint on messageId field

### Changed
- Email inbox API default limit increased from 20 to 10,000 (with pagination)
- Live Chat feature removed (out of scope)
- Email poller fetches ALL emails (read and unread) from IMAP

### Fixed
- Dev server process management for persistent background running
- Email polling error when service not running
- Cross-origin preview issues in development mode

## [2.0.0] - 2025-04-25

### Added
- **Complete UI Overhaul** - Modern dashboard with shadcn/ui components
  - Dashboard section with stats and charts
  - Email Inbox with review queue
  - Claims Management with CRUD operations
  - Learning Engine section
  - Insurance Companies management
  - Print Queue section
  - Audit Log section
  - Analytics section
  - Settings section

- **Multi-Agent AI Pipeline**
  - Intake Agent - Email classification
  - Extraction Agent - Data extraction
  - Decision Agent - Processing decisions
  - Learning Agent - Pattern learning
  - Attachment Agent - VLM processing

- **Learning Engine**
  - Pattern learning from corrections
  - Sender profiles with automation levels
  - Extraction patterns per company
  - Claim number format learning
  - Negative pattern avoidance
  - Bayesian confidence updates

- **Email Processing**
  - IMAP email polling service (port 3002)
  - Auto-poll scheduler
  - Manual poll trigger
  - Email status tracking

- **South African Insurance Support**
  - 40+ pre-seeded insurance company patterns
  - Domain-to-company mapping
  - Claim number format templates

### Database
- 40+ Prisma models for comprehensive data management
- SQLite database with Prisma ORM
- Audit logging for all actions

### API Endpoints
- Claims CRUD API
- Email processing API
- Learning engine API
- Feedback submission API
- Thread pattern detection API
- Domain suggestions API
- Extraction patterns API

## [1.0.0] - Initial Release

### Added
- Basic claims management functionality
- Email processing foundation
- Simple AI classification
- SQLite database integration
- Next.js application structure

---

## Version History

| Version | Date | Key Changes |
|---------|------|-------------|
| 2.5.0 | 2025-04-27 | Learning History, prediction tracking, field accuracy metrics, auto-claim readiness |
| 2.4.0 | 2025-04-27 | Attachment refetch system, extraction module, badge count fixes |
| 2.3.0 | 2025-04-27 | AI attachment analysis, document classification, claim likelihood scoring |
| 2.2.0 | 2025-04-26 | Bulk operations, HTML email rendering, AI auto-fill, encoding fixes |
| 2.1.0 | 2025-04-26 | Archive system, pagination, auto-analysis |
| 2.0.0 | 2025-04-25 | Complete redesign, AI pipeline, learning engine |
| 1.0.0 | 2024-Q4 | Initial release |

## Upcoming Features (Roadmap)

### v2.6.0 (Planned)
- [ ] Advanced search with date range filters
- [ ] Email export to CSV/Excel
- [ ] Dashboard widget customization
- [ ] Real-time notifications with WebSocket

### v2.7.0 (Planned)
- [ ] Email threading visualization
- [ ] Advanced analytics charts
- [ ] API rate limiting
- [ ] Performance optimization

### v3.0.0 (Future)
- [ ] Multi-tenant support
- [ ] Custom AI model training
- [ ] Mobile responsive optimization
- [ ] External API integrations (Santam, OUTsurance APIs)

---

*For detailed development history, see [worklog.md](./worklog.md)*
