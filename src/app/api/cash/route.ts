import { requireApiUser } from "@/server/api/auth";
import { handleApiError, ok } from "@/server/api/responses";
import { getCashData } from "@/server/queries";

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getCashData());
  } catch (error) {
    return handleApiError(error);
  }
}
