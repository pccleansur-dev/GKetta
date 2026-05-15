import { NextResponse } from "next/server";

import { clearSessionCookie, destroyCurrentSession, shouldUseSecureCookie } from "@/server/api/auth";

export async function POST(request: Request) {
  await destroyCurrentSession();
  const response = NextResponse.json({ success: true });
  clearSessionCookie(response, shouldUseSecureCookie(request));
  return response;
}
