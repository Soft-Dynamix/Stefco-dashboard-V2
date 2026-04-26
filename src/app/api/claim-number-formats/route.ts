import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// South African Insurance Claim Number Formats
const SA_CLAIM_FORMATS = [
  {
    companyShortName: "STM",
    formatPattern: "STM-YYYY-NNNNN",
    prefix: "STM",
    separator: "-",
    hasYear: true,
    yearPosition: 2,
    numberLength: 5,
    regexPattern: "STM-(\\d{4})-(\\d{5,8})",
    example: "STM-2024-12345",
    description: "Santam claim number format: STM-YYYY-NNNNN",
  },
  {
    companyShortName: "OUT",
    formatPattern: "OUT/NNNNNN/YY",
    prefix: "OUT",
    separator: "/",
    hasYear: true,
    yearPosition: 3,
    numberLength: 6,
    regexPattern: "OUT/(\\d{6})/(\\d{2})",
    example: "OUT/123456/24",
    description: "OUTsurance claim number format",
  },
  {
    companyShortName: "DIS",
    formatPattern: "DISYYYYNNNNNN",
    prefix: "DIS",
    separator: "",
    hasYear: true,
    yearPosition: 1,
    numberLength: 6,
    regexPattern: "DIS(\\d{4})(\\d{6})",
    example: "DIS2024123456",
    description: "Discovery Insure claim number format",
  },
  {
    companyShortName: "MIW",
    formatPattern: "MIW-NNNNNN",
    prefix: "MIW",
    separator: "-",
    hasYear: false,
    numberLength: 6,
    regexPattern: "MIW-(\\d{6,8})",
    example: "MIW-123456",
    description: "MiWay claim number format",
  },
  {
    companyShortName: "OMI",
    formatPattern: "MFNNNNN/YY",
    prefix: "MF",
    separator: "/",
    hasYear: true,
    yearPosition: 2,
    numberLength: 5,
    regexPattern: "MF(\\d{5})/(\\d{2})",
    example: "MF12345/24",
    description: "Old Mutual Insure claim number format",
  },
  {
    companyShortName: "HOL",
    formatPattern: "HOLYYYYNNNNN",
    prefix: "HOL",
    separator: "",
    hasYear: true,
    yearPosition: 1,
    numberLength: 5,
    regexPattern: "HOL(\\d{4})(\\d{5,6})",
    example: "HOL202412345",
    description: "Hollard claim number format",
  },
  {
    companyShortName: "BUD",
    formatPattern: "BUD-YY-NNNNNN",
    prefix: "BUD",
    separator: "-",
    hasYear: true,
    yearPosition: 2,
    numberLength: 6,
    regexPattern: "BUD-(\\d{2})-(\\d{6})",
    example: "BUD-24-123456",
    description: "Budget Insurance claim number format",
  },
  {
    companyShortName: "KPI",
    formatPattern: "KPI/NNNNNN/YY",
    prefix: "KPI",
    separator: "/",
    hasYear: true,
    yearPosition: 3,
    numberLength: 6,
    regexPattern: "KPI/(\\d{6})/(\\d{2})",
    example: "KPI/123456/24",
    description: "King Price claim number format",
  },
  {
    companyShortName: "MMI",
    formatPattern: "MMI-NNNNNNN",
    prefix: "MMI",
    separator: "-",
    hasYear: false,
    numberLength: 7,
    regexPattern: "MMI-(\\d{7})",
    example: "MMI-1234567",
    description: "Momentum Insure claim number format",
  },
  {
    companyShortName: "LIB",
    formatPattern: "LIBYYNNNNNN",
    prefix: "LIB",
    separator: "",
    hasYear: true,
    yearPosition: 1,
    numberLength: 6,
    regexPattern: "LIB(\\d{2})(\\d{6})",
    example: "LIB24123456",
    description: "Liberty claim number format",
  },
  {
    companyShortName: "FNB",
    formatPattern: "FNB-CLM-NNNNNN",
    prefix: "FNB-CLM",
    separator: "-",
    hasYear: false,
    numberLength: 6,
    regexPattern: "FNB-CLM-(\\d{6})",
    example: "FNB-CLM-123456",
    description: "FNB Insurance claim number format",
  },
  {
    companyShortName: "ABS",
    formatPattern: "ABS/NNNNNN/YY",
    prefix: "ABS",
    separator: "/",
    hasYear: true,
    yearPosition: 3,
    numberLength: 6,
    regexPattern: "ABS/(\\d{6})/(\\d{2})",
    example: "ABS/123456/24",
    description: "Absa Insurance claim number format",
  },
  {
    companyShortName: "CAP",
    formatPattern: "CAP-NNNNNNN",
    prefix: "CAP",
    separator: "-",
    hasYear: false,
    numberLength: 7,
    regexPattern: "CAP-(\\d{7})",
    example: "CAP-1234567",
    description: "Capitec Insurance claim number format",
  },
  {
    companyShortName: "AON",
    formatPattern: "AON/YY/NNNNNN",
    prefix: "AON",
    separator: "/",
    hasYear: true,
    yearPosition: 2,
    numberLength: 6,
    regexPattern: "AON/(\\d{2})/(\\d{6})",
    example: "AON/24/123456",
    description: "Aon claim number format",
  },
  {
    companyShortName: "SLM",
    formatPattern: "SLMYYYYNNNNN",
    prefix: "SLM",
    separator: "",
    hasYear: true,
    yearPosition: 1,
    numberLength: 5,
    regexPattern: "SLM(\\d{4})(\\d{5})",
    example: "SLM202412345",
    description: "Sanlam claim number format",
  },
];

// GET - Fetch claim number formats
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  try {
    const where: Record<string, unknown> = { isActive: true };
    if (companyId) where.insuranceCompanyId = companyId;

    const formats = await db.claimNumberFormat.findMany({
      where,
      orderBy: { matchCount: "desc" },
    });

    return NextResponse.json(formats);
  } catch (error) {
    console.error("Error fetching claim number formats:", error);
    return NextResponse.json(
      { error: "Failed to fetch formats" },
      { status: 500 }
    );
  }
}

// POST - Seed SA claim number formats
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, insuranceCompanyId, shortName } = body;

    if (action === "seed_all") {
      let created = 0;

      for (const format of SA_CLAIM_FORMATS) {
        // Find company by short name
        const company = await db.insuranceCompany.findFirst({
          where: {
            OR: [
              { shortName: format.companyShortName },
              { name: { contains: format.companyShortName } },
            ],
          },
        });

        if (company) {
          const existing = await db.claimNumberFormat.findFirst({
            where: {
              insuranceCompanyId: company.id,
              formatPattern: format.formatPattern,
            },
          });

          if (!existing) {
            await db.claimNumberFormat.create({
              data: {
                insuranceCompanyId: company.id,
                formatPattern: format.formatPattern,
                prefix: format.prefix,
                separator: format.separator,
                hasYear: format.hasYear,
                yearPosition: format.yearPosition,
                numberLength: format.numberLength,
                regexPattern: format.regexPattern,
                example: format.example,
              },
            });
            created++;
          }
        }
      }

      return NextResponse.json({
        message: "Claim number formats seeded",
        created,
        total: SA_CLAIM_FORMATS.length,
      });
    }

    if (action === "create" && insuranceCompanyId) {
      const format = body.format;
      const newFormat = await db.claimNumberFormat.create({
        data: {
          insuranceCompanyId,
          formatPattern: format.formatPattern,
          prefix: format.prefix,
          separator: format.separator,
          hasYear: format.hasYear,
          yearPosition: format.yearPosition,
          numberLength: format.numberLength,
          regexPattern: format.regexPattern,
          example: format.example,
        },
      });

      return NextResponse.json(newFormat);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error with claim number formats:", error);
    return NextResponse.json(
      { error: "Failed to process claim number formats" },
      { status: 500 }
    );
  }
}

// Test a claim number against all patterns
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { claimNumber } = body;

    if (!claimNumber) {
      return NextResponse.json(
        { error: "claimNumber is required" },
        { status: 400 }
      );
    }

    const formats = await db.claimNumberFormat.findMany({
      where: { isActive: true },
      include: {
        insuranceCompany: {
          select: { id: true, name: true, shortName: true },
        },
      },
    });

    const matches: Array<{
      companyId: string;
      companyName: string;
      confidence: number;
      matchDetails: Record<string, unknown>;
    }> = [];

    for (const format of formats) {
      try {
        const regex = new RegExp(`^${format.regexPattern}$`, "i");
        const match = claimNumber.match(regex);
        if (match) {
          matches.push({
            companyId: format.insuranceCompanyId,
            companyName: format.insuranceCompany.name,
            confidence: format.confidence,
            matchDetails: {
              format: format.formatPattern,
              prefix: format.prefix,
              hasYear: format.hasYear,
            },
          });

          // Update match count
          await db.claimNumberFormat.update({
            where: { id: format.id },
            data: { matchCount: { increment: 1 } },
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return NextResponse.json({
      claimNumber,
      matches,
      bestMatch: matches.length > 0 ? matches[0] : null,
    });
  } catch (error) {
    console.error("Error testing claim number:", error);
    return NextResponse.json(
      { error: "Failed to test claim number" },
      { status: 500 }
    );
  }
}
