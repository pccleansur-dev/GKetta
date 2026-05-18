"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatCurrency } from "@/lib/format";

export function CloseCashButton({ expectedAmount }: { expectedAmount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [closingAmount, setClosingAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ difference: number; backupFile: string } | null>(null);
  const [error, setError] = useState<string>();

  const parsed = parseFloat(closingAmount.replace(",", "."));
  const difference = isNaN(parsed) ? null : parsed - expectedAmount;

  function handleOpen() {
    setOpen(true);
    setClosingAmount("");
    setNotes("");
    setResult(null);
    setError(undefined);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSubmit() {
    if (isNaN(parsed) || parsed < 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/cash/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingAmount: parsed, notes: notes.trim() || undefined }),
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

  return (
    <>
      <button
        onClick={handleOpen}
        className="mt-4 rounded-full bg-[var(--text-primary)] px-4 py-3 text-sm font-semibold text-[var(--background)] transition hover:bg-[#ffffff]"
      >
        Cerrar caja
      </button>

      {open && (
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
              <div className="flex flex-1 flex-col gap-4 pt-2">
                <div className="surface-muted rounded-[22px] p-5 text-center">
                  <p className="text-sm text-[var(--text-secondary)]">Diferencia registrada</p>
                  <p
                    className={`mt-2 text-3xl font-semibold tracking-[-0.04em] ${
                      result.difference === 0
                        ? "text-[var(--success)]"
                        : result.difference > 0
                          ? "text-[var(--info)]"
                          : "text-[var(--danger)]"
                    }`}
                  >
                    {result.difference > 0 ? "+" : ""}
                    {formatCurrency(result.difference)}
                  </p>
                </div>
                <div className="rounded-[18px] border border-[rgba(93,143,108,0.3)] bg-[rgba(93,143,108,0.08)] px-4 py-3 text-sm text-[var(--success)]">
                  Caja cerrada. Backup generado: {result.backupFile}
                </div>
                <button
                  onClick={handleClose}
                  className="mt-auto rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                >
                  Listo
                </button>
              </div>
            ) : (
              <div className="overlay-panel-form">
                <div className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Caja esperada</p>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {formatCurrency(expectedAmount)}
                  </p>
                </div>

                <div>
                  <label className="field-label" htmlFor="closing-amount">
                    Monto real contado
                  </label>
                  <input
                    id="closing-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={closingAmount}
                    onChange={(e) => setClosingAmount(e.target.value)}
                    placeholder="0.00"
                    className="field-input"
                  />
                </div>

                {difference !== null && (
                  <div
                    className={`rounded-[18px] px-4 py-3 text-sm font-semibold ${
                      difference === 0
                        ? "border border-[rgba(93,143,108,0.3)] bg-[rgba(93,143,108,0.08)] text-[var(--success)]"
                        : difference > 0
                          ? "border border-[rgba(125,153,134,0.3)] bg-[rgba(125,153,134,0.08)] text-[var(--info)]"
                          : "border border-[rgba(168,106,97,0.3)] bg-[rgba(168,106,97,0.08)] text-[var(--danger)]"
                    }`}
                  >
                    {difference === 0
                      ? "La caja cuadra exacto."
                      : difference > 0
                        ? `Sobrante: ${formatCurrency(difference)}`
                        : `Faltante: ${formatCurrency(Math.abs(difference))}`}
                  </div>
                )}

                <div>
                  <label className="field-label" htmlFor="closing-notes">
                    Observaciones (opcional)
                  </label>
                  <textarea
                    id="closing-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Diferencias, retiros, notas del turno..."
                    className="field-textarea"
                  />
                </div>

                {error && (
                  <p className="text-sm text-[var(--danger)]">{error}</p>
                )}

                <div className="overlay-panel-actions">
                  <button
                    onClick={handleSubmit}
                    disabled={isPending || closingAmount === ""}
                    className="rounded-full bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Cerrando..." : "Confirmar cierre"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
