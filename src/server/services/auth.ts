import { db } from "@/lib/db";
import { getDefaultLoginPassword, hashPassword, verifyPassword } from "@/lib/password";
import { ApiError } from "@/server/api/errors";

export async function authenticateUser(identifierValue: unknown, passwordValue: unknown) {
  const identifier = String(identifierValue ?? "").trim();
  const password = String(passwordValue ?? "");

  if (!identifier) {
    throw new ApiError(400, "Ingresa el usuario o nombre.");
  }

  if (!password) {
    throw new ApiError(400, "Ingresa la contraseña.");
  }

  const user = await db.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { email: identifier.toLowerCase() },
        { email: identifier },
        { fullName: identifier },
        { fullName: identifier.replace(/\s*-\s*.*$/, "") },
      ],
    },
    select: {
      id: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    throw new ApiError(401, "Usuario inactivo o inexistente.");
  }

  const storedHash = user.passwordHash;
  const defaultPassword = getDefaultLoginPassword(user.role);
  const passwordMatches = storedHash ? verifyPassword(password, storedHash) : password === defaultPassword;

  if (!passwordMatches) {
    throw new ApiError(401, "Contraseña incorrecta.");
  }

  if (!storedHash) {
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(password),
        passwordUpdatedAt: new Date(),
      },
    });
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
  };
}
