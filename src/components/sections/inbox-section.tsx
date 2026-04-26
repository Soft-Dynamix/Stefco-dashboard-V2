"use client";

import { useEffect, useState, useMemo } from "react";
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
  Paperclip,
  FileSearch,
  AlertTriangle,
  FileCheck,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FeedbackModal, RejectionFeedbackData } from "@/components/feedback-modal";
import dynamic from "next/dynamic";

// Dynamically import PDFViewer with SSR disabled to avoid DOMMatrix errors
const PDFViewer = dynamic(
  () => import("@/components/pdf-viewer").then((mod) => mod.PDFViewer),
  { ssr: false }
);

interface Email {
  id: string;
  messageId: string;
  subject: string | null;
  from: string | null;
  fromDomain: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: string | null;
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
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showHtmlView, setShowHtmlView] = useState(true);
  const [isRefetchingAttachments, setIsRefetchingAttachments] = useState(false);
  const [attachmentStats, setAttachmentStats] = useState<{
    totalEmails: number;
    emailsWithAttachments: number;
    emailsWithoutAttachments: number;
    totalAttachments: number;
    activeEmailsNeedingRefetch: number;
  } | null>(null);
  const [attachmentAnalysis, setAttachmentAnalysis] = useState<{
    summary: {
      totalAttachments: number;
      claimRelatedAttachments: number;
      hasClaimForm: boolean;
      hasPolicySchedule: boolean;
      hasSupportingDocuments: boolean;
      overallClaimLikelihood: number;
      isLikelyNewClaim: boolean;
      confidenceLevel: string;
      assessmentReason: string;
      keyIndicators: string[];
      missingInformation: string[];
    } | null;
    analyses: Array<{
      id: string;
      fileName: string;
      fileType: string;
      documentType: string;
      documentConfidence: number;
      isClaimRelated: boolean;
      importance: string;
      claimLikelihoodScore: number;
      containsClaimNumber: boolean;
      containsPolicyNumber: boolean;
      containsVehicleReg: boolean;
      processingError?: string;
    }>;
  } | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{
    filename: string;
    content: string;
    contentType: string;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  // Decode quoted-printable encoding (for emails stored before the fix)
  const decodeQuotedPrintable = (str: string | null): string | null => {
    if (!str) return null;
    // Check if the string appears to be quoted-printable encoded
    if (!str.includes("=20") && !str.includes("=A0") && !/=([0-9A-F]{2})/.test(str)) {
      return str; // Not encoded, return as-is
    }
    return str
      .replace(/=\r\n/g, "") // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))); // Decode hex chars
  };

  // Decode base64 encoding (for emails stored before the fix)
  const decodeBase64 = (str: string | null): string | null => {
    if (!str) return null;
    try {
      // Check if the string looks like base64 encoded content
      // Base64 strings contain only A-Za-z0-9+/= and whitespace
      const trimmed = str.trim();
      if (/^[A-Za-z0-9+/=\s\r\n]+$/.test(trimmed) && trimmed.length > 50) {
        // Remove whitespace and try to decode
        const cleaned = trimmed.replace(/\s/g, '');
        // Check if it's valid base64 length (multiple of 4)
        if (cleaned.length % 4 === 0 || cleaned.endsWith('=') || cleaned.endsWith('==')) {
          try {
            const decoded = atob(cleaned);
            // Check if decoded content looks like valid text (not binary)
            if (/^[\x20-\x7E\r\n\t]+$/.test(decoded) || decoded.includes('<') || decoded.includes('html')) {
              return decoded;
            }
          } catch {
            // Not valid base64, return original
          }
        }
      }
      return str;
    } catch {
      return str;
    }
  };

  // Combined decoder that handles both base64 and quoted-printable
  const decodeEmailContent = (str: string | null): string | null => {
    if (!str) return null;
    // First try base64 decoding
    const base64Decoded = decodeBase64(str);
    if (base64Decoded !== str) return base64Decoded;
    // Then try quoted-printable decoding
    return decodeQuotedPrintable(str);
  };

  // Memoize decoded email content
  const decodedBodyHtml = useMemo(() => decodeEmailContent(selectedEmail?.bodyHtml || null), [selectedEmail?.bodyHtml]);
  const decodedBodyText = useMemo(() => decodeEmailContent(selectedEmail?.bodyText || null), [selectedEmail?.bodyText]);

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
      if (!res.ok) {
        console.warn("Polling status fetch failed with status:", res.status);
        return;
      }
      const json = await res.json();
      setPollingStatus(json);
    } catch (error) {
      // Silently handle transient fetch errors during development
      console.warn("Polling status fetch error (transient):", error);
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

  // Fetch attachment statistics
  const fetchAttachmentStats = async () => {
    try {
      const res = await fetch("/api/refetch-attachments");
      const json = await res.json();
      if (json.stats) {
        setAttachmentStats(json.stats);
      }
    } catch (error) {
      console.error("Failed to fetch attachment stats:", error);
    }
  };

  // Refetch attachments for old emails
  const refetchAttachments = async (emailId?: string) => {
    setIsRefetchingAttachments(true);
    toast({
      title: "Refetching Attachments",
      description: "Connecting to IMAP to fetch email attachments...",
    });

    try {
      const res = await fetch("/api/refetch-attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, emailId }),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: "Attachments Refetched",
          description: json.message || `Processed ${json.processed} emails, found attachments in ${json.updated}`,
        });
        fetchEmails();
        fetchAttachmentStats();
      } else {
        toast({
          title: "Refetch Failed",
          description: json.error || json.errors?.[0] || "Failed to refetch attachments",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refetch attachments",
        variant: "destructive",
      });
    } finally {
      setIsRefetchingAttachments(false);
    }
  };

  // Fetch attachment stats on mount
  useEffect(() => {
    fetchAttachmentStats();
  }, []);

  // Fetch attachment analysis for an email
  const fetchAttachmentAnalysis = async (emailId: string) => {
    setIsLoadingAnalysis(true);
    try {
      const res = await fetch(`/api/attachment-analysis?action=summary&emailId=${emailId}`);
      const json = await res.json();
      if (json.summary || json.analyses) {
        setAttachmentAnalysis({
          summary: json.summary ? {
            totalAttachments: json.summary.totalAttachments,
            claimRelatedAttachments: json.summary.claimRelatedAttachments,
            hasClaimForm: json.summary.hasClaimForm,
            hasPolicySchedule: json.summary.hasPolicySchedule,
            hasSupportingDocuments: json.summary.hasSupportingDocuments,
            overallClaimLikelihood: json.summary.overallClaimLikelihood,
            isLikelyNewClaim: json.summary.isLikelyNewClaim,
            confidenceLevel: json.summary.confidenceLevel,
            assessmentReason: json.summary.assessmentReason,
            keyIndicators: (() => {
              try {
                return json.summary.keyIndicators ? JSON.parse(json.summary.keyIndicators) : [];
              } catch {
                // If already an array, return as-is; otherwise return empty
                return Array.isArray(json.summary.keyIndicators) ? json.summary.keyIndicators : [];
              }
            })(),
            missingInformation: (() => {
              try {
                return json.summary.missingInformation ? JSON.parse(json.summary.missingInformation) : [];
              } catch {
                return Array.isArray(json.summary.missingInformation) ? json.summary.missingInformation : [];
              }
            })(),
          } : null,
          analyses: json.analyses || []
        });
      } else {
        setAttachmentAnalysis(null);
      }
    } catch (error) {
      console.error("Failed to fetch attachment analysis:", error);
      setAttachmentAnalysis(null);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const viewEmail = (email: Email) => {
    setSelectedEmail(email);
    setDetailsOpen(true);
    setAttachmentAnalysis(null); // Clear previous analysis
    // Fetch analysis if email has attachments
    if (email.attachments && email.attachments !== "NO_ATTACHMENTS") {
      fetchAttachmentAnalysis(email.id);
    }
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
        const historicalCount = json.historicalEmailsIgnored || 0;
        let description = "Email ignored. This helps the AI learn!";
        
        if (feedback.applyToSender) {
          if (historicalCount > 0) {
            description = `Email ignored, rule created for future emails, and ${historicalCount} historical email${historicalCount !== 1 ? 's' : ''} from this domain also ignored`;
          } else {
            description = "Email ignored and rule created for future emails from this sender";
          }
        }
        
        toast({
          title: "Feedback Submitted",
          description,
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

  // Delete email
  const deleteEmail = async (emailId: string) => {
    if (!confirm("Are you sure you want to delete this email? You can repoll it afterwards to get fresh attachment content.")) {
      return;
    }

    try {
      const res = await fetch("/api/email-inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId }),
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Email Deleted",
          description: "Email deleted. Use 'Poll Emails' to fetch it again with fresh attachment content.",
        });
        fetchEmails(pagination.page);
        setDetailsOpen(false);
      } else {
        throw new Error("Failed to delete email");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete email",
        variant: "destructive",
      });
    }
  };

  // Preview attachment
  const previewAttachmentFile = async (emailId: string, filename: string) => {
    try {
      // For PDFs, use the API URL directly in iframe (more reliable than blob URL)
      const isPdf = filename.toLowerCase().endsWith('.pdf');
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filename);
      
      if (isPdf) {
        // Use API URL directly for PDFs - this works better with iframes
        const apiUrl = `/api/attachments?action=preview&emailId=${emailId}&filename=${encodeURIComponent(filename)}`;
        setPreviewAttachment({
          filename,
          content: apiUrl,
          contentType: 'application/pdf',
        });
        setPreviewOpen(true);
      } else if (isImage) {
        // For images, fetch and create blob URL
        const res = await fetch(`/api/attachments?action=preview&emailId=${emailId}&filename=${encodeURIComponent(filename)}`);
        
        if (!res.ok) {
          throw new Error("Failed to load attachment");
        }
        
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        setPreviewAttachment({
          filename,
          content: url,
          contentType: blob.type || 'image/png',
        });
        setPreviewOpen(true);
      } else {
        // For other file types, just show download option
        setPreviewAttachment({
          filename,
          content: '',
          contentType: 'application/octet-stream',
        });
        setPreviewOpen(true);
      }
    } catch (error) {
      toast({
        title: "Preview Failed",
        description: error instanceof Error ? error.message : "Could not preview attachment",
        variant: "destructive",
      });
    }
  };

  // Download attachment
  const downloadAttachment = async (emailId: string, filename: string) => {
    try {
      const res = await fetch(`/api/attachments?action=download&emailId=${emailId}&filename=${encodeURIComponent(filename)}`);
      
      if (!res.ok) {
        throw new Error("Failed to download attachment");
      }
      
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
        description: error instanceof Error ? error.message : "Could not download attachment",
        variant: "destructive",
      });
    }
  };

  // Delete attachment
  const deleteAttachment = async (emailId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/attachments?emailId=${emailId}&filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      
      const json = await res.json();
      
      if (res.ok && json.success) {
        toast({
          title: "Attachment Deleted",
          description: `Successfully removed ${filename}`,
        });
        // Update the selected email to reflect the change
        if (selectedEmail) {
          const updatedAttachments = json.updatedAttachments;
          setSelectedEmail({
            ...selectedEmail,
            attachments: updatedAttachments && updatedAttachments.length > 0 
              ? JSON.stringify(updatedAttachments) 
              : "NO_ATTACHMENTS",
          });
        }
        // Refresh the email list
        fetchEmails(pagination.page);
      } else {
        throw new Error(json.error || "Failed to delete attachment");
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Could not delete attachment",
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

  // Bulk delete selected emails
  const bulkDelete = async () => {
    if (selectedEmailIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedEmailIds.size} email(s)? You can repoll them afterwards to get fresh attachment content.`)) {
      return;
    }

    setIsBulkDeleting(true);
    toast({
      title: "Bulk delete started",
      description: `Deleting ${selectedEmailIds.size} emails...`,
    });

    try {
      const res = await fetch("/api/email-inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailIds: Array.from(selectedEmailIds),
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        toast({
          title: "Emails Deleted",
          description: `Successfully deleted ${json.deleted} emails. Use 'Poll Emails' to fetch them again with fresh attachment content.`,
        });
        setSelectedEmailIds(new Set());
        fetchEmails(pagination.page);
      } else {
        throw new Error(json.error || "Failed to delete emails");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete emails",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
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

              <Button
                variant="outline"
                onClick={() => refetchAttachments()}
                disabled={isRefetchingAttachments || !pollingStatus?.isConfigured}
                className="min-w-[150px]"
              >
                {isRefetchingAttachments ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refetching...
                  </>
                ) : (
                  <>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Refetch Attachments
                    {attachmentStats && attachmentStats.emailsWithoutAttachments > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 rounded-full">
                        {attachmentStats.emailsWithoutAttachments}
                      </span>
                    )}
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
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={bulkDelete}
                  disabled={isBulkDeleting}
                >
                  {isBulkDeleting ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Selected
                </Button>
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
                  <TabsTrigger value="attachments" className="gap-2 text-sm h-8 px-4">
                    <Paperclip className="h-4 w-4" />
                    Attachments
                    {selectedEmail.attachments && selectedEmail.attachments !== "NO_ATTACHMENTS" && (() => {
                      try {
                        const atts = JSON.parse(selectedEmail.attachments);
                        return atts.length > 0 ? (
                          <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                            {atts.length}
                          </Badge>
                        ) : null;
                      } catch { return null; }
                    })()}
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
                          {decodedBodyHtml && (
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
                        {showHtmlView && decodedBodyHtml ? (
                          <iframe
                            srcDoc={decodedBodyHtml}
                            className="w-full h-[calc(92vh-260px)] min-h-[400px] border-0"
                            sandbox="allow-same-origin allow-images"
                            title="Email HTML Content"
                          />
                        ) : (
                          <ScrollArea className="h-[calc(92vh-240px)] min-h-[400px]">
                            <div className="p-5">
                              <pre className="text-base whitespace-pre-wrap font-sans leading-7 tracking-wide">
                                {decodedBodyText || (
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
                  
                  <TabsContent value="attachments" className="mt-2 space-y-3">
                    {/* Attachments Analysis Card */}
                    <Card className="border">
                      <CardHeader className="py-3 px-4 bg-muted/30 border-b">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Attachments
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          AI-powered document analysis for claim detection
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="py-4">
                        {selectedEmail.attachments === "NO_ATTACHMENTS" ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No attachments in this email</p>
                            <p className="text-xs mt-1 opacity-70">Email has been checked</p>
                          </div>
                        ) : selectedEmail.attachments ? (
                          (() => {
                            try {
                              const attachments = JSON.parse(selectedEmail.attachments);
                              if (attachments.length === 0) {
                                return (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No attachments in this email</p>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="text-sm text-muted-foreground">
                                      {attachments.length} attachment{attachments.length > 1 ? 's' : ''} found
                                      {selectedEmail.status === 'AI_ANALYZED' && (
                                        <span className="ml-2 text-green-600">(auto-analyzed)</span>
                                      )}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={async () => {
                                        setIsLoadingAnalysis(true);
                                        try {
                                          // UNIFIED ANALYSIS - analyzes email body + ALL attachments together
                                          const response = await fetch('/api/attachment-analysis', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              action: 'unified',
                                              emailId: selectedEmail.id,
                                              attachments: attachments.map((a: { filename: string; contentType?: string; size?: number; contentBase64?: string }) => ({
                                                filename: a.filename,
                                                mimeType: a.contentType,
                                                size: a.size,
                                                contentBase64: a.contentBase64,
                                              })),
                                              companyContext: selectedEmail.fromDomain,
                                            }),
                                          });
                                          const result = await response.json();
                                          if (result.success) {
                                            toast({
                                              title: "Re-analysis Complete",
                                              description: `Analyzed email body + ${result.unifiedAnalysis?.documentsAnalyzed?.attachments?.length || 0} documents. Found ${result.unifiedAnalysis?.keyIndicators?.length || 0} key indicators. Claim likelihood: ${result.unifiedAnalysis?.overallClaimLikelihood || 0}%`,
                                            });
                                            // Refresh the analysis display
                                            fetchAttachmentAnalysis(selectedEmail.id);
                                          } else {
                                            throw new Error(result.error);
                                          }
                                        } catch (error) {
                                          // Check for rate limiting or JSON parsing errors
                                          const errorMsg = String(error);
                                          const isRateLimited = errorMsg.includes('429') || errorMsg.includes('Too many requests') || errorMsg.includes('rate limit');
                                          const isParseError = errorMsg.includes('parse') ||
                                                               errorMsg.includes('JSON') ||
                                                               errorMsg.includes('Expected') ||
                                                               errorMsg.includes('SyntaxError') ||
                                                               errorMsg.includes('Unexpected');
                                          toast({
                                            title: isRateLimited ? "Rate Limited" : isParseError ? "Analysis Response Error" : "Analysis Failed",
                                            description: isRateLimited
                                              ? "API rate limit reached. Please wait a moment and try again."
                                              : isParseError
                                              ? "The AI returned an unexpected response. Please try again."
                                              : errorMsg,
                                            variant: "destructive",
                                          });
                                        } finally {
                                          setIsLoadingAnalysis(false);
                                        }
                                      }}
                                    >
                                      <FileSearch className="h-4 w-4" />
                                      {isLoadingAnalysis ? "Analyzing..." : "Re-analyze"}
                                    </Button>
                                  </div>
                                  
                                  {/* Analysis Results Display */}
                                  {attachmentAnalysis && attachmentAnalysis.summary && (
                                    <div className="space-y-3 mb-4 p-4 border rounded-lg bg-muted/30">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">Analysis Results</h4>
                                        <div className="flex items-center gap-2">
                                          <Badge variant={attachmentAnalysis.summary.overallClaimLikelihood >= 60 ? "default" : "secondary"} 
                                            className={attachmentAnalysis.summary.overallClaimLikelihood >= 60 ? "bg-green-500" : ""}>
                                            {attachmentAnalysis.summary.overallClaimLikelihood}% Claim Likelihood
                                          </Badge>
                                          <Badge variant="outline">
                                            {attachmentAnalysis.summary.confidenceLevel} Confidence
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <p className="text-sm text-muted-foreground">
                                        {attachmentAnalysis.summary.assessmentReason}
                                      </p>
                                      
                                      {attachmentAnalysis.summary.keyIndicators && attachmentAnalysis.summary.keyIndicators.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-green-600">Key Indicators Found:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {attachmentAnalysis.summary.keyIndicators.map((indicator, idx) => (
                                              <Badge key={idx} variant="outline" className="text-xs bg-green-50 border-green-200 text-green-700">
                                                {indicator}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {attachmentAnalysis.summary.missingInformation && attachmentAnalysis.summary.missingInformation.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="text-xs font-medium text-amber-600">Missing Information:</p>
                                          <div className="flex flex-wrap gap-1">
                                            {attachmentAnalysis.summary.missingInformation.map((item, idx) => (
                                              <Badge key={idx} variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                                {item}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Individual Document Analysis */}
                                      {attachmentAnalysis.analyses && attachmentAnalysis.analyses.length > 0 && (
                                        <div className="mt-3 pt-3 border-t">
                                          <p className="text-xs font-medium mb-2">Document Classification:</p>
                                          <div className="grid gap-2">
                                            {attachmentAnalysis.analyses.map((analysis, idx) => (
                                              <div key={idx} className="flex items-center justify-between p-2 bg-background rounded border text-xs">
                                                <div className="flex items-center gap-2">
                                                  <span className="font-medium truncate max-w-[200px]" title={analysis.fileName}>
                                                    {analysis.fileName}
                                                  </span>
                                                  <Badge variant={analysis.isClaimRelated ? "default" : "secondary"} 
                                                    className={analysis.isClaimRelated ? "bg-green-500 text-[10px]" : "text-[10px]"}>
                                                    {analysis.documentType}
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                  {analysis.containsClaimNumber && (
                                                    <Badge variant="outline" className="text-[10px]">Claim#</Badge>
                                                  )}
                                                  {analysis.containsPolicyNumber && (
                                                    <Badge variant="outline" className="text-[10px]">Policy#</Badge>
                                                  )}
                                                  {analysis.containsVehicleReg && (
                                                    <Badge variant="outline" className="text-[10px]">Vehicle</Badge>
                                                  )}
                                                  <span className="text-muted-foreground">{analysis.documentConfidence}%</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* Loading State */}
                                  {isLoadingAnalysis && !attachmentAnalysis && (
                                    <div className="flex items-center justify-center p-4 text-muted-foreground">
                                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                      Loading analysis...
                                    </div>
                                  )}
                                  
                                  {/* Attachments List */}
                                  <div className="grid gap-2">
                                    {attachments.map((att: { filename: string; contentType?: string; size?: number }, idx: number) => {
                                      const isImage = att.contentType?.startsWith('image/');
                                      const isPdf = att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf');
                                      const isDoc = att.filename.toLowerCase().endsWith('.doc') || att.filename.toLowerCase().endsWith('.docx');
                                      
                                      // Check if filename suggests claim-related content
                                      const filenameLower = att.filename.toLowerCase();
                                      const isClaimRelated = 
                                        filenameLower.includes('claim') ||
                                        filenameLower.includes('policy') ||
                                        filenameLower.includes('schedule') ||
                                        filenameLower.includes('form') ||
                                        filenameLower.includes('incident') ||
                                        filenameLower.includes('accident');
                                      
                                      return (
                                        <div
                                          key={idx}
                                          className={`flex items-center gap-3 p-3 rounded-md border ${
                                            isClaimRelated ? 'border-green-500/30 bg-green-500/5' : 'border-border'
                                          }`}
                                        >
                                          <div className={`p-2 rounded-md ${
                                            isPdf ? 'bg-red-100 text-red-600' :
                                            isImage ? 'bg-blue-100 text-blue-600' :
                                            isDoc ? 'bg-purple-100 text-purple-600' :
                                            'bg-gray-100 text-gray-600'
                                          }`}>
                                            <FileText className="h-5 w-5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              <p className="text-sm font-medium truncate">{att.filename}</p>
                                              {isClaimRelated && (
                                                <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                                                  Claim Document
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                              {att.contentType || 'Unknown type'}
                                              {att.size && ` • ${(att.size / 1024).toFixed(1)} KB`}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {(isImage || isPdf) && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => previewAttachmentFile(selectedEmail.id, att.filename)}
                                                title="Preview"
                                              >
                                                <Eye className="h-4 w-4" />
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0"
                                              onClick={() => downloadAttachment(selectedEmail.id, att.filename)}
                                              title="Download"
                                            >
                                              <Download className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              onClick={() => deleteAttachment(selectedEmail.id, att.filename)}
                                              title="Remove"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  
                                  {/* Claim Detection Hint */}
                                  {attachments.some((a: { filename: string }) => 
                                    a.filename.toLowerCase().includes('claim') ||
                                    a.filename.toLowerCase().includes('policy') ||
                                    a.filename.toLowerCase().includes('form')
                                  ) && (
                                    <div className="flex items-start gap-2 p-3 mt-4 bg-green-500/10 border border-green-500/30 rounded-md">
                                      <FileCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-sm font-medium text-green-700">Likely Claim Documents Detected</p>
                                        <p className="text-xs text-green-600 mt-1">
                                          This email contains attachments that appear to be claim-related (claim forms, policy schedules, etc.).
                                          These documents typically indicate a new claim submission.
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            } catch {
                              return (
                                <div className="text-center py-8 text-muted-foreground">
                                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p className="text-sm">Could not parse attachment data</p>
                                </div>
                              );
                            }
                          })()
                        ) : (
                          <div className="text-center py-8 text-muted-foreground">
                            <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No attachments in this email</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
                    
                    {/* Tertiary Actions - Delete */}
                    <div className="flex justify-center">
                      <Button 
                        variant="ghost" 
                        className="py-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => deleteEmail(selectedEmail.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        <span className="text-sm">Delete & Repoll</span>
                      </Button>
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

      {/* Attachment Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[95vh] p-0 sm:!max-w-[98vw]">
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {previewAttachment?.filename}
            </DialogTitle>
            <DialogDescription>
              {previewAttachment?.contentType}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden h-[calc(95vh-120px)]">
            {previewAttachment && (
              previewAttachment.contentType.startsWith('image/') ? (
                <div className="overflow-auto p-4 h-full">
                  <img
                    src={previewAttachment.content}
                    alt={previewAttachment.filename}
                    className="max-w-full max-h-full mx-auto object-contain"
                  />
                </div>
              ) : previewAttachment.contentType.includes('pdf') ? (
                <PDFViewer file={previewAttachment.content} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                  <FileText className="h-16 w-16 mb-4 opacity-50" />
                  <p>Preview not available for this file type</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      if (previewAttachment) {
                        downloadAttachment(selectedEmail?.id || '', previewAttachment.filename);
                      }
                    }}
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
    </div>
  );
}
