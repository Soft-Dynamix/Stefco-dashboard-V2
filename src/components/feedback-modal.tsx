"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  MessageSquare,
  Mail,
  Ban,
  FileX,
  TestTube,
  HelpCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";

interface Email {
  id: string;
  subject: string | null;
  from: string | null;
  fromDomain: string | null;
  aiClassification: string | null;
  aiConfidence: number | null;
  aiReasoning: string | null;
}

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: Email | null;
  onSubmit: (feedback: RejectionFeedbackData) => Promise<void>;
}

export interface RejectionFeedbackData {
  emailQueueId: string;
  rejectionCategory: string;
  rejectionReason: string;
  isFollowUp: boolean;
  relatedClaimId?: string;
  applyToSender: boolean;
  suggestedRule?: string;
}

const REJECTION_CATEGORIES = [
  {
    value: "follow_up",
    label: "Follow-up Email",
    description: "This is a reply/follow-up to an existing claim, not a new claim",
    icon: MessageSquare,
    color: "text-blue-500",
  },
  {
    value: "duplicate",
    label: "Duplicate",
    description: "Same claim already exists or was already processed",
    icon: RefreshCw,
    color: "text-orange-500",
  },
  {
    value: "not_a_claim",
    label: "Not a Claim",
    description: "Email doesn't contain claim information (general correspondence)",
    icon: FileX,
    color: "text-gray-500",
  },
  {
    value: "spam",
    label: "Spam/Junk",
    description: "Unsolicited or irrelevant email",
    icon: Ban,
    color: "text-red-500",
  },
  {
    value: "marketing",
    label: "Marketing/Promotional",
    description: "Sales or promotional content from insurance company",
    icon: Mail,
    color: "text-purple-500",
  },
  {
    value: "wrong_sender",
    label: "Wrong Sender Type",
    description: "Email from personal address, not official insurance channel",
    icon: AlertCircle,
    color: "text-yellow-500",
  },
  {
    value: "already_processed",
    label: "Already Processed",
    description: "This claim was already handled previously",
    icon: RefreshCw,
    color: "text-orange-500",
  },
  {
    value: "test_email",
    label: "Test Email",
    description: "Test or development email, not real claim",
    icon: TestTube,
    color: "text-cyan-500",
  },
  {
    value: "other",
    label: "Other Reason",
    description: "Specify in the reason field below",
    icon: HelpCircle,
    color: "text-gray-400",
  },
];

export function FeedbackModal({
  open,
  onOpenChange,
  email,
  onSubmit,
}: FeedbackModalProps) {
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [applyToSender, setApplyToSender] = useState(false);
  const [relatedClaimId, setRelatedClaimId] = useState("");
  const [suggestedRule, setSuggestedRule] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-suggest based on subject
  useEffect(() => {
    if (email?.subject) {
      const subject = email.subject.toLowerCase();
      if (subject.startsWith("re:") || subject.startsWith("fwd:") || subject.includes("follow-up")) {
        setIsFollowUp(true);
        if (!category) setCategory("follow_up");
      }
    }
  }, [email?.subject, category]);

  // Generate suggested rule based on category
  useEffect(() => {
    if (category && email?.fromDomain) {
      const rules: Record<string, string> = {
        follow_up: `Ignore "Re:" and "FWD:" emails from ${email.fromDomain}`,
        duplicate: `Flag duplicate subjects from ${email.fromDomain} for review`,
        spam: `Auto-ignore emails from ${email.fromDomain}`,
        marketing: `Auto-ignore marketing emails from ${email.fromDomain}`,
        wrong_sender: `Require verification for non-official senders from ${email.fromDomain}`,
        not_a_claim: `Lower confidence for ${email.fromDomain} claim detection`,
        test_email: `Ignore test emails with similar patterns`,
        already_processed: `Flag as already processed for ${email.fromDomain}`,
      };
      setSuggestedRule(rules[category] || "");
    }
  }, [category, email?.fromDomain]);

  const handleSubmit = async () => {
    if (!email || !category) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        emailQueueId: email.id,
        rejectionCategory: category,
        rejectionReason: reason,
        isFollowUp,
        relatedClaimId: relatedClaimId || undefined,
        applyToSender,
        suggestedRule: suggestedRule || undefined,
      });
      
      // Reset form
      setCategory("");
      setReason("");
      setIsFollowUp(false);
      setApplyToSender(false);
      setRelatedClaimId("");
      setSuggestedRule("");
      onOpenChange(false);
    } catch (error) {
      // Error is handled by parent component's toast
      console.error("Failed to submit feedback:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategory = REJECTION_CATEGORIES.find((c) => c.value === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Why Ignore This Email?
          </DialogTitle>
          <DialogDescription>
            Your feedback helps the AI learn to make better decisions. Please explain why this email should be ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium truncate">{email?.subject || "(No Subject)"}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              From: {email?.from} ({email?.fromDomain})
            </div>
            {email?.aiClassification && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">AI thought:</span>
                <Badge variant="outline">{email.aiClassification}</Badge>
                {email.aiConfidence !== null && (
                  <span className="text-muted-foreground">
                    ({email.aiConfidence.toFixed(0)}% confidence)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div className="space-y-3">
            <Label>Rejection Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select why this email should be ignored..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <cat.icon className={`h-4 w-4 ${cat.color}`} />
                      <span>{cat.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {selectedCategory && (
              <p className="text-sm text-muted-foreground">
                {selectedCategory.description}
              </p>
            )}
          </div>

          {/* Follow-up Detection */}
          <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="space-y-0.5">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                This is a follow-up to an existing claim
              </Label>
              <p className="text-sm text-muted-foreground">
                Mark if this email is a reply/follow-up, not a new claim
              </p>
            </div>
            <Switch
              checked={isFollowUp}
              onCheckedChange={setIsFollowUp}
            />
          </div>

          {/* Related Claim (if follow-up) */}
          {isFollowUp && (
            <div className="space-y-2">
              <Label>Related Claim Number (Optional)</Label>
              <Input
                placeholder="e.g., CLM-2024-00123"
                value={relatedClaimId}
                onChange={(e) => setRelatedClaimId(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Link this email to an existing claim for better thread tracking
              </p>
            </div>
          )}

          {/* Detailed Reason */}
          <div className="space-y-2">
            <Label>Detailed Reason (Optional)</Label>
            <Textarea
              placeholder="Explain more details about why this should be ignored. This helps the AI learn specific patterns..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Learning Options */}
          <div className="space-y-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="flex items-center gap-2">
              <Checkbox
                id="applyToSender"
                checked={applyToSender}
                onCheckedChange={(checked) => setApplyToSender(checked as boolean)}
              />
              <Label htmlFor="applyToSender" className="font-normal cursor-pointer">
                Create ignore rule for this sender/category
              </Label>
            </div>
            <p className="text-sm text-muted-foreground ml-6">
              Automatically apply this decision to future similar emails from {email?.fromDomain}
            </p>

            {suggestedRule && (
              <div className="mt-3 p-3 bg-background rounded border">
                <Label className="text-xs text-muted-foreground">Suggested Rule:</Label>
                <p className="text-sm font-medium">{suggestedRule}</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!category || isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit & Ignore Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
