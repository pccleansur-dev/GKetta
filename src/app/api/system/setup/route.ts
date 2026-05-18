import fs from "fs/promises";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { restartSelf } from "@/lib/docker";
import { hashPassword } from "@/lib/password";
import { ApiError } from "@/server/api/errors";
import { asRequiredString, asOptionalString, readJson } from "@/server/api/request";
import { handleApiError } from "@/server/api/responses";
import { createSession, setSessionCookie, shouldUseSecureCookie } from "@/server/api/auth";

async function updateEnvHostFile(backupPath: string) {
  const envPath = "/app/.env.host";
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    return;
  }
  const lines = content.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("BACKUP_PATH="));
  const newLine = `BACKUP_PATH=${backupPath}`;
  if (idx >= 0) {
    lines[idx] = newLine;
  } else {
    lines.push(newLine);
  }
  await fs.writeFile(envPath, lines.join("\n"), "utf-8");
}

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
    const backupPath = asOptionalString(body.backupPath)?.trim() || "./backups";
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

    // Write BACKUP_PATH to host .env so docker-compose volume picks it up on next restart
    const needsDockerRestart = backupPath !== "./backups" && backupPath !== "/app/backups";
    await updateEnvHostFile(backupPath);

    // Build response with both cookies
    const response = NextResponse.json({
      ok: true,
      message: "Configuración guardada correctamente.",
      needsDockerRestart,
    });

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

    // Trigger Docker restart after response is sent so the new volume takes effect
    if (needsDockerRestart) {
      setTimeout(() => {
        restartSelf().catch(console.error);
      }, 1500);
    }

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
