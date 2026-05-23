import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const GITHUB_REPO_SLUG = process.env.GITHUB_REPO_SLUG ?? "pccleansur-dev/GKetta";
export const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? "main";

export type AppVersionInfo = {
  packageVersion: string;
  gitCommit: string | null;
  gitBranch: string | null;
  gitAvailable: boolean;
  repoSlug: string;
  branch: string;
};

async function readPackageVersion() {
  const raw = await readFile(path.join(process.cwd(), "package.json"), "utf-8");
  const pkg = JSON.parse(raw) as { version?: string };
  return pkg.version ?? "0.0.0";
}

async function readGitInfo() {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: process.cwd() });
  } catch {
    return { gitAvailable: false, gitCommit: null, gitBranch: null };
  }

  const [commitResult, branchResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: process.cwd() }),
    execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: process.cwd() }),
  ]);

  return {
    gitAvailable: true,
    gitCommit: commitResult.stdout.trim() || null,
    gitBranch: branchResult.stdout.trim() || null,
  };
}

export async function getAppVersionInfo(): Promise<AppVersionInfo> {
  const [packageVersion, gitInfo] = await Promise.all([readPackageVersion(), readGitInfo()]);

  return {
    packageVersion,
    ...gitInfo,
    repoSlug: GITHUB_REPO_SLUG,
    branch: GITHUB_BRANCH,
  };
}
