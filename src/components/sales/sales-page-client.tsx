"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { formatCurrency } from "@/lib/format";

type SaleSummary = {
  id: string;
  date: string;
  saleDate: string;
  createdAt: string;
  description: string;
  amount: number;
  method: string;
  relatedOrderId: string | null;
  editable: boolean;
  deletable: boolean;
  payments: { method: string; amount: number }[];
};

type CustomerOption = { customerId: string; name: string };
type OrderOption = { id: string; customer: string; product: string };
type OperationMode = "sale" | "order";

type SalesPageClientProps = {
  canCreate: boolean;
  canEdit: boolean;
  initialPanel?: "new" | null;
  initialMode?: OperationMode;
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "account", label: "A cuenta" },
  { value: "mixed", label: "Mixto" },
] as const;

const DEPOSIT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  mixto: "Mixto",
  "a cuenta": "A cuenta",
};

const METHOD_FILTERS = ["all", "efectivo", "transferencia", "tarjeta", "mixto"] as const;

const MIXED_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "account", label: "A cuenta" },
] as const;

type MixedPart = { method: string; amount: string };

export function SalesPageClient({ canCreate, canEdit, initialPanel = null, initialMode = "sale" }: SalesPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_FILTERS)[number]>("all");

  // Panel state
  const [panel, setPanel] = useState<"new" | "edit" | null>(() =>
    initialPanel === "new" && canCreate ? "new" : null,
  );
  const [editingSale, setEditingSale] = useState<SaleSummary | null>(null);
  const [operationMode, setOperationMode] = useState<OperationMode>(initialMode);
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  // Sale fields
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [mixedParts, setMixedParts] = useState<MixedPart[]>([{ method: "cash", amount: "" }]);
  const [totalAmount, setTotalAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaleDate, setEditSaleDate] = useState("");
  const [editAmount, setEditAmount] = useState("");

  // Inline new customer
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerId, setNewCustomerId] = useState("");

  // Order-specific fields
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("transfer");
  const [orderDueDate, setOrderDueDate] = useState("");
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");
  const [orderStatus, setOrderStatus] = useState("confirmed");

  // Computed
  const parsedTotal = parseFloat(totalAmount.replace(",", ".")) || 0;
  const parsedDeposit = parseFloat(depositAmount.replace(",", ".")) || 0;
  const remainingBalance = Math.max(Math.round((parsedTotal - parsedDeposit) * 100) / 100, 0);
  const isOnAccount = remainingBalance > 0.01;

  const mixedSum = mixedParts.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const mixedRemaining = Math.round((parsedTotal - mixedSum) * 100) / 100;
  const usedMethods = new Set(mixedParts.map((p) => p.method));
  const availableMixedOptions = MIXED_OPTIONS.filter((o) => !usedMethods.has(o.value));
  const needsCustomer = paymentMethod === "account" ||
    (paymentMethod === "mixed" && mixedParts.some((p) => p.method === "account" && parseFloat(p.amount) > 0));

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
    setEditingSale(null);
    setEditDescription("");
    setEditSaleDate("");
    setEditAmount("");
    router.replace(pathname, { scroll: false });
  }

  async function createInlineCustomer() {
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: newCustomerName.trim(), phone: newCustomerPhone.trim() || undefined }),
    });
    const data = (await res.json().catch(() => null)) as { customerId?: string; error?: string } | null;
    if (!res.ok || !data?.customerId) {
      setError(data?.error ?? "No se pudo crear el cliente.");
      setCreatingCustomer(false);
      return;
    }
    const newEntry = { customerId: data.customerId, name: newCustomerName.trim() };
    setCustomers((prev) => [...prev, newEntry].sort((a, b) => a.name.localeCompare(b.name)));
    setNewCustomerId(data.customerId);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setShowNewCustomer(false);
    setCreatingCustomer(false);
  }

  function openCreatePanel(mode: OperationMode = "sale") {
    setError(undefined);
    setEditingSale(null);
    setEditDescription("");
    setEditSaleDate("");
    setEditAmount("");
    setOperationMode(mode);
    setPaymentMethod("cash");
    setMixedParts([{ method: "cash", amount: "" }]);
    setTotalAmount("");
    setDepositAmount("");
    setDepositMethod("transfer");
    setOrderDueDate("");
    setOrderDeliveryDate("");
    setOrderStatus("confirmed");
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerId("");
    setPanel("new");
  }

  function openEditPanel(sale: SaleSummary) {
    setError(undefined);
    setEditingSale(sale);
    setEditDescription(sale.description);
    setEditSaleDate(sale.saleDate);
    setEditAmount(sale.amount.toFixed(2));
    setPanel("edit");
  }

  async function submitSale(formData: FormData) {
    const method = String(formData.get("paymentMethod") ?? "cash");
    const paymentParts = method === "mixed"
      ? mixedParts.map((p) => ({ method: p.method, amount: parseFloat(p.amount) || 0 })).filter((p) => p.amount > 0)
      : [];

    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: String(formData.get("description") ?? ""),
        amount: totalAmount,
        saleDate: String(formData.get("saleDate") ?? ""),
        category: String(formData.get("category") ?? "local"),
        paymentMethod: method,
        paymentParts,
        relatedCustomerId: String(formData.get("relatedCustomerId") ?? ""),
        relatedOrderId: String(formData.get("relatedOrderId") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      }),
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) { setError(data?.error ?? "No se pudo registrar la venta."); return; }
    setNotice(data?.message ?? "Venta registrada correctamente.");
    closePanel();
    await fetchSales();
  }

  async function submitSaleEdit() {
    if (!editingSale) return;

    const res = await fetch(`/api/sales/${editingSale.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: editAmount,
        description: editDescription,
        saleDate: editSaleDate,
      }),
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(data?.error ?? "No se pudo actualizar la venta.");
      return;
    }

    setNotice(data?.message ?? "Venta actualizada correctamente.");
    closePanel();
    await fetchSales();
  }

  async function submitSaleDelete() {
    if (!editingSale) return;

    const confirmed = window.confirm("¿Querés anular esta venta? Se revertirá su impacto en caja y cuenta corriente.");
    if (!confirmed) return;

    const res = await fetch(`/api/sales/${editingSale.id}`, {
      method: "DELETE",
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) {
      setError(data?.error ?? "No se pudo anular la venta.");
      return;
    }

    setNotice(data?.message ?? "Venta anulada correctamente.");
    closePanel();
    await fetchSales();
  }

  async function submitOrder(formData: FormData) {
    const saleMode = isOnAccount ? "account" : "paid";
    if (saleMode === "paid" && parsedDeposit < parsedTotal) {
      setError("Si el pedido está cobrado completo, la seña debe igual al total.");
      return;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: String(formData.get("relatedCustomerId") ?? ""),
        productName: String(formData.get("description") ?? ""),
        totalAmount: parsedTotal,
        depositAmount: parsedDeposit,
        paymentMethod: depositMethod,
        saleMode,
        dueDate: isOnAccount ? orderDueDate : undefined,
        deliveryDate: orderDeliveryDate || undefined,
        status: orderStatus,
        notes: String(formData.get("notes") ?? ""),
      }),
    });

    const data = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!res.ok) { setError(data?.error ?? "No se pudo registrar el pedido."); return; }
    setNotice(data?.message ?? "Pedido registrado correctamente.");
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
    (sum, s) => sum + s.payments.filter((p) => p.method === "transferencia").reduce((ps, p) => ps + p.amount, 0), 0,
  );
  const filteredSales = sales.filter((s) => {
    if (methodFilter === "all") return true;
    if (methodFilter === "mixto") return s.method === "mixto";
    return s.payments.some((p) => p.method === methodFilter);
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
              Cada venta impacta en caja. Las ventas a cuenta generan deuda en la cuenta corriente del cliente.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => openCreatePanel("sale")}
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
          <button key={m} onClick={() => setMethodFilter(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${methodFilter === m ? "bg-[var(--primary)] text-white" : "border border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"}`}
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
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--success)]">{formatCurrency(sale.amount)}</p>
                {canEdit && sale.editable && (
                  <button
                    type="button"
                    onClick={() => openEditPanel(sale)}
                    className="rounded-full border border-[var(--border-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                  >
                    Corregir venta
                  </button>
                )}
                {canEdit && !sale.editable && (
                  <span className="rounded-full border border-[var(--border-soft)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    Vencida
                  </span>
                )}
              </div>
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
                <p className="section-kicker">{panel === "edit" ? "Corrección de venta" : "Nueva operación"}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  {panel === "edit" ? "Corregir venta" : "Registrar venta"}
                </h2>
              </div>
              <button onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {panel === "edit" ? (
              !canEdit ? (
                <p className="rounded-[22px] border border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Tu perfil no tiene permiso para corregir ventas.
                </p>
              ) : !editingSale ? (
                <p className="rounded-[22px] border border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  No se encontró la venta seleccionada.
                </p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(undefined);
                    startTransition(async () => {
                      await submitSaleEdit();
                    });
                  }}
                  className="overlay-panel-form"
                >
                    <div className="space-y-4">
                      <div className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{editingSale.description}</p>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {editingSale.date} · {PAYMENT_LABELS[editingSale.method] ?? editingSale.method}
                        </p>
                        <p className="mt-3 text-sm text-[var(--text-secondary)]">
                          Monto actual: <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(editingSale.amount)}</span>
                        </p>
                      </div>

                    <div>
                      <label className="field-label" htmlFor="editDescription">
                        Descripción
                      </label>
                      <input
                        id="editDescription"
                        name="editDescription"
                        type="text"
                        required
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="field-label" htmlFor="editSaleDate">
                        Fecha
                      </label>
                      <input
                        id="editSaleDate"
                        name="editSaleDate"
                        type="date"
                        required
                        value={editSaleDate}
                        onChange={(e) => setEditSaleDate(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    <div>
                      <label className="field-label" htmlFor="editAmount">
                        Nuevo importe
                      </label>
                      <input
                        id="editAmount"
                        name="editAmount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="field-input"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                        Caja / cuenta
                      </span>
                      {editingSale.deletable ? (
                        <span className="rounded-full border border-[rgba(184,90,90,0.22)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                          Anulable
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
                          Solo pedidos
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overlay-panel-actions">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isPending ? "Guardando..." : "Guardar corrección"}
                      </button>
                    {editingSale.deletable && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(undefined);
                          startTransition(async () => {
                            await submitSaleDelete();
                          });
                        }}
                        disabled={isPending}
                        className="rounded-full border border-[rgba(184,90,90,0.35)] px-4 py-3 text-sm font-semibold text-[var(--danger)] transition hover:border-[rgba(184,90,90,0.55)] hover:bg-[rgba(184,90,90,0.08)] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isPending ? "Anulando..." : "Anular venta"}
                      </button>
                    )}
                  </div>
                </form>
              )
            ) : !canCreate ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para registrar ventas.
              </p>
            ) : (
              <>
                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-1.5">
                  <button type="button" onClick={() => setOperationMode("sale")}
                    className={`rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                      operationMode === "sale"
                        ? "bg-[var(--primary)] text-white shadow-[0_6px_16px_rgba(45,76,57,0.3)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Venta directa
                  </button>
                  <button type="button" onClick={() => setOperationMode("order")}
                    className={`rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                      operationMode === "order"
                        ? "bg-[var(--primary)] text-white shadow-[0_6px_16px_rgba(45,76,57,0.3)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    Con seña · Pedido
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(undefined);
                    startTransition(async () => {
                      const fd = new FormData(e.currentTarget);
                      if (operationMode === "order") await submitOrder(fd);
                      else await submitSale(fd);
                    });
                  }}
                  className="overlay-panel-form"
                >
                  <div className="compact-form-grid">
                    {/* Cliente */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="field-label" htmlFor="relatedCustomerId">
                          Cliente{(operationMode === "order" || needsCustomer) && <span className="ml-1 text-[var(--danger)]">*</span>}
                        </label>
                        <button type="button" onClick={() => setShowNewCustomer((v) => !v)}
                          className="mb-[0.55rem] text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                        >
                          {showNewCustomer ? "Cancelar" : "+ Nuevo cliente"}
                        </button>
                      </div>

                      {showNewCustomer ? (
                        <div className="space-y-2 rounded-[18px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-3">
                          <input
                            type="text" placeholder="Nombre completo *" value={newCustomerName}
                            onChange={(e) => setNewCustomerName(e.target.value)} className="field-input"
                          />
                          <input
                            type="tel" placeholder="Teléfono (opcional)" value={newCustomerPhone}
                            onChange={(e) => setNewCustomerPhone(e.target.value)} className="field-input"
                          />
                          <button type="button" onClick={() => void createInlineCustomer()}
                            disabled={!newCustomerName.trim() || creatingCustomer}
                            className="w-full rounded-full bg-[var(--primary)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:opacity-60"
                          >
                            {creatingCustomer ? "Creando..." : "Crear y seleccionar"}
                          </button>
                        </div>
                      ) : (
                        <select id="relatedCustomerId" name="relatedCustomerId"
                          required={operationMode === "order" || needsCustomer}
                          disabled={loadingCustomers} value={newCustomerId || undefined}
                          onChange={(e) => setNewCustomerId(e.target.value)}
                          className="field-select"
                        >
                          <option value="">{operationMode === "order" ? "Seleccioná un cliente" : "Sin cliente asociado"}</option>
                          {customers.map((c) => (
                            <option key={c.customerId} value={c.customerId}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Descripción */}
                    <div className="md:col-span-2">
                      <label className="field-label" htmlFor="description">
                        {operationMode === "order" ? "Producto / descripción" : "Descripción"}
                      </label>
                      <input id="description" name="description" required className="field-input" />
                    </div>

                    {/* Importe total */}
                    <div>
                      <label className="field-label" htmlFor="amount">
                        {operationMode === "order" ? "Total del pedido" : "Importe"}
                      </label>
                      <input id="amount" name="amount" type="number" min="0.01" step="0.01" required
                        value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="field-input"
                      />
                    </div>

                    {/* --- VENTA DIRECTA --- */}
                    {operationMode === "sale" && (
                      <>
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
                          <select id="paymentMethod" name="paymentMethod" value={paymentMethod}
                            onChange={(e) => { setPaymentMethod(e.target.value); setMixedParts([{ method: "cash", amount: "" }]); }}
                            className="field-select"
                          >
                            {PAYMENT_METHODS.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>

                        {paymentMethod === "account" && parsedTotal > 0 && (
                          <div className="md:col-span-2">
                            <div className="rounded-[18px] border border-[rgba(154,118,85,0.28)] bg-[rgba(123,91,62,0.08)] px-4 py-3 text-sm text-[var(--text-primary)]">
                              Queda <span className="font-semibold">{formatCurrency(parsedTotal)}</span> pendiente en la cuenta corriente del cliente.
                            </div>
                          </div>
                        )}

                        {paymentMethod === "mixed" && (
                          <div className="md:col-span-2">
                            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-[var(--text-primary)]">Distribución del pago</p>
                                {parsedTotal > 0 && (
                                  <p className={`text-xs font-semibold ${Math.abs(mixedRemaining) < 0.01 ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
                                    {Math.abs(mixedRemaining) < 0.01 ? "Suma correcta" : mixedRemaining > 0 ? `Faltan ${formatCurrency(mixedRemaining)}` : `Sobran ${formatCurrency(Math.abs(mixedRemaining))}`}
                                  </p>
                                )}
                              </div>
                              <div className="mt-4 space-y-3">
                                {mixedParts.map((part, index) => {
                                  const optionsForThisPart = MIXED_OPTIONS.filter((o) => o.value === part.method || !usedMethods.has(o.value));
                                  return (
                                    <div key={index} className="flex items-center gap-2">
                                      <select value={part.method} onChange={(e) => updateMixedPart(index, "method", e.target.value)} className="field-select flex-1">
                                        {optionsForThisPart.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                      </select>
                                      <input type="number" min="0.01" step="0.01" placeholder="0.00"
                                        value={part.amount} onChange={(e) => updateMixedPart(index, "amount", e.target.value)}
                                        className="field-input w-36 shrink-0"
                                      />
                                      {mixedParts.length > 2 && (
                                        <button type="button" onClick={() => removeMixedPart(index)}
                                          className="shrink-0 rounded-full border border-[var(--border-soft)] px-3 py-2 text-xs text-[var(--text-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                                        >×</button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {availableMixedOptions.length > 0 && (
                                <button type="button" onClick={addMixedPart}
                                  className="mt-3 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                                >+ Agregar medio de pago</button>
                              )}
                            </div>
                          </div>
                        )}

                        {!needsCustomer && (
                          <div>
                            <label className="field-label" htmlFor="relatedOrderId">Pedido relacionado</label>
                            <select id="relatedOrderId" name="relatedOrderId" disabled={loadingOrders} className="field-select">
                              <option value="">Sin pedido asociado</option>
                              {orders.map((o) => <option key={o.id} value={o.id}>{o.customer} · {o.product}</option>)}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* --- PEDIDO CON SEÑA --- */}
                    {operationMode === "order" && (
                      <>
                        <div>
                          <label className="field-label" htmlFor="depositAmount">Seña cobrada ahora</label>
                          <input id="depositAmount" name="depositAmount" type="number" min="0" step="0.01"
                            value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0.00" className="field-input"
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="depositMethod">Medio de cobro de la seña</label>
                          <select id="depositMethod" value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)} className="field-select">
                            {DEPOSIT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>

                        {parsedTotal > 0 && (
                          <div className="md:col-span-2">
                            <div className={`rounded-[18px] border px-4 py-3 text-sm ${isOnAccount ? "border-[rgba(154,118,85,0.28)] bg-[rgba(123,91,62,0.08)] text-[var(--text-primary)]" : "border-[rgba(93,143,108,0.3)] bg-[rgba(93,143,108,0.08)] text-[var(--success)]"}`}>
                              {isOnAccount
                                ? <>Saldo restante <span className="font-semibold">{formatCurrency(remainingBalance)}</span> — queda a cuenta del cliente.</>
                                : "Pedido cobrado completo. No queda saldo pendiente."}
                            </div>
                          </div>
                        )}

                        {isOnAccount && (
                          <div>
                            <label className="field-label" htmlFor="orderDueDate">Fecha de vencimiento</label>
                            <input id="orderDueDate" name="orderDueDate" type="date" required
                              value={orderDueDate} onChange={(e) => setOrderDueDate(e.target.value)}
                              className="field-input"
                            />
                          </div>
                        )}

                        <div>
                          <label className="field-label" htmlFor="orderDeliveryDate">Fecha de entrega (opcional)</label>
                          <input id="orderDeliveryDate" type="date"
                            value={orderDeliveryDate} onChange={(e) => setOrderDeliveryDate(e.target.value)}
                            className="field-input"
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="orderStatus">Estado inicial</label>
                          <select id="orderStatus" value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="field-select">
                            <option value="confirmed">Confirmado / Señado</option>
                            <option value="in_progress">En proceso</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="md:col-span-2">
                      <label className="field-label" htmlFor="notes">Notas</label>
                      <textarea id="notes" name="notes" className="field-textarea resize-none" style={{ minHeight: 64 }} />
                    </div>
                  </div>

                  <div className="overlay-panel-actions">
                    <button type="submit" disabled={isPending || loadingCustomers}
                      className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isPending ? "Guardando..." : operationMode === "order" ? "Registrar pedido" : "Guardar venta"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
