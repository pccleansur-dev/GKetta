import { getDashboardData } from "@/server/queries";
import { requireApiUser } from "@/server/api/auth";
import { handleApiError, ok } from "@/server/api/responses";

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getDashboardData());
  } catch (error) {
    return handleApiError(error);
  }
}
