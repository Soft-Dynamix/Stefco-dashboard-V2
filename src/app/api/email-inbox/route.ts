import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10000");
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (status && status !== "all") {
      where.status = status;
    } else if (!status || status === "all") {
      // Exclude archived and ignored emails from "All Statuses" view
      where.status = { notIn: ["ARCHIVED", "IGNORED"] };
    }

    const [emails, total] = await Promise.all([
      db.emailQueue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { receivedAt: "desc" },
      }),
      db.emailQueue.count({ where }),
    ]);

    return NextResponse.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Email inbox GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
