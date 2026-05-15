import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";

const SETUP_COOKIE = "kettal_setup_done";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStatic =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (isStatic) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api");
  const isSetup = pathname.startsWith("/setup");

  // API routes and setup page are always accessible
  if (isApi || isSetup) {
    return NextResponse.next();
  }

  // If setup not completed, redirect everything to /setup
  const setupDone = request.cookies.get(SETUP_COOKIE)?.value;
  if (!setupDone) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  // Setup done — enforce session on protected pages
  if (pathname === "/login") {
    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
