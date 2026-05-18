"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { formatCurrency, statusLabel, statusPill } from "@/lib/format";

type OrderSummary = {
  id: string;
  customer: string;
  product: string;
  deliveryDate: string;
  deposit: number;
  remainingBalance: number;
  status: string;
};

type OrderDetail = {
  orderId: string;
  customerName: string;
  productName: string;
  status: string;
  paymentConfirmationStatus: string;
  deliveryDate: string;
  notes: string;
};

type OrdersPageClientProps = {
  canCreate: boolean;
  canEdit: boolean;
  initialPanel?: "edit" | null;
  initialOrderId?: string | null;
};

const DEFAULT_ORDER_STATUS = "confirmed";
const DEFAULT_PAYMENT_STATUS = "confirmed";

export function OrdersPageClient({ canEdit, initialPanel = null, initialOrderId = null }: OrdersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmado" | "en proceso" | "listo" | "entregado">("all");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"edit" | null>(() =>
    initialPanel === "edit" && canEdit ? "edit" : null,
  );
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [requestedOrderId, setRequestedOrderId] = useState<string>(initialOrderId ?? "");
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [isPending, startTransition] = useTransition();

  async function fetchOrders() {
    const res = await fetch("/api/orders", { cache: "no-store" });
    if (!res.ok) { setOrders([]); setLoadingOrders(false); return; }
    setOrders(await res.json() as OrderSummary[]);
    setLoadingOrders(false);
  }

  async function fetchOrderDetail(orderId: string) {
    setLoadingDetail(true);
    const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo cargar el pedido.");
      setPanel(null); setLoadingDetail(false); return;
    }
    setSelectedOrder(await res.json() as OrderDetail);
    setRequestedOrderId(orderId);
    setPanel("edit");
    setLoadingDetail(false);
  }

  function closePanel() {
    setPanel(null);
    setSelectedOrder(null);
    setRequestedOrderId("");
    setLoadingDetail(false);
    router.replace(pathname, { scroll: false });
  }

  async function submitUpdate(formData: FormData) {
    if (!selectedOrder) return;
    const res = await fetch(`/api/orders/${selectedOrder.orderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productName: String(formData.get("productName") ?? ""),
        deliveryDate: String(formData.get("deliveryDate") ?? ""),
        status: String(formData.get("status") ?? ""),
        paymentConfirmationStatus: String(formData.get("paymentConfirmationStatus") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) { setError(data?.error ?? "No se pudo actualizar el pedido."); return; }
    setNotice(data?.message ?? "Pedido actualizado correctamente.");
    closePanel();
    await fetchOrders();
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!active) return;
      if (res.ok) setOrders(await res.json() as OrderSummary[]);
      setLoadingOrders(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (initialPanel !== "edit" || !initialOrderId || !canEdit) return;
    void fetchOrderDetail(initialOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inProgress = orders.filter((o) => o.status === "en proceso").length;
  const ready = orders.filter((o) => o.status === "listo").length;
  const pendingBalance = orders.reduce((sum, o) => sum + o.remainingBalance, 0);
  const selectedOrderSummary = orders.find((o) => o.id === requestedOrderId) ?? orders.find((o) => o.id === selectedOrder?.orderId) ?? null;

  return (
    <main className="flex flex-col gap-6">
      <FeedbackBanner error={error} notice={notice} />

      <section className="page-frame rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Pedidos</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Seguimiento de pedidos
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Cada pedido nace desde una venta. Editá estado y entrega desde acá.
            </p>
          </div>
          <Link
            href="/ventas?panel=new&mode=order"
            className="rounded-full bg-[var(--primary)] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
          >
            Nuevo pedido
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Pedidos activos</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{orders.length}</p>
          </article>
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">En proceso o listos</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--warning)]">{inProgress + ready}</p>
          </article>
          <article className="surface-walnut rounded-[22px] p-4">
            <p className="text-sm text-[rgba(237,242,237,0.72)]">Saldo pendiente total</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{formatCurrency(pendingBalance)}</p>
          </article>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "confirmado", "en proceso", "listo", "entregado"] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${statusFilter === s ? "bg-[var(--primary)] text-white" : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"}`}
          >
            {s === "all" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingOrders ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">Cargando pedidos...</div>
        ) : orders.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">Todavía no hay pedidos cargados.</div>
        ) : (
          orders.filter((o) => statusFilter === "all" || o.status === statusFilter).map((order) => (
            <article key={order.id} className="page-frame executive-card rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--text-primary)]">{order.customer}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{order.product}</h2>
              <div className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center justify-between">
                  <span>Entrega</span>
                  <span className="font-semibold text-[var(--text-primary)]">{order.deliveryDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Seña confirmada</span>
                  <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(order.deposit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saldo restante</span>
                  <span className="font-semibold text-[var(--warning)]">{formatCurrency(order.remainingBalance)}</span>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                {canEdit ? (
                  <button onClick={() => void fetchOrderDetail(order.id)}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                  >
                    Editar
                  </button>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">Solo lectura</span>
                )}
              </div>
            </article>
          ))
        )}
      </section>

      {mounted && panel === "edit" && createPortal(
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />
          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">Editar pedido</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  Cambiar estado y entrega
                </h2>
              </div>
              <button onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {loadingDetail ? (
              <p className="text-sm text-[var(--text-secondary)]">Cargando datos del pedido...</p>
            ) : !selectedOrder ? (
              <p className="text-sm text-[var(--text-secondary)]">No se encontró el pedido.</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(undefined);
                  startTransition(async () => await submitUpdate(new FormData(e.currentTarget)));
                }}
                className="overlay-panel-form"
              >
                {selectedOrderSummary && (
                  <div className="surface-muted rounded-[22px] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedOrderSummary.customer}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">{selectedOrderSummary.product}</p>
                      </div>
                      <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--warning)]">{formatCurrency(selectedOrderSummary.remainingBalance)}</p>
                    </div>
                  </div>
                )}

                <div className="compact-form-grid">
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="productName">Producto</label>
                    <input id="productName" name="productName" defaultValue={selectedOrder.productName} required className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="deliveryDate">Fecha de entrega</label>
                    <input id="deliveryDate" name="deliveryDate" type="date" defaultValue={selectedOrder.deliveryDate} className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="status">Estado</label>
                    <select id="status" name="status" defaultValue={selectedOrder.status} className="field-select">
                      <option value="pending">Pendiente</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="in_progress">En proceso</option>
                      <option value="ready">Listo</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="paymentConfirmationStatus">Confirmación de seña</label>
                    <select id="paymentConfirmationStatus" name="paymentConfirmationStatus"
                      defaultValue={selectedOrder.paymentConfirmationStatus} className="field-select"
                    >
                      <option value="pending">Pendiente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="rejected">Rechazada</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="notes">Notas</label>
                    <textarea id="notes" name="notes" defaultValue={selectedOrder.notes}
                      className="field-textarea resize-none"
                      style={{ minHeight: 64 }}
                    />
                  </div>
                </div>

                <div className="overlay-panel-actions">
                  <button type="submit" disabled={isPending}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Actualizando..." : "Actualizar pedido"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>,
        document.body
      )}
    </main>
  );
}
