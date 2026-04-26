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
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Mail,
  Building2,
  Brain,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  Printer,
  Activity,
  Zap,
  ArrowRight,
  Download,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { DomainSuggestionsCard } from "@/components/domain-suggestions-card";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

interface DashboardData {
  stats: {
    totalClaims: number;
    pendingClaims: number;
    completedClaims: number;
    emailQueuePending: number;
    emailQueueAnalyzed: number;
    insuranceCompanies: number;
    learningPatterns: number;
    senderProfiles: number;
    accuracyRate: string;
  };
  recentClaims: Array<{
    id: string;
    claimNumber: string;
    clientName: string | null;
    status: string;
    createdAt: string;
    insuranceCompany: { name: string } | null;
  }>;
  claimsByStatus: Array<{ status: string; count: number }>;
  claimsByType: Array<{ type: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string | null;
    createdAt: string;
    status: string;
  }>;
  printQueueStats: Array<{ status: string; count: number }>;
}

// Color palette for charts - professional and accessible
const STATUS_COLORS: Record<string, string> = {
  NEW: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  PENDING_INFO: "#f97316",
  COMPLETED: "#10b981",
  CLOSED: "#6b7280",
};

const CHART_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export function DashboardSection() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async (retryCount = 0) => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/dashboard");
      
      // Handle non-JSON responses (e.g., HTML error pages during dev)
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        if (retryCount < 3) {
          // Retry after a short delay for transient dev errors
          setTimeout(() => fetchDashboard(retryCount + 1), 1000);
          return;
        }
        throw new Error("Server returned non-JSON response");
      }
      
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
      if (retryCount < 3) {
        setTimeout(() => fetchDashboard(retryCount + 1), 1000);
        return;
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    // Create CSV content for stats
    let csv = "STEFCO Claims Dashboard Report\n\n";
    csv += "Summary Statistics\n";
    csv += "Metric,Value\n";
    csv += `Total Claims,${data.stats.totalClaims}\n`;
    csv += `Pending Claims,${data.stats.pendingClaims}\n`;
    csv += `Completed Claims,${data.stats.completedClaims}\n`;
    csv += `Email Queue Pending,${data.stats.emailQueuePending}\n`;
    csv += `Email Queue Analyzed,${data.stats.emailQueueAnalyzed}\n`;
    csv += `Insurance Companies,${data.stats.insuranceCompanies}\n`;
    csv += `Learning Patterns,${data.stats.learningPatterns}\n`;
    csv += `Sender Profiles,${data.stats.senderProfiles}\n`;
    csv += `AI Accuracy Rate,${data.stats.accuracyRate}%\n\n`;
    
    // Claims by Status
    if (data.claimsByStatus.length > 0) {
      csv += "Claims by Status\n";
      csv += "Status,Count\n";
      data.claimsByStatus.forEach(item => {
        csv += `${item.status},${item.count}\n`;
      });
      csv += "\n";
    }
    
    // Claims by Type
    if (data.claimsByType.length > 0) {
      csv += "Claims by Type\n";
      csv += "Type,Count\n";
      data.claimsByType.forEach(item => {
        csv += `${item.type || "Unknown"},${item.count}\n`;
      });
      csv += "\n";
    }
    
    // Recent Claims
    if (data.recentClaims.length > 0) {
      csv += "Recent Claims\n";
      csv += "Claim Number,Client,Insurance Company,Status,Created Date\n";
      data.recentClaims.forEach(claim => {
        csv += `${claim.claimNumber},"${claim.clientName || "-"}","${claim.insuranceCompany?.name || "-"}",${claim.status},${new Date(claim.createdAt).toLocaleDateString()}\n`;
      });
    }
    
    // Download CSV
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `stefco-dashboard-report-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const generateTestEmail = async (type: "random" | "claim" | "ignore" = "random") => {
    setIsGeneratingEmail(true);
    try {
      const res = await fetch("/api/generate-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1, type }),
      });
      const json = await res.json();
      if (json.success) {
        // Refresh dashboard to show new email
        fetchDashboard();
      }
    } catch (error) {
      console.error("Failed to generate test email:", error);
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Failed to load dashboard data</p>
          <Button variant="outline" className="mt-4" onClick={fetchDashboard}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Calculate total for percentage
  const totalClaims = data.claimsByStatus.reduce((sum, item) => sum + item.count, 0);
  const hasClaims = totalClaims > 0 || data.stats.totalClaims > 0;

  // Prepare chart data
  const statusChartData = data.claimsByStatus.map((item) => ({
    name: item.status.replace(/_/g, " "),
    value: item.count,
    color: STATUS_COLORS[item.status] || "#6b7280",
  }));

  const typeChartData = data.claimsByType.slice(0, 6).map((item, index) => ({
    name: item.type || "Unknown",
    count: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  // Mock trend data for activity chart (would come from API in real app)
  const trendData = [
    { day: "Mon", emails: 12, claims: 4 },
    { day: "Tue", emails: 19, claims: 8 },
    { day: "Wed", emails: 15, claims: 5 },
    { day: "Thu", emails: 25, claims: 12 },
    { day: "Fri", emails: 22, claims: 9 },
    { day: "Sat", emails: 8, claims: 3 },
    { day: "Sun", emails: 5, claims: 1 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Overview of your claims processing system
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={fetchDashboard} 
            disabled={isRefreshing}
            title="Refresh data"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button 
            variant="outline" 
            onClick={() => generateTestEmail("claim")}
            disabled={isGeneratingEmail}
            className="gap-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            title="Generate a test claim email"
          >
            <Sparkles className={`h-4 w-4 ${isGeneratingEmail ? "animate-pulse" : ""}`} />
            <span className="hidden sm:inline">Test Email</span>
          </Button>
          <Button variant="outline" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button onClick={() => window.location.href = "#inbox"} className="gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Check Inbox</span>
            <ArrowRight className="h-4 w-4 hidden sm:block" />
          </Button>
        </div>
      </div>

      {/* Primary Stats Cards - Enhanced */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.stats.totalClaims}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {data.stats.pendingClaims} pending
              </Badge>
              {data.stats.pendingClaims > 0 && (
                <span className="text-xs text-muted-foreground">needs review</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Queue</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.stats.emailQueuePending}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {data.stats.emailQueueAnalyzed} analyzed
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Accuracy</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.stats.accuracyRate}%</div>
            <Progress 
              value={parseFloat(data.stats.accuracyRate)} 
              className="mt-2 h-2"
              indicatorClassName="bg-emerald-500"
            />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Data</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.stats.learningPatterns}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.stats.senderProfiles} sender profiles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trend Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Weekly Activity
              </CardTitle>
              <CardDescription>Email processing and claim creation trends</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorEmails" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorClaims" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="emails"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEmails)"
                  name="Emails"
                />
                <Area
                  type="monotone"
                  dataKey="claims"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClaims)"
                  name="Claims"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Emails Received</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">Claims Created</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Insurance Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.insuranceCompanies}</div>
            <p className="text-xs text-muted-foreground">Active companies</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Claims</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.stats.completedClaims}</div>
            <p className="text-xs text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Print Queue</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.printQueueStats.find(p => p.status === "QUEUED")?.count || 0}
            </div>
            <p className="text-xs text-muted-foreground">Documents pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Suggestions */}
      <DomainSuggestionsCard />

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Claims by Status - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Claims by Status</CardTitle>
            <CardDescription>Distribution of claims across statuses</CardDescription>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 && totalClaims > 0 ? (
              <div className="flex flex-col items-center">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  {statusChartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-muted-foreground">{item.name}</span>
                      <Badge variant="secondary" className="text-xs">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <FileText className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No claims data yet</p>
                <p className="text-xs mt-1">Claims will appear here once processed</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Claims by Type - Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Claims by Type</CardTitle>
            <CardDescription>Distribution by claim category</CardDescription>
          </CardHeader>
          <CardContent>
            {typeChartData.length > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      stroke="#9ca3af" 
                      fontSize={12}
                      width={80}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {typeChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <Activity className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">No type data yet</p>
                <p className="text-xs mt-1">Claim types will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Claims */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Claims</CardTitle>
              <CardDescription>Latest claims processed by the system</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = "#claims"}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.recentClaims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim Number</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Insurance Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentClaims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium font-mono">{claim.claimNumber}</TableCell>
                    <TableCell>{claim.clientName || "-"}</TableCell>
                    <TableCell>{claim.insuranceCompany?.name || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          claim.status === "COMPLETED"
                            ? "default"
                            : claim.status === "NEW"
                            ? "secondary"
                            : "outline"
                        }
                        className={
                          claim.status === "COMPLETED" ? "bg-emerald-500 hover:bg-emerald-600" :
                          claim.status === "NEW" ? "bg-blue-500 hover:bg-blue-600" :
                          claim.status === "IN_PROGRESS" ? "bg-amber-500 hover:bg-amber-600" : ""
                        }
                      >
                        {claim.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No claims yet</p>
              <p className="text-xs mt-1">Process emails to create claims</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Recent Activity
          </CardTitle>
          <CardDescription>System audit trail</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentActivity.length > 0 ? (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  {activity.status === "SUCCESS" ? (
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </div>
                  ) : activity.status === "WARNING" ? (
                    <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{activity.action.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">No recent activity</p>
              <p className="text-xs mt-1">Activity will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
