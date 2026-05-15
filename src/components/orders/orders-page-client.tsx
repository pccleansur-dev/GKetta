"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

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

type CustomerOption = {
  customerId: string;
  name: string;
};

type OrdersPageClientProps = {
  canCreate: boolean;
  canEdit: boolean;
  initialPanel?: "new" | "edit" | null;
  initialOrderId?: string | null;
};

const DEFAULT_ORDER_STATUS = "confirmed";
const DEFAULT_PAYMENT_STATUS = "confirmed";
const DEFAULT_PAYMENT_METHOD = "transfer";

export function OrdersPageClient({
  canCreate,
  canEdit,
  initialPanel = null,
  initialOrderId = null,
}: OrdersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "confirmado" | "en proceso" | "listo">("all");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"new" | "edit" | null>(() => {
    if (initialPanel === "new" && canCreate) {
      return "new";
    }

    if (initialPanel === "edit" && canEdit) {
      return "edit";
    }

    return null;
  });
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [requestedOrderId, setRequestedOrderId] = useState<string>(initialOrderId ?? "");
  const [isPending, startTransition] = useTransition();

  async function fetchOrders() {
    const response = await fetch("/api/orders", {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar los pedidos.");
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    const data = (await response.json()) as OrderSummary[];
    setOrders(data);
    setLoadingOrders(false);
  }

  async function fetchOrderDetail(orderId: string, showPending = true) {
    if (showPending) {
      setLoadingDetail(true);
    }

    const response = await fetch(`/api/orders/${orderId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo cargar el pedido.");
      setSelectedOrder(null);
      setPanel(null);
      setLoadingDetail(false);
      return;
    }

    const data = (await response.json()) as OrderDetail;
    setSelectedOrder(data);
    setRequestedOrderId(orderId);
    setPanel("edit");
    setLoadingDetail(false);
  }

  function clearPanelUrl() {
    router.replace(pathname, { scroll: false });
  }

  function closePanel() {
    setPanel(null);
    setSelectedOrder(null);
    setRequestedOrderId("");
    setLoadingDetail(false);
    clearPanelUrl();
  }

  function openCreatePanel() {
    setError(undefined);
    setSelectedOrder(null);
    setRequestedOrderId("");
    setPanel("new");
  }

  function openEditPanel(orderId: string) {
    setError(undefined);
    setRequestedOrderId(orderId);
    setPanel("edit");
    void fetchOrderDetail(orderId);
  }

  async function submitCreate(formData: FormData) {
    const payload = {
      customerId: String(formData.get("customerId") ?? ""),
      productName: String(formData.get("productName") ?? ""),
      totalAmount: String(formData.get("totalAmount") ?? ""),
      depositAmount: String(formData.get("depositAmount") ?? "0"),
      deliveryDate: String(formData.get("deliveryDate") ?? ""),
      status: String(formData.get("status") ?? DEFAULT_ORDER_STATUS),
      paymentConfirmationStatus: String(
        formData.get("paymentConfirmationStatus") ?? DEFAULT_PAYMENT_STATUS,
      ),
      paymentMethod: String(formData.get("paymentMethod") ?? DEFAULT_PAYMENT_METHOD),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el pedido.");
      return;
    }

    setNotice(data?.message ?? "Pedido cargado correctamente.");
    closePanel();
    await fetchOrders();
  }

  async function submitUpdate(formData: FormData) {
    if (!selectedOrder) {
      return;
    }

    const payload = {
      productName: String(formData.get("productName") ?? ""),
      deliveryDate: String(formData.get("deliveryDate") ?? ""),
      status: String(formData.get("status") ?? ""),
      paymentConfirmationStatus: String(formData.get("paymentConfirmationStatus") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch(`/api/orders/${selectedOrder.orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el pedido.");
      return;
    }

    setNotice(data?.message ?? "Pedido actualizado correctamente.");
    closePanel();
    await fetchOrders();
  }

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      const response = await fetch("/api/orders", {
        cache: "no-store",
      });

      if (!active) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar los pedidos.");
        setOrders([]);
        setLoadingOrders(false);
        return;
      }

      const data = (await response.json()) as OrderSummary[];

      if (!active) {
        return;
      }

      setOrders(data);
      setLoadingOrders(false);
    }

    async function loadCustomers() {
      const response = await fetch("/api/customers", {
        cache: "no-store",
      });

      if (!active) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar los clientes.");
        setCustomers([]);
        setLoadingCustomers(false);
        return;
      }

      const data = (await response.json()) as CustomerOption[];

      if (!active) {
        return;
      }

      setCustomers(
        data
          .map((customer) => ({
            customerId: customer.customerId,
            name: customer.name,
          }))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      setLoadingCustomers(false);
    }

    void loadOrders();
    void loadCustomers();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (initialPanel !== "edit" || !initialOrderId || !canEdit) {
      return;
    }

    let active = true;

    async function loadOrderDetail() {
      const response = await fetch(`/api/orders/${initialOrderId}`, {
        cache: "no-store",
      });

      if (!active) {
        return;
      }

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudo cargar el pedido.");
        setSelectedOrder(null);
        setPanel(null);
        setLoadingDetail(false);
        return;
      }

      const data = (await response.json()) as OrderDetail;

      if (!active) {
        return;
      }

      setSelectedOrder(data);
      setRequestedOrderId(initialOrderId ?? "");
      setPanel("edit");
      setLoadingDetail(false);
    }

    void loadOrderDetail();

    return () => {
      active = false;
    };
  }, [canEdit, initialOrderId, initialPanel]);

  const inProgress = orders.filter((order) => order.status === "en proceso").length;
  const ready = orders.filter((order) => order.status === "listo").length;
  const pendingBalance = orders.reduce((sum, order) => sum + order.remainingBalance, 0);
  const selectedOrderSummary =
    orders.find((order) => order.id === requestedOrderId) ??
    orders.find((order) => order.id === selectedOrder?.orderId) ??
    null;

  return (
    <main className="flex flex-col gap-6">
      <FeedbackBanner error={error} notice={notice} />

      <section className="page-frame rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Pedidos puntuales</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Pedidos con seña y confirmación
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Seguimiento del producto, fecha de entrega, seña cobrada y saldo pendiente.
            </p>
          </div>

          {canCreate ? (
            <button
              onClick={openCreatePanel}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
            >
              Nuevo pedido
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Pedidos activos</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {orders.length}
            </p>
          </article>
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">En proceso o listos</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--warning)]">
              {inProgress + ready}
            </p>
          </article>
          <article className="surface-walnut rounded-[22px] p-4">
            <p className="text-sm text-[rgba(237,242,237,0.72)]">Saldo pendiente total</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {formatCurrency(pendingBalance)}
            </p>
          </article>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(["all", "confirmado", "en proceso", "listo"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === s
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            }`}
          >
            {s === "all" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loadingOrders ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            Cargando pedidos...
          </div>
        ) : orders.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            Todavía no hay pedidos cargados.
          </div>
        ) : (
          orders
            .filter((order) => statusFilter === "all" || order.status === statusFilter)
            .map((order) => (
            <article key={order.id} className="page-frame executive-card rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--text-primary)]">{order.customer}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${statusPill(order.status)}`}
                >
                  {statusLabel(order.status)}
                </span>
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                {order.product}
              </h2>
              <div className="mt-5 space-y-3 text-sm text-[var(--text-secondary)]">
                <div className="flex items-center justify-between">
                  <span>Entrega</span>
                  <span className="font-semibold text-[var(--text-primary)]">{order.deliveryDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Seña confirmada</span>
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatCurrency(order.deposit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saldo restante</span>
                  <span className="font-semibold text-[var(--warning)]">
                    {formatCurrency(order.remainingBalance)}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex justify-end">
                {canEdit ? (
                  <button
                    onClick={() => openEditPanel(order.id)}
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

      {panel ? (
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />

          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">
                  {panel === "new" ? "Nuevo pedido" : "Editar pedido"}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  {panel === "new" ? "Pedido con seña y seguimiento" : "Cambiar estado y entrega"}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  {panel === "new"
                    ? "Cargá producto, total, seña y fecha sin salir de la vista principal."
                    : "Ajustá estado, entrega y notas desde este panel compacto."}
                </p>
              </div>

              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {panel === "new" && !canCreate ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para crear pedidos.
              </p>
            ) : panel === "edit" && !canEdit ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para editar pedidos.
              </p>
            ) : panel === "edit" && loadingDetail ? (
              <p className="text-sm text-[var(--text-secondary)]">Cargando datos del pedido...</p>
            ) : panel === "edit" && !selectedOrder ? (
              <p className="text-sm text-[var(--text-secondary)]">
                No se encontró el pedido seleccionado.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(undefined);
                  startTransition(async () => {
                    const formData = new FormData(event.currentTarget);
                    if (panel === "new") {
                      await submitCreate(formData);
                    } else {
                      await submitUpdate(formData);
                    }
                  });
                }}
                className="overlay-panel-form"
              >
                {panel === "edit" && selectedOrderSummary ? (
                  <div className="surface-muted rounded-[22px] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {selectedOrderSummary.customer}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                          {selectedOrderSummary.product}
                        </p>
                      </div>
                      <p className="text-xl font-semibold tracking-[-0.03em] text-[var(--warning)]">
                        {formatCurrency(selectedOrderSummary.remainingBalance)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="compact-form-grid">
                  {panel === "new" ? (
                    <>
                      <div>
                        <label className="field-label" htmlFor="customerId">
                          Cliente
                        </label>
                        <select
                          id="customerId"
                          name="customerId"
                          required
                          disabled={loadingCustomers}
                          className="field-select"
                        >
                          <option value="">Seleccionar cliente</option>
                          {customers.map((customer) => (
                            <option key={customer.customerId} value={customer.customerId}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="productName">
                          Producto
                        </label>
                        <input id="productName" name="productName" required className="field-input" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="totalAmount">
                          Total del pedido
                        </label>
                        <input
                          id="totalAmount"
                          name="totalAmount"
                          type="number"
                          min="0.01"
                          step="0.01"
                          required
                          className="field-input"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="depositAmount">
                          Seña cobrada
                        </label>
                        <input
                          id="depositAmount"
                          name="depositAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                          className="field-input"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="deliveryDate">
                          Fecha de entrega
                        </label>
                        <input id="deliveryDate" name="deliveryDate" type="date" className="field-input" />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="status">
                          Estado inicial
                        </label>
                        <select
                          id="status"
                          name="status"
                          defaultValue={DEFAULT_ORDER_STATUS}
                          className="field-select"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="in_progress">En proceso</option>
                          <option value="ready">Listo</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="paymentConfirmationStatus">
                          Confirmación de la seña
                        </label>
                        <select
                          id="paymentConfirmationStatus"
                          name="paymentConfirmationStatus"
                          defaultValue={DEFAULT_PAYMENT_STATUS}
                          className="field-select"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="confirmed">Confirmada</option>
                          <option value="rejected">Rechazada</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="paymentMethod">
                          Medio de pago de la seña
                        </label>
                        <select
                          id="paymentMethod"
                          name="paymentMethod"
                          defaultValue={DEFAULT_PAYMENT_METHOD}
                          className="field-select"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia</option>
                          <option value="card">Tarjeta</option>
                          <option value="mixed">Mixto</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="md:col-span-2">
                        <label className="field-label" htmlFor="productName">
                          Producto
                        </label>
                        <input
                          id="productName"
                          name="productName"
                          defaultValue={selectedOrder?.productName ?? ""}
                          required
                          className="field-input"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="deliveryDate">
                          Fecha de entrega
                        </label>
                        <input
                          id="deliveryDate"
                          name="deliveryDate"
                          type="date"
                          defaultValue={selectedOrder?.deliveryDate ?? ""}
                          className="field-input"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor="status">
                          Estado
                        </label>
                        <select
                          id="status"
                          name="status"
                          defaultValue={selectedOrder?.status ?? DEFAULT_ORDER_STATUS}
                          className="field-select"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="in_progress">En proceso</option>
                          <option value="ready">Listo</option>
                          <option value="delivered">Entregado</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor="paymentConfirmationStatus">
                          Confirmación de la seña
                        </label>
                        <select
                          id="paymentConfirmationStatus"
                          name="paymentConfirmationStatus"
                          defaultValue={selectedOrder?.paymentConfirmationStatus ?? DEFAULT_PAYMENT_STATUS}
                          className="field-select"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="confirmed">Confirmada</option>
                          <option value="rejected">Rechazada</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="notes">
                      Notas
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      defaultValue={selectedOrder?.notes ?? ""}
                      className="field-textarea min-h-[88px] resize-none"
                    />
                  </div>
                </div>

                <div className="overlay-panel-actions">
                  <button
                    type="submit"
                    disabled={isPending || loadingCustomers}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending
                      ? panel === "new"
                        ? "Guardando..."
                        : "Actualizando..."
                      : panel === "new"
                        ? "Guardar pedido"
                        : "Actualizar pedido"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
