"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type VersionInfo = {
  packageVersion: string;
  gitCommit: string | null;
  gitBranch: string | null;
  gitAvailable: boolean;
  repoSlug: string;
  branch: string;
};

type UpdateState = {
  status: string;
  detail: string;
  updatedAt: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Listo",
  respaldo: "Respaldo",
  descargando: "Descargando",
  extrayendo: "Extrayendo",
  copiando: "Reemplazando",
  dependencias: "Instalando",
  generando: "Prisma",
  compilando: "Compilando",
  reiniciando: "Reiniciando",
  completado: "Completado",
  fallo: "Fallo",
  restaurando: "Restaurando",
};

const STATUS_PROGRESS: Record<string, number> = {
  idle: 0,
  respaldo: 10,
  descargando: 25,
  extrayendo: 35,
  copiando: 55,
  dependencias: 70,
  generando: 82,
  compilando: 90,
  reiniciando: 96,
  completado: 100,
  fallo: 100,
  restaurando: 88,
};

function isActiveUpdateStatus(status?: string) {
  return Boolean(
    status &&
      [
        "respaldo",
        "descargando",
        "extrayendo",
        "copiando",
        "dependencias",
        "generando",
        "compilando",
        "reiniciando",
        "restaurando",
      ].includes(status),
  );
}

export function SystemUpdateCard({ versionInfo }: { versionInfo: VersionInfo }) {
  const [message, setMessage] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPending, startTransition] = useTransition();

  const status = updateState?.status ?? "idle";
  const targetProgress = useMemo(() => STATUS_PROGRESS[status] ?? 0, [status]);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const res = await fetch("/api/system/update", { cache: "no-store" });
        if (!res.ok) return;

        const data = (await res.json()) as UpdateState;
        if (!active) return;

        setUpdateState(data);
      } catch {
        // silencio intencional
      }
    }

    void refresh();

    const interval = setInterval(() => {
      if (isPending || isActiveUpdateStatus(updateState?.status)) {
        void refresh();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isPending, updateState?.status]);

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => {
      if (!active) return;
      setProgress((current) => {
        if (current >= targetProgress) return current;
        const step = targetProgress >= 90 ? 2 : 4;
        return Math.min(current + step, targetProgress);
      });
    }, 120);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [targetProgress]);

  function handleUpdate() {
    setMessage(undefined);
    setError(undefined);

    startTransition(async () => {
      const res = await fetch("/api/system/update", {
        method: "POST",
      });

      const data = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;

      if (!res.ok) {
        setError(data?.error ?? "No se pudo actualizar el sistema.");
        return;
      }

      setMessage(data?.message ?? "Sistema actualizado.");
    });
  }

  return (
    <section className="page-frame rounded-[28px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker">Sistema</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            Version instalada
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Desde aca ves que esta corriendo y podes traer la ultima version desde GitHub.
          </p>
        </div>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isPending}
          className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Actualizando..." : "Actualizar desde GitHub"}
        </button>
      </div>

      <div className="mt-4 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Estado: {STATUS_LABELS[status] ?? status}
          </p>
          {updateState?.updatedAt ? (
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {new Date(updateState.updatedAt).toLocaleString("es-AR")}
            </p>
          ) : null}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--primary),#80a489)] transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <span>Avance estimado</span>
          <span>{progress}%</span>
        </div>
        {updateState?.detail ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{updateState.detail}</p>
        ) : null}
      </div>

      {(message || error) && (
        <div className="mt-4 rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm">
          <p className={error ? "text-[var(--danger)]" : "text-[var(--success)]"}>{error ?? message}</p>
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <article className="surface-muted rounded-[22px] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Version</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {versionInfo.packageVersion}
          </p>
        </article>
        <article className="surface-muted rounded-[22px] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Fuente</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {versionInfo.repoSlug}@{versionInfo.branch}
          </p>
        </article>
        <article className="surface-muted rounded-[22px] p-4">
          <p className="text-sm text-[var(--text-secondary)]">Commit</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
            {versionInfo.gitAvailable ? versionInfo.gitCommit ?? "-" : "-"}
          </p>
        </article>
      </div>
    </section>
  );
}
