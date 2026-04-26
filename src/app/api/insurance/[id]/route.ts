import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const company = await db.insuranceCompany.findUnique({
      where: { id },
      include: {
        claims: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        learningPatterns: true,
        _count: {
          select: { claims: true },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    console.error("Insurance GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch insurance company" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const company = await db.insuranceCompany.update({
      where: { id },
      data: {
        name: body.name,
        shortName: body.shortName,
        folderName: body.folderName,
        senderDomains: body.senderDomains ? JSON.stringify(body.senderDomains) : null,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        notes: body.notes,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("Insurance PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update insurance company" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.insuranceCompany.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Insurance DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete insurance company" },
      { status: 500 }
    );
  }
}
