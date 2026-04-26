# STEFCO Claims Dashboard - API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

Currently, the API uses session-based authentication. All endpoints require the user to be authenticated via the web interface.

---

## Table of Contents

1. [Claims API](#claims-api)
2. [Email Inbox API](#email-inbox-api)
3. [Email Polling API](#email-polling-api)
4. [Learning API](#learning-api)
5. [Insurance Companies API](#insurance-companies-api)
6. [Feedback API](#feedback-api)
7. [Analytics API](#analytics-api)
8. [Audit Log API](#audit-log-api)

---

## Claims API

### List Claims

```http
GET /api/claims?page=1&limit=20&status=NEW
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number for pagination |
| limit | number | 20 | Items per page |
| status | string | - | Filter by claim status |

**Response:**
```json
{
  "claims": [
    {
      "id": "clx...",
      "claimNumber": "STM-2025-00001",
      "clientName": "John Doe",
      "clientEmail": "john@example.com",
      "claimType": "MOTOR",
      "status": "NEW",
      "createdAt": "2025-04-26T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Create Claim

```http
POST /api/claims
Content-Type: application/json

{
  "claimNumber": "STM-2025-00001",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "clientPhone": "+27123456789",
  "claimType": "MOTOR",
  "incidentDescription": "Vehicle accident",
  "vehicleRegistration": "CA123456",
  "sourceEmailId": "email-id",
  "status": "NEW"
}
```

### Get Claim Details

```http
GET /api/claims/{id}
```

### Update Claim

```http
PUT /api/claims/{id}
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "clientPhone": "+27987654321"
}
```

### Delete Claim

```http
DELETE /api/claims/{id}
```

---

## Email Inbox API

### List Emails

```http
GET /api/email-inbox?status=PENDING&page=1&limit=50
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Emails per page (max 10000) |
| status | string | - | Filter by status: PENDING, AI_ANALYZED, CLAIM_CREATED, IGNORED, ARCHIVED |

**Response:**
```json
{
  "emails": [
    {
      "id": "email-id",
      "messageId": "<unique-message-id@domain.com>",
      "subject": "Claim Notification - STM-2025-00001",
      "from": "claims@santam.co.za",
      "fromDomain": "santam.co.za",
      "bodyText": "Email content...",
      "bodyHtml": "<html>...</html>",
      "aiClassification": "NEW_CLAIM",
      "aiConfidence": 92.5,
      "aiReasoning": "Email contains claim number and vehicle details...",
      "status": "AI_ANALYZED",
      "receivedAt": "2025-04-26T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 234,
    "totalPages": 5
  }
}
```

### Get Email Details

```http
GET /api/email-inbox/{id}
```

**Response:**
```json
{
  "id": "email-id",
  "messageId": "<unique-message-id@domain.com>",
  "subject": "Claim Notification",
  "from": "claims@santam.co.za",
  "fromDomain": "santam.co.za",
  "to": "intake@stefco.co.za",
  "bodyText": "Plain text content...",
  "bodyHtml": "<html><body>HTML content...</body></html>",
  "attachments": null,
  "aiClassification": "NEW_CLAIM",
  "aiConfidence": 92.5,
  "aiReasoning": "Email contains claim number...",
  "aiExtractedData": "{\"claimNumber\":\"STM-2025-00001\",\"clientName\":\"John Doe\"}",
  "status": "AI_ANALYZED",
  "processingRoute": "ai_suggest",
  "learningHintsCount": 5,
  "receivedAt": "2025-04-26T10:00:00Z",
  "processedAt": "2025-04-26T10:01:00Z"
}
```

### Update Email Status

```http
PUT /api/email-inbox/{id}
Content-Type: application/json

{
  "status": "ARCHIVED"
}
```

**Valid Status Values:**
- `PENDING` - Awaiting processing
- `AI_ANALYZED` - AI has analyzed the email
- `USER_REVIEWING` - User is reviewing
- `CLAIM_CREATED` - Claim has been created
- `IGNORED` - Email ignored with feedback
- `ARCHIVED` - Archived for organization

### Bulk Archive Emails (v2.2.0)

```http
POST /api/email-inbox/bulk-archive
Content-Type: application/json

{
  "emailIds": ["email-id-1", "email-id-2", "email-id-3"],
  "status": "ARCHIVED"
}
```

**Request Body:**
| Field | Type | Description |
|-------|------|-------------|
| emailIds | string[] | Array of email IDs to update |
| status | string | Target status: ARCHIVED or PENDING |

**Response:**
```json
{
  "success": true,
  "updated": 3,
  "message": "Successfully archived 3 emails"
}
```

---

## Email Polling API

### Get Polling Status

```http
GET /api/email-poll
```

**Response:**
```json
{
  "isConfigured": true,
  "lastPoll": "2025-04-26T10:00:00Z",
  "nextPoll": "2025-04-26T10:05:00Z",
  "totalQueued": 5,
  "schedulerEnabled": true,
  "pollInterval": 5,
  "autoAnalyzeEnabled": true,
  "autoClaimCreationEnabled": false,
  "automationStats": {
    "manual": 20,
    "semi": 15,
    "auto": 10
  }
}
```

### Trigger Manual Poll

```http
POST /api/email-poll
Content-Type: application/json

{
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "fetched": 10,
  "analyzed": 10,
  "message": "Fetched 10 new emails, analyzed 10"
}
```

### Run Full Automation Pipeline

```http
POST /api/email-poll
Content-Type: application/json

{
  "limit": 50,
  "fullPipeline": true
}
```

**Response:**
```json
{
  "success": true,
  "fetched": 10,
  "analyzed": 10,
  "claimsCreated": 3,
  "message": "Fetched 10, analyzed 10, created 3 claims"
}
```

### Analyze Pending Emails

```http
PUT /api/email-poll
Content-Type: application/json

{
  "limit": 50
}
```

### Auto-Create Claims (v2.1.0)

```http
PUT /api/email-poll
Content-Type: application/json

{
  "limit": 50,
  "createClaims": true
}
```

**Response:**
```json
{
  "success": true,
  "created": 5,
  "skipped": 10,
  "message": "Created 5 claims, skipped 10"
}
```

### Scheduler Control

```http
POST /api/email-poll/scheduler
Content-Type: application/json

{
  "action": "start",
  "interval": 5
}
```

**Actions:**
- `start` - Start auto-polling
- `stop` - Stop auto-polling

---

## Learning API

### Get Learning Statistics

```http
GET /api/learning
```

**Response:**
```json
{
  "totalPatterns": 150,
  "totalSenders": 45,
  "averageAccuracy": 85.5,
  "recentCorrections": 12,
  "automationLevelDistribution": {
    "MANUAL": 20,
    "SEMI_AUTO": 15,
    "AUTO": 10
  }
}
```

### Submit Correction Feedback

```http
POST /api/claim-feedback
Content-Type: application/json

{
  "claimId": "claim-id",
  "fieldCorrections": {
    "clientName": {
      "original": "J Doe",
      "corrected": "John Doe"
    }
  },
  "extractedFromEmail": true
}
```

---

## Insurance Companies API

### List Companies

```http
GET /api/insurance
```

### Create Company

```http
POST /api/insurance
Content-Type: application/json

{
  "name": "Santam",
  "domain": "santam.co.za",
  "claimNumberFormat": "STM-YYYY-NNNNN",
  "contactEmail": "claims@santam.co.za"
}
```

### Update Company

```http
PUT /api/insurance/{id}
```

### Delete Company

```http
DELETE /api/insurance/{id}
```

---

## Feedback API

### Submit Rejection Feedback

```http
POST /api/rejection-feedback
Content-Type: application/json

{
  "emailId": "email-id",
  "category": "SPAM",
  "reason": "This is a marketing email, not a claim",
  "applyToSender": true
}
```

**Categories:**
- `SPAM` - Marketing or spam email
- `DUPLICATE` - Duplicate claim
- `NOT_CLAIM` - Not a claim-related email
- `ALREADY_PROCESSED` - Claim already exists
- `FOLLOW_UP_EMAIL` - Follow-up or reply email
- `MARKETING` - Marketing material
- `INTERNAL_EMAIL` - Internal company email
- `OTHER` - Other reason

**Response:**
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "autoIgnoreRuleCreated": true
}
```

---

## Analytics API

### Get Dashboard Stats

```http
GET /api/dashboard
```

**Response:**
```json
{
  "totalClaims": 1250,
  "pendingClaims": 45,
  "processedToday": 12,
  "averageProcessingTime": 3.5,
  "accuracyRate": 92.5,
  "recentClaims": [...],
  "statusDistribution": {...}
}
```

### Get Analytics Data

```http
GET /api/analytics?period=30d
```

---

## Audit Log API

### List Audit Logs

```http
GET /api/audit?action=CLAIM_CREATED&page=1&limit=50
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| action | string | Filter by action type |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "logs": [
    {
      "id": "log-id",
      "action": "CLAIM_CREATED",
      "entityType": "Claim",
      "details": "Claim STM-2025-00001 created from email",
      "status": "SUCCESS",
      "createdAt": "2025-04-26T10:00:00Z"
    }
  ],
  "pagination": {...}
}
```

---

## Process Email API

### Process Single Email

```http
POST /api/process-email
Content-Type: application/json

{
  "emailId": "email-id",
  "subject": "Claim Notification",
  "from": "claims@santam.co.za",
  "bodyText": "Email content...",
  "fromDomain": "santam.co.za"
}
```

**Response:**
```json
{
  "classification": {
    "classification": "NEW_CLAIM",
    "confidence": 92.5,
    "reasoning": "Email contains claim number and vehicle details..."
  },
  "extraction": {
    "claimNumber": "STM-2025-00001",
    "clientName": "John Doe",
    "clientEmail": "john@example.com",
    "claimType": "MOTOR",
    "vehicleRegistration": "CA123456"
  },
  "learningHintsCount": 5
}
```

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong",
  "details": "Additional details if available"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

Currently, there are no rate limits enforced. However, please be mindful of:
- AI analysis endpoints have inherent latency (1-3 seconds per email)
- Bulk operations should be limited to reasonable batch sizes
- Polling interval should not be less than 1 minute

---

## Email Data Format

### Quoted-Printable Decoding (v2.2.0)

Emails fetched via IMAP are automatically decoded from quoted-printable encoding. The system handles:
- `=20` → Space character
- `=A0` → Non-breaking space
- `=3D` → Equals sign
- Soft line breaks (`=\r\n`) → Removed

Both `bodyText` and `bodyHtml` fields are decoded before storage. For existing emails, the frontend provides fallback decoding.

---

## Webhook Support (Planned)

Future versions will support webhooks for:
- New claim notifications
- Status change notifications
- Learning milestone alerts

---

*Last updated: 2025-04-26 (v2.2.0)*
