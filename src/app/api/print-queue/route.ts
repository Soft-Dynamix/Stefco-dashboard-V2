import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "all") {
      where.printStatus = status;
    }

    const items = await db.printQueueItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        claim: {
          select: {
            claimNumber: true,
            clientName: true,
          },
        },
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("Print queue GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch print queue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const item = await db.printQueueItem.create({
      data: {
        claimId: body.claimId,
        fileName: body.fileName,
        filePath: body.filePath,
        fileType: body.fileType,
      },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("Print queue POST error:", error);
    return NextResponse.json(
      { error: "Failed to add to print queue" },
      { status: 500 }
    );
  }
}
