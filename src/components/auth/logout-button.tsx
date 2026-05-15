"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button onClick={onClick} disabled={isPending} className={className}>
      {isPending ? "Saliendo..." : label}
    </button>
  );
}
