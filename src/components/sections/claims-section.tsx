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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  Building2,
  Calendar,
  Phone,
  Mail,
  Car,
  Home,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Claim {
  id: string;
  claimNumber: string;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  claimType: string | null;
  incidentDate: string | null;
  incidentDescription: string | null;
  vehicleRegistration: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  propertyAddress: string | null;
  excessAmount: number | null;
  status: string;
  processingStage: string;
  classificationConfidence: number | null;
  extractionConfidence: number | null;
  insuranceCompanyId: string | null;
  insuranceCompany: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

export function ClaimsSection() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    claimNumber: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    claimType: "",
    incidentDate: "",
    incidentDescription: "",
    vehicleRegistration: "",
    vehicleMake: "",
    vehicleModel: "",
    propertyAddress: "",
    excessAmount: "",
    insuranceCompanyId: "",
    status: "NEW",
  });

  useEffect(() => {
    fetchClaims();
    fetchInsuranceCompanies();
  }, [statusFilter]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/claims?status=${statusFilter}`);
      const json = await res.json();
      setClaims(json.claims || []);
    } catch (error) {
      console.error("Failed to fetch claims:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInsuranceCompanies = async () => {
    try {
      const res = await fetch("/api/insurance");
      const json = await res.json();
      setInsuranceCompanies(json || []);
    } catch (error) {
      console.error("Failed to fetch insurance companies:", error);
    }
  };

  const viewClaim = async (claim: Claim) => {
    try {
      const res = await fetch(`/api/claims/${claim.id}`);
      const json = await res.json();
      setSelectedClaim(json);
      setDetailsOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load claim details",
        variant: "destructive",
      });
    }
  };

  const editClaim = (claim: Claim) => {
    setFormData({
      claimNumber: claim.claimNumber,
      clientName: claim.clientName || "",
      clientEmail: claim.clientEmail || "",
      clientPhone: claim.clientPhone || "",
      claimType: claim.claimType || "",
      incidentDate: claim.incidentDate ? claim.incidentDate.split("T")[0] : "",
      incidentDescription: claim.incidentDescription || "",
      vehicleRegistration: claim.vehicleRegistration || "",
      vehicleMake: claim.vehicleMake || "",
      vehicleModel: claim.vehicleModel || "",
      propertyAddress: claim.propertyAddress || "",
      excessAmount: claim.excessAmount?.toString() || "",
      insuranceCompanyId: claim.insuranceCompanyId || "",
      status: claim.status,
    });
    setSelectedClaim(claim);
    setEditOpen(true);
  };

  const createClaim = async () => {
    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Claim created successfully",
        });
        setCreateOpen(false);
        resetForm();
        fetchClaims();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create claim",
        variant: "destructive",
      });
    }
  };

  const updateClaim = async () => {
    if (!selectedClaim) return;

    try {
      const res = await fetch(`/api/claims/${selectedClaim.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Claim updated successfully",
        });
        setEditOpen(false);
        fetchClaims();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update claim",
        variant: "destructive",
      });
    }
  };

  const deleteClaim = async (claimId: string) => {
    if (!confirm("Are you sure you want to delete this claim?")) return;

    try {
      const res = await fetch(`/api/claims/${claimId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: "Claim deleted successfully",
        });
        fetchClaims();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete claim",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      claimNumber: "",
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      claimType: "",
      incidentDate: "",
      incidentDescription: "",
      vehicleRegistration: "",
      vehicleMake: "",
      vehicleModel: "",
      propertyAddress: "",
      excessAmount: "",
      insuranceCompanyId: "",
      status: "NEW",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      NEW: "secondary",
      IN_PROGRESS: "default",
      PENDING_INFO: "outline",
      COMPLETED: "default",
      CLOSED: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const filteredClaims = claims.filter((claim) => {
    if (!searchQuery) return true;
    return (
      claim.claimNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      claim.vehicleRegistration?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const claimTypes = ["MOTOR", "PROPERTY", "LIABILITY", "THEFT", "FIRE", "OTHER"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims</h1>
          <p className="text-muted-foreground">
            Manage and process insurance claims
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Claim
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by claim number, client, or vehicle..."
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
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="NEW">New</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="PENDING_INFO">Pending Info</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Claims Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim Number</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Insurance Co.</TableHead>
                <TableHead>Status</TableHead>
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
              ) : filteredClaims.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No claims found
                  </TableCell>
                </TableRow>
              ) : (
                filteredClaims.map((claim) => (
                  <TableRow key={claim.id}>
                    <TableCell className="font-medium">{claim.claimNumber}</TableCell>
                    <TableCell>{claim.clientName || "-"}</TableCell>
                    <TableCell>
                      {claim.claimType ? (
                        <Badge variant="outline">{claim.claimType}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {claim.insuranceCompany?.name || "-"}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell>
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewClaim(claim)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editClaim(claim)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteClaim(claim.id)}
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

      {/* View Claim Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Claim Details</DialogTitle>
            <DialogDescription>
              {selectedClaim?.claimNumber}
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <ScrollArea className="h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Status & Confidence */}
                <div className="flex items-center gap-4">
                  {getStatusBadge(selectedClaim.status)}
                  <Badge variant="outline">{selectedClaim.processingStage}</Badge>
                  {selectedClaim.classificationConfidence !== null && (
                    <span className="text-sm text-muted-foreground">
                      AI Confidence: {selectedClaim.classificationConfidence.toFixed(0)}%
                    </span>
                  )}
                </div>

                <Separator />

                {/* Client Info */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Client Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">{selectedClaim.clientName || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{selectedClaim.clientEmail || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Phone</Label>
                      <p className="font-medium">{selectedClaim.clientPhone || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Insurance Company</Label>
                      <p className="font-medium">{selectedClaim.insuranceCompany?.name || "-"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Claim Details */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Claim Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p className="font-medium">{selectedClaim.claimType || "-"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Incident Date</Label>
                      <p className="font-medium">
                        {selectedClaim.incidentDate
                          ? new Date(selectedClaim.incidentDate).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Excess Amount</Label>
                      <p className="font-medium">
                        {selectedClaim.excessAmount ? `R ${selectedClaim.excessAmount}` : "-"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="font-medium">{selectedClaim.incidentDescription || "-"}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Vehicle/Property Info */}
                {selectedClaim.claimType === "MOTOR" ? (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Car className="h-4 w-4" />
                      Vehicle Information
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Registration</Label>
                        <p className="font-medium">{selectedClaim.vehicleRegistration || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Make</Label>
                        <p className="font-medium">{selectedClaim.vehicleMake || "-"}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Model</Label>
                        <p className="font-medium">{selectedClaim.vehicleModel || "-"}</p>
                      </div>
                    </div>
                  </div>
                ) : selectedClaim.claimType === "PROPERTY" ? (
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Home className="h-4 w-4" />
                      Property Information
                    </h3>
                    <div>
                      <Label className="text-muted-foreground">Address</Label>
                      <p className="font-medium">{selectedClaim.propertyAddress || "-"}</p>
                    </div>
                  </div>
                ) : null}

                <Separator />

                {/* Timestamps */}
                <div className="text-sm text-muted-foreground">
                  <p>Created: {new Date(selectedClaim.createdAt).toLocaleString()}</p>
                  <p>Updated: {new Date(selectedClaim.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit/Create Claim Dialog */}
      <Dialog open={editOpen || createOpen} onOpenChange={() => {
        setEditOpen(false);
        setCreateOpen(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editOpen ? "Edit Claim" : "Create Claim"}</DialogTitle>
            <DialogDescription>
              {editOpen ? "Update claim details" : "Enter claim details"}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Claim Number *</Label>
                  <Input
                    value={formData.claimNumber}
                    onChange={(e) => setFormData({ ...formData, claimNumber: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="PENDING_INFO">Pending Info</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client Name</Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Insurance Company</Label>
                  <Select
                    value={formData.insuranceCompanyId}
                    onValueChange={(v) => setFormData({ ...formData, insuranceCompanyId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {insuranceCompanies.map((ic) => (
                        <SelectItem key={ic.id} value={ic.id}>
                          {ic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Client Email</Label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Client Phone</Label>
                  <Input
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Claim Type</Label>
                  <Select
                    value={formData.claimType}
                    onValueChange={(v) => setFormData({ ...formData, claimType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {claimTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Incident Date</Label>
                  <Input
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Excess Amount</Label>
                  <Input
                    type="number"
                    value={formData.excessAmount}
                    onChange={(e) => setFormData({ ...formData, excessAmount: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Incident Description</Label>
                <Textarea
                  value={formData.incidentDescription}
                  onChange={(e) => setFormData({ ...formData, incidentDescription: e.target.value })}
                  rows={3}
                />
              </div>

              {(formData.claimType === "MOTOR" || !formData.claimType) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Vehicle Registration</Label>
                      <Input
                        value={formData.vehicleRegistration}
                        onChange={(e) => setFormData({ ...formData, vehicleRegistration: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Vehicle Make</Label>
                      <Input
                        value={formData.vehicleMake}
                        onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Vehicle Model</Label>
                      <Input
                        value={formData.vehicleModel}
                        onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.claimType === "PROPERTY" && (
                <>
                  <Separator />
                  <div>
                    <Label>Property Address</Label>
                    <Textarea
                      value={formData.propertyAddress}
                      onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                      rows={2}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setCreateOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={editOpen ? updateClaim : createClaim}>
              {editOpen ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
