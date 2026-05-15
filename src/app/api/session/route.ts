import { getSessionUser } from "@/lib/session";
import { ok } from "@/server/api/responses";

export async function GET() {
  const user = await getSessionUser();
  return ok({ user });
}
