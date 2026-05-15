"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { PasswordField } from "@/components/ui/password-field";

type UserSummary = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  passwordStatus: string;
  updatedAt: string;
};

type UsersSummary = {
  total: number;
  active: number;
  owners: number;
  managers: number;
  staff: number;
};

type UsersPageClientProps = {
  canManage: boolean;
  currentUserId: string;
  initialPanel?: "new" | "edit" | null;
  initialUserId?: string | null;
};

const roleLabels: Record<string, string> = {
  owner: "Administrador",
  manager: "Encargada",
  staff: "Empleada",
};

export function UsersPageClient({
  canManage,
  currentUserId,
  initialPanel = null,
  initialUserId = null,
}: UsersPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [summary, setSummary] = useState<UsersSummary>({
    total: 0,
    active: 0,
    owners: 0,
    managers: 0,
    staff: 0,
  });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [panel, setPanel] = useState<"new" | "edit" | null>(() => {
    if (initialPanel === "new" && canManage) return "new";
    if (initialPanel === "edit" && canManage && initialUserId) return "edit";
    return null;
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialPanel === "edit" ? (initialUserId ?? null) : null,
  );
  const [isPending, startTransition] = useTransition();

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  async function fetchUsers() {
    const response = await fetch("/api/users", { cache: "no-store" });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudieron cargar los usuarios.");
      setLoadingUsers(false);
      return;
    }

    const data = (await response.json()) as { users: UserSummary[]; summary: UsersSummary };
    setUsers(data.users);
    setSummary(data.summary);
    setLoadingUsers(false);
  }

  function clearPanelUrl() {
    router.replace(pathname, { scroll: false });
  }

  function closePanel() {
    setPanel(null);
    setSelectedUserId(null);
    clearPanelUrl();
  }

  function openCreatePanel() {
    setError(undefined);
    setPanel("new");
  }

  function openEditPanel(userId: string) {
    setError(undefined);
    setSelectedUserId(userId);
    setPanel("edit");
  }

  async function toggleStatus(userId: string) {
    setTogglingId(userId);
    const response = await fetch(`/api/users/${userId}/toggle-status`, { method: "POST" });
    const data = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    setTogglingId(null);

    if (!response.ok) {
      setError(data?.error ?? "No se pudo cambiar el estado.");
      return;
    }

    setNotice(data?.message ?? "Estado actualizado.");
    await fetchUsers();
  }

  async function submitCreate(formData: FormData) {
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      username: String(formData.get("username") ?? ""),
      role: String(formData.get("role") ?? "staff"),
      isActive: String(formData.get("isActive") ?? "true") === "true",
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo crear el usuario.");
      return;
    }

    setNotice(data?.message ?? "Usuario creado correctamente.");
    closePanel();
    await fetchUsers();
  }

  async function submitEdit(formData: FormData) {
    if (!selectedUserId) return;

    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      username: String(formData.get("username") ?? ""),
      role: String(formData.get("role") ?? "staff"),
      isActive: String(formData.get("isActive") ?? "true") === "true",
    };

    const response = await fetch(`/api/users/${selectedUserId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo actualizar el usuario.");
      return;
    }

    setNotice(data?.message ?? "Usuario actualizado correctamente.");
    closePanel();
    await fetchUsers();
  }

  async function submitPassword(formData: FormData) {
    if (!selectedUserId) return;

    const payload = {
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    const response = await fetch(`/api/users/${selectedUserId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      setError(data?.error ?? "No se pudo cambiar la contrasena.");
      return;
    }

    setNotice(data?.message ?? "Contrasena actualizada correctamente.");
    closePanel();
    await fetchUsers();
  }

  useEffect(() => {
    let active = true;

    async function load() {
      const response = await fetch("/api/users", { cache: "no-store" });
      if (!active) return;

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudieron cargar los usuarios.");
        setLoadingUsers(false);
        return;
      }

      const data = (await response.json()) as {
        users: UserSummary[];
        summary: UsersSummary;
      };

      if (!active) return;
      setUsers(data.users);
      setSummary(data.summary);
      setLoadingUsers(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex flex-col gap-6">
      <FeedbackBanner error={error} notice={notice} />

      <section className="page-frame rounded-[30px] p-5 sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Usuarios y roles</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
              Administracion de acceso local
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              Aca se crean usuarios para el login local y se ajustan roles, nombre visible y estado
              activo.
            </p>
          </div>
          {canManage ? (
            <button
              onClick={openCreatePanel}
              className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
            >
              Nuevo usuario
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3 md:grid-cols-5">
          <SummaryCard label="Usuarios" value={summary.total} tone="text-[var(--text-primary)]" />
          <SummaryCard label="Activos" value={summary.active} tone="text-[var(--success)]" />
          <SummaryCard label="Administradores" value={summary.owners} tone="text-[var(--text-primary)]" />
          <SummaryCard label="Encargadas" value={summary.managers} tone="text-[var(--text-primary)]" />
          <SummaryCard label="Empleadas" value={summary.staff} tone="text-[var(--text-primary)]" />
        </div>
      </section>

      {!canManage ? (
        <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
          Tu perfil puede usar el sistema, pero no administrar usuarios y roles.
        </div>
      ) : null}

      <section className="space-y-3">
        {loadingUsers ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            Cargando usuarios...
          </div>
        ) : users.length === 0 ? (
          <div className="page-frame rounded-[28px] p-5 text-sm text-[var(--text-secondary)]">
            No hay usuarios cargados todavia.
          </div>
        ) : (
          users.map((user) => (
            <article key={user.id} className="page-frame rounded-[26px] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-lg font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
                      {user.fullName}
                    </p>
                    <span className="rounded-full bg-[rgba(45,76,57,0.16)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                      {roleLabels[user.role] ?? user.role}
                    </span>
                    {user.id === currentUserId ? (
                      <span className="rounded-full bg-[rgba(154,118,85,0.16)] px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                        Sesion actual
                      </span>
                    ) : null}
                    {!user.isActive ? (
                      <span className="rounded-full bg-[rgba(168,106,97,0.14)] px-3 py-1 text-xs font-semibold text-[var(--danger)]">
                        Inactivo
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{user.email}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {user.passwordStatus}
                  </p>
                </div>

                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void toggleStatus(user.id)}
                      disabled={togglingId === user.id || (user.id === currentUserId && user.isActive)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                        user.id === currentUserId && user.isActive
                          ? "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-muted)]"
                          : user.isActive
                            ? "border border-[rgba(168,106,97,0.28)] bg-[rgba(168,106,97,0.08)] text-[var(--danger)] hover:bg-[rgba(168,106,97,0.14)]"
                            : "border border-[rgba(93,143,108,0.28)] bg-[rgba(93,143,108,0.08)] text-[var(--success)] hover:bg-[rgba(93,143,108,0.14)]"
                      }`}
                    >
                      {togglingId === user.id
                        ? "..."
                        : user.id === currentUserId && user.isActive
                          ? "No disponible"
                          : user.isActive
                            ? "Desactivar"
                            : "Activar"}
                    </button>
                    <button
                      onClick={() => openEditPanel(user.id)}
                      className="rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
                    >
                      Editar
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>

      {panel ? (
        <div className="overlay-panel-shell">
          <button aria-label="Cerrar panel" className="overlay-panel-dismiss" onClick={closePanel} />

          <section role="dialog" aria-modal="true" className="overlay-panel">
            <div className="overlay-panel-header">
              <div>
                <p className="section-kicker">
                  {panel === "new" ? "Nuevo usuario" : "Editar usuario"}
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-primary)] sm:text-2xl">
                  {panel === "new" ? "Crear acceso al panel" : selectedUser?.fullName ?? ""}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                  {panel === "new"
                    ? "Defini nombre, usuario, rol y contrasena inicial."
                    : "Actualiza datos del usuario o cambia su contrasena."}
                </p>
              </div>
              <button
                onClick={closePanel}
                className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)]"
              >
                Cerrar
              </button>
            </div>

            {!canManage ? (
              <p className="rounded-[22px] border border-[var(--border-soft)] bg-[rgba(13,15,14,0.68)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Tu perfil no tiene permiso para gestionar usuarios.
              </p>
            ) : panel === "new" ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setError(undefined);
                  startTransition(async () => {
                    await submitCreate(new FormData(event.currentTarget));
                  });
                }}
                className="overlay-panel-form"
              >
                <div className="compact-form-grid">
                  <div>
                    <label className="field-label" htmlFor="fullName">
                      Nombre visible
                    </label>
                    <input id="fullName" name="fullName" required className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="username">
                      Usuario
                    </label>
                    <input id="username" name="username" type="text" required className="field-input" />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="role">
                      Rol
                    </label>
                    <select id="role" name="role" defaultValue="staff" className="field-select">
                      <option value="owner">Administrador</option>
                      <option value="manager">Encargada</option>
                      <option value="staff">Empleada</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="isActive">
                      Estado
                    </label>
                    <select id="isActive" name="isActive" defaultValue="true" className="field-select">
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                  <PasswordField
                    id="password"
                    name="password"
                    label="Contrasena inicial"
                    required
                    className="field-input"
                  />
                  <PasswordField
                    id="confirmPassword"
                    name="confirmPassword"
                    label="Confirmar contrasena"
                    required
                    className="field-input"
                  />
                </div>
                <div className="overlay-panel-actions">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPending ? "Guardando..." : "Guardar usuario"}
                  </button>
                </div>
              </form>
            ) : selectedUser ? (
              <div className="overlay-panel-form">
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Datos del usuario
                    </p>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError(undefined);
                        startTransition(async () => {
                          await submitEdit(new FormData(event.currentTarget));
                        });
                      }}
                      className="space-y-4"
                    >
                      <div className="compact-form-grid">
                        <div>
                          <label className="field-label" htmlFor="edit-fullName">
                            Nombre visible
                          </label>
                          <input
                            id="edit-fullName"
                            name="fullName"
                            defaultValue={selectedUser.fullName}
                            required
                            className="field-input"
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="edit-username">
                            Usuario
                          </label>
                          <input
                            id="edit-username"
                            name="username"
                            type="text"
                            defaultValue={selectedUser.email}
                            required
                            className="field-input"
                          />
                        </div>
                        <div>
                          <label className="field-label" htmlFor="edit-role">
                            Rol
                          </label>
                          <select
                            id="edit-role"
                            name="role"
                            defaultValue={selectedUser.role}
                            className="field-select"
                          >
                            <option value="owner">Administrador</option>
                            <option value="manager">Encargada</option>
                            <option value="staff">Empleada</option>
                          </select>
                        </div>
                        <div>
                          <label className="field-label" htmlFor="edit-isActive">
                            Estado
                          </label>
                          <select
                            id="edit-isActive"
                            name="isActive"
                            defaultValue={selectedUser.isActive ? "true" : "false"}
                            disabled={selectedUser.id === currentUserId}
                            className="field-select"
                          >
                            <option value="true">Activo</option>
                            <option value="false">Inactivo</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isPending ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    </form>
                  </div>

                  <div className="border-t border-[var(--border-soft)] pt-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Cambiar contrasena
                    </p>
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        setError(undefined);
                        startTransition(async () => {
                          await submitPassword(new FormData(event.currentTarget));
                        });
                      }}
                      className="space-y-4"
                    >
                      <div className="compact-form-grid">
                        <PasswordField
                          id="new-password"
                          name="password"
                          label="Nueva contrasena"
                          required
                          className="field-input"
                        />
                        <PasswordField
                          id="new-confirmPassword"
                          name="confirmPassword"
                          label="Confirmar contrasena"
                          required
                          className="field-input"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isPending}
                          className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {isPending ? "Actualizando..." : "Cambiar contrasena"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">
                No se encontro el usuario seleccionado.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="surface-muted rounded-[22px] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</p>
    </article>
  );
}
