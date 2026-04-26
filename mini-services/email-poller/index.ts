/**
 * STEFCO Claims Dashboard - Email Poller Service
 * 
 * This service runs independently to poll emails from IMAP on a schedule.
 * It calls the main app's API which handles both fetching AND auto-analysis.
 * 
 * Usage:
 *   bun run dev   - Development with hot reload
 *   bun run start - Production mode
 */

const SERVICE_PORT = 3002;
const MAIN_APP_URL = "http://localhost:3000";
const DEFAULT_INTERVAL = 5; // minutes

// Simple HTTP server for health checks
const server = Bun.serve({
  port: SERVICE_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/health") {
      const status = await getPollerStatus();
      return Response.json({
        status: "running",
        ...status,
        timestamp: new Date().toISOString(),
      });
    }
    
    if (url.pathname === "/trigger") {
      const result = await triggerPoll();
      return Response.json(result);
    }
    
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`📧 Email Poller Service running on port ${SERVICE_PORT}`);

// Main polling loop
async function main() {
  console.log("🚀 Starting Email Poller Service...");
  
  // Initial poll after 10 seconds
  setTimeout(async () => {
    await triggerPoll();
  }, 10000);
  
  // Schedule polling every minute
  setInterval(async () => {
    const config = await getPollerConfig();
    if (config.enabled) {
      await triggerPoll();
    }
  }, 60 * 1000);
}

interface PollerConfig {
  enabled: boolean;
  interval: number;
  autoAnalyze: boolean;
  autoClaim: boolean;
}

async function getPollerConfig(): Promise<PollerConfig> {
  try {
    const res = await fetch(`${MAIN_APP_URL}/api/email-poll`);
    const data = await res.json();
    return {
      enabled: data.schedulerEnabled ?? false,
      interval: data.pollInterval ?? DEFAULT_INTERVAL,
      autoAnalyze: data.autoAnalyzeEnabled ?? false,
      autoClaim: data.autoClaimCreationEnabled ?? false,
    };
  } catch (error) {
    console.error("Failed to get poller config:", error);
    return {
      enabled: false,
      interval: DEFAULT_INTERVAL,
      autoAnalyze: false,
      autoClaim: false,
    };
  }
}

async function getPollerStatus() {
  const config = await getPollerConfig();
  
  try {
    const res = await fetch(`${MAIN_APP_URL}/api/email-poll`);
    const data = await res.json();
    return {
      enabled: config.enabled,
      interval: config.interval,
      autoAnalyze: config.autoAnalyze,
      autoClaim: config.autoClaim,
      isConfigured: data.isConfigured ?? false,
      pendingEmails: data.totalQueued ?? 0,
      lastRun: data.lastPoll ?? null,
    };
  } catch (error) {
    return {
      enabled: config.enabled,
      interval: config.interval,
      autoAnalyze: config.autoAnalyze,
      autoClaim: config.autoClaim,
      isConfigured: false,
      pendingEmails: 0,
      lastRun: null,
    };
  }
}

async function triggerPoll(): Promise<{
  success: boolean;
  fetched: number;
  analyzed: number;
  errors: string[];
  timestamp: string;
}> {
  const startTime = Date.now();
  const config = await getPollerConfig();
  
  console.log(`📬 [${new Date().toISOString()}] Triggering email poll...`);
  console.log(`   Auto-Analyze: ${config.autoAnalyze ? 'ON' : 'OFF'}`);
  console.log(`   Auto-Claim: ${config.autoClaim ? 'ON' : 'OFF'}`);

  if (!config.enabled) {
    console.log("⏸️ Poller is disabled in settings, skipping...");
    return {
      success: false,
      fetched: 0,
      analyzed: 0,
      errors: ["Poller is disabled"],
      timestamp: new Date().toISOString(),
    };
  }

  try {
    // Call the main app's API which handles both fetch and auto-analyze
    const res = await fetch(`${MAIN_APP_URL}/api/email-poll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        limit: 50,
        autoAnalyze: true,  // Always try to auto-analyze
      }),
    });

    const data = await res.json();
    
    console.log(`✅ Poll complete: Fetched ${data.fetched || 0}, Analyzed ${data.analyzed || 0}`);
    if (data.errors && data.errors.length > 0) {
      console.log(`   ⚠️ Errors: ${data.errors.length}`);
    }
    
    return {
      success: data.success ?? true,
      fetched: data.fetched ?? 0,
      analyzed: data.analyzed ?? 0,
      errors: data.errors ?? [],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Poll failed:", error);
    return {
      success: false,
      fetched: 0,
      analyzed: 0,
      errors: [String(error)],
      timestamp: new Date().toISOString(),
    };
  }
}

// Start the service
main().catch(console.error);
