import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// Mock email templates for different insurance scenarios
const mockEmailTemplates = [
  {
    subject: "New Claim Appointment - {claimNumber}",
    from: "claims@hollard.co.za",
    fromDomain: "hollard.co.za",
    category: "NEW_CLAIM",
    body: `Dear Stefco Consultants,

You have been appointed to assess a new motor vehicle claim.

Claim Details:
- Claim Number: {claimNumber}
- Client Name: {clientName}
- Contact Number: {clientPhone}
- Email: {clientEmail}
- Date of Loss: {incidentDate}
- Vehicle: {vehicleMake} {vehicleModel}
- Registration: {vehicleRegistration}
- Excess Amount: R{excessAmount}

Incident Description:
{incidentDescription}

Please contact the client within 24 hours to arrange an assessment.

Kind regards,
Hollard Insurance Claims Department
claims@hollard.co.za`,
  },
  {
    subject: "Insurance Claim Appointment - {claimNumber}",
    from: "motorclaims@oldmutual.co.za",
    fromDomain: "oldmutual.co.za",
    category: "NEW_CLAIM",
    body: `NOTIFICATION OF CLAIM APPOINTMENT

This serves to inform you that you have been appointed as the assessor for the following claim:

Claim Reference: {claimNumber}
Type: Motor Vehicle Claim

CLIENT DETAILS:
Name: {clientName}
Phone: {clientPhone}
Email: {clientEmail}

INCIDENT DETAILS:
Date: {incidentDate}
Location: Johannesburg
Description: {incidentDescription}

VEHICLE DETAILS:
Make: {vehicleMake}
Model: {vehicleModel}
Registration: {vehicleRegistration}
Excess: R{excessAmount}

Please acknowledge receipt of this appointment.

Old Mutual Insure
Claims Management Centre`,
  },
  {
    subject: "NUWE EIS AANSTELLING - {claimNumber}",
    from: "eise@santam.co.za",
    fromDomain: "santam.co.za",
    category: "NEW_CLAIM",
    body: `Geagte Stefco Consultants,

U is aangestel as beoordelaar vir die volgende versekerings eis:

EIS BESONDERHEDE:
Eis Nommer: {claimNumber}
Kliënt Naam: {clientName}
Kontak Nommer: {clientPhone}

VOERTUIG BESONDERHEDE:
Voertuig: {vehicleMake} {vehicleModel}
Registrasie: {vehicleRegistration}

Voorval Beskrywing:
{incidentDescription}

Kontak asseblief die kliënt binne 24 uur.

Vriendelike groete,
Santam Eise Afdeling`,
  },
  {
    subject: "Property Claim Appointment - {claimNumber}",
    from: "property@discovery.co.za",
    fromDomain: "discovery.co.za",
    category: "NEW_CLAIM",
    body: `Discovery Insure - Property Claim Appointment

Claim Number: {claimNumber}

Dear Assessor,

You have been appointed to assess the following property claim:

CLIENT INFORMATION:
Name: {clientName}
Contact: {clientPhone}
Email: {clientEmail}

PROPERTY DETAILS:
Address: {propertyAddress}

INCIDENT INFORMATION:
Date of Incident: {incidentDate}
Type: Fire Damage
Description: {incidentDescription}

Excess Amount: R{excessAmount}

Please arrange to inspect the property at your earliest convenience.

Discovery Insure
Property Claims Department`,
  },
  {
    subject: "RE: Your Appointment Request",
    from: "info@somecompany.co.za",
    fromDomain: "somecompany.co.za",
    category: "OTHER",
    body: `Hi,

Thank you for your email. We have received your request and will process it shortly.

Please allow 3-5 working days for a response.

Best regards,
Customer Service`,
  },
  {
    subject: "Out of Office: Away until next week",
    from: "john.doe@insurancebrokers.co.za",
    fromDomain: "insurancebrokers.co.za",
    category: "IGNORE",
    body: `I am currently out of the office and will return on Monday.

For urgent matters, please contact my colleague at colleague@insurancebrokers.co.za.

Regards,
John Doe`,
  },
  {
    subject: "SPECIAL OFFER - Insurance Marketing",
    from: "promotions@marketing.co.za",
    fromDomain: "marketing.co.za",
    category: "IGNORE",
    body: `SPECIAL OFFER!!!

Get 50% off your next insurance premium!

Click here to find out more about our amazing deals!

Unsubscribe link at bottom.

Marketing Promotions Ltd`,
  },
  {
    subject: "Claim Appointment - {claimNumber}",
    from: "claims@telesure.co.za",
    fromDomain: "telesure.co.za",
    category: "NEW_CLAIM",
    body: `TELESURE CLAIMS NOTIFICATION

Claim Number: {claimNumber}
Appointment Type: Motor Vehicle Assessment

CLIENT DETAILS:
Name: {clientName}
Contact Number: {clientPhone}
Email Address: {clientEmail}

INCIDENT DETAILS:
Date of Incident: {incidentDate}
Location: Pretoria
Incident Type: Collision

VEHICLE INFORMATION:
Make: {vehicleMake}
Model: {vehicleModel}
Registration Number: {vehicleRegistration}

Excess Payable: R{excessAmount}

Please confirm your availability for this appointment.

Telesure Claims Management`,
  },
];

// Data pools for randomization
const clientNames = [
  "Johan van der Merwe", "Pieter Smit", "Jan Botha", "Willem Joubert",
  "Maretha Coetzee", "Anneke Pretorius", "Frikkie Venter", "Koos de Wet",
  "Thabo Molefe", "Lerato Dlamini", "Sipho Nkosi", "Nomsa Mbeki",
  "David Johnson", "Sarah Williams", "Michael Brown", "Jennifer Thompson",
  "James Wilson", "Emma Davis", "Robert Miller", "Lisa Anderson"
];

const vehicleMakes = ["Toyota", "Volkswagen", "Ford", "BMW", "Mercedes-Benz", "Audi", "Hyundai", "Kia", "Nissan", "Mazda"];
const vehicleModels = ["Corolla", "Golf", "Ranger", "320i", "C200", "A4", "i30", "Cerato", "Navara", "CX-5"];

const incidentDescriptions = [
  "Rear-end collision at traffic light. Minor damage to bumper and trunk.",
  "Hail damage to roof and bonnet. Multiple dents visible.",
  "Side swipe while parking. Scratches and dent on passenger door.",
  "Front-end collision. Radiator damage and bumper replacement needed.",
  "Windscreen cracked by flying debris on highway.",
  "Attempted theft. Damaged door lock and ignition.",
  "Single vehicle accident. Vehicle veered off road into ditch.",
  "Multi-vehicle pile-up on highway. Front and rear damage.",
];

const propertyAddresses = [
  "123 Main Street, Sandton, 2196",
  "456 Oak Avenue, Pretoria, 0001",
  "789 Pine Road, Cape Town, 8001",
  "321 Elm Lane, Durban, 4001",
  "654 Willow Drive, Bloemfontein, 9301",
];

function generateClaimNumber(): string {
  const prefixes = ["CLM", "HOL", "OMC", "SAN", "DIS", "TEL", "AA", "MOT"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const year = new Date().getFullYear();
  const number = Math.floor(Math.random() * 900000) + 100000;
  return `${prefix}/${year}/${number}`;
}

function generatePhone(): string {
  return `0${Math.floor(Math.random() * 9) + 1}${Math.floor(Math.random() * 10000000).toString().padStart(8, '0')}`;
}

function generateEmail(name: string): string {
  const clean = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
  const domains = ["gmail.com", "yahoo.com", "outlook.com", "mweb.co.za", "telkomsa.net"];
  return `${clean}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function generateRegistration(): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return `${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]}${letters[Math.floor(Math.random() * 26)]} GP`;
}

function generateMessageId(subject: string, body: string, from: string): string {
  const content = `${subject}:${body}:${from}:${Date.now()}`;
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(body.count || 1, 20); // Max 20 emails at a time
    const type = body.type || "random"; // "random", "claim", "ignore"

    const createdEmails = [];

    for (let i = 0; i < count; i++) {
      // Select template based on type
      let template;
      if (type === "claim") {
        const claimTemplates = mockEmailTemplates.filter(t => t.category === "NEW_CLAIM");
        template = claimTemplates[Math.floor(Math.random() * claimTemplates.length)];
      } else if (type === "ignore") {
        const ignoreTemplates = mockEmailTemplates.filter(t => t.category === "IGNORE" || t.category === "OTHER");
        template = ignoreTemplates[Math.floor(Math.random() * ignoreTemplates.length)];
      } else {
        // Random but weighted toward claims (70% claims, 20% ignore, 10% other)
        const rand = Math.random();
        if (rand < 0.7) {
          const claimTemplates = mockEmailTemplates.filter(t => t.category === "NEW_CLAIM");
          template = claimTemplates[Math.floor(Math.random() * claimTemplates.length)];
        } else if (rand < 0.9) {
          const ignoreTemplates = mockEmailTemplates.filter(t => t.category === "IGNORE");
          template = ignoreTemplates[Math.floor(Math.random() * ignoreTemplates.length)];
        } else {
          const otherTemplates = mockEmailTemplates.filter(t => t.category === "OTHER");
          template = otherTemplates[Math.floor(Math.random() * otherTemplates.length)];
        }
      }

      // Generate random data
      const claimNumber = generateClaimNumber();
      const clientName = clientNames[Math.floor(Math.random() * clientNames.length)];
      const vehicleMake = vehicleMakes[Math.floor(Math.random() * vehicleMakes.length)];
      const vehicleModel = vehicleModels[Math.floor(Math.random() * vehicleModels.length)];
      const incidentDescription = incidentDescriptions[Math.floor(Math.random() * incidentDescriptions.length)];
      const incidentDate = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
      const excessAmount = (Math.floor(Math.random() * 50) + 10) * 100;

      // Replace placeholders
      let emailBody = template.body
        .replace(/{claimNumber}/g, claimNumber)
        .replace(/{clientName}/g, clientName)
        .replace(/{clientPhone}/g, generatePhone())
        .replace(/{clientEmail}/g, generateEmail(clientName))
        .replace(/{incidentDate}/g, incidentDate)
        .replace(/{vehicleMake}/g, vehicleMake)
        .replace(/{vehicleModel}/g, vehicleModel)
        .replace(/{vehicleRegistration}/g, generateRegistration())
        .replace(/{excessAmount}/g, excessAmount.toString())
        .replace(/{incidentDescription}/g, incidentDescription)
        .replace(/{propertyAddress}/g, propertyAddresses[Math.floor(Math.random() * propertyAddresses.length)]);

      let emailSubject = template.subject
        .replace(/{claimNumber}/g, claimNumber);

      const messageId = generateMessageId(emailSubject, emailBody, template.from);

      // Check for duplicate
      const existing = await db.emailQueue.findUnique({
        where: { messageId },
      });

      if (existing) {
        continue; // Skip duplicate
      }

      // Create email in queue
      const email = await db.emailQueue.create({
        data: {
          messageId,
          subject: emailSubject,
          from: template.from,
          fromDomain: template.fromDomain,
          to: "claims@stefco.co.za",
          bodyText: emailBody,
          bodyHtml: null,
          attachments: null,
          emailDate: new Date(),
          status: "PENDING",
          processingRoute: "manual_review",
        },
      });

      createdEmails.push({
        id: email.id,
        subject: emailSubject,
        from: template.from,
        category: template.category,
      });

      // Create/update domain profile for tracking
      const existingProfile = await db.domainProfile.findUnique({
        where: { domain: template.fromDomain },
      });

      if (!existingProfile) {
        await db.domainProfile.create({
          data: {
            domain: template.fromDomain,
            automationLevel: "manual",
            totalEmails: 1,
            confidenceScore: 0,
          },
        });
      } else {
        await db.domainProfile.update({
          where: { domain: template.fromDomain },
          data: {
            totalEmails: { increment: 1 },
          },
        });
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "test_emails_generated",
        entityType: "system",
        details: JSON.stringify({ count: createdEmails.length, type }),
        status: "SUCCESS",
        processedBy: "MANUAL",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Generated ${createdEmails.length} test email(s)`,
      count: createdEmails.length,
      emails: createdEmails,
    });
  } catch (error) {
    console.error("Failed to generate test emails:", error);
    return NextResponse.json(
      { error: "Failed to generate test emails", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return available email types
  return NextResponse.json({
    types: ["random", "claim", "ignore"],
    maxCount: 20,
    description: "Generate test emails for testing the claims processing workflow",
    usage: "POST with { count: number, type: 'random'|'claim'|'ignore' }",
  });
}
