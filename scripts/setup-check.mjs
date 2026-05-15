import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const G = "\x1b[32m";
const R = "\x1b[31m";
const Y = "\x1b[33m";
const B = "\x1b[34m";
const X = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const ok = (msg) => console.log(`  ${G}✔${X}  ${msg}`);
const fail = (msg) => { console.log(`  ${R}✘${X}  ${msg}`); errors++; };
const warn = (msg) => console.log(`  ${Y}⚠${X}  ${msg}`);
const info = (msg) => console.log(`  ${B}i${X}  ${DIM}${msg}${X}`);
const line = () => console.log(`  ${DIM}${"─".repeat(50)}${X}`);

function run(cmd) {
  try {
    return execSync(cmd, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch {
    return null;
  }
}

let errors = 0;

console.log();
console.log(`  ${BOLD}Sistema Kettal — Verificación del entorno${X}`);
console.log();

// ── Node.js ──────────────────────────────────────────
const nodeVersion = process.version;
const nodeMajor = parseInt(nodeVersion.slice(1));
if (nodeMajor >= 18) {
  ok(`Node.js ${nodeVersion}`);
} else {
  fail(`Node.js ${nodeVersion} detectado — se requiere v18 o superior`);
  info("Descargá la versión LTS desde: https://nodejs.org");
}

// ── pnpm ─────────────────────────────────────────────
const pnpmVersion = run("pnpm --version");
if (pnpmVersion) {
  ok(`pnpm ${pnpmVersion}`);
} else {
  fail("pnpm no encontrado");
  info("Instalalo con: npm install -g pnpm");
}

// ── Docker instalado ─────────────────────────────────
const dockerVersion = run("docker --version");
if (dockerVersion) {
  ok(dockerVersion.replace("Docker version ", "Docker ").replace(", build", " —"));
} else {
  fail("Docker no encontrado");
  info("Instalá Docker Desktop desde: https://docker.com/products/docker-desktop");
}

// ── Docker daemon corriendo ───────────────────────────
const dockerPs = run("docker ps -q");
if (dockerPs !== null) {
  ok("Docker Desktop corriendo");
} else {
  fail("Docker Desktop no está corriendo — inicialo antes de continuar");
}

// ── Contenedor Postgres ───────────────────────────────
const pgStatus = run(
  'docker inspect sistema-kettal-postgres --format "{{.State.Health.Status}}" 2>nul',
);
if (pgStatus === "healthy") {
  ok("Postgres container sano (sistema-kettal-postgres)");
} else if (pgStatus && pgStatus !== "") {
  warn(`Postgres container en estado: ${pgStatus}`);
  info("Esperá unos segundos o corré: docker compose up -d postgres");
} else {
  info("Postgres container no encontrado — se creará al levantar los servicios");
}

// ── Conexión a la base de datos ───────────────────────
const dbReady = run(
  "docker exec sistema-kettal-postgres pg_isready -U kettal -d sistema_kettal 2>nul",
);
if (dbReady && dbReady.includes("accepting")) {
  ok("Conexión a la base de datos OK");
} else if (pgStatus === "healthy") {
  warn("Base de datos iniciando...");
} else {
  info("Base de datos: se inicializará con pnpm db:setup");
}

// ── .env ─────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  ok(".env encontrado");
} else {
  warn(".env no encontrado");
  info("Crealo con: Copy-Item .env.example .env  (PowerShell)");
  info("            cp .env.example .env          (bash)");
}

// ── Resultado ─────────────────────────────────────────
console.log();
line();
console.log();

if (errors > 0) {
  console.log(`  ${R}${BOLD}${errors} problema(s) encontrado(s). Resolvelos antes de continuar.${X}`);
  console.log();
  process.exit(1);
} else {
  console.log(`  ${G}${BOLD}✔ Todo listo.${X}`);
  console.log();
  console.log(`  ${BOLD}Para usar el sistema (recomendado):${X}`);
  console.log(`    docker compose up -d --build`);
  console.log(`    → Abrir http://localhost:3017`);
  console.log();
  console.log(`  ${BOLD}Para desarrollar:${X}`);
  console.log(`    pnpm install`);
  console.log(`    docker compose up -d postgres`);
  console.log(`    pnpm db:setup`);
  console.log(`    pnpm dev`);
  console.log(`    → Abrir http://localhost:3000`);
  console.log();
}
