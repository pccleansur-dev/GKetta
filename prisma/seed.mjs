import { PrismaClient, UserRole } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

const DEFAULT_LOGIN_PASSWORDS = {
  owner: "admin1234",
  manager: "KettalManager2026!",
  staff: "KettalStaff2026!",
};

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

async function main() {
  const existingUsers = await prisma.user.count();

  if (existingUsers > 0) {
    console.log("Usuarios existentes detectados. Seed omitido.");
    return;
  }

  await prisma.user.create({
    data: {
      email: "admin",
      fullName: "Administrador",
      role: UserRole.owner,
      passwordHash: hashPassword(DEFAULT_LOGIN_PASSWORDS.owner),
      passwordUpdatedAt: new Date(),
    },
  });

  console.log("Instalacion limpia preparada.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
