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
  DialogFooter,
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
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Plus,
  Link,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DomainSuggestion {
  id: string;
  senderDomain: string;
  detectedCompanyName: string | null;
  detectedFromEmail: string | null;
  suggestedCompanyId: string | null;
  suggestedCompanyName: string | null;
  confidenceScore: number;
  emailCount: number;
  claimCount: number;
  sampleSubjects: string | null;
  status: string;
  createdAt: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
  shortName: string | null;
}

export function DomainSuggestionsCard() {
  const [suggestions, setSuggestions] = useState<DomainSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<DomainSuggestion | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchSuggestions();
    fetchCompanies();
  }, []);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/domain-suggestions?status=pending&limit=10");
      const json = await res.json();
      setSuggestions(json.suggestions || []);
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/insurance");
      const json = await res.json();
      setCompanies(json.insurance || []);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    }
  };

  const handleApprove = async () => {
    if (!selectedSuggestion) return;

    setProcessing(selectedSuggestion.id);
    try {
      const res = await fetch("/api/domain-suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: selectedSuggestion.id,
          action: "approve",
          companyId: selectedCompanyId || undefined,
          newCompanyName: selectedCompanyId ? undefined : newCompanyName,
        }),
      });

      const json = await res.json();

      if (json.approved) {
        toast({
          title: "Domain Approved",
          description: `${selectedSuggestion.senderDomain} has been linked to an insurance company`,
        });
        fetchSuggestions();
        setApproveDialogOpen(false);
        setSelectedSuggestion(null);
        setSelectedCompanyId("");
        setNewCompanyName("");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve domain",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (suggestion: DomainSuggestion) => {
    setProcessing(suggestion.id);
    try {
      const res = await fetch("/api/domain-suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId: suggestion.id,
          action: "reject",
        }),
      });

      const json = await res.json();

      if (json.rejected) {
        toast({
          title: "Domain Rejected",
          description: `${suggestion.senderDomain} has been marked as not an insurance company`,
        });
        fetchSuggestions();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject domain",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const openApproveDialog = (suggestion: DomainSuggestion) => {
    setSelectedSuggestion(suggestion);
    setNewCompanyName(suggestion.suggestedCompanyName || suggestion.detectedCompanyName || "");
    setApproveDialogOpen(true);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">High ({score}%)</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-500">Medium ({score}%)</Badge>;
    return <Badge className="bg-red-500">Low ({score}%)</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-yellow-500/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">New Domains Detected</CardTitle>
              <Badge variant="secondary">{suggestions.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchSuggestions}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            These sender domains are not yet linked to insurance companies. Review and approve them to improve AI accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Suggested Company</TableHead>
                  <TableHead>Emails</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{suggestion.senderDomain}</span>
                      </div>
                      {suggestion.detectedFromEmail && (
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                          {suggestion.detectedFromEmail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {suggestion.suggestedCompanyName || suggestion.detectedCompanyName || (
                        <span className="text-muted-foreground">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>{suggestion.emailCount}</TableCell>
                    <TableCell>{getConfidenceBadge(suggestion.confidenceScore)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7"
                          onClick={() => openApproveDialog(suggestion)}
                          disabled={processing === suggestion.id}
                        >
                          {processing === suggestion.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-red-500 hover:text-red-600"
                          onClick={() => handleReject(suggestion)}
                          disabled={processing === suggestion.id}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Link Domain to Insurance Company
            </DialogTitle>
            <DialogDescription>
              Choose how to link <strong>{selectedSuggestion?.senderDomain}</strong> to an insurance company.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Detected info */}
            {selectedSuggestion?.sampleSubjects && (
              <div className="bg-muted/50 rounded-lg p-3">
                <Label className="text-xs text-muted-foreground">Sample Email Subjects</Label>
                <div className="mt-1 space-y-1">
                  {JSON.parse(selectedSuggestion.sampleSubjects).slice(0, 3).map((subject: string, i: number) => (
                    <p key={i} className="text-sm truncate">{subject}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label>Option 1: Link to Existing Company</Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an existing insurance company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name} {company.shortName && `(${company.shortName})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-3">
              <Label>Option 2: Create New Company</Label>
              <Input
                placeholder="New company name..."
                value={newCompanyName}
                onChange={(e) => {
                  setNewCompanyName(e.target.value);
                  setSelectedCompanyId("");
                }}
                disabled={!!selectedCompanyId}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing === selectedSuggestion?.id || (!selectedCompanyId && !newCompanyName)}
            >
              {processing === selectedSuggestion?.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Approve & Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
