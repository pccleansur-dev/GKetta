import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { ApiError } from "@/server/api/errors";
import { asRequiredString, asOptionalString, readJson } from "@/server/api/request";
import { handleApiError } from "@/server/api/responses";
import { createSession, setSessionCookie, shouldUseSecureCookie } from "@/server/api/auth";

const SETUP_COOKIE = "kettal_setup_done";
const ONE_YEAR = 365 * 24 * 60 * 60;

async function upsertConfig(key: string, value: string) {
  await db.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function POST(request: Request) {
  try {
    const setupCompleted = await db.systemConfig.findUnique({ where: { key: "setup_completed" } });

    if (setupCompleted?.value === "true") {
      throw new ApiError(403, "La configuracion inicial ya fue completada.");
    }

    const body = await readJson<Record<string, unknown>>(request);
    const businessName = asRequiredString(body.businessName, "el nombre del negocio");
    const password = asRequiredString(body.password, "la contraseña");
    const confirmPassword = asRequiredString(body.confirmPassword, "la confirmación");
    const backupPath = asOptionalString(body.backupPath) ?? "./backups";
    const retentionDays = asOptionalString(body.retentionDays) ?? "60";

    if (password !== confirmPassword) {
      throw new ApiError(400, "Las contraseñas no coinciden.");
    }

    if (password.length < 8) {
      throw new ApiError(400, "La contraseña debe tener al menos 8 caracteres.");
    }

    // Find the owner user
    const owner = await db.user.findFirst({
      where: { role: "owner", isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (!owner) {
      throw new ApiError(500, "No se encontró el usuario administrador.");
    }

    // Update owner password
    await db.user.update({
      where: { id: owner.id },
      data: {
        passwordHash: hashPassword(password),
        passwordUpdatedAt: new Date(),
      },
    });

    // Save system config
    await Promise.all([
      upsertConfig("setup_completed", "true"),
      upsertConfig("business_name", businessName),
      upsertConfig("backup_path", backupPath),
      upsertConfig("backup_retention_days", retentionDays),
    ]);

    // Build response with both cookies
    const response = NextResponse.json({ ok: true, message: "Configuración guardada correctamente." });

    // Mark setup done (1 year)
    response.cookies.set(SETUP_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });

    // Log in as owner
    const sessionToken = await createSession(owner.id);
    setSessionCookie(response, sessionToken, shouldUseSecureCookie(request));

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
