import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ApiError } from "@/server/api/errors";
import { asRequiredString, readJson } from "@/server/api/request";
import { handleApiError } from "@/server/api/responses";
import { createSession, setSessionCookie, shouldUseSecureCookie } from "@/server/api/auth";
import { validateBackup, restoreFromBackup } from "@/lib/restore";

const SETUP_COOKIE = "kettal_setup_done";
const ONE_YEAR = 365 * 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const setupCompleted = await db.systemConfig.findUnique({ where: { key: "setup_completed" } });

    if (setupCompleted?.value === "true") {
      throw new ApiError(403, "La restauracion inicial ya no esta disponible.");
    }

    const body = await readJson<Record<string, unknown>>(request);
    const password = asRequiredString(body.password, "la contraseña");
    const confirmPassword = asRequiredString(body.confirmPassword, "la confirmación");

    if (password !== confirmPassword) {
      throw new ApiError(400, "Las contraseñas no coinciden.");
    }

    if (password.length < 8) {
      throw new ApiError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    const backup = validateBackup(body.backup);

    await restoreFromBackup(backup, password);

    // Find restored owner to log in
    const owner = await db.user.findFirst({
      where: { role: "owner", isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!owner) {
      throw new ApiError(500, "No se encontró el usuario administrador tras la restauración.");
    }

    const response = NextResponse.json({ ok: true, message: "Sistema restaurado correctamente." });

    response.cookies.set(SETUP_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });

    const sessionToken = await createSession(owner.id);
    setSessionCookie(response, sessionToken, shouldUseSecureCookie(request));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
