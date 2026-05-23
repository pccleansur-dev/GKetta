import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SystemUpdateCard } from "@/components/system/system-update-card";
import { getSessionUser } from "@/lib/session";
import { getAppVersionInfo } from "@/lib/version";

export const dynamic = "force-dynamic";

export default async function SistemaPage() {
  const currentUser = await getSessionUser();

  if (!currentUser) {
    redirect("/login");
  }

  if (currentUser.role !== "owner") {
    redirect("/");
  }

  const versionInfo = await getAppVersionInfo();

  return (
    <DashboardShell>
      <main className="flex flex-col gap-6">
        <SystemUpdateCard versionInfo={versionInfo} />
      </main>
    </DashboardShell>
  );
}
