"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FeedbackBanner } from "@/components/ui/feedback-banner";
import { PasswordField } from "@/components/ui/password-field";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");

    startTransition(async () => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "No se pudo iniciar sesion.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  }

  return (
    <>
      <FeedbackBanner error={error} />

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="username">
            Usuario o nombre
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="admin"
            className="field-input"
          />
        </div>

        <PasswordField id="password" name="password" label="Contrasena" className="field-input" />

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </>
  );
}
