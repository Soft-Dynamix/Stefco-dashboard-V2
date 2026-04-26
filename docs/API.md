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
5. [Learning History API (v2.5.0)](#learning-history-api-v250)
6. [Insurance Companies API](#insurance-companies-api)
7. [Feedback API](#feedback-api)
8. [Analytics API](#analytics-api)
9. [Audit Log API](#audit-log-api)

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

## Learning History API (v2.5.0)

### Get Learning History

Retrieve AI prediction history, field accuracy metrics, and learning progress.

```http
GET /api/learning?type=history&page=1&limit=20
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| type | string | stats | Must be "history" for this endpoint |
| page | number | 1 | Page number for comparisons |
| limit | number | 50 | Comparisons per page |

**Response:**
```json
{
  "comparisons": [
    {
      "id": "comp-id",
      "emailQueueId": "email-id",
      "claimId": "claim-id",
      "senderDomain": "santam.co.za",
      "claimType": "MOTOR",
      "comparisons": "[{\"field\":\"claimNumber\",\"predicted\":\"STM-2025-000\",\"actual\":\"STM-2025-00001\",\"confidence\":85,\"isCorrect\":false}]",
      "totalFields": 10,
      "correctFields": 8,
      "accuracyRate": 80,
      "learningApplied": true,
      "createdAt": "2025-04-27T10:00:00Z"
    }
  ],
  "totalComparisons": 150,
  "currentPage": 1,
  "totalPages": 8,
  "fieldMetrics": [
    {
      "id": "metric-id",
      "senderDomain": "santam.co.za",
      "fieldName": "claimNumber",
      "claimType": "MOTOR",
      "totalPredictions": 25,
      "correctPredictions": 23,
      "correctedCount": 2,
      "accuracyRate": 92,
      "recentAccuracy": 95,
      "trendDirection": "improving",
      "avgConfidence": 88,
      "readyForAutoClaim": true,
      "lastPredictionAt": "2025-04-27T10:00:00Z"
    }
  ],
  "overallAccuracy": 85.5,
  "accuracyTrend": [
    {"date": "2025-04-21", "accuracy": 75, "total": 20},
    {"date": "2025-04-22", "accuracy": 78, "total": 25},
    {"date": "2025-04-23", "accuracy": 82, "total": 30},
    {"date": "2025-04-24", "accuracy": 80, "total": 28},
    {"date": "2025-04-25", "accuracy": 85, "total": 35},
    {"date": "2025-04-26", "accuracy": 88, "total": 40},
    {"date": "2025-04-27", "accuracy": 90, "total": 45}
  ],
  "fieldsReadyForAuto": 12,
  "totalFields": 25,
  "domainsSummary": [
    {
      "senderDomain": "santam.co.za",
      "automationLevel": "semi_auto",
      "totalEmails": 150,
      "accuracyRate": 92
    }
  ],
  "summary": {
    "totalPredictions": 500,
    "totalCorrect": 425,
    "overallAccuracy": 85,
    "comparisonsCount": 150,
    "fieldsLearned": 25,
    "fieldsReadyForAuto": 12,
    "improvingFields": 15,
    "decliningFields": 2,
    "stableFields": 8
  }
}
```

### Field Comparison Object

Each comparison record contains a JSON array of field-level comparisons:

```json
{
  "field": "claimNumber",
  "predicted": "STM-2025-000",
  "actual": "STM-2025-00001",
  "confidence": 85,
  "isCorrect": false,
  "errorType": "wrong"
}
```

**Error Types:**
- `wrong` - AI extracted wrong value
- `missing` - AI didn't extract a value that exists
- `extra` - AI extracted a value that doesn't exist

### Auto-Claim Readiness

Fields become "ready for auto-claim" when:
- At least 10 predictions for that field
- Accuracy rate of 90% or higher

The system tracks readiness per domain, per field, and per claim type for granular control.

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

*Last updated: 2025-04-27 (v2.5.0)*

---

## Attachment Analysis API (v2.3.0)

### Analyze Email Attachments

Trigger AI-powered analysis of email attachments for claim detection.

```http
POST /api/attachment-analysis
Content-Type: application/json

{
  "action": "analyze",
  "emailId": "email-id",
  "attachments": [
    {
      "filename": "Claim_Form.pdf",
      "mimeType": "application/pdf",
      "size": 245000
    },
    {
      "filename": "Policy_Schedule.pdf",
      "mimeType": "application/pdf",
      "size": 180000
    }
  ],
  "companyContext": "santam.co.za"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalAttachments": 2,
    "claimRelatedAttachments": 2,
    "hasClaimForm": true,
    "hasPolicySchedule": true,
    "hasSupportingDocuments": false,
    "overallClaimLikelihood": 85.5,
    "isLikelyNewClaim": true,
    "confidenceLevel": "HIGH",
    "assessmentReason": "High likelihood of new claim: Email contains both a claim form and policy schedule...",
    "keyIndicators": [
      "Contains claim form",
      "Contains policy schedule",
      "Claim number found: STM-2025-00001",
      "Vehicle registration: CA123456 GP"
    ],
    "missingInformation": [],
    "combinedClaimData": {
      "claimNumber": "STM-2025-00001",
      "policyNumber": "POL-123456",
      "clientName": "John Doe",
      "vehicleRegistration": "CA123456 GP",
      "claimType": "MOTOR"
    }
  },
  "analyses": [
    {
      "attachmentId": "att-id-1",
      "fileName": "Claim_Form.pdf",
      "fileType": "PDF",
      "classification": {
        "documentType": "CLAIM_FORM",
        "confidence": 95,
        "reasoning": "Document contains claim form fields, incident details, and claim number",
        "isClaimRelated": true,
        "importance": "HIGH"
      },
      "claimLikelihoodScore": 85,
      "containsClaimNumber": true,
      "containsPolicyNumber": false,
      "containsVehicleReg": true
    }
  ]
}
```

### Get Attachment Analysis Results

```http
GET /api/attachment-analysis?emailId=email-id&action=summary
```

**Response:**
```json
{
  "summary": {
    "id": "summary-id",
    "emailQueueId": "email-id",
    "totalAttachments": 2,
    "claimRelatedAttachments": 2,
    "hasClaimForm": true,
    "hasPolicySchedule": true,
    "overallClaimLikelihood": 85.5,
    "isLikelyNewClaim": true,
    "confidenceLevel": "HIGH",
    "assessmentReason": "High likelihood of new claim..."
  },
  "analyses": [...]
}
```

### Submit Feedback for Learning

```http
POST /api/attachment-analysis
Content-Type: application/json

{
  "action": "feedback",
  "emailId": "email-id",
  "feedback": {
    "attachmentId": "att-id",
    "fieldName": "claimNumber",
    "originalValue": "STM-2025-000",
    "correctedValue": "STM-2025-00001"
  },
  "companyContext": "santam.co.za"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Feedback recorded successfully"
}
```

### Get Learned Patterns

```http
GET /api/attachment-analysis?action=patterns&companyContext=santam.co.za
```

**Response:**
```json
{
  "patterns": [
    {
      "fieldName": "claimNumber",
      "patterns": [
        {
          "original": "STM-2025-000",
          "corrected": "STM-2025-00001",
          "count": 3
        }
      ]
    }
  ]
}
```

### Document Types Classified

| Type | Description | Claim Relevance |
|------|-------------|-----------------|
| `CLAIM_FORM` | Claim submission forms, incident reports | HIGH |
| `POLICY_SCHEDULE` | Insurance policy documents, certificates | HIGH |
| `INVOICE` | Bills, statements, payment requests | LOW |
| `QUOTATION` | Quotes, estimates, proposals | LOW |
| `POLICE_REPORT` | Police case reports, accident case numbers | HIGH |
| `MEDICAL_REPORT` | Medical reports, hospital documentation | MEDIUM |
| `VEHICLE_ASSESSMENT` | Vehicle damage assessments | MEDIUM |
| `REPAIR_QUOTE` | Repair estimates, body shop quotes | MEDIUM |
| `PHOTO_EVIDENCE` | Photos of damage, accidents | MEDIUM |
| `IDENTITY_DOCUMENT` | ID cards, passports, driver's licenses | LOW |
| `PROOF_OF_ADDRESS` | Utility bills, bank statements | LOW |
| `BANKING_DETAILS` | Bank account details | LOW |
| `CORRESPONDENCE` | General letters, emails | LOW |
| `EMAIL_PRINTOUT` | Printed emails | LOW |
| `OTHER` | Documents that don't fit other categories | LOW |

### Extracted Fields - Claim Form

| Field | Description | Example |
|-------|-------------|---------|
| `claimNumber` | Claim reference number | STM-2025-00001 |
| `claimType` | Type of claim | MOTOR, PROPERTY, LIABILITY |
| `incidentDate` | Date of incident | 2025-04-26 |
| `incidentLocation` | Where incident occurred | 123 Main St, Johannesburg |
| `incidentDescription` | What happened | Vehicle collision at intersection |
| `policyHolderName` | Name of policy holder | John Doe |
| `policyHolderIdNumber` | SA ID number | 8001015009087 |
| `policyHolderPhone` | Contact number | 0821234567 |
| `policyHolderEmail` | Email address | john@example.com |
| `policyNumber` | Policy reference | POL-123456 |
| `vehicleRegistration` | Vehicle reg number | CA123456 GP |
| `vehicleMake` | Vehicle manufacturer | Toyota |
| `vehicleModel` | Vehicle model | Corolla |
| `driverName` | Driver name (if different) | Jane Doe |
| `thirdPartyName` | Third party name | Bob Smith |
| `excessAmount` | Excess amount | 5000 |

### Extracted Fields - Policy Schedule

| Field | Description | Example |
|-------|-------------|---------|
| `policyNumber` | Policy reference | POL-123456 |
| `policyType` | Type of policy | Comprehensive Motor |
| `insuredName` | Name of insured | John Doe |
| `insuredIdNumber` | SA ID number | 8001015009087 |
| `sumInsured` | Coverage amount | 250000 |
| `premium` | Premium amount | 1500 |
| `excess` | Excess amount | 5000 |
| `inceptionDate` | Policy start date | 2024-01-01 |
| `expiryDate` | Policy end date | 2024-12-31 |

### Claim Likelihood Scoring

The system calculates a claim likelihood score (0-100) based on:

1. **Document Type Weight**:
   - CLAIM_FORM: +50 points
   - POLICY_SCHEDULE: +20 points
   - Supporting documents: +10-30 points

2. **Extracted Data Boosts**:
   - Claim number found: +15 points
   - Policy number found: +10 points
   - Vehicle registration: +5 points
   - Incident date: +5 points
   - Client name: +5 points

3. **Document Combination Bonus**:
   - Claim Form + Policy Schedule: +20 points
   - Supporting documents present: +5 points

**Interpretation**:
- **80-100**: HIGH confidence - Likely a new claim
- **60-79**: MEDIUM confidence - Possible claim
- **0-59**: LOW confidence - Probably not a new claim
