import { SalesPageClient } from "@/components/sales/sales-page-client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { canCreateSales, requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VentasPage({ searchParams }: PageProps) {
  const currentUser = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const panelParam = readSingle(params?.panel);
  const modeParam = readSingle(params?.mode);
  const panel = panelParam === "new" ? "new" : null;
  const initialMode = modeParam === "order" ? "order" : "sale";

  return (
    <DashboardShell>
      <SalesPageClient
        canCreate={canCreateSales(currentUser.role)}
        initialPanel={panel}
        initialMode={initialMode}
      />
    </DashboardShell>
  );
}
