import { NextResponse } from "next/server";

import { handleApiError } from "@/server/api/responses";
import { readJson } from "@/server/api/request";
import { createSession, setSessionCookie, shouldUseSecureCookie } from "@/server/api/auth";
import { authenticateUser } from "@/server/services/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson<{ email?: string; username?: string; password?: string }>(request);
    const user = await authenticateUser(body.username ?? body.email, body.password);
    const sessionToken = await createSession(user.id);
    const response = NextResponse.json({ user });
    setSessionCookie(response, sessionToken, shouldUseSecureCookie(request));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
