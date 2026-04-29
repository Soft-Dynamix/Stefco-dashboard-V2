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
import {
  Brain,
  Database,
  Users,
  Ban,
  TrendingUp,
  Plus,
  Search,
  RefreshCw,
  MessageSquare,
  XCircle,
  Lightbulb,
  History,
  CheckCircle,
  XCircle as XIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Target,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LearningStats {
  stats: {
    totalPatterns: number;
    totalKnowledge: number;
    totalSenderProfiles: number;
    totalIgnoreRules: number;
    avgConfidence: number;
  };
  automationLevels: Array<{ level: string; count: number }>;
  topSenders: Array<{
    id: string;
    senderDomain: string;
    totalEmails: number;
    newClaimCount: number;
    accuracyRate: number;
    automationLevel: string;
  }>;
  recentPatterns: Array<{
    id: string;
    senderDomain: string;
    fieldName: string;
    patternHint: string;
    confidence: number;
    correctionCount: number;
    insuranceCompany: { name: string } | null;
  }>;
}

interface LearningPattern {
  id: string;
  senderDomain: string;
  fieldName: string;
  patternHint: string;
  exampleOriginal: string | null;
  exampleCorrected: string | null;
  confidence: number;
  correctionCount: number;
  insuranceCompany: { name: string } | null;
}

interface SenderPattern {
  id: string;
  senderDomain: string;
  totalEmails: number;
  newClaimCount: number;
  ignoreCount: number;
  accuracyRate: number;
  automationLevel: string;
  confidenceScore: number;
}

interface RejectionFeedbackItem {
  id: string;
  emailQueueId: string;
  rejectionCategory: string;
  rejectionReason: string | null;
  isFollowUp: boolean;
  relatedClaimId: string | null;
  applyToSender: boolean;
  suggestedRule: string | null;
  emailSubject: string | null;
  emailFrom: string | null;
  emailFromDomain: string | null;
  originalClassification: string | null;
  originalConfidence: number | null;
  createdAt: string;
}

interface ThreadPatternItem {
  id: string;
  senderDomain: string;
  subjectPrefix: string | null;
  normalizedSubject: string | null;
  followUpCount: number;
  newClaimCount: number;
  isFollowUpProbability: number;
}

interface AutoIgnoreRule {
  id: string;
  senderDomain: string;
  category: string;
  reason: string | null;
  ignoreCount: number;
  appliedCount: number;
  autoIgnore: boolean;
  isActive: boolean;
  lastAppliedAt: string | null;
  createdAt: string;
}

interface FieldComparison {
  field: string;
  predicted: string | number | null;
  actual: string | number | null;
  confidence: number;
  isCorrect: boolean;
  errorType?: "missing" | "wrong" | "extra";
}

interface PredictionComparisonItem {
  id: string;
  emailQueueId: string;
  claimId: string | null;
  senderDomain: string | null;
  claimType: string | null;
  comparisons: string; // JSON string of FieldComparison[]
  totalFields: number;
  correctFields: number;
  accuracyRate: number;
  learningApplied: boolean;
  createdAt: string;
}

interface FieldMetric {
  id: string;
  senderDomain: string;
  fieldName: string;
  claimType: string | null;
  totalPredictions: number;
  correctPredictions: number;
  correctedCount: number;
  accuracyRate: number;
  recentAccuracy: number;
  trendDirection: string;
  avgConfidence: number;
  readyForAutoClaim: boolean;
  lastPredictionAt: string | null;
  lastCorrectionAt: string | null;
}

interface AccuracyTrendItem {
  date: string;
  accuracy: number;
  total: number;
}

interface LearningRecord {
  id: string;
  type: string;
  typeName: string;
  typeNameShort: string;
  createdAt: string;
  domain: string;
  description: string;
  details: Record<string, unknown>;
  icon: string;
  color: string;
}

interface LearningHistoryData {
  comparisons: LearningRecord[];
  allLearningRecords: LearningRecord[];
  totalComparisons: number;
  currentPage: number;
  totalPages: number;
  fieldMetrics: FieldMetric[];
  overallAccuracy: number;
  accuracyTrend: AccuracyTrendItem[];
  fieldsReadyForAuto: number;
  totalFields: number;
  typeCounts: {
    fieldPrediction: number;
    classificationCorrection: number;
    ignoreRule: number;
    threadPattern: number;
    domainProfile: number;
    rejectionFeedback: number;
  };
  summary: {
    totalPredictions: number;
    totalCorrect: number;
    overallAccuracy: number;
    comparisonsCount: number;
    fieldsLearned: number;
    fieldsReadyForAuto: number;
    improvingFields: number;
    decliningFields: number;
    stableFields: number;
    typeCounts: {
      fieldPrediction: number;
      classificationCorrection: number;
      ignoreRule: number;
      threadPattern: number;
      domainProfile: number;
      rejectionFeedback: number;
    };
  };
}

export function LearningSection() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [patterns, setPatterns] = useState<LearningPattern[]>([]);
  const [senders, setSenders] = useState<SenderPattern[]>([]);
  const [rejectionFeedback, setRejectionFeedback] = useState<RejectionFeedbackItem[]>([]);
  const [threadPatterns, setThreadPatterns] = useState<ThreadPatternItem[]>([]);
  const [autoIgnoreRules, setAutoIgnoreRules] = useState<AutoIgnoreRule[]>([]);
  const [learningHistory, setLearningHistory] = useState<LearningHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [historyPage, setHistoryPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "patterns") fetchPatterns();
    if (activeTab === "senders") fetchSenders();
    if (activeTab === "feedback") fetchRejectionFeedback();
    if (activeTab === "threads") fetchThreadPatterns();
    if (activeTab === "autoignore") fetchAutoIgnoreRules();
    if (activeTab === "history") fetchLearningHistory();
  }, [activeTab, historyPage]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/learning?type=stats");
      const json = await res.json();
      setStats(json);
    } catch (error) {
      console.error("Failed to fetch learning stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatterns = async () => {
    try {
      const res = await fetch("/api/learning?type=patterns");
      const json = await res.json();
      setPatterns(json);
    } catch (error) {
      console.error("Failed to fetch patterns:", error);
    }
  };

  const fetchSenders = async () => {
    try {
      const res = await fetch("/api/learning?type=senders");
      const json = await res.json();
      setSenders(json);
    } catch (error) {
      console.error("Failed to fetch senders:", error);
    }
  };

  const fetchRejectionFeedback = async () => {
    try {
      const res = await fetch("/api/rejection-feedback?limit=100");
      const json = await res.json();
      setRejectionFeedback(json);
    } catch (error) {
      console.error("Failed to fetch rejection feedback:", error);
    }
  };

  const fetchThreadPatterns = async () => {
    try {
      const res = await fetch("/api/thread-patterns");
      const json = await res.json();
      setThreadPatterns(json);
    } catch (error) {
      console.error("Failed to fetch thread patterns:", error);
    }
  };

  const fetchAutoIgnoreRules = async () => {
    try {
      const res = await fetch("/api/learning?type=autoignore");
      const json = await res.json();
      setAutoIgnoreRules(json);
    } catch (error) {
      console.error("Failed to fetch auto-ignore rules:", error);
    }
  };

  const fetchLearningHistory = async () => {
    try {
      const res = await fetch(`/api/learning?type=history&page=${historyPage}&limit=20`);
      const json = await res.json();
      setLearningHistory(json);
    } catch (error) {
      console.error("Failed to fetch learning history:", error);
    }
  };

  const toggleAutoIgnore = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/learning`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, autoIgnore: enabled }),
      });
      
      if (res.ok) {
        toast({
          title: enabled ? "Auto-Ignore Enabled" : "Auto-Ignore Disabled",
          description: enabled 
            ? "Future emails from this domain will be automatically ignored"
            : "Future emails will require manual review",
        });
        fetchAutoIgnoreRules();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update auto-ignore setting",
        variant: "destructive",
      });
    }
  };

  const getAutomationLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      manual: "bg-red-500",
      semi_auto: "bg-yellow-500",
      auto: "bg-green-500",
    };
    return colors[level] || "bg-gray-500";
  };

  const getAutomationLevelBadge = (level: string) => {
    const variants: Record<string, "destructive" | "secondary" | "default"> = {
      manual: "destructive",
      semi_auto: "secondary",
      auto: "default",
    };
    return (
      <Badge variant={variants[level] || "outline"}>
        {level.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      follow_up: "bg-blue-500",
      duplicate: "bg-orange-500",
      not_a_claim: "bg-gray-500",
      spam: "bg-red-500",
      marketing: "bg-purple-500",
      wrong_sender: "bg-yellow-500",
      already_processed: "bg-orange-500",
      test_email: "bg-cyan-500",
      other: "bg-gray-400",
    };
    return (
      <Badge className={colors[category] || "bg-gray-500"}>
        {category.replace("_", " ")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Engine</h1>
          <p className="text-muted-foreground">
            AI learning patterns and sender profiles
          </p>
        </div>
        <Button onClick={fetchStats} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Patterns</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats?.totalPatterns || 0}</div>
            <p className="text-xs text-muted-foreground">Extraction rules learned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sender Profiles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats?.totalSenderProfiles || 0}</div>
            <p className="text-xs text-muted-foreground">Known senders tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.stats?.avgConfidence || 0).toFixed(0)}%
            </div>
            <Progress value={stats?.stats?.avgConfidence || 0} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ignore Rules</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.stats?.totalIgnoreRules || 0}</div>
            <p className="text-xs text-muted-foreground">Auto-ignore rules</p>
          </CardContent>
        </Card>
      </div>

      {/* How Learning Works */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-green-500" />
            How the System Learns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">1</span>
                You Provide Feedback
              </div>
              <p className="text-muted-foreground pl-8">
                When you reject an email with a reason, the system captures what went wrong and why.
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-xs">2</span>
                Patterns Are Created
              </div>
              <p className="text-muted-foreground pl-8">
                The system creates rules like "Re: emails from santam.co.za are usually follow-ups, not new claims".
              </p>
            </div>
            <div className="space-y-2">
              <div className="font-medium flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">3</span>
                Future Decisions Improve
              </div>
              <p className="text-muted-foreground pl-8">
                Next time a similar email arrives, the AI uses learned patterns to make better decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation Levels */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Level Distribution</CardTitle>
          <CardDescription>
            How senders are categorized for processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            {stats?.automationLevels.map((level) => (
              <div key={level.level} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getAutomationLevelColor(level.level)}`} />
                <span className="capitalize">{level.level.replace("_", " ")}</span>
                <Badge variant="secondary">{level.count}</Badge>
              </div>
            ))}
          </div>
          
          <Separator className="my-4" />
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <Badge variant="destructive">MANUAL</Badge>
              <p className="mt-1 text-muted-foreground">
                &lt; 6 patterns OR &lt; 70% accuracy
              </p>
            </div>
            <div>
              <Badge variant="secondary">SEMI-AUTO</Badge>
              <p className="mt-1 text-muted-foreground">
                ≥ 6 patterns AND ≥ 70% accuracy
              </p>
            </div>
            <div>
              <Badge variant="default">AUTO</Badge>
              <p className="mt-1 text-muted-foreground">
                ≥ 10 patterns AND ≥ 85% accuracy
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Top Senders</TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            Learning History
          </TabsTrigger>
          <TabsTrigger value="feedback">Rejection Feedback</TabsTrigger>
          <TabsTrigger value="autoignore">Auto-Ignore Rules</TabsTrigger>
          <TabsTrigger value="threads">Thread Detection</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="senders">All Senders</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Sender Domains</CardTitle>
              <CardDescription>
                Most active email senders by volume
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Total Emails</TableHead>
                    <TableHead>Claims</TableHead>
                    <TableHead>Accuracy</TableHead>
                    <TableHead>Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.topSenders.map((sender) => (
                    <TableRow key={sender.id}>
                      <TableCell className="font-medium">{sender.senderDomain}</TableCell>
                      <TableCell>{sender.totalEmails}</TableCell>
                      <TableCell>{sender.newClaimCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={sender.accuracyRate} className="w-16" />
                          {sender.accuracyRate.toFixed(0)}%
                        </div>
                      </TableCell>
                      <TableCell>{getAutomationLevelBadge(sender.automationLevel)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recent Learning Patterns</CardTitle>
              <CardDescription>
                Latest patterns learned from corrections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Domain</TableHead>
                    <TableHead>Field</TableHead>
                    <TableHead>Pattern Hint</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Corrections</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.recentPatterns.map((pattern) => (
                    <TableRow key={pattern.id}>
                      <TableCell className="font-medium">{pattern.senderDomain}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{pattern.fieldName}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">
                        {pattern.patternHint}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pattern.confidence} className="w-16" />
                          {pattern.confidence}%
                        </div>
                      </TableCell>
                      <TableCell>{pattern.correctionCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card className="border-blue-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Overall Accuracy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(learningHistory?.summary?.overallAccuracy || 0).toFixed(1)}%
                  </div>
                  <Progress 
                    value={learningHistory?.summary?.overallAccuracy || 0} 
                    className="mt-2" 
                  />
                </CardContent>
              </Card>

              <Card className="border-green-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Correct Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {learningHistory?.summary?.totalCorrect || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {learningHistory?.summary?.totalPredictions || 0} total
                  </p>
                </CardContent>
              </Card>

              <Card className="border-purple-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-500" />
                    Fields Learned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {learningHistory?.summary?.fieldsLearned || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {learningHistory?.summary?.fieldsReadyForAuto || 0} ready for auto
                  </p>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    Improving
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {learningHistory?.summary?.improvingFields || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">fields trending up</p>
                </CardContent>
              </Card>

              <Card className="border-red-500/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    Declining
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {learningHistory?.summary?.decliningFields || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">fields need attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Type Counts Summary */}
            <div className="grid gap-4 md:grid-cols-6">
              <Card className="border-blue-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-blue-600">{learningHistory?.typeCounts?.fieldPrediction || 0}</div>
                  <p className="text-xs text-muted-foreground">Field Predictions</p>
                </CardContent>
              </Card>
              <Card className="border-amber-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-amber-600">{learningHistory?.typeCounts?.classificationCorrection || 0}</div>
                  <p className="text-xs text-muted-foreground">Classifications</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-red-600">{learningHistory?.typeCounts?.ignoreRule || 0}</div>
                  <p className="text-xs text-muted-foreground">Ignore Rules</p>
                </CardContent>
              </Card>
              <Card className="border-teal-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-teal-600">{learningHistory?.typeCounts?.threadPattern || 0}</div>
                  <p className="text-xs text-muted-foreground">Thread Patterns</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-emerald-600">{learningHistory?.typeCounts?.domainProfile || 0}</div>
                  <p className="text-xs text-muted-foreground">Domain Profiles</p>
                </CardContent>
              </Card>
              <Card className="border-purple-500/30">
                <CardContent className="pt-4">
                  <div className="text-lg font-bold text-purple-600">{learningHistory?.typeCounts?.rejectionFeedback || 0}</div>
                  <p className="text-xs text-muted-foreground">Rejections</p>
                </CardContent>
              </Card>
            </div>

            {/* Learning History Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-blue-500" />
                  Learning History
                </CardTitle>
                <CardDescription>
                  All learning events recorded by the system - classification corrections, ignore rules, thread patterns, and more
                </CardDescription>
              </CardHeader>
              <CardContent>
                {learningHistory?.comparisons.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No learning history yet.</p>
                    <p className="text-sm">When you reject emails or correct AI predictions, the system will learn and record those events here.</p>
                  </div>
                ) : (
                  <>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Domain</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {learningHistory?.comparisons.map((record) => {
                            const colorClasses: Record<string, string> = {
                              blue: 'text-blue-600 bg-blue-50 border-blue-200',
                              amber: 'text-amber-600 bg-amber-50 border-amber-200',
                              red: 'text-red-600 bg-red-50 border-red-200',
                              teal: 'text-teal-600 bg-teal-50 border-teal-200',
                              emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                              purple: 'text-purple-600 bg-purple-50 border-purple-200',
                            };
                            const badgeClass = colorClasses[record.color] || 'text-gray-600 bg-gray-50 border-gray-200';
                            
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {new Date(record.createdAt).toLocaleDateString()} {' '}
                                  <span className="text-muted-foreground text-xs">
                                    {new Date(record.createdAt).toLocaleTimeString()}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`${badgeClass} border`}>{record.typeNameShort}</Badge>
                                </TableCell>
                                <TableCell className="font-medium max-w-[150px] truncate">
                                  {record.domain}
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                  <span className="text-sm">{record.description}</span>
                                </TableCell>
                                <TableCell>
                                  <details className="cursor-pointer">
                                    <summary className="text-sm text-blue-500 hover:text-blue-700">
                                      View details
                                    </summary>
                                    <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                                      {Object.entries(record.details).map(([key, value]) => (
                                        <div key={key} className="flex gap-2">
                                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                                          <span className="text-muted-foreground">
                                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                </details>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>

                    {/* Pagination */}
                    {(learningHistory?.totalPages || 0) > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-muted-foreground">
                          Page {learningHistory?.currentPage} of {learningHistory?.totalPages}
                          <span className="ml-2">
                            ({learningHistory?.totalComparisons} total records)
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage <= 1}
                            onClick={() => setHistoryPage(p => p - 1)}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={historyPage >= (learningHistory?.totalPages || 1)}
                            onClick={() => setHistoryPage(p => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Field Accuracy Metrics */}
            {learningHistory && learningHistory.fieldMetrics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    Field Accuracy by Domain
                  </CardTitle>
                  <CardDescription>
                    Per-field accuracy tracking - fields need 90%+ accuracy for auto-claim
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Domain</TableHead>
                          <TableHead>Field</TableHead>
                          <TableHead>Accuracy</TableHead>
                          <TableHead>Predictions</TableHead>
                          <TableHead>Trend</TableHead>
                          <TableHead>Auto-Claim</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {learningHistory.fieldMetrics.map((metric) => (
                          <TableRow key={metric.id}>
                            <TableCell className="font-medium">{metric.senderDomain}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{metric.fieldName}</Badge>
                              {metric.claimType && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({metric.claimType})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={metric.accuracyRate} 
                                  className="w-20"
                                />
                                <span className={metric.accuracyRate >= 90 ? 'text-green-600 font-medium' : ''}>
                                  {metric.accuracyRate.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{metric.totalPredictions}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {metric.trendDirection === "improving" && (
                                  <>
                                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 text-sm">Improving</span>
                                  </>
                                )}
                                {metric.trendDirection === "declining" && (
                                  <>
                                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                                    <span className="text-red-600 text-sm">Declining</span>
                                  </>
                                )}
                                {metric.trendDirection === "stable" && (
                                  <>
                                    <Minus className="h-4 w-4 text-gray-500" />
                                    <span className="text-gray-600 text-sm">Stable</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {metric.readyForAutoClaim ? (
                                <Badge className="bg-green-500">Ready</Badge>
                              ) : (
                                <Badge variant="secondary">
                                  {metric.totalPredictions < 10 ? `${10 - metric.totalPredictions} more needed` : `${(90 - metric.accuracyRate).toFixed(0)}% to go`}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Rejection Feedback History
              </CardTitle>
              <CardDescription>
                Learn from why emails were rejected - this teaches the AI to improve
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {rejectionFeedback.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No rejection feedback yet. When you reject emails with reasons, they will appear here.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>AI Thought</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectionFeedback.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {item.emailSubject || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getCategoryBadge(item.rejectionCategory)}
                              {item.isFollowUp && (
                                <MessageSquare className="h-3 w-3 text-blue-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {item.rejectionReason || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <Badge variant="outline">{item.originalClassification || "N/A"}</Badge>
                              {item.originalConfidence !== null && (
                                <span className="text-muted-foreground ml-1">
                                  ({item.originalConfidence.toFixed(0)}%)
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.applyToSender && (
                              <Badge variant="secondary" className="text-xs">
                                Rule Created
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="autoignore" className="mt-4">
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ban className="h-5 w-5 text-orange-500" />
                Auto-Ignore Rules
              </CardTitle>
              <CardDescription>
                Domains that are automatically ignored based on your feedback. Rules are enabled after 3+ ignores.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground">
                  <strong>How it works:</strong> When you reject 3+ emails from the same domain with the same category 
                  (e.g., "spam"), the system automatically ignores future emails from that domain. You can toggle 
                  rules on/off below.
                </p>
              </div>
              <ScrollArea className="h-[400px]">
                {autoIgnoreRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No auto-ignore rules yet. Reject 3+ emails from the same domain to create a rule.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Times Ignored</TableHead>
                        <TableHead>Auto-Applied</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Applied</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {autoIgnoreRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.senderDomain}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.category}</Badge>
                          </TableCell>
                          <TableCell>{rule.ignoreCount}</TableCell>
                          <TableCell>{rule.appliedCount}</TableCell>
                          <TableCell>
                            {rule.autoIgnore ? (
                              <Badge className="bg-green-500">ACTIVE</Badge>
                            ) : (
                              <Badge variant="secondary">PENDING</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {rule.lastAppliedAt 
                              ? new Date(rule.lastAppliedAt).toLocaleDateString()
                              : "Never"}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rule.autoIgnore}
                              onCheckedChange={(checked) => toggleAutoIgnore(rule.id, checked)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="threads" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                Thread Detection Patterns
              </CardTitle>
              <CardDescription>
                Learn to distinguish follow-up emails from new claims based on subject patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {threadPatterns.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No thread patterns learned yet. When you mark emails as follow-ups, patterns will appear here.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Prefix</TableHead>
                        <TableHead>Normalized Subject</TableHead>
                        <TableHead>Follow-ups</TableHead>
                        <TableHead>New Claims</TableHead>
                        <TableHead>P(Follow-up)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {threadPatterns.map((pattern) => (
                        <TableRow key={pattern.id}>
                          <TableCell className="font-medium">{pattern.senderDomain}</TableCell>
                          <TableCell>
                            {pattern.subjectPrefix ? (
                              <Badge variant="outline">{pattern.subjectPrefix}:</Badge>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate">
                            {pattern.normalizedSubject || "-"}
                          </TableCell>
                          <TableCell>{pattern.followUpCount}</TableCell>
                          <TableCell>{pattern.newClaimCount}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={pattern.isFollowUpProbability * 100} 
                                className="w-16" 
                              />
                              {(pattern.isFollowUpProbability * 100).toFixed(0)}%
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Learning Patterns</CardTitle>
                  <CardDescription>
                    Extraction rules learned from user corrections
                  </CardDescription>
                </div>
                <div className="w-64">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search patterns..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Field</TableHead>
                      <TableHead>Pattern Hint</TableHead>
                      <TableHead>Example</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Corrections</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patterns
                      .filter((p) =>
                        searchQuery
                          ? p.senderDomain.includes(searchQuery) ||
                            p.fieldName.includes(searchQuery)
                          : true
                      )
                      .map((pattern) => (
                        <TableRow key={pattern.id}>
                          <TableCell className="font-medium">{pattern.senderDomain}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{pattern.fieldName}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {pattern.patternHint}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            {pattern.exampleOriginal && (
                              <div className="text-xs">
                                <span className="text-muted-foreground line-through">
                                  {pattern.exampleOriginal}
                                </span>
                                {" → "}
                                <span className="text-green-600">
                                  {pattern.exampleCorrected}
                                </span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Progress value={pattern.confidence} className="w-16" />
                          </TableCell>
                          <TableCell>{pattern.correctionCount}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="senders" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>All Sender Profiles</CardTitle>
              <CardDescription>
                Complete list of known email senders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Total Emails</TableHead>
                      <TableHead>Claims</TableHead>
                      <TableHead>Ignored</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Confidence Score</TableHead>
                      <TableHead>Level</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {senders.map((sender) => (
                      <TableRow key={sender.id}>
                        <TableCell className="font-medium">{sender.senderDomain}</TableCell>
                        <TableCell>{sender.totalEmails}</TableCell>
                        <TableCell>{sender.newClaimCount}</TableCell>
                        <TableCell>{sender.ignoreCount}</TableCell>
                        <TableCell>
                          <Progress value={sender.accuracyRate} className="w-16" />
                        </TableCell>
                        <TableCell>{sender.confidenceScore.toFixed(0)}</TableCell>
                        <TableCell>{getAutomationLevelBadge(sender.automationLevel)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
