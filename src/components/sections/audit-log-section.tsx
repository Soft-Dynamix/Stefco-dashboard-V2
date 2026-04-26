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
  History,
  CheckCircle,
  AlertCircle,
  XCircle,
  RefreshCw,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: string | null;
  status: string;
  processedBy: string | null;
  createdAt: string;
  claim: {
    claimNumber: string;
    clientName: string | null;
  } | null;
}

export function AuditLogSection() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?action=${actionFilter}&page=${page}&limit=50`);
      const json = await res.json();
      setLogs(json.logs || []);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "WARNING":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      SUCCESS: "default",
      WARNING: "secondary",
      ERROR: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
    } catch {
      return details;
    }
  };

  const actionTypes = [
    "all",
    "claim_created",
    "claim_updated",
    "email_classified",
    "email_processed",
    "feedback_submitted",
    "pattern_created",
    "settings_updated",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete system activity history
          </p>
        </div>
        <Button onClick={fetchLogs} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-4 items-center">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {actionTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type === "all" ? "All Actions" : formatAction(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{formatAction(log.action)}</span>
                      </TableCell>
                      <TableCell>
                        {log.entityType && (
                          <div>
                            <Badge variant="outline">{log.entityType}</Badge>
                            {log.claim && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {log.claim.claimNumber}
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground max-w-[300px] truncate block">
                          {parseDetails(log.details)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {log.processedBy || "SYSTEM"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{new Date(log.createdAt).toLocaleDateString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </Button>
        <span className="flex items-center px-4">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
