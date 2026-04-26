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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Printer,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface PrintQueueItem {
  id: string;
  claimId: string | null;
  fileName: string;
  filePath: string;
  fileType: string | null;
  printStatus: string;
  printedAt: string | null;
  printedBy: string | null;
  errorMessage: string | null;
  createdAt: string;
  claim: {
    claimNumber: string;
    clientName: string | null;
  } | null;
}

export function PrintQueueSection() {
  const [items, setItems] = useState<PrintQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const { } = useState();

  useEffect(() => {
    fetchItems();
  }, [statusFilter]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/print-queue?status=${statusFilter}`);
      const json = await res.json();
      setItems(json || []);
    } catch (error) {
      console.error("Failed to fetch print queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsPrinted = async (id: string) => {
    try {
      // In a real implementation, this would call the Windows print service
      const res = await fetch(`/api/print-queue/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printStatus: "COMPLETED", printedAt: new Date() }),
      });

      if (res.ok) {
        fetchItems();
      }
    } catch (error) {
      console.error("Failed to update print status:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "QUEUED":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "PRINTING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      QUEUED: "secondary",
      PRINTING: "default",
      COMPLETED: "default",
      FAILED: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  // Calculate stats
  const queuedCount = items.filter((i) => i.printStatus === "QUEUED").length;
  const printingCount = items.filter((i) => i.printStatus === "PRINTING").length;
  const completedCount = items.filter((i) => i.printStatus === "COMPLETED").length;
  const failedCount = items.filter((i) => i.printStatus === "FAILED").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Print Queue</h1>
          <p className="text-muted-foreground">
            Manage documents queued for printing
          </p>
        </div>
        <Button onClick={fetchItems} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{queuedCount}</p>
                <p className="text-sm text-muted-foreground">Queued</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{printingCount}</p>
                <p className="text-sm text-muted-foreground">Printing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{failedCount}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="QUEUED">Queued</SelectItem>
            <SelectItem value="PRINTING">Printing</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Print Queue Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Printed At</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No documents in queue
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{item.fileName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.claim ? (
                          <div>
                            <p className="font-medium">{item.claim.claimNumber}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.claim.clientName}
                            </p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {item.fileType ? (
                          <Badge variant="outline">{item.fileType.toUpperCase()}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.printStatus)}</TableCell>
                      <TableCell>
                        {item.printedAt
                          ? new Date(item.printedAt).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(item.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.printStatus === "QUEUED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsPrinted(item.id)}
                          >
                            <Printer className="h-4 w-4 mr-1" />
                            Print
                          </Button>
                        )}
                        {item.printStatus === "FAILED" && item.errorMessage && (
                          <span className="text-xs text-red-500">{item.errorMessage}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Windows Print Service Info */}
      <Card>
        <CardHeader>
          <CardTitle>Windows Print Service</CardTitle>
          <CardDescription>
            Configure print settings for Windows 11 Server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Default Printer</p>
                <p className="font-medium">Not Configured</p>
              </div>
              <div>
                <p className="text-muted-foreground">Print Method</p>
                <p className="font-medium">Windows Print Spooler</p>
              </div>
              <div>
                <p className="text-muted-foreground">Output Path</p>
                <p className="font-medium">C:\Stefco\Print</p>
              </div>
              <div>
                <p className="text-muted-foreground">Auto-Print</p>
                <p className="font-medium">Disabled</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
