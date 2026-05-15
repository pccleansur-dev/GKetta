import { ApiError } from "@/server/api/errors";

export async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError(400, "JSON inválido.");
  }
}

export function asOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asRequiredString(value: unknown, fieldName: string) {
  const parsed = asOptionalString(value);

  if (!parsed) {
    throw new ApiError(400, `Falta completar ${fieldName}.`);
  }

  return parsed;
}

export function asOptionalNumber(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function asRequiredPositiveNumber(value: unknown, fieldName: string) {
  const parsed = asOptionalNumber(value);

  if (parsed == null || Number.isNaN(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} debe ser mayor a cero.`);
  }

  return parsed;
}

export function asOptionalInteger(value: unknown) {
  const parsed = asOptionalNumber(value);

  if (parsed == null) {
    return null;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function asOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return null;
}

export function asOptionalDate(value: unknown) {
  const parsed = asOptionalString(value);

  if (!parsed) {
    return null;
  }

  const date = new Date(`${parsed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
