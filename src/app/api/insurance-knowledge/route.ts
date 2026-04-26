import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// South African Insurance Companies - Seed Data
const SA_INSURANCE_COMPANIES = [
  { domainPattern: "santam.co.za", companyName: "Santam", shortName: "STM" },
  { domainPattern: "outsurance.co.za", companyName: "OUTsurance", shortName: "OUT" },
  { domainPattern: "discovery.co.za", companyName: "Discovery Insure", shortName: "DIS" },
  { domainPattern: "discoveryinsurance.co.za", companyName: "Discovery Insure", shortName: "DIS" },
  { domainPattern: "miway.co.za", companyName: "MiWay", shortName: "MIW" },
  { domainPattern: "oldmutual.co.za", companyName: "Old Mutual Insure", shortName: "OMI" },
  { domainPattern: "mutualandfederal.co.za", companyName: "Old Mutual Insure", shortName: "OMI" },
  { domainPattern: "hollard.co.za", companyName: "Hollard Insurance", shortName: "HOL" },
  { domainPattern: "hollardinsure.co.za", companyName: "Hollard Insurance", shortName: "HOL" },
  { domainPattern: "budgetinsurance.co.za", companyName: "Budget Insurance", shortName: "BUD" },
  { domainPattern: "kingprice.co.za", companyName: "King Price Insurance", shortName: "KPI" },
  { domainPattern: "momentum.co.za", companyName: "Momentum Insure", shortName: "MMI" },
  { domainPattern: "momentuminsure.co.za", companyName: "Momentum Insure", shortName: "MMI" },
  { domainPattern: "liberty.co.za", companyName: "Liberty Insurance", shortName: "LIB" },
  { domainPattern: "africanbank.co.za", companyName: "African Bank Insurance", shortName: "ABI" },
  { domainPattern: "fnb.co.za", companyName: "FNB Insurance", shortName: "FNB" },
  { domainPattern: "standardbank.co.za", companyName: "Standard Bank Insurance", shortName: "SBI" },
  { domainPattern: "absa.co.za", companyName: "Absa Insurance", shortName: "ABS" },
  { domainPattern: "capitecbank.co.za", companyName: "Capitec Insurance", shortName: "CAP" },
  { domainPattern: "telesure.co.za", companyName: "Telesure Investment Holdings", shortName: "TIH" },
  { domainPattern: "aon.co.za", companyName: "Aon South Africa", shortName: "AON" },
  { domainPattern: "marsh.co.za", companyName: "Marsh Africa", shortName: "MAR" },
  { domainPattern: "alexanderforbes.co.za", companyName: "Alexander Forbes", shortName: "AFB" },
  { domainPattern: "sanlam.co.za", companyName: "Sanlam Insurance", shortName: "SLM" },
  { domainPattern: "gryphon.co.za", companyName: "Gryphon Insurance", shortName: "GRY" },
  { domainPattern: "cibs.co.za", companyName: "CIB Insurance Administrators", shortName: "CIB" },
  { domainPattern: "chartis.co.za", companyName: "AIG South Africa", shortName: "AIG" },
  { domainPattern: "aig.co.za", companyName: "AIG South Africa", shortName: "AIG" },
  { domainPattern: "allianz.co.za", companyName: "Allianz Global Corporate", shortName: "ALZ" },
  { domainPattern: "chubb.co.za", companyName: "Chubb Insurance", shortName: "CHB" },
  { domainPattern: "renasa.co.za", companyName: "RENASA Insurance", shortName: "RNA" },
  { domainPattern: "sbv.co.za", companyName: "SBV Services Insurance", shortName: "SBV" },
  { domainPattern: "mag.co.za", companyName: "Mutual & Federal", shortName: "M&F" },
  { domainPattern: "cabiskills.co.za", companyName: "CABI Skills Insurance", shortName: "CAB" },
  { domainPattern: "equilibrium.co.za", companyName: "Equilibrium Insurance", shortName: "EQU" },
  { domainPattern: "zimn.co.za", companyName: "Zimn Insurance", shortName: "ZIM" },
  { domainPattern: "gaursure.co.za", companyName: "GA Insurance", shortName: "GAI" },
  { domainPattern: "sabinet.co.za", companyName: "Sabinet Insurance", shortName: "SAB" },
  { domainPattern: "multishield.co.za", companyName: "Multishield Insurance", shortName: "MSH" },
];

// GET - Fetch all insurance domain knowledge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");
  const active = searchParams.get("active");

  try {
    if (domain) {
      // Look up specific domain
      const knowledge = await db.insuranceDomainKnowledge.findFirst({
        where: {
          OR: [
            { domainPattern: domain },
            { domainPattern: domain.replace(/^[^.]+\./, "*.") },
          ],
          isActive: active !== "false",
        },
      });
      return NextResponse.json({ knowledge });
    }

    const allKnowledge = await db.insuranceDomainKnowledge.findMany({
      where: active !== "false" ? { isActive: true } : {},
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json(allKnowledge);
  } catch (error) {
    console.error("Error fetching insurance knowledge:", error);
    return NextResponse.json(
      { error: "Failed to fetch insurance knowledge" },
      { status: 500 }
    );
  }
}

// POST - Seed insurance domain knowledge (run once)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "seed") {
      let created = 0;
      let updated = 0;

      for (const company of SA_INSURANCE_COMPANIES) {
        const existing = await db.insuranceDomainKnowledge.findUnique({
          where: { domainPattern: company.domainPattern },
        });

        if (existing) {
          await db.insuranceDomainKnowledge.update({
            where: { id: existing.id },
            data: {
              companyName: company.companyName,
              shortName: company.shortName,
              isActive: true,
            },
          });
          updated++;
        } else {
          await db.insuranceDomainKnowledge.create({
            data: {
              domainPattern: company.domainPattern,
              companyName: company.companyName,
              shortName: company.shortName,
              country: "ZA",
              isActive: true,
            },
          });
          created++;
        }
      }

      return NextResponse.json({
        message: "Insurance domain knowledge seeded",
        created,
        updated,
        total: SA_INSURANCE_COMPANIES.length,
      });
    }

    if (action === "add") {
      const { domainPattern, companyName, shortName, country } = body;

      if (!domainPattern || !companyName) {
        return NextResponse.json(
          { error: "domainPattern and companyName are required" },
          { status: 400 }
        );
      }

      const knowledge = await db.insuranceDomainKnowledge.create({
        data: {
          domainPattern,
          companyName,
          shortName,
          country: country || "ZA",
          isActive: true,
        },
      });

      return NextResponse.json(knowledge);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error seeding insurance knowledge:", error);
    return NextResponse.json(
      { error: "Failed to seed insurance knowledge" },
      { status: 500 }
    );
  }
}

// DELETE - Remove insurance domain knowledge
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    await db.insuranceDomainKnowledge.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Deactivated successfully" });
  } catch (error) {
    console.error("Error deleting insurance knowledge:", error);
    return NextResponse.json(
      { error: "Failed to delete insurance knowledge" },
      { status: 500 }
    );
  }
}
