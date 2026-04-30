# STEFCO Claims Dashboard - API Documentation

**Version:** 2.5.0  
**Base URL:** `http://localhost:3000/api`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Response Format](#response-format)
3. [Email Endpoints](#email-endpoints)
4. [Claims Endpoints](#claims-endpoints)
5. [Learning Endpoints](#learning-endpoints)
6. [Insurance Endpoints](#insurance-endpoints)
7. [Attachment Endpoints](#attachment-endpoints)
8. [Analytics Endpoints](#analytics-endpoints)
9. [Settings Endpoints](#settings-endpoints)
10. [Error Handling](#error-handling)

---

## Authentication

Currently, the API does not require authentication. All endpoints are accessible without authentication headers. In production, implement appropriate authentication middleware.

---

## Response Format

### Success Response
```json
{
  "data": { ... },
  "message": "Success"
}
```

### Error Response
```json
{
  "error": "Error message",
  "details": "Additional details"
}
```

### Paginated Response
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

---

## Email Endpoints

### GET /api/email-inbox

List emails in the queue with pagination and filtering.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| status | string | - | Filter by status (pending, processed, archived) |
| search | string | - | Search in subject/sender |

**Response:**
```json
{
  "emails": [
    {
      "id": "clx123...",
      "messageId": "<unique@sender.com>",
      "subject": "Claim Submission: CLM-2024-001",
      "from": "claims@insurance.co.za",
      "fromDomain": "insurance.co.za",
      "to": "claims@stefco.co.za",
      "bodyText": "Email body content...",
      "bodyHtml": "<html>...</html>",
      "receivedAt": "2024-04-27T10:00:00Z",
      "status": "pending",
      "classification": "NEW_CLAIM",
      "confidence": 0.95,
      "attachments": [
        {
          "filename": "claim_form.pdf",
          "contentType": "application/pdf",
          "size": 102400
        }
      ],
      "createdAt": "2024-04-27T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  },
  "stats": {
    "pending": 25,
    "processed": 50,
    "archived": 25
  }
}
```

### GET /api/email-inbox/[id]

Get detailed information about a specific email.

**Response:**
```json
{
  "id": "clx123...",
  "messageId": "<unique@sender.com>",
  "subject": "Claim Submission: CLM-2024-001",
  "from": "claims@insurance.co.za",
  "fromDomain": "insurance.co.za",
  "to": "claims@stefco.co.za",
  "bodyText": "Full email body...",
  "bodyHtml": "<html>Full HTML...</html>",
  "receivedAt": "2024-04-27T10:00:00Z",
  "status": "pending",
  "classification": "NEW_CLAIM",
  "confidence": 0.95,
  "attachments": [...],
  "predictions": [...],
  "attachmentAnalyses": [...],
  "createdAt": "2024-04-27T10:00:00Z",
  "updatedAt": "2024-04-27T10:00:00Z"
}
```

### PUT /api/email-inbox/[id]

Update email status or classification.

**Request Body:**
```json
{
  "status": "processed",
  "classification": "NEW_CLAIM",
  "notes": "Processed successfully"
}
```

### DELETE /api/email-inbox/[id]

Delete an email from the queue.

**Response:**
```json
{
  "success": true,
  "message": "Email deleted successfully"
}
```

### POST /api/email-inbox/bulk-archive

Archive multiple emails at once.

**Request Body:**
```json
{
  "emailIds": ["clx123...", "clx456..."]
}
```

### POST /api/email-poll

Trigger IMAP email polling.

**Request Body:**
```json
{
  "limit": 100,
  "force": false
}
```

**Response:**
```json
{
  "success": true,
  "fetched": 25,
  "new": 10,
  "duplicates": 15,
  "message": "Email polling completed"
}
```

### POST /api/process-email

Process an email with AI classification and extraction.

**Request Body:**
```json
{
  "emailId": "clx123...",
  "options": {
    "extractFields": true,
    "analyzeAttachments": true
  }
}
```

**Response:**
```json
{
  "classification": "NEW_CLAIM",
  "confidence": 0.95,
  "extractedData": {
    "claimNumber": "CLM-2024-001",
    "policyNumber": "POL-12345",
    "clientName": "John Doe",
    "vehicleRegistration": "CA123456"
  },
  "attachmentResults": [...],
  "recommendation": "CREATE_CLAIM"
}
```

---

## Claims Endpoints

### GET /api/claims

List claims with pagination and filtering.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| status | string | - | Filter by status |
| claimType | string | - | Filter by type (MOTOR, PROPERTY, etc.) |
| search | string | - | Search in claim number, client name |

**Response:**
```json
{
  "claims": [
    {
      "id": "clx123...",
      "claimNumber": "CLM-2024-001",
      "clientName": "John Doe",
      "clientEmail": "john@email.com",
      "clientPhone": "+27123456789",
      "claimType": "MOTOR",
      "incidentDate": "2024-04-25",
      "incidentDescription": "Vehicle accident...",
      "vehicleRegistration": "CA123456",
      "vehicleMake": "Toyota",
      "vehicleModel": "Corolla",
      "vehicleYear": 2020,
      "vehicleColor": "White",
      "vehicleVinNumber": "AHT286CZ0J1234567",
      "engineNumber": "ENG123456",
      "status": "NEW",
      "processingStage": "INITIAL_REVIEW",
      "classificationConfidence": 0.95,
      "extractionConfidence": 0.88,
      "insuranceCompany": {
        "id": "clx456...",
        "name": "Santam",
        "shortName": "STM"
      },
      "createdAt": "2024-04-27T10:00:00Z",
      "updatedAt": "2024-04-27T10:00:00Z"
    }
  ],
  "pagination": {...},
  "stats": {
    "total": 100,
    "byStatus": {"NEW": 25, "PROCESSING": 50, "FINALIZED": 25},
    "byType": {"MOTOR": 60, "PROPERTY": 30, "OTHER": 10}
  }
}
```

### POST /api/claims

Create a new claim.

**Request Body:**
```json
{
  "claimNumber": "CLM-2024-001",
  "clientName": "John Doe",
  "clientEmail": "john@email.com",
  "clientPhone": "+27123456789",
  "claimType": "MOTOR",
  "incidentDate": "2024-04-25",
  "incidentDescription": "Vehicle accident...",
  "vehicleRegistration": "CA123456",
  "vehicleMake": "Toyota",
  "vehicleModel": "Corolla",
  "vehicleYear": 2020,
  "vehicleColor": "White",
  "vehicleVinNumber": "AHT286CZ0J1234567",
  "engineNumber": "ENG123456",
  "insuranceCompanyId": "clx456...",
  "sourceEmailId": "clx789..."
}
```

### GET /api/claims/[id]

Get detailed claim information.

### PUT /api/claims/[id]

Update claim details.

### DELETE /api/claims/[id]

Delete a claim.

---

## Learning Endpoints

### GET /api/learning

Get learning statistics and data.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Data type: stats, patterns, senders, knowledge, ignore-rules, autoignore, history |

**Response (type=stats):**
```json
{
  "stats": {
    "totalPatterns": 0,
    "totalKnowledge": 12,
    "totalSenderProfiles": 32,
    "totalIgnoreRules": 45,
    "totalRejectionFeedback": 47,
    "totalThreadPatterns": 12,
    "avgConfidence": 0
  },
  "automationLevels": [
    {"level": "manual", "count": 32}
  ],
  "topSenders": [...],
  "recentPatterns": []
}
```

**Response (type=history):**
```json
{
  "comparisons": [
    {
      "id": "clx123...",
      "type": "classification_correction",
      "typeName": "Classification Correction",
      "typeNameShort": "Classification",
      "createdAt": "2024-04-27T10:00:00Z",
      "domain": "santam.co.za",
      "description": "\"OTHER\" → \"IGNORE\"",
      "details": {
        "originalClassification": "OTHER",
        "correctedClassification": "IGNORE",
        "subject": "RE: Claim Update..."
      },
      "icon": "Tags",
      "color": "amber"
    }
  ],
  "totalComparisons": 119,
  "currentPage": 1,
  "totalPages": 6,
  "fieldMetrics": [],
  "typeCounts": {
    "fieldPrediction": 0,
    "classificationCorrection": 12,
    "ignoreRule": 45,
    "threadPattern": 12,
    "domainProfile": 3,
    "rejectionFeedback": 47
  },
  "summary": {
    "totalPredictions": 0,
    "totalCorrect": 0,
    "overallAccuracy": 0,
    "comparisonsCount": 119,
    "fieldsLearned": 0,
    "fieldsReadyForAuto": 0,
    "improvingFields": 0,
    "decliningFields": 0,
    "stableFields": 0
  }
}
```

### POST /api/learning

Create a new learning pattern.

**Request Body:**
```json
{
  "type": "pattern",
  "senderDomain": "santam.co.za",
  "insuranceCompanyId": "clx456...",
  "fieldName": "claimNumber",
  "patternHint": "STM-YYYY-NNNNN format",
  "exampleOriginal": "claim #",
  "exampleCorrected": "STM-2024-00123",
  "confidence": 75
}
```

### PUT /api/learning

Toggle auto-ignore for a rule.

**Request Body:**
```json
{
  "ruleId": "clx123...",
  "autoIgnore": true
}
```

### POST /api/rejection-feedback

Submit rejection feedback for learning.

**Request Body:**
```json
{
  "emailQueueId": "clx123...",
  "rejectionCategory": "follow_up",
  "rejectionReason": "Detected as follow-up email",
  "isFollowUp": true,
  "relatedClaimId": "CLM-2024-001",
  "applyToSender": true,
  "suggestedRule": "Auto-ignore Re: emails from this sender"
}
```

---

## Insurance Endpoints

### GET /api/insurance

List insurance companies.

**Response:**
```json
{
  "companies": [
    {
      "id": "clx123...",
      "name": "Santam",
      "shortName": "STM",
      "folderName": "Santam",
      "senderDomains": ["santam.co.za", "santam.com"],
      "contactEmail": "claims@santam.co.za",
      "contactPhone": "+27123456789",
      "isActive": true,
      "notes": "South African insurer",
      "claimCount": 150,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/insurance

Create a new insurance company.

### PUT /api/insurance/[id]

Update insurance company details.

### DELETE /api/insurance/[id]

Delete an insurance company.

---

## Attachment Endpoints

### GET /api/refetch-attachments

Get attachment statistics.

**Response:**
```json
{
  "totalEmails": 100,
  "emailsNeedingRefetch": 25,
  "emailsNoAttachments": 50,
  "emailsFetched": 25,
  "percentage": 75
}
```

### POST /api/refetch-attachments

Batch refetch attachments from IMAP.

**Request Body:**
```json
{
  "emailIds": ["clx123...", "clx456..."],
  "limit": 50
}
```

### POST /api/attachment-analysis

Analyze attachments for claim detection.

**Request Body:**
```json
{
  "emailId": "clx123...",
  "attachmentIds": ["att1...", "att2..."]
}
```

**Response:**
```json
{
  "results": [
    {
      "attachmentId": "att1...",
      "documentType": "CLAIM_FORM",
      "confidence": 0.95,
      "extractedData": {
        "claimNumber": "CLM-2024-001",
        "policyHolder": "John Doe",
        "vehicleRegistration": "CA123456"
      },
      "claimLikelihood": 85
    }
  ],
  "overallClaimLikelihood": 85,
  "recommendation": "CREATE_CLAIM"
}
```

---

## Analytics Endpoints

### GET /api/dashboard

Get dashboard statistics.

**Response:**
```json
{
  "emailStats": {
    "pending": 25,
    "processing": 10,
    "processed": 50,
    "archived": 15
  },
  "claimStats": {
    "total": 100,
    "new": 25,
    "processing": 50,
    "finalized": 25
  },
  "recentClaims": [...],
  "recentActivity": [...],
  "processingTimes": {
    "avgClassificationTime": 2.5,
    "avgExtractionTime": 5.2,
    "avgTotalTime": 7.7
  }
}
```

---

## Settings Endpoints

### GET /api/settings

Get system settings.

### PUT /api/settings

Update system settings.

**Request Body:**
```json
{
  "imapHost": "imap.provider.com",
  "imapPort": 993,
  "imapUser": "email@domain.com",
  "imapPassword": "encrypted_password",
  "imapSsl": true,
  "pollingInterval": 300,
  "autoArchive": true,
  "notificationsEnabled": true
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 404 | Not Found |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": {
    "field": "Additional context"
  }
}
```

### Common Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `INVALID_INPUT` | Request body validation failed | Check required fields |
| `NOT_FOUND` | Resource doesn't exist | Verify ID is correct |
| `DUPLICATE_ENTRY` | Resource already exists | Use unique identifiers |
| `PROCESSING_ERROR` | AI processing failed | Retry or check input quality |
| `RATE_LIMITED` | Too many requests | Wait and retry |

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints | 100 | 1 minute |
| AI endpoints | 30 | 1 minute |
| Poll endpoints | 10 | 1 minute |

---

**Document End**

*For implementation details, see the source code in src/app/api/. For development questions, refer to docs/DEVELOPER_HANDOVER.md.*
