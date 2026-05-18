"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CustomerOption = {
  id: string;
  customerId: string;
  name: string;
  phone: string;
};

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function ManualReminderButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: CustomerOption[]) => {
        setCustomers(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => {});
  }, [open]);

  function handleOpen() {
    setOpen(true);
    setMessage("");
    setSent(false);
  }

  function handleClose() {
    setOpen(false);
  }

  const selected = customers.find((c) => c.id === selectedId);
  const phone = selected ? normalizePhone(selected.phone) : "";
  const whatsappLink =
    phone && message.trim()
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`
      : null;

  function handleSend() {
    if (!whatsappLink || !selected) return;
    void fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: selected.customerId,
        reminderType: "manual",
        whatsappLink,
        messagePreview: message.trim(),
      }),
    });
    setSent(true);
    window.open(whatsappLink, "_blank", "noreferrer");
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
      >
        Mensaje manual
      </button>

      {mounted && open && createPortal(
        <div className="overlay-panel-shell" style={{ zIndex: 60 }}>
          <button className="overlay-panel-dismiss" onClick={handleClose} aria-label="Cerrar" />
          <div className="overlay-panel" style={{ maxHeight: "100dvh", overflowY: "auto" }}>
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">WhatsApp</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                  Mensaje manual
                </h2>
              </div>
              <button
                onClick={handleClose}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
              >
                Cancelar
              </button>
            </div>

            <div className="flex flex-col gap-4 pb-4">
              <div>
                <label className="field-label" htmlFor="manual-customer">
                  Cliente
                </label>
                <select
                  id="manual-customer"
                  value={selectedId}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setSent(false);
                  }}
                  className="field-select"
                >
                  <option value="" disabled>
                    Seleccioná un cliente
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label" htmlFor="manual-message">
                  Mensaje
                </label>
                <textarea
                  id="manual-message"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setSent(false);
                  }}
                  placeholder="Escribí el mensaje que querés enviar..."
                  className="field-textarea"
                  style={{ minHeight: 120, maxHeight: 200 }}
                />
              </div>

              {sent && (
                <div className="rounded-[18px] border border-[rgba(93,143,108,0.3)] bg-[rgba(93,143,108,0.08)] px-4 py-3 text-sm text-[var(--success)]">
                  Mensaje enviado y registrado.
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-xs text-[var(--text-muted)]">
                  {selected && phone ? `+${phone}` : "Seleccioná un cliente"}
                </p>
                <button
                  onClick={handleSend}
                  disabled={!whatsappLink || sent}
                  title="Abrir en WhatsApp"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_8px_20px_rgba(45,76,57,0.3)] transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
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
