import type { ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/layout/page-transition";
import { Sidebar } from "@/components/layout/sidebar";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";

export async function DashboardShell({ children }: { children: ReactNode }) {
  const [currentUser, businessNameConfig] = await Promise.all([
    requireSessionUser(),
    db.systemConfig.findUnique({ where: { key: "business_name" } }),
  ]);

  const businessName = businessNameConfig?.value ?? "Sistema Kettal";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1520px] items-start gap-6 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:pb-8">
      <Sidebar currentUser={currentUser} />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <Header currentUser={currentUser} businessName={businessName} />
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
