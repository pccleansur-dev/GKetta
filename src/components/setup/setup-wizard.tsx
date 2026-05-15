"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PasswordField } from "@/components/ui/password-field";
import type { BackupData } from "@/lib/restore";

type Props = { isDocker: boolean };

type Mode = "choice" | "setup" | "restore";

const SETUP_STEPS = ["Negocio", "Contrasena", "Backup", "Confirmar"] as const;
const RESTORE_STEPS = ["Archivo", "Contrasena", "Confirmar"] as const;

const defaultBackupPath = (isDocker: boolean) => (isDocker ? "./backups" : "");

function SetupFlow({ isDocker, onBack }: { isDocker: boolean; onBack: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [businessName, setBusinessName] = useState("Sistema Kettal");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [backupPath, setBackupPath] = useState(defaultBackupPath(isDocker));
  const [retentionDays, setRetentionDays] = useState("60");

  const isCloudPath =
    backupPath.toLowerCase().includes("onedrive") ||
    backupPath.toLowerCase().includes("dropbox") ||
    backupPath.toLowerCase().includes("google drive") ||
    backupPath.toLowerCase().includes("icloud") ||
    backupPath.toLowerCase().includes("mega");

  function validate(): string | null {
    if (step === 0 && !businessName.trim()) return "Ingresa el nombre del negocio.";
    if (step === 1) {
      if (password.length < 8) return "La contrasena debe tener al menos 8 caracteres.";
      if (password !== confirmPassword) return "Las contrasenas no coinciden.";
    }
    if (step === 2 && !backupPath.trim()) return "Ingresa la ruta de la carpeta de backup.";
    return null;
  }

  function next() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setStep((current) => current + 1);
  }

  function submit() {
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/system/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, password, confirmPassword, backupPath, retentionDays }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo completar la configuracion.");
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <>
      <StepIndicator steps={SETUP_STEPS} current={step} />
      <ErrorBanner message={error} />

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">Como se llama el negocio?</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Este nombre aparece en el encabezado del sistema.
            </p>
            <div>
              <label className="field-label" htmlFor="businessName">
                Nombre del negocio
              </label>
              <input
                id="businessName"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                className="field-input"
                placeholder="Ej: Muebles Lopez"
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Contrasena del administrador
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Reemplaza la contrasena por defecto. Minimo 8 caracteres.
            </p>
            <div className="surface-muted rounded-[18px] px-4 py-3 text-sm text-[var(--text-secondary)]">
              Usuario inicial:{" "}
              <span className="font-semibold text-[var(--text-primary)]">admin</span>
            </div>
            <PasswordField
              id="pw"
              label="Nueva contrasena"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
            />
            <PasswordField
              id="cpw"
              label="Confirmar contrasena"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="field-input"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Configuracion de backups diarios
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              El sistema hace backup automatico cada noche a las 00:00.
            </p>
            {isDocker ? (
              <div className="surface-muted rounded-[18px] px-4 py-3 text-sm text-[var(--text-secondary)]">
                En modo Docker los backups se guardan en{" "}
                <span className="font-semibold text-[var(--text-primary)]">./backups/</span> del
                proyecto. Si esa carpeta vive dentro de OneDrive, Dropbox o similar, tus backups
                tambien quedan sincronizados afuera de la app.
              </div>
            ) : (
              <div className="surface-muted rounded-[18px] px-4 py-3 text-sm text-[var(--text-secondary)]">
                Elegi una carpeta que ya este sincronizada por OneDrive, Dropbox o Google Drive.
              </div>
            )}
            <div>
              <label className="field-label" htmlFor="bpath">
                Ruta de la carpeta
              </label>
              <input
                id="bpath"
                value={backupPath}
                onChange={(event) => setBackupPath(event.target.value)}
                className="field-input"
                placeholder={isDocker ? "./backups" : "C:\\Users\\...\\OneDrive\\Kettal\\backups"}
              />
              {backupPath ? (
                <p
                  className={`mt-2 text-xs ${
                    isCloudPath ? "text-[var(--success)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {isCloudPath
                    ? "Ruta asociada a una carpeta de nube detectada. Es solo una ayuda visual: confirma en tu equipo que realmente se este sincronizando."
                    : "Si queres respaldo fuera del equipo, verifica que esta carpeta este sincronizada con tu servicio de nube."}
                </p>
              ) : null}
            </div>
            <div>
              <label className="field-label" htmlFor="ret">
                Retencion
              </label>
              <select
                id="ret"
                value={retentionDays}
                onChange={(event) => setRetentionDays(event.target.value)}
                className="field-select"
              >
                <option value="30">30 dias</option>
                <option value="60">60 dias (recomendado)</option>
                <option value="90">90 dias</option>
                <option value="180">180 dias</option>
                <option value="365">1 ano</option>
              </select>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">Todo listo para empezar</p>
            <p className="text-sm text-[var(--text-secondary)]">
              Revisa la configuracion antes de confirmar.
            </p>
            <div className="space-y-2">
              {[
                ["Negocio", businessName],
                ["Administrador", "admin"],
                ["Carpeta de backup", backupPath],
                ["Retencion", `${retentionDays} dias`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="surface-muted flex justify-between rounded-[18px] px-4 py-3 text-sm"
                >
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <Actions
        onBack={step === 0 ? onBack : () => {
          setError(undefined);
          setStep((current) => current - 1);
        }}
        onNext={step < SETUP_STEPS.length - 1 ? next : undefined}
        onSubmit={step === SETUP_STEPS.length - 1 ? submit : undefined}
        isPending={isPending}
        submitLabel="Empezar a usar el sistema"
      />
    </>
  );
}

function RestoreFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  const [backup, setBackup] = useState<BackupData | null>(null);
  const [preview, setPreview] = useState<{
    businessName: string;
    createdAt: string;
    counts: Record<string, number>;
  } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const raw = JSON.parse(loadEvent.target?.result as string) as unknown;
        const obj = raw as Record<string, unknown>;
        if (!obj.version || !obj.data) throw new Error("Estructura invalida.");

        const data = obj.data as Record<string, unknown>;
        const configs = (data.systemConfig as Record<string, unknown>[]) ?? [];
        const bizEntry = configs.find((config) => config.key === "business_name") as
          | Record<string, unknown>
          | undefined;

        setPreview({
          businessName: (bizEntry?.value as string) ?? "Sistema Kettal",
          createdAt: obj.createdAt as string,
          counts: {
            clientes: ((data.customers as unknown[]) ?? []).length,
            pedidos: ((data.orders as unknown[]) ?? []).length,
            ventas: ((data.sales as unknown[]) ?? []).length,
            movimientos: ((data.accountMovements as unknown[]) ?? []).length,
          },
        });
        setBackup(raw as BackupData);
        setError(undefined);
      } catch {
        setError("El archivo no es un backup valido de Sistema Kettal.");
        setBackup(null);
        setPreview(null);
      }
    };
    reader.readAsText(file);
  }

  function validateStep(): string | null {
    if (step === 0 && !backup) return "Selecciona un archivo de backup.";
    if (step === 1) {
      if (password.length < 8) return "La contrasena debe tener al menos 8 caracteres.";
      if (password !== confirmPassword) return "Las contrasenas no coinciden.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(undefined);
    setStep((current) => current + 1);
  }

  function submit() {
    if (!backup) return;
    setError(undefined);
    startTransition(async () => {
      const res = await fetch("/api/system/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backup, password, confirmPassword }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "No se pudo restaurar el backup.");
        return;
      }
      router.replace("/");
      router.refresh();
    });
  }

  const backupDate = preview?.createdAt
    ? new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(preview.createdAt))
    : null;

  return (
    <>
      <StepIndicator steps={RESTORE_STEPS} current={step} />
      <ErrorBanner message={error} />

      <div className="mt-6 space-y-4">
        {step === 0 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Selecciona el archivo de backup
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Busca el archivo <span className="font-semibold text-[var(--text-primary)]">kettal-backup-*.json</span> en tu carpeta de backups o en la nube.
            </p>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-[18px] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-6 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--primary)] hover:text-[var(--text-primary)]"
              >
                {backup ? "Archivo cargado - clic para cambiar" : "Clic para seleccionar archivo"}
              </button>
            </div>

            {preview ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Vista previa
                </p>
                {[
                  ["Negocio", preview.businessName],
                  ["Fecha del backup", backupDate ?? ""],
                  ["Clientes", String(preview.counts.clientes)],
                  ["Pedidos", String(preview.counts.pedidos)],
                  ["Ventas", String(preview.counts.ventas)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="surface-muted flex justify-between rounded-[18px] px-4 py-2.5 text-sm"
                  >
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    <span className="font-semibold text-[var(--text-primary)]">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Nueva contrasena del administrador
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Por seguridad, defini una contrasena nueva para el acceso del administrador.
            </p>
            <div className="surface-muted rounded-[18px] px-4 py-3 text-sm text-[var(--text-secondary)]">
              Usuario inicial:{" "}
              <span className="font-semibold text-[var(--text-primary)]">admin</span>
            </div>
            <PasswordField
              id="rpw"
              label="Nueva contrasena"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input"
            />
            <PasswordField
              id="rcpw"
              label="Confirmar contrasena"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="field-input"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="text-base font-semibold text-[var(--text-primary)]">
              Confirmas la restauracion?
            </p>
            <div className="rounded-[18px] border border-[rgba(168,106,97,0.28)] bg-[rgba(168,106,97,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
              Esta accion reemplaza todos los datos actuales con los del backup seleccionado. No se puede deshacer.
            </div>
            <div className="space-y-2">
              {[
                ["Negocio a restaurar", preview?.businessName ?? ""],
                ["Fecha del backup", backupDate ?? ""],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="surface-muted flex justify-between rounded-[18px] px-4 py-3 text-sm"
                >
                  <span className="text-[var(--text-secondary)]">{label}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{value}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <Actions
        onBack={step === 0 ? onBack : () => {
          setError(undefined);
          setStep((current) => current - 1);
        }}
        onNext={step < RESTORE_STEPS.length - 1 ? next : undefined}
        onSubmit={step === RESTORE_STEPS.length - 1 ? submit : undefined}
        isPending={isPending}
        submitLabel={isPending ? "Restaurando..." : "Restaurar sistema"}
        submitDanger
      />
    </>
  );
}

function StepIndicator({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <div className="mt-6 flex items-center gap-2">
      {steps.map((label, index) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
              index < current
                ? "bg-[var(--success)] text-white"
                : index === current
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border-soft)] text-[var(--text-muted)]"
            }`}
          >
            {index < current ? "OK" : index + 1}
          </div>
          <span
            className={`text-xs font-medium ${
              index === current ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            {label}
          </span>
          {index < steps.length - 1 ? (
            <div
              className={`h-px w-6 ${index < current ? "bg-[var(--success)]" : "bg-[var(--border-soft)]"}`}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mt-5 rounded-[18px] border border-[rgba(168,106,97,0.28)] bg-[rgba(168,106,97,0.08)] px-4 py-3 text-sm text-[var(--danger)]">
      {message}
    </div>
  );
}

function Actions({
  onBack,
  onNext,
  onSubmit,
  isPending,
  submitLabel,
  submitDanger,
}: {
  onBack: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isPending: boolean;
  submitLabel: string;
  submitDanger?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={isPending}
        className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] disabled:opacity-50"
      >
        Atras
      </button>
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)]"
        >
          Siguiente
        </button>
      ) : null}
      {onSubmit ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending}
          className={`rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_rgba(45,76,57,0.3)] transition disabled:cursor-not-allowed disabled:opacity-70 ${
            submitDanger
              ? "bg-[var(--danger)] hover:bg-[rgba(168,106,97,0.9)]"
              : "bg-[var(--primary)] hover:bg-[var(--primary-dark)]"
          }`}
        >
          {submitLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SetupWizard({ isDocker }: Props) {
  const [mode, setMode] = useState<Mode>("choice");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="page-frame w-full max-w-xl rounded-[32px] p-6 sm:p-8">
        <p className="section-kicker">Configuracion inicial</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
          Bienvenido al sistema
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          {mode === "choice"
            ? "Es la primera vez o queres restaurar un backup existente?"
            : mode === "setup"
              ? "Completa estos datos una sola vez antes de operar."
              : "Restaura el sistema desde un archivo de backup."}
        </p>

        {mode === "choice" ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("setup")}
              className="flex flex-col gap-3 rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5 text-left transition hover:border-[var(--primary)] hover:bg-[var(--surface-strong)]"
            >
              <span className="text-2xl">Nuevo</span>
              <p className="font-semibold text-[var(--text-primary)]">Configurar desde cero</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Primera instalacion o inicio limpio del sistema.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setMode("restore")}
              className="flex flex-col gap-3 rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface-muted)] p-5 text-left transition hover:border-[var(--primary)] hover:bg-[var(--surface-strong)]"
            >
              <span className="text-2xl">Backup</span>
              <p className="font-semibold text-[var(--text-primary)]">Restaurar desde backup</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Recuperar datos de un backup anterior.
              </p>
            </button>
          </div>
        ) : null}

        {mode === "setup" ? <SetupFlow isDocker={isDocker} onBack={() => setMode("choice")} /> : null}
        {mode === "restore" ? <RestoreFlow onBack={() => setMode("choice")} /> : null}
      </section>
    </main>
  );
}
