import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getAuditLogsData, getUsersData } from "@/server/queries";
import { canViewAuditLogs, getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const actionLabels: Record<string, string> = {
  all: "Todas",
  create: "Creación",
  update: "Actualización",
  password_update: "Cambio de clave",
  payment: "Pago",
};

const roleLabels: Record<string, string> = {
  owner: "Dueño",
  manager: "Encargada",
  staff: "Empleada",
};

const entityLabels: Record<string, string> = {
  all: "Todas",
  customer: "Cliente",
  account_movement: "Pago",
  order: "Pedido",
  sale: "Venta",
  user: "Usuario",
};

export default async function AuditoriaPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : undefined;
  const action = readSingle(params?.action) ?? "all";
  const entity = readSingle(params?.entity) ?? "all";
  const actorUserId = readSingle(params?.actorUserId) ?? "all";

  const currentUser = await getSessionUser();
  const canView = currentUser ? canViewAuditLogs(currentUser.role) : false;
  const [auditData, usersData] = await Promise.all([
    getAuditLogsData({
      action: action === "all" ? undefined : action,
      entityName: entity === "all" ? undefined : entity,
      actorUserId: actorUserId === "all" ? undefined : actorUserId,
      limit: 80,
    }),
    getUsersData(),
  ]);
  const { logs, summary } = auditData;

  return (
    <DashboardShell>
      <main className="flex flex-col gap-6">
        <section className="page-frame rounded-[30px] p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5">
            <div>
              <p className="section-kicker">Auditoría</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Registro visible de cambios
              </h1>
              <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                Cada alta, edición y pago deja una traza con usuario, entidad afectada y fecha.
              </p>
            </div>
            {canView ? null : (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil puede operar el sistema, pero no ver el historial completo.
              </p>
            )}
          </div>

          {canView ? (
            <>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <article className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Registros</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                    {summary.total}
                  </p>
                </article>
                <article className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Altas</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--success)]">
                    {summary.creates}
                  </p>
                </article>
                <article className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Ediciones</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--warning)]">
                    {summary.updates}
                  </p>
                </article>
                <article className="surface-muted rounded-[22px] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Últimas 24 hs</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--info)]">
                    {summary.recent}
                  </p>
                </article>
              </div>

              <form method="get" className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="field-label" htmlFor="entity">
                    Entidad
                  </label>
                  <select id="entity" name="entity" defaultValue={entity} className="field-select">
                    {Object.entries(entityLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="action">
                    Acción
                  </label>
                  <select id="action" name="action" defaultValue={action} className="field-select">
                    {Object.entries(actionLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="actorUserId">
                    Usuario
                  </label>
                  <select
                    id="actorUserId"
                    name="actorUserId"
                    defaultValue={actorUserId}
                    className="field-select"
                  >
                    <option value="all">Todos</option>
                    {usersData.users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-3">
                  <button type="submit" className="w-full rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]">
                    Filtrar
                  </button>
                  <Link
                    href="/auditoria"
                    className="w-full rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
                  >
                    Limpiar
                  </Link>
                </div>
              </form>

              <section className="mt-5 space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">
                    No hay registros para los filtros aplicados.
                  </p>
                ) : null}
                {logs.map((log) => (
                  <article key={log.id} className="surface-muted rounded-[22px] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-base font-semibold text-[var(--text-primary)]">
                            {log.actor}
                          </p>
                          <span className="rounded-full bg-[rgba(45,76,57,0.16)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                            {roleLabels[log.actorRole] ?? log.actorRole}
                          </span>
                          <span className="rounded-full bg-[rgba(154,118,85,0.14)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                            {log.actionLabel}
                          </span>
                          <span className="rounded-full bg-[rgba(125,153,134,0.14)] px-3 py-1 text-xs font-semibold text-[var(--info)]">
                            {log.entity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{log.summary}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {log.entityName} · {log.entityId}
                        </p>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{log.date}</p>
                    </div>
                  </article>
                ))}
              </section>
            </>
          ) : null}
        </section>
      </main>
    </DashboardShell>
  );
}
