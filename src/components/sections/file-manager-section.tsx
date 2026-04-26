"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  File,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FileInfo {
  name: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: string;
  isImage: boolean;
  isPdf: boolean;
  isDoc: boolean;
}

export function FileManagerSection() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/files?action=list");
      const json = await res.json();
      setFiles(json.files || []);
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const previewFileHandler = (file: FileInfo) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const downloadFile = async (filename: string) => {
    try {
      const res = await fetch(`/api/files?action=download&filename=${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: `Downloading ${filename}`,
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Could not download file",
        variant: "destructive",
      });
    }
  };

  const deleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/files?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: "File Deleted",
          description: json.message,
        });
        fetchFiles();
      } else {
        throw new Error(json.error);
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Could not delete file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileIcon = (file: FileInfo) => {
    if (file.isImage) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    if (file.isPdf) return <FileText className="h-5 w-5 text-red-500" />;
    if (file.isDoc) return <FileSpreadsheet className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Uploaded Files
              </CardTitle>
              <CardDescription>
                Manage files uploaded to the server
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary */}
          <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <Badge variant="secondary">{files.length} files</Badge>
            <span>•</span>
            <span>Total: {formatFileSize(totalSize)}</span>
            <span>•</span>
            <span className="text-xs">Location: /home/z/my-project/upload</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Filename</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Modified</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.name}>
                      <TableCell className="w-8">
                        {getFileIcon(file)}
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate" title={file.name}>
                        {file.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {file.type.split("/")[1]?.toUpperCase() || "FILE"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatFileSize(file.size)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(file.modifiedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(file.isImage || file.isPdf) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => previewFileHandler(file)}
                              title="Preview"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => downloadFile(file.name)}
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => deleteFile(file.name)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              {previewFile && getFileIcon(previewFile)}
              {previewFile?.name}
            </DialogTitle>
            <DialogDescription>
              {previewFile?.type} • {previewFile && formatFileSize(previewFile.size)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 min-h-[400px] max-h-[calc(90vh-120px)]">
            {previewFile && (
              previewFile.isImage ? (
                <img
                  src={`/api/files?action=preview&filename=${encodeURIComponent(previewFile.name)}`}
                  alt={previewFile.name}
                  className="max-w-full max-h-full mx-auto object-contain rounded"
                />
              ) : previewFile.isPdf ? (
                <iframe
                  src={`/api/files?action=preview&filename=${encodeURIComponent(previewFile.name)}`}
                  className="w-full h-[70vh] border-0 rounded"
                  title="PDF Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <File className="h-16 w-16 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => downloadFile(previewFile.name)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
