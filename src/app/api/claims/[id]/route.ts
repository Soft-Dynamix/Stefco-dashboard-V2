import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        insuranceCompany: true,
        notes: {
          orderBy: { createdAt: "desc" },
        },
        feedback: {
          orderBy: { createdAt: "desc" },
        },
        printQueueItems: true,
      },
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Claim GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch claim" },
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
    
    const claim = await db.claim.update({
      where: { id },
      data: {
        claimNumber: body.claimNumber,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        clientPhone: body.clientPhone,
        claimType: body.claimType,
        incidentDate: body.incidentDate ? new Date(body.incidentDate) : null,
        incidentDescription: body.incidentDescription,
        vehicleRegistration: body.vehicleRegistration,
        vehicleMake: body.vehicleMake,
        vehicleModel: body.vehicleModel,
        propertyAddress: body.propertyAddress,
        excessAmount: body.excessAmount ? parseFloat(body.excessAmount) : null,
        insuranceCompanyId: body.insuranceCompanyId,
        status: body.status,
        processingStage: body.processingStage,
        reviewedBy: body.reviewedBy,
        reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : null,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "claim_updated",
        entityType: "claim",
        entityId: claim.id,
        details: JSON.stringify({ claimNumber: claim.claimNumber, updates: body }),
        status: "SUCCESS",
        processedBy: "MANUAL",
        claimId: claim.id,
      },
    });

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Claim PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update claim" },
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
    
    await db.claim.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Claim DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete claim" },
      { status: 500 }
    );
  }
}
