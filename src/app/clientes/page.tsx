import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CustomersPageClient } from "@/components/customers/customers-page-client";
import { canManageCustomers, requireSessionUser } from "@/lib/session";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function ClientesPage({ searchParams }: PageProps) {
  const currentUser = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const panelParam = readSingle(params?.panel);
  const panel = panelParam === "new" ? "new" : null;

  return (
    <DashboardShell>
      <CustomersPageClient
        canManage={canManageCustomers(currentUser.role)}
        initialPanel={panel}
      />
    </DashboardShell>
  );
}
