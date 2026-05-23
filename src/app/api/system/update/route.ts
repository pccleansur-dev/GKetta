import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { restartSelf } from "@/lib/docker";
import { createBackup } from "@/lib/backup";
import { GITHUB_BRANCH, GITHUB_REPO_SLUG, getAppVersionInfo } from "@/lib/version";
import { ApiError } from "@/server/api/errors";
import { handleApiError } from "@/server/api/responses";
import { getSessionUser } from "@/lib/session";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

async function upsertUpdateStatus(status: string, detail: string | null = null) {
  await Promise.all([
    db.systemConfig.upsert({
      where: { key: "update_status" },
      update: { value: status },
      create: { key: "update_status", value: status },
    }),
    db.systemConfig.upsert({
      where: { key: "update_status_detail" },
      update: { value: detail ?? "" },
      create: { key: "update_status_detail", value: detail ?? "" },
    }),
    db.systemConfig.upsert({
      where: { key: "update_status_at" },
      update: { value: new Date().toISOString() },
      create: { key: "update_status_at", value: new Date().toISOString() },
    }),
  ]);
}

function getGithubArchiveUrl() {
  const [owner, repo] = GITHUB_REPO_SLUG.split("/");
  if (!owner || !repo) {
    throw new ApiError(500, "La configuración del repositorio es inválida.");
  }

  return `https://codeload.github.com/${owner}/${repo}/tar.gz/refs/heads/${GITHUB_BRANCH}`;
}

async function downloadArchive(url: string, filepath: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) {
    throw new ApiError(502, "No se pudo descargar la actualización desde GitHub.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filepath, buffer);
}

async function findArchiveRoot(extractDir: string) {
  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const root = entries.find((entry) => entry.isDirectory());
  if (!root) {
    throw new ApiError(500, "El paquete descargado no tiene una estructura válida.");
  }
  return path.join(extractDir, root.name);
}

async function copyTree(sourceDir: string, targetDir: string) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      dereference: false,
    });
  }
}

async function snapshotCurrentApp(cwd: string) {
  const snapshotDir = await fs.mkdtemp(path.join(os.tmpdir(), "gketta-snapshot-"));
  const backupPath = path.join(snapshotDir, "app");

  await fs.mkdir(backupPath, { recursive: true });

  const pathsToSnapshot = [
    "src",
    "prisma",
    "scripts",
    "public",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "eslint.config.mjs",
    "next.config.mjs",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "Dockerfile",
  ];

  for (const relativePath of pathsToSnapshot) {
    const sourcePath = path.join(cwd, relativePath);
    const targetPath = path.join(backupPath, relativePath);
    try {
      const stat = await fs.stat(sourcePath);
      if (stat.isDirectory()) {
        await fs.cp(sourcePath, targetPath, {
          recursive: true,
          force: true,
          dereference: false,
        });
      } else {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
      }
    } catch {
      // Si algo no existe, no bloquea el snapshot.
    }
  }

  return snapshotDir;
}

async function restoreSnapshot(snapshotDir: string, cwd: string) {
  const backupPath = path.join(snapshotDir, "app");
  const entries = await fs.readdir(backupPath, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(backupPath, entry.name);
    const targetPath = path.join(cwd, entry.name);
    await fs.rm(targetPath, { recursive: true, force: true });
    await fs.cp(sourcePath, targetPath, {
      recursive: true,
      force: true,
      dereference: false,
    });
  }
}

async function applyUpdateFromGitHub() {
  const cwd = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "gketta-update-"));
  const archivePath = path.join(tempDir, "update.tar.gz");
  const extractDir = path.join(tempDir, "extract");

  await fs.mkdir(extractDir, { recursive: true });
  await upsertUpdateStatus("descargando", "Bajando la versión desde GitHub...");
  await downloadArchive(getGithubArchiveUrl(), archivePath);
  await upsertUpdateStatus("extrayendo", "Preparando archivos...");
  await execFileAsync("tar", ["-xzf", archivePath, "-C", extractDir], { maxBuffer: 1024 * 1024 * 2 });

  const rootDir = await findArchiveRoot(extractDir);

  const pathsToReplace = [
    "src",
    "prisma",
    "scripts",
    "public",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "eslint.config.mjs",
    "next.config.mjs",
    "postcss.config.mjs",
    "tailwind.config.ts",
    "Dockerfile",
  ];

  await Promise.all(
    pathsToReplace.map((relativePath) =>
      fs.rm(path.join(cwd, relativePath), { recursive: true, force: true }),
    ),
  );

  await upsertUpdateStatus("copiando", "Reemplazando el código actual...");
  await copyTree(rootDir, cwd);

  await upsertUpdateStatus("dependencias", "Instalando dependencias...");
  await execFileAsync("pnpm", ["install", "--frozen-lockfile"], { cwd, maxBuffer: 1024 * 1024 * 2 });
  await upsertUpdateStatus("generando", "Actualizando Prisma...");
  await execFileAsync("pnpm", ["db:generate"], { cwd, maxBuffer: 1024 * 1024 * 2 });
  await upsertUpdateStatus("compilando", "Compilando la nueva versión...");
  await execFileAsync("pnpm", ["build"], { cwd, maxBuffer: 1024 * 1024 * 2 });
}

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new ApiError(401, "Sesión requerida.");
    }

    if (user.role !== "owner") {
      throw new ApiError(403, "Tu perfil no tiene permiso para actualizar el sistema.");
    }

    const before = await getAppVersionInfo();
    await upsertUpdateStatus("respaldo", "Creando respaldo...");
    const dataBackup = await createBackup();
    const codeSnapshotDir = await snapshotCurrentApp(process.cwd());

    try {
      await applyUpdateFromGitHub();
    } catch (error) {
      await upsertUpdateStatus("restaurando", "Volviendo a la versión anterior...");
      await restoreSnapshot(codeSnapshotDir, process.cwd());
      await upsertUpdateStatus("fallo", error instanceof Error ? error.message : "Error desconocido.");
      throw error;
    }

    const after = await getAppVersionInfo();
    await upsertUpdateStatus("reiniciando", "Reiniciando el servicio...");

    const response = NextResponse.json({
      ok: true,
      updated: before.packageVersion !== after.packageVersion || before.gitCommit !== after.gitCommit,
      message:
        before.packageVersion !== after.packageVersion || before.gitCommit !== after.gitCommit
          ? `Sistema actualizado desde GitHub. Respaldo: ${dataBackup.filename}.`
          : "Ya tenías la última versión.",
      version: after,
      backup: dataBackup.filename,
    });

    setTimeout(() => {
      restartSelf().catch(console.error);
    }, 1500);

    await upsertUpdateStatus("completado", "La actualización terminó correctamente.");

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      throw new ApiError(401, "Sesión requerida.");
    }

    if (user.role !== "owner") {
      throw new ApiError(403, "Tu perfil no tiene permiso para ver este estado.");
    }

    const configs = await db.systemConfig.findMany({
      where: { key: { in: ["update_status", "update_status_detail", "update_status_at"] } },
    });
    const map = Object.fromEntries(configs.map((config) => [config.key, config.value]));

    return NextResponse.json({
      status: map.update_status ?? "idle",
      detail: map.update_status_detail ?? "",
      updatedAt: map.update_status_at ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
