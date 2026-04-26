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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Phone,
  Mail,
  FolderOpen,
  Search,
  Code,
  Hash,
  Play,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InsuranceCompany {
  id: string;
  name: string;
  shortName: string | null;
  folderName: string;
  senderDomains: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { claims: number };
  createdAt: string;
}

interface ExtractionPattern {
  id: string;
  insuranceCompanyId: string;
  fieldType: string;
  patternType: string;
  patternValue: string;
  description: string | null;
  exampleMatch: string | null;
  confidence: number;
  successCount: number;
  failureCount: number;
  isActive: boolean;
  isSystemPattern: boolean;
  insuranceCompany: { name: string; shortName: string | null };
}

interface ClaimNumberFormat {
  id: string;
  insuranceCompanyId: string;
  formatPattern: string;
  prefix: string | null;
  separator: string | null;
  hasYear: boolean;
  regexPattern: string;
  example: string | null;
  matchCount: number;
  confidence: number;
  isActive: boolean;
}

export function InsuranceSection() {
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);
  const [patterns, setPatterns] = useState<ExtractionPattern[]>([]);
  const [formats, setFormats] = useState<ClaimNumberFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [patternDialogOpen, setPatternDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<InsuranceCompany | null>(null);
  const [testClaimNumber, setTestClaimNumber] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    shortName: "",
    folderName: "",
    senderDomains: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    isActive: true,
  });

  const [patternForm, setPatternForm] = useState({
    insuranceCompanyId: "",
    fieldType: "claimNumber",
    patternType: "regex",
    patternValue: "",
    description: "",
    exampleMatch: "",
  });

  useEffect(() => {
    fetchCompanies();
    fetchPatterns();
    fetchFormats();
  }, []);

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/insurance");
      const json = await res.json();
      setCompanies(json || []);
    } catch (error) {
      console.error("Failed to fetch companies:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await fetch("/api/extraction-patterns");
      const json = await res.json();
      setPatterns(json || []);
    } catch (error) {
      console.error("Failed to fetch patterns:", error);
    }
  };

  const fetchFormats = async () => {
    try {
      const res = await fetch("/api/claim-number-formats");
      const json = await res.json();
      setFormats(json || []);
    } catch (error) {
      console.error("Failed to fetch formats:", error);
    }
  };

  const seedDefaultFormats = async () => {
    try {
      const res = await fetch("/api/claim-number-formats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_all" }),
      });
      const json = await res.json();
      toast({
        title: "Formats Seeded",
        description: `Created ${json.created} claim number formats`,
      });
      fetchFormats();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to seed formats",
        variant: "destructive",
      });
    }
  };

  const testClaimNumberFormat = async () => {
    if (!testClaimNumber) return;
    try {
      const res = await fetch("/api/claim-number-formats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimNumber: testClaimNumber }),
      });
      const json = await res.json();
      setTestResult(json);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to test claim number",
        variant: "destructive",
      });
    }
  };

  const openCreate = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      shortName: "",
      folderName: "",
      senderDomains: "",
      contactEmail: "",
      contactPhone: "",
      notes: "",
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (company: InsuranceCompany) => {
    setEditingCompany(company);
    setFormData({
      name: company.name,
      shortName: company.shortName || "",
      folderName: company.folderName,
      senderDomains: company.senderDomains || "",
      contactEmail: company.contactEmail || "",
      contactPhone: company.contactPhone || "",
      notes: company.notes || "",
      isActive: company.isActive,
    });
    setDialogOpen(true);
  };

  const openPatternCreate = (companyId?: string) => {
    setPatternForm({
      insuranceCompanyId: companyId || "",
      fieldType: "claimNumber",
      patternType: "regex",
      patternValue: "",
      description: "",
      exampleMatch: "",
    });
    setPatternDialogOpen(true);
  };

  const saveCompany = async () => {
    try {
      const url = editingCompany
        ? `/api/insurance/${editingCompany.id}`
        : "/api/insurance";
      const method = editingCompany ? "PUT" : "POST";

      const body = {
        ...formData,
        senderDomains: formData.senderDomains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `Company ${editingCompany ? "updated" : "created"} successfully`,
        });
        setDialogOpen(false);
        fetchCompanies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save company",
        variant: "destructive",
      });
    }
  };

  const savePattern = async () => {
    try {
      const res = await fetch("/api/extraction-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patternForm),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Pattern created successfully",
        });
        setPatternDialogOpen(false);
        fetchPatterns();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save pattern",
        variant: "destructive",
      });
    }
  };

  const deleteCompany = async (id: string) => {
    if (!confirm("Are you sure you want to delete this company?")) return;

    try {
      const res = await fetch(`/api/insurance/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Company deleted successfully",
        });
        fetchCompanies();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete company",
        variant: "destructive",
      });
    }
  };

  const deletePattern = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this pattern?")) return;

    try {
      const res = await fetch(`/api/extraction-patterns?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Pattern deactivated",
        });
        fetchPatterns();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to deactivate pattern",
        variant: "destructive",
      });
    }
  };

  const filteredCompanies = companies.filter((company) =>
    company.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFieldBadge = (fieldType: string) => {
    const colors: Record<string, string> = {
      claimNumber: "bg-blue-500",
      policyNumber: "bg-green-500",
      clientName: "bg-purple-500",
      vehicleRegistration: "bg-orange-500",
      excessAmount: "bg-yellow-500",
    };
    return (
      <Badge className={colors[fieldType] || "bg-gray-500"}>
        {fieldType}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insurance Companies</h1>
          <p className="text-muted-foreground">
            Manage companies, extraction patterns, and claim number formats
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Company
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-2" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <Code className="h-4 w-4 mr-2" />
            Extraction Patterns
          </TabsTrigger>
          <TabsTrigger value="formats">
            <Hash className="h-4 w-4 mr-2" />
            Claim Number Formats
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-4">
          {/* Search */}
          <div className="relative w-64 mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search companies..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Companies Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Short Name</TableHead>
                    <TableHead>Folder</TableHead>
                    <TableHead>Domains</TableHead>
                    <TableHead>Claims</TableHead>
                    <TableHead>Status</TableHead>
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
                  ) : filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No companies found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{company.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{company.shortName || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {company.folderName}
                          </div>
                        </TableCell>
                        <TableCell>
                          {company.senderDomains ? (
                            <div className="flex flex-wrap gap-1">
                              {JSON.parse(company.senderDomains).slice(0, 2).map((domain: string) => (
                                <Badge key={domain} variant="outline" className="text-xs">
                                  {domain}
                                </Badge>
                              ))}
                              {JSON.parse(company.senderDomains).length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{JSON.parse(company.senderDomains).length - 2}
                                </Badge>
                              )}
                            </div>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{company._count?.claims || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={company.isActive ? "default" : "secondary"}>
                            {company.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPatternCreate(company.id)}
                              title="Add extraction pattern"
                            >
                              <Code className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCompany(company.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Extraction Patterns Tab */}
        <TabsContent value="patterns" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Extraction Patterns</CardTitle>
                  <CardDescription>
                    Learn patterns to extract data from different insurance company formats
                  </CardDescription>
                </div>
                <Button onClick={() => openPatternCreate()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Pattern
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Example</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Stats</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No patterns yet. Patterns are learned from user corrections or can be added manually.
                        </TableCell>
                      </TableRow>
                    ) : (
                      patterns.map((pattern) => (
                        <TableRow key={pattern.id}>
                          <TableCell className="font-medium">
                            {pattern.insuranceCompany?.name || "Generic"}
                          </TableCell>
                          <TableCell>{getFieldBadge(pattern.fieldType)}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1 rounded">
                              {pattern.patternValue.length > 30
                                ? `${pattern.patternValue.substring(0, 30)}...`
                                : pattern.patternValue}
                            </code>
                          </TableCell>
                          <TableCell className="text-sm">
                            {pattern.exampleMatch || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {pattern.confidence}%
                              {pattern.confidence >= 80 ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : pattern.confidence >= 60 ? (
                                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <span className="text-green-600">✓{pattern.successCount}</span>
                            {" / "}
                            <span className="text-red-600">✗{pattern.failureCount}</span>
                          </TableCell>
                          <TableCell>
                            {pattern.isSystemPattern ? (
                              <Badge variant="secondary">Auto</Badge>
                            ) : (
                              <Badge variant="outline">Manual</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePattern(pattern.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Claim Number Formats Tab */}
        <TabsContent value="formats" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Claim Number Formats</CardTitle>
                  <CardDescription>
                    Recognize claim numbers from different insurance companies
                  </CardDescription>
                </div>
                <Button onClick={seedDefaultFormats} variant="outline">
                  <Zap className="mr-2 h-4 w-4" />
                  Seed SA Formats
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Test Claim Number */}
              <div className="flex gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <Label>Test Claim Number</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="e.g., STM-2024-12345"
                      value={testClaimNumber}
                      onChange={(e) => setTestClaimNumber(e.target.value)}
                    />
                    <Button onClick={testClaimNumberFormat}>
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {testResult && (
                  <div className="flex-1">
                    <Label>Match Result</Label>
                    <div className="mt-1 p-3 bg-background rounded border">
                      {testResult.bestMatch ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="font-medium">
                            {(testResult.bestMatch as Record<string, unknown>).companyName as string}
                          </span>
                          <Badge variant="outline">
                            {(testResult.bestMatch as Record<string, unknown>).format as string}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <XCircle className="h-4 w-4" />
                          No matching format found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Format Pattern</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Example</TableHead>
                      <TableHead>Has Year</TableHead>
                      <TableHead>Matches</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formats.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Click "Seed SA Formats" to add default South African insurance formats
                        </TableCell>
                      </TableRow>
                    ) : (
                      formats.map((format) => (
                        <TableRow key={format.id}>
                          <TableCell className="font-mono text-sm">
                            {format.formatPattern}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{format.prefix || "-"}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format.example || "-"}
                          </TableCell>
                          <TableCell>
                            {format.hasYear ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-300" />
                            )}
                          </TableCell>
                          <TableCell>{format.matchCount}</TableCell>
                          <TableCell>{format.confidence}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Company Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCompany ? "Edit Company" : "Add Company"}
            </DialogTitle>
            <DialogDescription>
              {editingCompany
                ? "Update insurance company details"
                : "Add a new insurance company to the registry"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData({
                      ...formData,
                      name,
                      folderName: formData.folderName || name.toLowerCase().replace(/\s+/g, "-"),
                    });
                  }}
                />
              </div>
              <div>
                <Label>Short Name</Label>
                <Input
                  value={formData.shortName}
                  onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Folder Name *</Label>
                <Input
                  value={formData.folderName}
                  onChange={(e) => setFormData({ ...formData, folderName: e.target.value })}
                />
              </div>
              <div>
                <Label>Sender Domains</Label>
                <Input
                  placeholder="domain1.com, domain2.com"
                  value={formData.senderDomains}
                  onChange={(e) => setFormData({ ...formData, senderDomains: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of email domains
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCompany}>
              {editingCompany ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pattern Dialog */}
      <Dialog open={patternDialogOpen} onOpenChange={setPatternDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extraction Pattern</DialogTitle>
            <DialogDescription>
              Create a pattern to extract specific fields from emails
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Insurance Company</Label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={patternForm.insuranceCompanyId}
                onChange={(e) => setPatternForm({ ...patternForm, insuranceCompanyId: e.target.value })}
              >
                <option value="">Generic (All Companies)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Field Type</Label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={patternForm.fieldType}
                onChange={(e) => setPatternForm({ ...patternForm, fieldType: e.target.value })}
              >
                <option value="claimNumber">Claim Number</option>
                <option value="policyNumber">Policy Number</option>
                <option value="clientName">Client Name</option>
                <option value="vehicleRegistration">Vehicle Registration</option>
                <option value="excessAmount">Excess Amount</option>
                <option value="clientPhone">Client Phone</option>
                <option value="clientEmail">Client Email</option>
              </select>
            </div>

            <div>
              <Label>Regex Pattern</Label>
              <Textarea
                placeholder="e.g., (?:Claim|Ref)[:\s]+([A-Z]{2,4}-\d{4}-\d{5,8})"
                value={patternForm.patternValue}
                onChange={(e) => setPatternForm({ ...patternForm, patternValue: e.target.value })}
                rows={2}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use capture groups () to extract the value
              </p>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                placeholder="Human-readable description"
                value={patternForm.description}
                onChange={(e) => setPatternForm({ ...patternForm, description: e.target.value })}
              />
            </div>

            <div>
              <Label>Example Match</Label>
              <Input
                placeholder="e.g., STM-2024-12345"
                value={patternForm.exampleMatch}
                onChange={(e) => setPatternForm({ ...patternForm, exampleMatch: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPatternDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePattern}>
              Create Pattern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
