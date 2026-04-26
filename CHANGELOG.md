# STEFCO Claims Dashboard - Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
| 2.1.0 | 2025-04-26 | Archive system, pagination, auto-analysis |
| 2.0.0 | 2025-04-25 | Complete redesign, AI pipeline, learning engine |
| 1.0.0 | 2024-Q4 | Initial release |

## Upcoming Features (Roadmap)

### v2.2.0 (Planned)
- [ ] Bulk email operations (select multiple, bulk archive)
- [ ] Advanced search with date range filters
- [ ] Email export to CSV/Excel
- [ ] Dashboard widget customization

### v2.3.0 (Planned)
- [ ] Real-time notifications with WebSocket
- [ ] Email threading visualization
- [ ] Advanced analytics charts
- [ ] API rate limiting

### v3.0.0 (Future)
- [ ] Multi-tenant support
- [ ] Custom AI model training
- [ ] Mobile responsive optimization
- [ ] External API integrations (Santam, OUTsurance APIs)

---

*For detailed development history, see [worklog.md](./worklog.md)*
