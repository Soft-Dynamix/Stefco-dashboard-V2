import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Fetch extraction patterns for a company or all
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");
  const fieldType = searchParams.get("fieldType");
  const active = searchParams.get("active");

  try {
    const where: Record<string, unknown> = {};
    if (companyId) where.insuranceCompanyId = companyId;
    if (fieldType) where.fieldType = fieldType;
    if (active !== "false") where.isActive = true;

    const patterns = await db.extractionPattern.findMany({
      where,
      include: {
        insuranceCompany: {
          select: { name: true, shortName: true },
        },
      },
      orderBy: [
        { priority: "desc" },
        { confidence: "desc" },
      ],
    });

    // Get examples for each pattern
    const patternsWithExamples = await Promise.all(
      patterns.map(async (pattern) => {
        const examples = await db.extractionExample.findMany({
          where: {
            insuranceCompanyId: pattern.insuranceCompanyId,
            fieldType: pattern.fieldType,
          },
          take: 5,
        });
        return { ...pattern, examples };
      })
    );

    return NextResponse.json(patternsWithExamples);
  } catch (error) {
    console.error("Error fetching extraction patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch patterns" },
      { status: 500 }
    );
  }
}

// POST - Create new extraction pattern
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      insuranceCompanyId,
      fieldType,
      patternType,
      patternValue,
      description,
      exampleMatch,
      isSystemPattern,
    } = body;

    if (!insuranceCompanyId || !fieldType || !patternValue) {
      return NextResponse.json(
        { error: "insuranceCompanyId, fieldType, and patternValue are required" },
        { status: 400 }
      );
    }

    // Validate regex if pattern type is regex
    if (patternType === "regex") {
      try {
        new RegExp(patternValue);
      } catch {
        return NextResponse.json(
          { error: "Invalid regex pattern" },
          { status: 400 }
        );
      }
    }

    const pattern = await db.extractionPattern.create({
      data: {
        insuranceCompanyId,
        fieldType,
        patternType: patternType || "regex",
        patternValue,
        description,
        exampleMatch,
        isSystemPattern: isSystemPattern || false,
        confidence: 70,
      },
    });

    // Create audit log
    await db.auditLog.create({
      data: {
        action: "extraction_pattern_created",
        entityType: "extraction_pattern",
        entityId: pattern.id,
        details: JSON.stringify({
          companyId: insuranceCompanyId,
          fieldType,
          pattern: patternValue,
        }),
        status: "SUCCESS",
      },
    });

    return NextResponse.json(pattern);
  } catch (error) {
    console.error("Error creating extraction pattern:", error);
    return NextResponse.json(
      { error: "Failed to create pattern" },
      { status: 500 }
    );
  }
}

// PUT - Update pattern (success/failure tracking)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternId, action } = body;

    if (!patternId || !action) {
      return NextResponse.json(
        { error: "patternId and action are required" },
        { status: 400 }
      );
    }

    const pattern = await db.extractionPattern.findUnique({
      where: { id: patternId },
    });

    if (!pattern) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 }
      );
    }

    let updateData: Record<string, unknown> = {};

    if (action === "success") {
      updateData = {
        successCount: { increment: 1 },
        confidence: Math.min(95, pattern.confidence + 1),
      };
    } else if (action === "failure") {
      updateData = {
        failureCount: { increment: 1 },
        confidence: Math.max(50, pattern.confidence - 2),
      };
    } else if (action === "update") {
      updateData = {
        patternValue: body.patternValue,
        description: body.description,
        exampleMatch: body.exampleMatch,
        priority: body.priority,
        isActive: body.isActive,
      };
    }

    const updated = await db.extractionPattern.update({
      where: { id: patternId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating extraction pattern:", error);
    return NextResponse.json(
      { error: "Failed to update pattern" },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate pattern
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

    await db.extractionPattern.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Pattern deactivated" });
  } catch (error) {
    console.error("Error deactivating pattern:", error);
    return NextResponse.json(
      { error: "Failed to deactivate pattern" },
      { status: 500 }
    );
  }
}
