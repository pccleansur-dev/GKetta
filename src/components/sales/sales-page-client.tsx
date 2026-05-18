"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { formatCurrency } from "@/lib/format";

type SaleSummary = {
  id: string;
  date: string;
  description: string;
  amount: number;
  method: string;
  payments: {
    method: string;
    amount: number;
  }[];
};

type CustomerOption = {
  customerId: string;
  name: string;
};

type OrderOption = {
  id: string;
  customer: string;
  product: string;
};

type SalesPageClientProps = {
  canCreate: boolean;
  initialPanel?: "new" | null;
};

const paymentLabels: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  mixto: "Mixto",
};

const methodFilters = ["all", "efectivo", "transferencia", "tarjeta", "mixto"] as const;

export function SalesPageClient({ canCreate, initialPanel = null }: SalesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [methodFilter, setMethodFilter] = useState<"all" | "efectivo" | "transferencia" | "tarjeta" | "mixto">("all");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"new" | null>(() =>
    initialPanel === "new" && canCreate ? "new" : null,
  );
  const [isPending, startTransition] = useTransition();

  async function fetchSales() {
    const response = await fetch("/api/sales", { cache: "no-store" });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar las ventas.");
      setSales([]);
      setLoadingSales(false);
      return;
    }

    const data = (await response.json()) as SaleSummary[];
    setSales(data);
    setLoadingSales(false);
  }

  function clearPanelUrl() {
    router.replace(pathname, { scroll: false });
  }

  function closePanel() {
    setPanel(null);
    clearPanelUrl();
  }

  function openCreatePanel() {
    setError(undefined);
    setPanel("new");
  }

  async function submitCreate(formData: FormData) {
    const paymentMethod = String(formData.get("paymentMethod") ?? "cash");
    const paymentParts =
      paymentMethod === "mixed"
        ? [
            { method: "cash", amount: String(formData.get("paymentCash") ?? "") },
            { method: "transfer", amount: String(formData.get("paymentTransfer") ?? "") },
            { method: "card", amount: String(formData.get("paymentCard") ?? "") },
          ]
        : [];

    const payload = {
      description: String(formData.get("description") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      saleDate: String(formData.get("saleDate") ?? ""),
      category: String(formData.get("category") ?? "local"),
      paymentMethod,
      paymentParts,
      relatedCustomerId: String(formData.get("relatedCustomerId") ?? ""),
      relatedOrderId: String(formData.get("relatedOrderId") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo registrar la venta.");
      return;
    }

    setNotice(data?.message ?? "Venta registrada correctamente.");
    closePanel();
    await fetchSales();
  }

  useEffect(() => {
    let active = true;

    async function loadSales() {
      const response = await fetch("/api/sales", { cache: "no-store" });

      if (!active) return;

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar las ventas.");
        setSales([]);
        setLoadingSales(false);
        return;
      }

      const data = (await response.json()) as SaleSummary[];
      if (!active) return;
      setSales(data);
      setLoadingSales(false);
    }

    async function loadCustomers() {
      const response = await fetch("/api/customers", { cache: "no-store" });

      if (!active) return;

      if (!response.ok) {
        setLoadingCustomers(false);
        return;
      }

      const data = (await response.json()) as CustomerOption[];
      if (!active) return;
      setCustomers(
        data
          .map((c) => ({ customerId: c.customerId, name: c.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLoadingCustomers(false);
    }

    async function loadOrders() {
      const response = await fetch("/api/orders", { cache: "no-store" });

      if (!active) return;

      if (!response.ok) {
        setLoadingOrders(false);
        return;
      }

      const data = (await response.json()) as OrderOption[];
      if (!active) return;
      setOrders(data);
      setLoadingOrders(false);
    }

    void loadSales();
    void loadCustomers();
    void loadOrders();

    return () => {
      active = false;
    };
  }, []);

  const total = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const transferTotal = sales.reduce(
    (sum, sale) =>
      sum +
      sale.payments
        .filter((payment) => payment.method === "transferencia")
        .reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
    0,
  );
  const loadingDropdowns = loadingCustomers || loadingOrders;
  const filteredSales = sales.filter((sale) => {
    if (methodFilter === "all") {
      return true;
    }

    if (methodFilter === "mixto") {
      return sale.method === "mixto";
    }

    return sale.payments.some((payment) => payment.method === methodFilter);
  });

  return (
    <main className="flex flex-col gap-6">
      <FeedbackBanner error={error} notice={notice} />

      <section className="page-frame rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Ventas diarias</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Carga comercial del día
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Cada venta nueva impacta automáticamente en caja. Podés asociarla a cliente o pedido
              cuando corresponda.
            </p>
          </div>

          {canCreate ? (
            <button
              onClick={openCreatePanel}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
            >
              Registrar venta
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Operaciones visibles</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {sales.length}
            </p>
          </article>
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Ingresos por transferencia</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--info)]">
              {formatCurrency(transferTotal)}
            </p>
          </article>
          <article className="surface-walnut rounded-[22px] p-4">
            <p className="text-sm text-[rgba(237,242,237,0.72)]">Total cargado</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              {formatCurrency(total)}
            </p>
          </article>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {methodFilters.map((m) => (
          <button
            key={m}
            onClick={() => setMethodFilter(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              methodFilter === m
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            }`}
          >
            {m === "all" ? "Todas" : paymentLabels[m]}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {loadingSales ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            Cargando ventas...
          </div>
        ) : sales.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            Todavía no hay ventas cargadas.
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            No hay ventas para ese medio de pago.
          </div>
        ) : (
          filteredSales.map((sale) => (
            <article
              key={sale.id}
              className="page-frame flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">{sale.description}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {sale.date} - {paymentLabels[sale.method] ?? sale.method}
                </p>
                {sale.payments.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sale.payments.map((payment) => (
                      <span
                        key={`${sale.id}-${payment.method}`}
                        className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]"
                      >
                        {paymentLabels[payment.method] ?? payment.method}: {formatCurrency(payment.amount)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--success)]">
                {formatCurrency(sale.amount)}
              </p>
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
                <p className="section-kicker">Nueva venta</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  Registrar venta del día
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  Cargá importe, medio de pago y datos asociados sin salir de la vista principal.
                </p>
              </div>

              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {!canCreate ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para registrar ventas.
              </p>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(undefined);
                  startTransition(async () => {
                    const formData = new FormData(event.currentTarget);
                    await submitCreate(formData);
                  });
                }}
                className="overlay-panel-form"
              >
                <div className="compact-form-grid">
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="description">
                      Descripción
                    </label>
                    <input id="description" name="description" required className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="amount">
                      Importe
                    </label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      className="field-input"
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="saleDate">
                      Fecha
                    </label>
                    <input id="saleDate" name="saleDate" type="date" className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="category">
                      Categoría
                    </label>
                    <select id="category" name="category" defaultValue="local" className="field-select">
                      <option value="local">Venta local</option>
                      <option value="pedido">Pedido</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="paymentMethod">
                      Medio de pago
                    </label>
                    <select
                      id="paymentMethod"
                      name="paymentMethod"
                      value={selectedPaymentMethod}
                      onChange={(event) => setSelectedPaymentMethod(event.currentTarget.value)}
                      className="field-select"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="mixed">Mixto</option>
                    </select>
                  </div>
                  {selectedPaymentMethod === "mixed" ? (
                    <div className="md:col-span-2">
                      <div className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          Distribucion del pago
                        </p>
                        <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                          Carga al menos dos importes. La suma debe coincidir con el importe total.
                        </p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div>
                            <label className="field-label" htmlFor="paymentCash">
                              Efectivo
                            </label>
                            <input
                              id="paymentCash"
                              name="paymentCash"
                              type="number"
                              min="0"
                              step="0.01"
                              className="field-input"
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="paymentTransfer">
                              Transferencia
                            </label>
                            <input
                              id="paymentTransfer"
                              name="paymentTransfer"
                              type="number"
                              min="0"
                              step="0.01"
                              className="field-input"
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="paymentCard">
                              Tarjeta
                            </label>
                            <input
                              id="paymentCard"
                              name="paymentCard"
                              type="number"
                              min="0"
                              step="0.01"
                              className="field-input"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <label className="field-label" htmlFor="relatedCustomerId">
                      Cliente relacionado
                    </label>
                    <select
                      id="relatedCustomerId"
                      name="relatedCustomerId"
                      disabled={loadingCustomers}
                      className="field-select"
                    >
                      <option value="">Sin cliente asociado</option>
                      {customers.map((customer) => (
                        <option key={customer.customerId} value={customer.customerId}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="relatedOrderId">
                      Pedido relacionado
                    </label>
                    <select
                      id="relatedOrderId"
                      name="relatedOrderId"
                      disabled={loadingOrders}
                      className="field-select"
                    >
                      <option value="">Sin pedido asociado</option>
                      {orders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.customer} · {order.product}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="notes">
                      Notas
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      className="field-textarea min-h-[88px] resize-none"
                    />
                  </div>
                </div>

                <div className="overlay-panel-actions">
                  <button
                    type="submit"
                    disabled={isPending || loadingDropdowns}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Guardando..." : "Guardar venta"}
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
