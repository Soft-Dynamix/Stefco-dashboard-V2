"use client";

import {
  LayoutDashboard,
  Mail,
  FileText,
  Brain,
  Building2,
  Settings,
  History,
  Printer,
  BarChart3,
  FolderOpen,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  {
    title: "Dashboard",
    url: "/#dashboard",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    title: "Email Inbox",
    url: "/#inbox",
    icon: Mail,
    badge: "pending",
  },
  {
    title: "Claims",
    url: "/#claims",
    icon: FileText,
    badge: null,
  },
  {
    title: "Learning Engine",
    url: "/#learning",
    icon: Brain,
    badge: null,
  },
];

const managementItems = [
  {
    title: "Insurance Companies",
    url: "/#insurance",
    icon: Building2,
  },
  {
    title: "Files",
    url: "/#files",
    icon: FolderOpen,
  },
  {
    title: "Print Queue",
    url: "/#print",
    icon: Printer,
  },
  {
    title: "Audit Log",
    url: "/#audit",
    icon: History,
  },
  {
    title: "Analytics",
    url: "/#analytics",
    icon: BarChart3,
  },
];

const systemItems = [
  {
    title: "Settings",
    url: "/#settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            SC
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">STEFCO</span>
            <span className="text-xs text-muted-foreground">Claims Dashboard</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">
            v1.0
          </div>
          <span className="text-xs text-muted-foreground">Soft-Dynamix</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
