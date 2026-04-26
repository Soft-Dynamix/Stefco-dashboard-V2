import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STEFCO Claims Dashboard",
  description: "AI-Powered Insurance Claims Processing System",
  keywords: ["Claims", "Insurance", "AI", "Automation", "STEFCO"],
  authors: [{ name: "Soft-Dynamix" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex flex-col min-h-screen">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>STEFCO Claims Dashboard</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
              {children}
            </main>
            <footer className="shrink-0 border-t bg-muted/30 px-4 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="font-medium">STEFCO Claims Dashboard</span>
                  <span className="text-border">•</span>
                  <span>Powered by Soft-Dynamix</span>
                </div>
                <div className="flex items-center gap-4">
                  <span>8 AI Agents Active</span>
                  <span className="text-border">•</span>
                  <span>v1.0.0</span>
                </div>
              </div>
            </footer>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
