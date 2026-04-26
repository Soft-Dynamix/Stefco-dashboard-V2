/**
 * Files API
 * 
 * Serves uploaded files from the /home/z/my-project/upload directory
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const UPLOAD_DIR = "/home/z/my-project/upload";

// GET: List or retrieve files
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const action = searchParams.get("action") || "list";

    // List all files
    if (action === "list") {
      const files = fs.readdirSync(UPLOAD_DIR);
      const fileList = files.map((file) => {
        const filePath = path.join(UPLOAD_DIR, file);
        const stats = fs.statSync(filePath);
        const ext = path.extname(file).toLowerCase();
        
        return {
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
          type: getMimeType(ext),
          isImage: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext),
          isPdf: ext === ".pdf",
          isDoc: [".doc", ".docx"].includes(ext),
        };
      });

      return NextResponse.json({
        files: fileList,
        total: fileList.length,
        uploadDir: UPLOAD_DIR,
      });
    }

    // Download or preview specific file
    if ((action === "download" || action === "preview") && filename) {
      const filePath = path.join(UPLOAD_DIR, filename);

      // Security: Prevent directory traversal
      if (!filePath.startsWith(UPLOAD_DIR)) {
        return NextResponse.json(
          { error: "Invalid file path" },
          { status: 400 }
        );
      }

      if (!fs.existsSync(filePath)) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }

      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = getMimeType(ext);

      const headers: Record<string, string> = {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
      };

      if (action === "download") {
        headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      } else {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
        // For images, allow caching
        headers["Cache-Control"] = "public, max-age=3600";
      }

      return new NextResponse(fileBuffer, {
        status: 200,
        headers,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'list', 'download', or 'preview'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Files API error:", error);
    return NextResponse.json(
      { error: "Failed to process file request" },
      { status: 500 }
    );
  }
}

// DELETE: Remove a file
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "filename parameter is required" },
        { status: 400 }
      );
    }

    const filePath = path.join(UPLOAD_DIR, filename);

    // Security: Prevent directory traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    fs.unlinkSync(filePath);

    return NextResponse.json({
      success: true,
      message: `Deleted ${filename}`,
    });
  } catch (error) {
    console.error("File delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".json": "application/json",
    ".xml": "application/xml",
  };

  return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
}
