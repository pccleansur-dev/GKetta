import { requireApiUser } from "@/server/api/auth";
import { handleApiError, ok } from "@/server/api/responses";
import { getAuditLogsData } from "@/server/queries";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const url = new URL(request.url);
    const action = url.searchParams.get("action") ?? undefined;
    const actorUserId = url.searchParams.get("actorUserId") ?? undefined;
    const entityName = url.searchParams.get("entityName") ?? undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    return ok(
      await getAuditLogsData({
        action,
        actorUserId,
        entityName,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
