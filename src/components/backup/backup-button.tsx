"use client";

import { useState } from "react";

export function BackupButton({ lastBackupAt }: { lastBackupAt: string | null }) {
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string>();

  async function handleBackup() {
    setStatus("loading");
    setMessage(undefined);
    const response = await fetch("/api/backup", { method: "POST" });
    const data = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    if (!response.ok) {
      setStatus("error");
      setMessage(data?.error ?? "No se pudo crear el backup.");
    } else {
      setStatus("ok");
      setMessage(data?.message ?? "Backup creado correctamente.");
    }
  }

  const lastBackup = lastBackupAt
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(lastBackupAt))
    : "Nunca";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Último backup</p>
          <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{lastBackup}</p>
        </div>
        <button
          onClick={() => void handleBackup()}
          disabled={status === "loading"}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Creando backup..." : "Hacer backup ahora"}
        </button>
      </div>
      {message ? (
        <p
          className={`text-sm ${status === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
