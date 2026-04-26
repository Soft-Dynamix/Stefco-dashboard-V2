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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Activity,
  Zap,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface AnalyticsData {
  dailyStats: Array<{
    date: string;
    emailsReceived: number;
    claimsCreated: number;
    avgConfidenceScore: number;
  }>;
  claimsByInsurance: Array<{
    name: string;
    count: number;
  }>;
  avgProcessingTime: string;
  feedbackStats: Array<{
    type: string;
    count: number;
  }>;
}

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

export function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Failed to load analytics</p>
          <Button variant="outline" className="mt-4" onClick={fetchAnalytics}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Calculate totals from daily stats
  const totalEmails = data.dailyStats.reduce((sum, d) => sum + d.emailsReceived, 0);
  const totalClaims = data.dailyStats.reduce((sum, d) => sum + d.claimsCreated, 0);
  const avgConfidence = data.dailyStats.reduce((sum, d) => sum + (d.avgConfidenceScore || 0), 0) / (data.dailyStats.length || 1);

  // Prepare chart data
  const dailyChartData = data.dailyStats.slice(-14).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    emails: d.emailsReceived,
    claims: d.claimsCreated,
    confidence: d.avgConfidenceScore || 0,
  }));

  const insuranceChartData = data.claimsByInsurance.slice(0, 8).map((item, index) => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + "..." : item.name,
    count: item.count,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  const feedbackPieData = data.feedbackStats.map((item, index) => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    value: item.count,
    color: item.type === "confirmed" ? "#10b981" : item.type === "corrected" ? "#f59e0b" : "#ef4444",
  }));

  // Calculate conversion rate
  const conversionRate = totalEmails > 0 ? ((totalClaims / totalEmails) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            System performance and metrics
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards - Enhanced */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{totalEmails}</div>
            <p className="text-xs text-muted-foreground">Processed in period</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Claims Created</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{totalClaims}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs">
                {conversionRate}% conversion
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{data.avgProcessingTime}</div>
            <p className="text-xs text-muted-foreground">Days per claim</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg AI Confidence</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{avgConfidence.toFixed(1)}%</div>
            <Progress value={avgConfidence} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Chart - Activity Over Time */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Activity Trend
              </CardTitle>
              <CardDescription>Emails received and claims created over time</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Zap className="h-3 w-3" />
              Last {range} days
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyChartData}>
                <defs>
                  <linearGradient id="colorEmailsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorClaimsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="emails"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorEmailsGradient)"
                  name="Emails"
                />
                <Area
                  type="monotone"
                  dataKey="claims"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorClaimsGradient)"
                  name="Claims"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="insurance">By Insurance</TabsTrigger>
          <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Confidence Trend */}
          <Card>
            <CardHeader>
              <CardTitle>AI Confidence Trend</CardTitle>
              <CardDescription>Average confidence score over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                    <YAxis stroke="#9ca3af" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Confidence']}
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ fill: "#8b5cf6", strokeWidth: 2 }}
                      name="Confidence %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Claims by Insurance Company</CardTitle>
              <CardDescription>
                Distribution of claims across insurance providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insuranceChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={insuranceChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#9ca3af" 
                        fontSize={11}
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'white', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {insuranceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Building2 className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No insurance data yet</p>
                  <p className="text-xs mt-1">Process claims to see distribution</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accuracy" className="mt-4 space-y-4">
          {/* Feedback Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>AI Accuracy Metrics</CardTitle>
              <CardDescription>
                Feedback-based accuracy tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Pie Chart */}
                <div className="h-[250px]">
                  {feedbackPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={feedbackPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {feedbackPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Target className="h-12 w-12 mb-3 opacity-30" />
                      <p className="text-sm">No feedback data yet</p>
                    </div>
                  )}
                </div>

                {/* Stats Cards */}
                <div className="space-y-3">
                  {data.feedbackStats.map((stat, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {stat.type === "confirmed" ? (
                            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                              <CheckCircle className="h-6 w-6 text-emerald-500" />
                            </div>
                          ) : stat.type === "corrected" ? (
                            <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                              <AlertTriangle className="h-6 w-6 text-amber-500" />
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                              <XCircle className="h-6 w-6 text-red-500" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-2xl font-bold tabular-nums">{stat.count}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {stat.type}
                            </p>
                          </div>
                          <Badge 
                            variant="secondary"
                            className={
                              stat.type === "confirmed" ? "bg-emerald-500/10 text-emerald-600" :
                              stat.type === "corrected" ? "bg-amber-500/10 text-amber-600" :
                              "bg-red-500/10 text-red-600"
                            }
                          >
                            {totalClaims > 0 ? ((stat.count / totalClaims) * 100).toFixed(1) : 0}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Overall Accuracy */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Overall Accuracy Rate</h3>
                  <span className="text-2xl font-bold text-emerald-600">
                    {data.feedbackStats.length > 0
                      ? (
                          ((data.feedbackStats.find(f => f.type === "confirmed")?.count || 0) /
                            Math.max(data.feedbackStats.reduce((sum, f) => sum + f.count, 0), 1)) *
                          100
                        ).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    data.feedbackStats.length > 0
                      ? (data.feedbackStats.find(f => f.type === "confirmed")?.count || 0) /
                        Math.max(data.feedbackStats.reduce((sum, f) => sum + f.count, 0), 1) *
                        100
                      : 0
                  }
                  className="h-3"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Based on user feedback from {data.feedbackStats.reduce((sum, f) => sum + f.count, 0)} total reviews
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
