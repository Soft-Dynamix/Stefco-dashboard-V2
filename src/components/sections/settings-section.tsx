"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Brain,
  Mail,
  Server,
  Save,
  CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Settings {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  IMAP_HOST?: string;
  IMAP_PORT?: string;
  IMAP_USER?: string;
  IMAP_PASSWORD?: string;
  IMAP_SSL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  AUTO_POLL_INTERVAL?: string;
  AUTO_PRINT_ENABLED?: string;
  AUTO_ANALYZE_ENABLED?: string;
  AUTO_CLAIM_CREATION_ENABLED?: string;
  EMAIL_POLLER_ENABLED?: string;
  DEFAULT_PRINTER?: string;
  FILE_OUTPUT_PATH?: string;
}

export function SettingsSection() {
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      setSettings(json);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (category: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        toast({
          title: "Success",
          description: `${category} settings saved successfully`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
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
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure system settings and integrations
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="ai">
        <TabsList>
          <TabsTrigger value="ai">
            <Brain className="h-4 w-4 mr-2" />
            AI Provider
          </TabsTrigger>
          <TabsTrigger value="imap">
            <Mail className="h-4 w-4 mr-2" />
            Email (IMAP)
          </TabsTrigger>
          <TabsTrigger value="smtp">
            <Mail className="h-4 w-4 mr-2" />
            Email (SMTP)
          </TabsTrigger>
          <TabsTrigger value="system">
            <Server className="h-4 w-4 mr-2" />
            System
          </TabsTrigger>
        </TabsList>

        {/* AI Provider Settings */}
        <TabsContent value="ai" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Configuration</CardTitle>
              <CardDescription>
                Configure the AI provider for email classification and data extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>AI Provider</Label>
                <Select
                  value={settings.AI_PROVIDER || "gemini"}
                  onValueChange={(v) => updateSetting("AI_PROVIDER", v)}
                >
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini">Google Gemini (Default)</SelectItem>
                    <SelectItem value="groq">Groq (Fast)</SelectItem>
                    <SelectItem value="openrouter">OpenRouter (Multi-model)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div>
                <Label>Gemini API Key</Label>
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={settings.GEMINI_API_KEY || ""}
                  onChange={(e) => updateSetting("GEMINI_API_KEY", e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get your API key from Google AI Studio
                </p>
              </div>

              <div>
                <Label>Groq API Key</Label>
                <Input
                  type="password"
                  placeholder="gsk_..."
                  value={settings.GROQ_API_KEY || ""}
                  onChange={(e) => updateSetting("GROQ_API_KEY", e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>OpenRouter API Key</Label>
                <Input
                  type="password"
                  placeholder="sk-or-..."
                  value={settings.OPENROUTER_API_KEY || ""}
                  onChange={(e) => updateSetting("OPENROUTER_API_KEY", e.target.value)}
                  className="mt-1"
                />
              </div>

              <Button onClick={() => saveSettings("AI Provider")} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save AI Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IMAP Settings */}
        <TabsContent value="imap" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>IMAP Configuration</CardTitle>
              <CardDescription>
                Configure incoming email settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>IMAP Host</Label>
                  <Input
                    placeholder="imap.gmail.com"
                    value={settings.IMAP_HOST || ""}
                    onChange={(e) => updateSetting("IMAP_HOST", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>IMAP Port</Label>
                  <Input
                    type="number"
                    placeholder="993"
                    value={settings.IMAP_PORT || "993"}
                    onChange={(e) => updateSetting("IMAP_PORT", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={settings.IMAP_USER || ""}
                    onChange={(e) => updateSetting("IMAP_USER", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="App password"
                    value={settings.IMAP_PASSWORD || ""}
                    onChange={(e) => updateSetting("IMAP_PASSWORD", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Use SSL</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable for port 993 (recommended)
                  </p>
                </div>
                <Switch
                  checked={settings.IMAP_SSL === "true"}
                  onCheckedChange={(checked) => updateSetting("IMAP_SSL", checked.toString())}
                />
              </div>

              <div>
                <Label>Polling Interval (minutes)</Label>
                <Input
                  type="number"
                  placeholder="5"
                  value={settings.AUTO_POLL_INTERVAL || "5"}
                  onChange={(e) => updateSetting("AUTO_POLL_INTERVAL", e.target.value)}
                  className="mt-1 w-32"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Email Poller</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically fetch emails from IMAP
                  </p>
                </div>
                <Switch
                  checked={settings.EMAIL_POLLER_ENABLED === "true"}
                  onCheckedChange={(checked) => updateSetting("EMAIL_POLLER_ENABLED", checked.toString())}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Analyze Emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically run AI analysis on new emails using learning hints
                  </p>
                </div>
                <Switch
                  checked={settings.AUTO_ANALYZE_ENABLED === "true"}
                  onCheckedChange={(checked) => updateSetting("AUTO_ANALYZE_ENABLED", checked.toString())}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-emerald-600 font-medium">Auto-Create Claims (Full Automation)</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically create claims for domains with 90%+ accuracy (20+ emails processed)
                  </p>
                </div>
                <Switch
                  checked={settings.AUTO_CLAIM_CREATION_ENABLED === "true"}
                  onCheckedChange={(checked) => updateSetting("AUTO_CLAIM_CREATION_ENABLED", checked.toString())}
                />
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-2">🚀 Full Automation Path</h4>
                <div className="text-sm text-emerald-700 dark:text-emerald-300 space-y-1">
                  <p><strong>Stage 1 (Manual):</strong> New domains - All emails require human review</p>
                  <p><strong>Stage 2 (Semi-Auto):</strong> 5+ emails + 70% accuracy - AI suggests, human confirms</p>
                  <p><strong>Stage 3 (Full Auto):</strong> 20+ emails + 90% accuracy - Claims created automatically!</p>
                </div>
              </div>

              <Button onClick={() => saveSettings("IMAP")} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save IMAP Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMTP Settings */}
        <TabsContent value="smtp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>SMTP Configuration</CardTitle>
              <CardDescription>
                Configure outgoing email settings for auto-replies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Host</Label>
                  <Input
                    placeholder="smtp.gmail.com"
                    value={settings.SMTP_HOST || ""}
                    onChange={(e) => updateSetting("SMTP_HOST", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    placeholder="587"
                    value={settings.SMTP_PORT || "587"}
                    onChange={(e) => updateSetting("SMTP_PORT", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Username</Label>
                  <Input
                    type="email"
                    placeholder="your-email@gmail.com"
                    value={settings.SMTP_USER || ""}
                    onChange={(e) => updateSetting("SMTP_USER", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="App password"
                    value={settings.SMTP_PASSWORD || ""}
                    onChange={(e) => updateSetting("SMTP_PASSWORD", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    placeholder="noreply@stefco.co.za"
                    value={settings.SMTP_FROM_EMAIL || ""}
                    onChange={(e) => updateSetting("SMTP_FROM_EMAIL", e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>From Name</Label>
                  <Input
                    placeholder="STEFCO Claims"
                    value={settings.SMTP_FROM_NAME || ""}
                    onChange={(e) => updateSetting("SMTP_FROM_NAME", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button onClick={() => saveSettings("SMTP")} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save SMTP Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                Windows 11 Server specific settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>File Output Path</Label>
                <Input
                  placeholder="C:\Stefco\Claims"
                  value={settings.FILE_OUTPUT_PATH || ""}
                  onChange={(e) => updateSetting("FILE_OUTPUT_PATH", e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Base folder for claim documents and folders
                </p>
              </div>

              <div>
                <Label>Default Printer</Label>
                <Input
                  placeholder="Default Windows Printer"
                  value={settings.DEFAULT_PRINTER || ""}
                  onChange={(e) => updateSetting("DEFAULT_PRINTER", e.target.value)}
                  className="mt-1"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Print Enabled</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically print processed documents
                  </p>
                </div>
                <Switch
                  checked={settings.AUTO_PRINT_ENABLED === "true"}
                  onCheckedChange={(checked) => updateSetting("AUTO_PRINT_ENABLED", checked.toString())}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Analysis Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {settings.AUTO_ANALYZE_ENABLED === "true" ? "Enabled" : "Disabled"}
                  </p>
                </div>
                <CheckCircle className={`h-5 w-5 ${settings.AUTO_ANALYZE_ENABLED === "true" ? "text-emerald-500" : "text-muted-foreground"}`} />
              </div>

              <Separator />

              <Card className="bg-muted/50">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Platform</p>
                      <p className="font-medium">Windows 11 Server</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Database</p>
                      <p className="font-medium">SQLite</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Framework</p>
                      <p className="font-medium">Next.js 16</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Version</p>
                      <p className="font-medium">1.0.0</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button onClick={() => saveSettings("System")} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                Save System Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
