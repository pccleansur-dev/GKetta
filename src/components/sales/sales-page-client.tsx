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
  payments: { method: string; amount: number }[];
};

type CustomerOption = { customerId: string; name: string };
type OrderOption = { id: string; customer: string; product: string };

type SalesPageClientProps = {
  canCreate: boolean;
  initialPanel?: "new" | null;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "account", label: "A cuenta" },
  { value: "mixed", label: "Mixto" },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  mixto: "Mixto",
  account: "A cuenta",
};

const METHOD_FILTERS = ["all", "efectivo", "transferencia", "tarjeta", "mixto"] as const;

const MIXED_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "account", label: "A cuenta" },
] as const;

type MixedPart = { method: string; amount: string };

export function SalesPageClient({ canCreate, initialPanel = null }: SalesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_FILTERS)[number]>("all");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [mixedParts, setMixedParts] = useState<MixedPart[]>([{ method: "cash", amount: "" }]);
  const [totalAmount, setTotalAmount] = useState("");
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"new" | null>(() =>
    initialPanel === "new" && canCreate ? "new" : null,
  );
  const [isPending, startTransition] = useTransition();

  const parsedTotal = parseFloat(totalAmount.replace(",", ".")) || 0;
  const mixedSum = mixedParts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const mixedRemaining = roundMoney(parsedTotal - mixedSum);
  const usedMethods = new Set(mixedParts.map((p) => p.method));
  const availableMixedOptions = MIXED_OPTIONS.filter((o) => !usedMethods.has(o.value));

  function roundMoney(v: number) { return Math.round(v * 100) / 100; }

  function addMixedPart() {
    const next = MIXED_OPTIONS.find((o) => !usedMethods.has(o.value));
    if (next) setMixedParts((prev) => [...prev, { method: next.value, amount: "" }]);
  }

  function removeMixedPart(index: number) {
    setMixedParts((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMixedPart(index: number, field: "method" | "amount", value: string) {
    setMixedParts((prev) => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  }

  async function fetchSales() {
    const res = await fetch("/api/sales", { cache: "no-store" });
    if (!res.ok) { setSales([]); setLoadingSales(false); return; }
    setSales(await res.json() as SaleSummary[]);
    setLoadingSales(false);
  }

  function closePanel() {
    setPanel(null);
    router.replace(pathname, { scroll: false });
  }

  function openCreatePanel() {
    setError(undefined);
    setPaymentMethod("cash");
    setMixedParts([{ method: "cash", amount: "" }]);
    setTotalAmount("");
    setPanel("new");
  }

  async function submitCreate(formData: FormData) {
    const method = String(formData.get("paymentMethod") ?? "cash");
    const paymentParts = method === "mixed"
      ? mixedParts
          .map((p) => ({ method: p.method, amount: parseFloat(p.amount) || 0 }))
          .filter((p) => p.amount > 0)
      : [];

    const payload = {
      description: String(formData.get("description") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      saleDate: String(formData.get("saleDate") ?? ""),
      category: String(formData.get("category") ?? "local"),
      paymentMethod: method,
      paymentParts,
      relatedCustomerId: String(formData.get("relatedCustomerId") ?? ""),
      relatedOrderId: String(formData.get("relatedOrderId") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) { setError(data?.error ?? "No se pudo registrar la venta."); return; }

    setNotice(data?.message ?? "Venta registrada correctamente.");
    closePanel();
    await fetchSales();
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const [salesRes, customersRes, ordersRes] = await Promise.all([
        fetch("/api/sales", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/orders", { cache: "no-store" }),
      ]);

      if (!active) return;

      if (salesRes.ok) setSales(await salesRes.json() as SaleSummary[]);
      setLoadingSales(false);

      if (customersRes.ok) {
        const data = await customersRes.json() as CustomerOption[];
        setCustomers(data.map((c) => ({ customerId: c.customerId, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)));
      }
      setLoadingCustomers(false);

      if (ordersRes.ok) setOrders(await ordersRes.json() as OrderOption[]);
      setLoadingOrders(false);
    }

    void load();
    return () => { active = false; };
  }, []);

  const total = sales.reduce((sum, s) => sum + s.amount, 0);
  const transferTotal = sales.reduce(
    (sum, s) => sum + s.payments.filter((p) => p.method === "transferencia").reduce((ps, p) => ps + p.amount, 0),
    0,
  );
  const filteredSales = sales.filter((s) => {
    if (methodFilter === "all") return true;
    if (methodFilter === "mixto") return s.method === "mixto";
    return s.payments.some((p) => p.method === methodFilter);
  });

  const needsCustomer = paymentMethod === "account" ||
    (paymentMethod === "mixed" && mixedParts.some((p) => p.method === "account" && parseFloat(p.amount) > 0));

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
              Cada venta impacta en caja. Las ventas a cuenta generan deuda en la cuenta corriente del cliente.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={openCreatePanel}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
            >
              Registrar venta
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Operaciones</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{sales.length}</p>
          </article>
          <article className="surface-muted rounded-[22px] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Ingresos por transferencia</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--info)]">{formatCurrency(transferTotal)}</p>
          </article>
          <article className="surface-walnut rounded-[22px] p-4">
            <p className="text-sm text-[rgba(237,242,237,0.72)]">Total cargado</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{formatCurrency(total)}</p>
          </article>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {METHOD_FILTERS.map((m) => (
          <button
            key={m}
            onClick={() => setMethodFilter(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              methodFilter === m
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            }`}
          >
            {m === "all" ? "Todas" : PAYMENT_LABELS[m] ?? m}
          </button>
        ))}
      </div>

      <section className="space-y-3">
        {loadingSales ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">Cargando ventas...</div>
        ) : sales.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">Todavía no hay ventas cargadas.</div>
        ) : filteredSales.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">No hay ventas para ese medio de pago.</div>
        ) : (
          filteredSales.map((sale) => (
            <article key={sale.id} className="page-frame flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">{sale.description}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {sale.date} · {PAYMENT_LABELS[sale.method] ?? sale.method}
                </p>
                {sale.payments.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sale.payments.map((p) => (
                      <span key={`${sale.id}-${p.method}`} className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                        {PAYMENT_LABELS[p.method] ?? p.method}: {formatCurrency(p.amount)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--success)]">{formatCurrency(sale.amount)}</p>
            </article>
          ))
        )}
      </section>

      {panel && (
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />
          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">Nueva venta</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  Registrar venta del día
                </h2>
              </div>
              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {!canCreate ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para registrar ventas.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(undefined);
                  startTransition(async () => {
                    await submitCreate(new FormData(e.currentTarget));
                  });
                }}
                className="overlay-panel-form"
              >
                <div className="compact-form-grid">
                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="description">Descripción</label>
                    <input id="description" name="description" required className="field-input" />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="amount">Importe total</label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(e.target.value)}
                      className="field-input"
                    />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="saleDate">Fecha</label>
                    <input id="saleDate" name="saleDate" type="date" className="field-input" />
                  </div>

                  <div>
                    <label className="field-label" htmlFor="category">Categoría</label>
                    <select id="category" name="category" defaultValue="local" className="field-select">
                      <option value="local">Venta local</option>
                      <option value="pedido">Pedido</option>
                      <option value="cuenta_corriente">Cuenta corriente</option>
                      <option value="otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="paymentMethod">Medio de pago</label>
                    <select
                      id="paymentMethod"
                      name="paymentMethod"
                      value={paymentMethod}
                      onChange={(e) => { setPaymentMethod(e.target.value); setMixedParts([{ method: "cash", amount: "" }]); }}
                      className="field-select"
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Cliente — obligatorio cuando hay "a cuenta" */}
                  <div className={needsCustomer ? "md:col-span-2" : ""}>
                    <label className="field-label" htmlFor="relatedCustomerId">
                      Cliente{needsCustomer && <span className="ml-1 text-[var(--danger)]">*</span>}
                    </label>
                    <select
                      id="relatedCustomerId"
                      name="relatedCustomerId"
                      required={needsCustomer}
                      disabled={loadingCustomers}
                      className="field-select"
                    >
                      <option value="">{needsCustomer ? "Seleccioná un cliente (requerido)" : "Sin cliente asociado"}</option>
                      {customers.map((c) => (
                        <option key={c.customerId} value={c.customerId}>{c.name}</option>
                      ))}
                    </select>
                    {needsCustomer && (
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                        El saldo que queda a cuenta genera deuda en la cuenta corriente del cliente.
                      </p>
                    )}
                  </div>

                  {/* Distribución mixta */}
                  {paymentMethod === "mixed" && (
                    <div className="md:col-span-2">
                      <div className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">Distribución del pago</p>
                          {parsedTotal > 0 && (
                            <p className={`text-xs font-semibold ${Math.abs(mixedRemaining) < 0.01 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                              {Math.abs(mixedRemaining) < 0.01
                                ? "Suma correcta"
                                : mixedRemaining > 0
                                  ? `Faltan ${formatCurrency(mixedRemaining)}`
                                  : `Sobran ${formatCurrency(Math.abs(mixedRemaining))}`}
                            </p>
                          )}
                        </div>

                        <div className="mt-4 space-y-3">
                          {mixedParts.map((part, index) => {
                            const optionsForThisPart = MIXED_OPTIONS.filter(
                              (o) => o.value === part.method || !usedMethods.has(o.value),
                            );
                            return (
                              <div key={index} className="flex items-center gap-2">
                                <select
                                  value={part.method}
                                  onChange={(e) => updateMixedPart(index, "method", e.target.value)}
                                  className="field-select flex-1"
                                >
                                  {optionsForThisPart.map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={part.amount}
                                  onChange={(e) => updateMixedPart(index, "amount", e.target.value)}
                                  className="field-input w-36 shrink-0"
                                />
                                {mixedParts.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => removeMixedPart(index)}
                                    className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {availableMixedOptions.length > 0 && (
                          <button
                            type="button"
                            onClick={addMixedPart}
                            className="mt-3 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                          >
                            + Agregar medio de pago
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* A cuenta — muestra resumen del saldo que queda */}
                  {paymentMethod === "account" && parsedTotal > 0 && (
                    <div className="md:col-span-2">
                      <div className="rounded-[18px] border border-[rgba(154,118,85,0.28)] bg-[rgba(123,91,62,0.08)] px-4 py-3 text-sm text-[var(--text-primary)]">
                        Queda <span className="font-semibold">{formatCurrency(parsedTotal)}</span> pendiente en la cuenta corriente del cliente.
                      </div>
                    </div>
                  )}

                  {/* Pedido relacionado */}
                  {!needsCustomer && (
                    <div>
                      <label className="field-label" htmlFor="relatedOrderId">Pedido relacionado</label>
                      <select id="relatedOrderId" name="relatedOrderId" disabled={loadingOrders} className="field-select">
                        <option value="">Sin pedido asociado</option>
                        {orders.map((o) => (
                          <option key={o.id} value={o.id}>{o.customer} · {o.product}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="field-label" htmlFor="notes">Notas</label>
                    <textarea id="notes" name="notes" className="field-textarea min-h-[88px] resize-none" />
                  </div>
                </div>

                <div className="overlay-panel-actions">
                  <button
                    type="submit"
                    disabled={isPending || loadingCustomers}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Guardando..." : "Guardar venta"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
