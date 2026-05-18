import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getSessionUser } from "@/lib/session";
import { isSetupCompleted } from "@/lib/system-config";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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
              Ingresa con tu usuario y contrasena. Los permisos se aplican en servidor y el panel
              ajusta lo que podes ver y editar.
            </p>
          </div>

          <div className="surface executive-card rounded-[28px] p-5 sm:p-6">
            <div className="border-b border-[var(--border-soft)] pb-5">
              <p className="section-kicker">Iniciar sesion</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-primary)]">
                Entrar al panel
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Escribe tu usuario y contrasena correspondiente.
              </p>
            </div>

            <LoginForm initialError={error} />
          </div>
        </div>
      </section>
    </main>
  );
}
