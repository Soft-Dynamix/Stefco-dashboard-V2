import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const companies = await db.insuranceCompany.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { claims: true },
        },
      },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("Insurance GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insurance companies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const company = await db.insuranceCompany.create({
      data: {
        name: body.name,
        shortName: body.shortName,
        folderName: body.folderName || body.name.toLowerCase().replace(/\s+/g, "-"),
        senderDomains: body.senderDomains ? JSON.stringify(body.senderDomains) : null,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        notes: body.notes,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Insurance POST error:", error);
    return NextResponse.json(
      { error: "Failed to create insurance company" },
      { status: 500 }
    );
  }
}
