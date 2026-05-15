import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { db } from "@/lib/db";
import { DEFAULT_LOGIN_PASSWORDS } from "@/lib/password";
import { getSessionUser } from "@/lib/session";
import { isSetupCompleted } from "@/lib/system-config";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const roleLabels: Record<string, string> = {
  owner: "Administrador",
  manager: "Encargada",
  staff: "Empleada",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const setupCompleted = await isSetupCompleted();
  if (!setupCompleted) {
    redirect("/setup");
  }

  const currentUser = await getSessionUser();
  if (currentUser) {
    redirect("/");
  }

  const params = searchParams ? await searchParams : undefined;
  const error = readSingle(params?.error);
  const users = await db.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: { id: true, fullName: true, email: true, role: true },
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="page-frame w-full max-w-4xl rounded-[32px] p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="section-kicker">Acceso local</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">
              Sistema Kettal
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
              Ingresas con usuario y contrasena. Los permisos se aplican en servidor y el panel
              ajusta lo que podes ver y editar.
            </p>

            <div className="mt-6 space-y-3">
              <article className="surface-muted rounded-[22px] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Usuario inicial
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">admin</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Clave inicial
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {DEFAULT_LOGIN_PASSWORDS.owner}
                </p>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  El resto de los usuarios se crean despues desde la pantalla de usuarios.
                </p>
              </article>
            </div>
          </div>

          <div className="surface executive-card rounded-[28px] p-5 sm:p-6">
            <div className="border-b border-[var(--border-soft)] pb-5">
              <p className="section-kicker">Iniciar sesion</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Entrar al panel
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Escribe el usuario o el nombre visible y su contrasena correspondiente.
              </p>
            </div>

            <LoginForm initialError={error} />

            <div className="mt-4 space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="surface-muted flex items-center justify-between rounded-[18px] px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{user.fullName}</p>
                    <p className="text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                  <span className="rounded-full bg-[rgba(45,76,57,0.16)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)]">
                    {roleLabels[user.role]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
