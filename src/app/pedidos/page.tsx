import { OrdersPageClient } from "@/components/orders/orders-page-client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { canCreateOrders, canEditOrders, requireSessionUser } from "@/lib/session";
import { getOrderEditData } from "@/server/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PedidosPage({ searchParams }: PageProps) {
  const currentUser = await requireSessionUser();
  const params = searchParams ? await searchParams : undefined;
  const panelParam = readSingle(params?.panel);
  const orderId = readSingle(params?.orderId);
  const panel = panelParam === "edit" ? "edit" : null;
  const initialOrderDetail = panel === "edit" && orderId ? await getOrderEditData(orderId) : null;

  return (
    <DashboardShell>
      <OrdersPageClient
        canCreate={canCreateOrders(currentUser.role)}
        canEdit={canEditOrders(currentUser.role)}
        initialPanel={panel}
        initialOrderId={orderId ?? null}
        initialOrderDetail={initialOrderDetail}
      />
    </DashboardShell>
  );
}
