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
    previousClosing != null ? String(previousClosing) : ""
  );
  const [error, setError] = useState<string>();

  useEffect(() => { setMounted(true); }, []);

  function handleOpen() {
    setOpen(true);
    setError(undefined);
  }

  function handleClose() { setOpen(false); }

  function handleSubmit() {
    const parsed = parseFloat(openingAmount.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/cash/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingAmount: parsed }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo abrir la caja.");
        return;
      }
      handleClose();
      router.refresh();
    });
  }

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
              {previousClosing != null && (
                <div className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Cierre anterior</p>
                  <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {formatCurrency(previousClosing)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Monto sugerido como fondo inicial de efectivo.
                  </p>
                </div>
              )}

              <div>
                <label className="field-label" htmlFor="opening-amount">
                  Fondo inicial en efectivo
                </label>
                <input
                  id="opening-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                  className="field-input"
                />
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  ¿Cuánto efectivo hay en la caja al iniciar el turno?
                </p>
              </div>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

              <div className="overlay-panel-actions">
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Abriendo..." : "Abrir caja"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
