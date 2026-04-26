"use client";

import { useState, useEffect } from "react";
import { DashboardSection } from "@/components/sections/dashboard-section";
import { InboxSection } from "@/components/sections/inbox-section";
import { ClaimsSection } from "@/components/sections/claims-section";
import { LearningSection } from "@/components/sections/learning-section";
import { InsuranceSection } from "@/components/sections/insurance-section";
import { PrintQueueSection } from "@/components/sections/print-queue-section";
import { AuditLogSection } from "@/components/sections/audit-log-section";
import { AnalyticsSection } from "@/components/sections/analytics-section";
import { SettingsSection } from "@/components/sections/settings-section";

export default function Page() {
  const [activeSection, setActiveSection] = useState("dashboard");

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) || "dashboard";
      setActiveSection(hash);
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSection />;
      case "inbox":
        return <InboxSection />;
      case "claims":
        return <ClaimsSection />;
      case "learning":
        return <LearningSection />;
      case "insurance":
        return <InsuranceSection />;
      case "print":
        return <PrintQueueSection />;
      case "audit":
        return <AuditLogSection />;
      case "analytics":
        return <AnalyticsSection />;
      case "settings":
        return <SettingsSection />;
      default:
        return <DashboardSection />;
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {renderSection()}
    </div>
  );
}
