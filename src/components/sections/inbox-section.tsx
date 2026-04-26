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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  RefreshCw,
  Play,
  Square,
  Download,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  FileText,
  Archive,
  ArchiveRestore,
  X,
  Image,
  Code,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackModal, RejectionFeedbackData } from "@/components/feedback-modal";

interface Email {
  id: string;
  messageId: string;
  subject: string | null;
  from: string | null;
  fromDomain: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  aiClassification: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
  aiExtractedData: string | null;
  status: string;
  processingRoute: string | null;
  learningHintsCount: number;
  receivedAt: string;
  processedAt: string | null;
}

interface PollingStatus {
  isConfigured: boolean;
  lastPoll: string | null;
  nextPoll: string | null;
  totalQueued: number;
  schedulerEnabled: boolean;
  pollInterval: number;
  autoAnalyzeEnabled?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function InboxSection() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pollingStatus, setPollingStatus] = useState<PollingStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [emailToReject, setEmailToReject] = useState<Email | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isAnalyzingPending, setIsAnalyzingPending] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [showHtmlView, setShowHtmlView] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmails(1);
    fetchPollingStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchPollingStatus, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchEmails = async (page: number = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/email-inbox?status=${statusFilter}&page=${page}&limit=50`);
      const json = await res.json();
      setEmails(json.emails || []);
      setPagination(json.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPollingStatus = async () => {
    try {
      const res = await fetch("/api/email-poll");
      const json = await res.json();
      setPollingStatus(json);
    } catch (error) {
      console.error("Failed to fetch polling status:", error);
    }
  };

  const pollEmailsNow = async () => {
    setIsPolling(true);
    toast({
      title: "Polling Emails",
      description: "Connecting to IMAP server...",
    });

    try {
      const res = await fetch("/api/email-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: "Success",
          description: json.message || `Fetched ${json.fetched} new emails`,
        });
        fetchEmails();
        fetchPollingStatus();
      } else {
        toast({
          title: "Polling Failed",
          description: json.errors?.[0] || "Failed to fetch emails",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to poll emails",
        variant: "destructive",
      });
    } finally {
      setIsPolling(false);
    }
  };

  const toggleScheduler = async (enable: boolean) => {
    try {
      const res = await fetch("/api/email-poll/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: enable ? "start" : "stop",
          interval: pollingStatus?.pollInterval || 5,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: enable ? "Scheduler Started" : "Scheduler Stopped",
          description: json.message,
        });
        fetchPollingStatus();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update scheduler",
        variant: "destructive",
      });
    }
  };

  const analyzePendingEmails = async () => {
    setIsAnalyzingPending(true);
    toast({
      title: "AI Analysis Started",
      description: "Analyzing pending emails with learning hints...",
    });

    try {
      const res = await fetch("/api/email-poll", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: "Analysis Complete",
          description: json.message || `Analyzed ${json.analyzed} emails`,
        });
        fetchEmails();
        fetchPollingStatus();
      } else {
        toast({
          title: "Analysis Failed",
          description: json.errors?.[0] || "Failed to analyze emails",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze emails",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzingPending(false);
    }
  };

  const viewEmail = (email: Email) => {
    setSelectedEmail(email);
    setDetailsOpen(true);
  };

  const openRejectModal = (email: Email) => {
    setEmailToReject(email);
    setFeedbackModalOpen(true);
  };

  const handleRejectionFeedback = async (feedback: RejectionFeedbackData) => {
    try {
      const res = await fetch("/api/rejection-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        toast({
          title: "Feedback Submitted",
          description: feedback.applyToSender
            ? "Email ignored and rule created for future emails from this sender"
            : "Email ignored. This helps the AI learn!",
        });
        fetchEmails();
        setDetailsOpen(false);
        setFeedbackModalOpen(false);
      } else {
        throw new Error(json.error || "Failed to submit feedback");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to submit feedback";
      console.error("Rejection feedback error:", error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw error; // Re-throw so the modal can handle it
    }
  };

  const classifyEmail = async (emailId: string, classification: string) => {
    try {
      const res = await fetch(`/api/email-inbox/${emailId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: classification === "NEW_CLAIM" ? "CLAIM_CREATED" : "IGNORED",
        }),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Email ${classification === "NEW_CLAIM" ? "accepted as claim" : "ignored"}`,
        });
        fetchEmails();
        setDetailsOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const createClaimFromEmail = async (email: Email) => {
    // Parse extracted data
    let extractedData: Record<string, unknown> = {};
    try {
      extractedData = email.aiExtractedData ? JSON.parse(email.aiExtractedData) : {};
    } catch {
      extractedData = {};
    }

    // Create claim
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimNumber: (extractedData.claimNumber as string) || `PENDING-${Date.now()}`,
          clientName: extractedData.clientName,
          clientEmail: extractedData.clientEmail,
          clientPhone: extractedData.clientPhone,
          claimType: extractedData.claimType,
          incidentDescription: extractedData.incidentDescription,
          vehicleRegistration: extractedData.vehicleRegistration,
          sourceEmailId: email.id,
          sourceEmailSubject: email.subject,
          sourceEmailFrom: email.from,
          status: "NEW",
        }),
      });

      if (res.ok) {
        // Update email status
        await fetch(`/api/email-inbox/${email.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CLAIM_CREATED" }),
        });

        toast({
          title: "Success",
          description: "Claim created successfully",
        });
        fetchEmails();
        setDetailsOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create claim",
        variant: "destructive",
      });
    }
  };

  const reanalyzeEmail = async (email: Email) => {
    setIsReanalyzing(true);
    toast({
      title: "AI Analysis Started",
      description: "Re-analyzing email with AI...",
    });

    try {
      const res = await fetch("/api/process-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: email.id,
          subject: email.subject,
          from: email.from,
          bodyText: email.bodyText,
          fromDomain: email.fromDomain,
        }),
      });

      const json = await res.json();

      if (res.ok && json.classification) {
        toast({
          title: "Analysis Complete",
          description: `Classification: ${json.classification.classification} (${json.classification.confidence}% confidence)`,
        });
        // Refresh email list and update selected email
        fetchEmails();
        // Update the selected email with new analysis data
        setSelectedEmail({
          ...email,
          aiClassification: json.classification.classification,
          aiConfidence: json.classification.confidence,
          aiReasoning: json.classification.reasoning,
          aiExtractedData: json.extraction ? JSON.stringify(json.extraction) : null,
          status: "AI_ANALYZED",
          learningHintsCount: json.learningHintsCount || 0,
        });
      } else {
        throw new Error(json.error || "Analysis failed");
      }
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze email",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const archiveEmail = async (emailId: string, archive: boolean = true) => {
    try {
      const res = await fetch(`/api/email-inbox/${emailId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: archive ? "ARCHIVED" : "PENDING",
        }),
      });

      if (res.ok) {
        toast({
          title: archive ? "Email Archived" : "Email Unarchived",
          description: archive 
            ? "Email moved to archive. You can find it in the Archived filter."
            : "Email restored to pending status.",
        });
        fetchEmails(pagination.page);
        setDetailsOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      PENDING: "secondary",
      AI_ANALYZED: "default",
      USER_REVIEWING: "outline",
      CLAIM_CREATED: "default",
      IGNORED: "destructive",
      ARCHIVED: "outline",
    };
    
    if (status === "ARCHIVED") {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
          <Archive className="h-3 w-3 mr-1" />
          Archived
        </Badge>
      );
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const getClassificationBadge = (classification: string | null) => {
    if (!classification) return <Badge variant="outline">Unanalyzed</Badge>;
    
    const colors: Record<string, string> = {
      NEW_CLAIM: "bg-green-500",
      IGNORE: "bg-gray-500",
      MISSING_INFO: "bg-yellow-500",
      OTHER: "bg-blue-500",
    };

    return (
      <Badge className={colors[classification] || "bg-gray-500"}>
        {classification}
      </Badge>
    );
  };

  // Check if email is likely a follow-up based on subject
  const isLikelyFollowUp = (email: Email) => {
    if (!email.subject) return false;
    const subject = email.subject.toLowerCase();
    return subject.startsWith("re:") || subject.startsWith("fwd:") || subject.includes("follow-up");
  };

  const filteredEmails = emails.filter((email) => {
    if (!searchQuery) return true;
    return (
      email.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromDomain?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Bulk selection handlers
  const toggleEmailSelection = (emailId: string) => {
    const newSelected = new Set(selectedEmailIds);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmailIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedEmailIds.size === filteredEmails.length) {
      // Deselect all
      setSelectedEmailIds(new Set());
    } else {
      // Select all filtered emails
      setSelectedEmailIds(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const clearSelection = () => {
    setSelectedEmailIds(new Set());
  };

  const bulkArchive = async (archive: boolean = true) => {
    if (selectedEmailIds.size === 0) return;
    
    setIsBulkArchiving(true);
    const action = archive ? "archive" : "unarchive";
    toast({
      title: `Bulk ${action} started`,
      description: `${archive ? "Archiving" : "Unarchiving"} ${selectedEmailIds.size} emails...`,
    });

    try {
      const res = await fetch("/api/email-inbox/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmailIds),
          status: archive ? "ARCHIVED" : "PENDING",
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        toast({
          title: archive ? "Emails Archived" : "Emails Unarchived",
          description: `Successfully ${archive ? "archived" : "unarchived"} ${json.updated} emails.`,
        });
        setSelectedEmailIds(new Set());
        fetchEmails(pagination.page);
      } else {
        throw new Error(json.error || `Failed to ${action} emails`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} emails`,
        variant: "destructive",
      });
    } finally {
      setIsBulkArchiving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
          <p className="text-muted-foreground">
            Review and process incoming claim emails
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchEmails} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Polling Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Polling
              </CardTitle>
              <CardDescription>
                IMAP email fetching and scheduling
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              {pollingStatus?.isConfigured ? (
                <Badge className="bg-green-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Configured
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Not Configured
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Queued Emails</p>
              <p className="text-2xl font-bold">{pollingStatus?.totalQueued || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Poll</p>
              <p className="text-sm font-medium">
                {pollingStatus?.lastPoll
                  ? new Date(pollingStatus.lastPoll).toLocaleString()
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Poll Interval</p>
              <p className="text-sm font-medium">
                Every {pollingStatus?.pollInterval || 5} {pollingStatus?.pollInterval === 1 ? 'minute' : 'minutes'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Auto-Poller</p>
              <p className="text-sm font-medium flex items-center gap-2">
                {pollingStatus?.schedulerEnabled ? (
                  <><Play className="h-3 w-3 text-green-500" /> Running</>
                ) : (
                  <><Square className="h-3 w-3 text-gray-500" /> Stopped</>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Auto-Analyze</p>
              <p className="text-sm font-medium flex items-center gap-2">
                {pollingStatus?.autoAnalyzeEnabled ? (
                  <><Brain className="h-3 w-3 text-green-500" /> Enabled</>
                ) : (
                  <><Brain className="h-3 w-3 text-gray-500" /> Disabled</>
                )}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Button
                onClick={pollEmailsNow}
                disabled={isPolling || !pollingStatus?.isConfigured}
                className="min-w-[150px]"
              >
                {isPolling ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Polling...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Poll Emails Now
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={analyzePendingEmails}
                disabled={isAnalyzingPending || (pollingStatus?.totalQueued || 0) === 0}
                className="min-w-[150px]"
              >
                {isAnalyzingPending ? (
                  <>
                    <Brain className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="mr-2 h-4 w-4" />
                    Analyze Pending ({pollingStatus?.totalQueued || 0})
                  </>
                )}
              </Button>

              {!pollingStatus?.isConfigured && (
                <p className="text-sm text-muted-foreground">
                  Configure IMAP settings to enable polling
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="scheduler" className="text-sm">
                Auto-Poll
              </Label>
              <Switch
                id="scheduler"
                checked={pollingStatus?.schedulerEnabled || false}
                onCheckedChange={toggleScheduler}
                disabled={!pollingStatus?.isConfigured}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="AI_ANALYZED">AI Analyzed</SelectItem>
            <SelectItem value="CLAIM_CREATED">Claim Created</SelectItem>
            <SelectItem value="IGNORED">Ignored</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
            <SelectItem value="all">All Statuses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Email Count Summary & Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {emails.length > 0 ? ((pagination.page - 1) * 50) + 1 : 0}-{Math.min(pagination.page * 50, pagination.total)} of {pagination.total} emails
          {statusFilter !== "all" && ` with status "${statusFilter}"`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEmails(pagination.page - 1)}
            disabled={loading || pagination.page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEmails(pagination.page + 1)}
            disabled={loading || pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedEmailIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-sm">
                  {selectedEmailIds.size} selected
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedEmailIds.size === 1 ? "email" : "emails"} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                {statusFilter !== "ARCHIVED" && (
                  <Button
                    size="sm"
                    onClick={() => bulkArchive(true)}
                    disabled={isBulkArchiving}
                  >
                    {isBulkArchiving ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Archive className="h-4 w-4 mr-2" />
                    )}
                    Archive Selected
                  </Button>
                )}
                {statusFilter === "ARCHIVED" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => bulkArchive(false)}
                    disabled={isBulkArchiving}
                  >
                    {isBulkArchiving ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                    )}
                    Unarchive Selected
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    className="h-4 w-4 cursor-pointer"
                    checked={filteredEmails.length > 0 && selectedEmailIds.size === filteredEmails.length}
                    onCheckedChange={toggleSelectAll}
                    title="Select all"
                  />
                </TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>From</TableHead>
                <TableHead>AI Classification</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEmails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {statusFilter === "PENDING"
                      ? "No pending emails. Click \"Test Email\" on the Dashboard to generate test emails, or \"Poll Emails Now\" to fetch from IMAP."
                      : statusFilter === "all"
                      ? "No emails in the system yet. Generate test emails or configure IMAP polling."
                      : `No emails with status "${statusFilter}". Try a different filter.`}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmails.map((email) => (
                  <TableRow key={email.id} className={selectedEmailIds.has(email.id) ? "bg-primary/5" : ""}>
                    <TableCell className="w-12">
                      <Checkbox
                        className="h-4 w-4 cursor-pointer"
                        checked={selectedEmailIds.has(email.id)}
                        onCheckedChange={() => toggleEmailSelection(email.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="flex items-center gap-2">
                        {isLikelyFollowUp(email) && (
                          <MessageSquare className="h-3 w-3 text-blue-500 flex-shrink-0" title="Likely follow-up" />
                        )}
                        <span className="truncate">{email.subject || "(No Subject)"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {email.from || "-"}
                    </TableCell>
                    <TableCell>{getClassificationBadge(email.aiClassification)}</TableCell>
                    <TableCell>
                      {email.aiConfidence !== null ? (
                        <div className="flex items-center gap-1">
                          <Brain className="h-3 w-3" />
                          {email.aiConfidence.toFixed(0)}%
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(email.status)}</TableCell>
                    <TableCell>
                      {new Date(email.receivedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewEmail(email)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {email.status === "ARCHIVED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => archiveEmail(email.id, false)}
                            title="Unarchive"
                          >
                            <ArchiveRestore className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => archiveEmail(email.id, true)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Email Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent style={{ maxWidth: '95vw', width: '95vw' }} className="h-[92vh] p-0 gap-0 flex flex-col rounded-lg border">
          <DialogHeader className="px-5 py-2 border-b bg-muted/30">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Details
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDetailsOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="flex flex-col flex-1 overflow-hidden min-h-0">
              {/* Email Header Info - Compact */}
              <div className="px-5 py-2 border-b bg-muted/10 flex-shrink-0">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">From:</span>
                    <span className="font-medium">{selectedEmail.from || "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0 max-w-[300px]">
                    <span className="text-muted-foreground text-xs">Subject:</span>
                    <span className="font-medium truncate">{selectedEmail.subject || "(No Subject)"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Received:</span>
                    <span>{new Date(selectedEmail.receivedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedEmail.status)}
                    {selectedEmail.aiClassification && getClassificationBadge(selectedEmail.aiClassification)}
                  </div>
                </div>
              </div>
              
              {/* Tabs */}
              <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden min-h-0">
                <TabsList className="mx-5 my-2 flex-shrink-0 h-10">
                  <TabsTrigger value="content" className="gap-2 text-sm h-8 px-4">
                    <Mail className="h-4 w-4" />
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="gap-2 text-sm h-8 px-4">
                    <Brain className="h-4 w-4" />
                    AI Analysis
                  </TabsTrigger>
                  <TabsTrigger value="actions" className="gap-2 text-sm h-8 px-4">
                    <AlertCircle className="h-4 w-4" />
                    Actions
                  </TabsTrigger>
                </TabsList>
                
                {/* Tab Content with Scroll */}
                <div className="flex-1 overflow-y-auto px-5 pb-3 min-h-0">
                  <TabsContent value="content" className="mt-2 space-y-3">
                    {/* Email Body Card */}
                    <Card className="border">
                      <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Email Body
                          </CardTitle>
                          {selectedEmail.bodyHtml && (
                            <div className="flex items-center gap-2">
                              <Button
                                variant={showHtmlView ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowHtmlView(true)}
                                className="h-7 text-xs gap-1"
                              >
                                <Image className="h-3.5 w-3.5" />
                                HTML
                              </Button>
                              <Button
                                variant={!showHtmlView ? "default" : "outline"}
                                size="sm"
                                onClick={() => setShowHtmlView(false)}
                                className="h-7 text-xs gap-1"
                              >
                                <Code className="h-3.5 w-3.5" />
                                Text
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {showHtmlView && selectedEmail.bodyHtml ? (
                          <iframe
                            srcDoc={selectedEmail.bodyHtml}
                            className="w-full h-[calc(92vh-260px)] min-h-[400px] border-0"
                            sandbox="allow-same-origin allow-images"
                            title="Email HTML Content"
                          />
                        ) : (
                          <ScrollArea className="h-[calc(92vh-240px)] min-h-[400px]">
                            <div className="p-5">
                              <pre className="text-base whitespace-pre-wrap font-sans leading-7 tracking-wide">
                                {selectedEmail.bodyText || (
                                  <span className="text-muted-foreground italic">No content available</span>
                                )}
                              </pre>
                            </div>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Processing Info - Compact inline */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 bg-muted/20 rounded-md text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Status:</span>
                        {getStatusBadge(selectedEmail.status)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Route:</span>
                        <span className="font-medium">{selectedEmail.processingRoute || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Learning Hints:</span>
                        <span className="font-medium">{selectedEmail.learningHintsCount}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Processed:</span>
                        <span className="font-medium">
                          {selectedEmail.processedAt 
                            ? new Date(selectedEmail.processedAt).toLocaleString()
                            : "Not processed"}
                        </span>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="ai" className="mt-2 space-y-3">
                    {/* AI Analysis - Two Column Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left Column - Classification & Reasoning */}
                      <div className="space-y-3">
                        {/* Classification Card */}
                        <Card className="border">
                          <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Brain className="h-4 w-4" />
                              AI Classification
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="py-4">
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Result:</span>
                                {selectedEmail.aiClassification 
                                  ? getClassificationBadge(selectedEmail.aiClassification)
                                  : <Badge variant="outline" className="text-xs">Not analyzed</Badge>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Confidence:</span>
                                {selectedEmail.aiConfidence !== null ? (
                                  <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          selectedEmail.aiConfidence >= 80 ? 'bg-green-500' :
                                          selectedEmail.aiConfidence >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${selectedEmail.aiConfidence}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium">{selectedEmail.aiConfidence.toFixed(0)}%</span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        {/* AI Reasoning Card */}
                        <Card className="border">
                          <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                            <CardTitle className="text-sm font-medium">AI Reasoning</CardTitle>
                          </CardHeader>
                          <CardContent className="p-0">
                            <ScrollArea className="h-[calc(92vh-380px)] min-h-[150px]">
                              <div className="p-4">
                                <p className="text-sm leading-relaxed">
                                  {selectedEmail.aiReasoning || (
                                    <span className="text-muted-foreground italic">No reasoning available</span>
                                  )}
                                </p>
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Right Column - Extracted Data */}
                      <Card className="border">
                        <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Extracted Data
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <ScrollArea className="h-[calc(92vh-300px)] min-h-[300px]">
                          <div className="p-4">
                            {selectedEmail.aiExtractedData ? (
                              <pre className="text-sm font-mono bg-muted/50 p-4 rounded-md">
                                {JSON.stringify(JSON.parse(selectedEmail.aiExtractedData), null, 2)}
                              </pre>
                            ) : (
                              <span className="text-muted-foreground italic">No data extracted</span>
                            )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="actions" className="mt-2 space-y-4">
                    {/* Follow-up warning */}
                    {isLikelyFollowUp(selectedEmail) && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-md">
                        <MessageSquare className="h-5 w-5 text-blue-500" />
                        <span className="text-sm text-blue-700">This looks like a follow-up email (Re:/FWD:)</span>
                      </div>
                    )}
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        className="h-auto py-4 flex-col gap-1"
                        onClick={() => createClaimFromEmail(selectedEmail)}
                        disabled={selectedEmail.status === "CLAIM_CREATED"}
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm">Create Claim</span>
                      </Button>
                      <Button
                        variant="destructive"
                        className="h-auto py-4 flex-col gap-1"
                        onClick={() => openRejectModal(selectedEmail)}
                        disabled={selectedEmail.status === "IGNORED"}
                      >
                        <XCircle className="h-5 w-5" />
                        <span className="text-sm">Ignore</span>
                      </Button>
                    </div>
                    
                    {/* Secondary Actions */}
                    <div className="grid grid-cols-2 gap-4">
                      <Button 
                        variant="outline" 
                        className="py-3"
                        onClick={() => reanalyzeEmail(selectedEmail)}
                        disabled={isReanalyzing}
                      >
                        {isReanalyzing ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Brain className="mr-2 h-4 w-4" />
                        )}
                        <span className="text-sm">Re-analyze</span>
                      </Button>
                      {selectedEmail.status === "ARCHIVED" ? (
                        <Button 
                          variant="outline" 
                          className="py-3"
                          onClick={() => archiveEmail(selectedEmail.id, false)}
                        >
                          <ArchiveRestore className="mr-2 h-4 w-4" />
                          <span className="text-sm">Unarchive</span>
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          className="py-3"
                          onClick={() => archiveEmail(selectedEmail.id, true)}
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          <span className="text-sm">Archive</span>
                        </Button>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal
        open={feedbackModalOpen}
        onOpenChange={setFeedbackModalOpen}
        email={emailToReject}
        onSubmit={handleRejectionFeedback}
      />
    </div>
  );
}
