"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/format";

type Props = { previousClosing?: number };

export function OpenCashButton({ previousClosing }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [openingAmount, setOpeningAmount] = useState(
    previousClosing != null ? String(previousClosing) : "0"
  );
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => { setMounted(true); }, []);

  function handleOpen() {
    setOpen(true);
    setConfirmed(false);
    setError(undefined);
    setOpeningAmount(previousClosing != null ? String(previousClosing) : "0");
  }

  function handleClose() {
    setOpen(false);
    setConfirmed(false);
  }

  function handleConfirm() {
    const parsed = parseFloat(openingAmount.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(undefined);
    setConfirmed(true);
  }

  function handleSubmit() {
    const parsed = parseFloat(openingAmount.replace(",", "."));
    startTransition(async () => {
      const res = await fetch("/api/cash/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingAmount: parsed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo abrir la caja.");
        setConfirmed(false);
        return;
      }
      handleClose();
      router.refresh();
    });
  }

  const parsed = parseFloat(openingAmount.replace(",", "."));
  const isValid = !isNaN(parsed) && parsed >= 0;
  const diffVsPrevious = previousClosing != null && isValid
    ? Math.round((parsed - previousClosing) * 100) / 100
    : null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-4 rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
      >
        Abrir caja
      </button>

      {mounted && open && createPortal(
        <div className="overlay-panel-shell">
          <button className="overlay-panel-dismiss" onClick={handleClose} aria-label="Cerrar" />
          <div className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">Inicio del turno</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  Abrir caja
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                Cancelar
              </button>
            </div>

            <div className="overlay-panel-form">
              {!confirmed ? (
                <>
                  {previousClosing != null && (
                    <div className="surface-muted rounded-[22px] p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Cierre anterior
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                        {formatCurrency(previousClosing)}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="field-label" htmlFor="opening-amount">
                      Efectivo en caja al abrir
                    </label>
                    <input
                      id="opening-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      className="field-input"
                      autoFocus
                    />
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                      Contá el efectivo físico en la caja. Puede diferir del cierre anterior por retiros,
                      gastos u otros movimientos no registrados aún en el sistema.
                    </p>
                  </div>

                  {diffVsPrevious !== null && Math.abs(diffVsPrevious) > 0.01 && (
                    <div className={`rounded-[18px] border px-4 py-3 text-sm ${
                      diffVsPrevious > 0
                        ? "border-[rgba(125,153,134,0.3)] bg-[rgba(125,153,134,0.08)] text-[var(--info)]"
                        : "border-[rgba(168,106,97,0.3)] bg-[rgba(168,106,97,0.08)] text-[var(--danger)]"
                    }`}>
                      {diffVsPrevious > 0
                        ? `${formatCurrency(diffVsPrevious)} más que el cierre anterior.`
                        : `${formatCurrency(Math.abs(diffVsPrevious))} menos que el cierre anterior.`}
                    </div>
                  )}

                  {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

                  <div className="overlay-panel-actions">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={!isValid}
                      className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Confirmar monto
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="surface-walnut rounded-[22px] p-5 text-center">
                    <p className="text-sm text-[rgba(237,242,237,0.72)]">Efectivo inicial confirmado</p>
                    <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
                      {formatCurrency(parsed)}
                    </p>
                  </div>

                  <p className="text-sm text-[var(--text-secondary)]">
                    Al confirmar se abre la caja del día con este monto como saldo inicial.
                  </p>

                  {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

                  <div className="flex gap-3 overlay-panel-actions">
                    <button
                      type="button"
                      onClick={() => setConfirmed(false)}
                      disabled={isPending}
                      className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
                    >
                      Modificar
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isPending}
                      className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPending ? "Abriendo..." : "Abrir caja"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
