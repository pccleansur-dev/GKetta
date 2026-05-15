import { AccountsPageClient } from "@/components/accounts/accounts-page-client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { canRegisterPayments, requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CuentasCorrientesPage({ searchParams }: PageProps) {
  const currentUser = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const panelParam = readSingle(params?.panel);
  const selectedAccountId = readSingle(params?.accountId);
  const panel = panelParam === "payment" ? "payment" : null;

  return (
    <DashboardShell>
      <AccountsPageClient
        canRegister={canRegisterPayments(currentUser.role)}
        initialPanel={panel}
        initialAccountId={selectedAccountId ?? null}
      />
    </DashboardShell>
  );
}
