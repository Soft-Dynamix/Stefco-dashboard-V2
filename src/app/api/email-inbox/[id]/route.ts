import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const email = await db.emailQueue.findUnique({
      where: { id },
      include: {
        predictions: true,
      },
    });

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    return NextResponse.json(email);
  } catch (error) {
    console.error("Email GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch email" },
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
    
    const email = await db.emailQueue.update({
      where: { id },
      data: {
        status: body.status,
        ignoreReason: body.ignoreReason,
        ignoreCategory: body.ignoreCategory,
        processedAt: new Date(),
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "email_updated",
        entityType: "email",
        entityId: email.id,
        details: JSON.stringify({ status: body.status }),
        status: "SUCCESS",
        processedBy: "MANUAL",
      },
    });

    return NextResponse.json(email);
  } catch (error) {
    console.error("Email PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update email" },
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
    
    await db.emailQueue.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Email DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete email" },
      { status: 500 }
    );
  }
}
