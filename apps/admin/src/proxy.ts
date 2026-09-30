import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "@/lib/session";
import { PERMISSIONS, can, permissionForPath } from "@/lib/rbac";

/**
 * Route guard. Runs before every page:
 *  - no valid signed session -> /login?next=...
 *  - signed in but lacking the route's permission -> / with a reason
 *  - valid session -> slide the 35-minute idle window
 * Server components and actions re-check against the live admin record;
 * this layer is the fast first gate, not the only one.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Both sign-in steps: open without a session, and a signed-in operator is
  // sent to the console instead. /login/verify checks its own tp_mfa ticket.
  const isLogin = path === "/login" || path === "/login/verify";
  if (path === "/accept-invite") return NextResponse.next();
  const claims = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (!claims) {
    if (isLogin) return NextResponse.next();
    const url = new URL("/login", req.nextUrl);
    if (path !== "/") url.searchParams.set("next", path);
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (isLogin) return NextResponse.redirect(new URL("/", req.nextUrl));

  // Role-tier routes (team, settings, audit, ownership) are gated here from
  // the signed role. Per-admin grants can change mid-session, so those are
  // checked by the page against the live record instead of the token.
  const needed = permissionForPath(path);
  const tierOnly = needed && PERMISSIONS.find((p) => p.key === needed)?.minRole !== "admin";
  if (needed && tierOnly && !can(claims.role, [], needed)) {
    return NextResponse.redirect(new URL(`/?denied=${needed}`, req.nextUrl));
  }

  const res = NextResponse.next();
  // slide the idle window at most once a minute
  if (claims.exp - Date.now() < 34 * 60 * 1000) {
    const { sub, email, role, perms, ver } = claims;
    res.cookies.set(SESSION_COOKIE, await signSession({ sub, email, role, perms, ver }), sessionCookieOptions());
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico)$).*)"],
};
