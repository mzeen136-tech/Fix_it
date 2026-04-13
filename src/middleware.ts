import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ADMIN_COOKIE, TECH_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protect /admin/* (except /admin/login) ───────────────────────────────
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get(ADMIN_COOKIE)?.value;
    if (!token) return NextResponse.redirect(new URL("/admin/login", req.url));

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // ── Protect /tech/dashboard ───────────────────────────────────────────────
  if (pathname.startsWith("/tech/dashboard")) {
    const token = req.cookies.get(TECH_COOKIE)?.value;
    if (!token) return NextResponse.redirect(new URL("/tech/login", req.url));

    const payload = await verifyToken(token);
    if (!payload || payload.role !== "tech") {
      return NextResponse.redirect(new URL("/tech/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/tech/dashboard/:path*"],
};
