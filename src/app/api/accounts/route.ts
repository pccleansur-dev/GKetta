import { requireApiUser } from "@/server/api/auth";
import { handleApiError, ok } from "@/server/api/responses";
import { getAccountsPageData } from "@/server/queries";

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getAccountsPageData());
  } catch (error) {
    return handleApiError(error);
  }
}
