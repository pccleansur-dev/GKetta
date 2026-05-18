"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/format";

type Props = {
  expectedAmount: number;
  expectedCash: number;
  expectedTransfer: number;
  expectedCard: number;
};

export function CloseCashButton({ expectedAmount, expectedCash, expectedTransfer, expectedCard }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [cardAmount, setCardAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ difference: number; backupFile: string } | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => { setMounted(true); }, []);

  const parsedCash = parseFloat(cashAmount.replace(",", ".")) || 0;
  const parsedTransfer = parseFloat(transferAmount.replace(",", ".")) || 0;
  const parsedCard = parseFloat(cardAmount.replace(",", ".")) || 0;
  const totalReal = Math.round((parsedCash + parsedTransfer + parsedCard) * 100) / 100;
  const difference = totalReal > 0 || cashAmount || transferAmount || cardAmount
    ? Math.round((totalReal - expectedAmount) * 100) / 100
    : null;

  function handleOpen() {
    setOpen(true);
    setCashAmount("");
    setTransferAmount("");
    setCardAmount("");
    setNotes("");
    setResult(null);
    setError(undefined);
  }

  function handleClose() { setOpen(false); }

  function handleSubmit() {
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/cash/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashAmount: parsedCash,
          transferAmount: parsedTransfer,
          cardAmount: parsedCard,
          notes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        difference?: number;
        backupFile?: string;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo cerrar la caja.");
        return;
      }
      setResult({ difference: data?.difference ?? 0, backupFile: data?.backupFile ?? "" });
      router.refresh();
    });
  }

  const diffColor = (real: number, expected: number) => {
    const d = real - expected;
    if (Math.abs(d) < 0.01) return "text-[var(--success)]";
    return d > 0 ? "text-[var(--info)]" : "text-[var(--danger)]";
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-4 rounded-full bg-[var(--text-primary)] px-4 py-3 text-sm font-semibold text-[var(--background)] transition hover:bg-[#ffffff]"
      >
        Cerrar caja
      </button>

      {mounted && open && createPortal(
        <div className="overlay-panel-shell">
          <button className="overlay-panel-dismiss" onClick={handleClose} aria-label="Cerrar" />
          <div className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">Caja del día</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  Cerrar caja
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                Cancelar
              </button>
            </div>

            {result ? (
              <div className="overlay-panel-form">
                <div className="surface-muted rounded-[22px] p-5 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">Diferencia registrada</p>
                  <p className={`mt-2 text-3xl font-semibold tracking-[-0.04em] ${result.difference === 0 ? "text-[var(--success)]" : result.difference > 0 ? "text-[var(--info)]" : "text-[var(--danger)]"}`}>
                    {result.difference > 0 ? "+" : ""}{formatCurrency(result.difference)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(93,143,108,0.3)] bg-[rgba(93,143,108,0.08)] px-4 py-3 text-sm text-[var(--success)]">
                  Caja cerrada. Backup generado: {result.backupFile}
                </div>
                <div className="overlay-panel-actions">
                  <button onClick={handleClose} className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]">
                    Listo
                  </button>
                </div>
              </div>
            ) : (
              <div className="overlay-panel-form">
                {/* Header tabla */}
                <div className="grid grid-cols-3 gap-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  <span>Medio</span>
                  <span className="text-right">Registrado</span>
                  <span className="text-right">Real contado</span>
                </div>

                {/* Efectivo */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Efectivo</span>
                  <span className="text-right text-sm text-[var(--text-secondary)]">{formatCurrency(expectedCash)}</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
                    className="field-input text-right"
                  />
                </div>

                {/* Transferencia */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Transferencia</span>
                  <span className="text-right text-sm text-[var(--text-secondary)]">{formatCurrency(expectedTransfer)}</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                    className="field-input text-right"
                  />
                </div>

                {/* Tarjeta */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">Tarjeta</span>
                  <span className="text-right text-sm text-[var(--text-secondary)]">{formatCurrency(expectedCard)}</span>
                  <input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={cardAmount} onChange={(e) => setCardAmount(e.target.value)}
                    className="field-input text-right"
                  />
                </div>

                {/* Totales */}
                <div className="mt-1 rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Total registrado</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(expectedAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">Total real</span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatCurrency(totalReal)}</span>
                  </div>
                  {difference !== null && (
                    <div className="mt-2 flex items-center justify-between border-t border-[var(--border-soft)] pt-2 text-sm">
                      <span className="text-[var(--text-secondary)]">Diferencia</span>
                      <span className={`font-semibold ${diffColor(totalReal, expectedAmount)}`}>
                        {difference > 0 ? "+" : ""}{formatCurrency(difference)}
                        {Math.abs(difference) < 0.01 ? " · cuadra" : difference > 0 ? " · sobrante" : " · faltante"}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="field-label" htmlFor="closing-notes">Observaciones (opcional)</label>
                  <textarea
                    id="closing-notes"
                    value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Diferencias, retiros, notas del turno..."
                    className="field-textarea resize-none" style={{ minHeight: 64 }}
                  />
                </div>

                {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

                <div className="overlay-panel-actions">
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Cerrando..." : "Confirmar cierre"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
