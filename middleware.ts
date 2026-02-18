import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Check protected routes — /profile under any locale
  const isProtectedRoute = routing.locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/profile`) ||
      pathname === `/${locale}/profile`
  );

  if (isProtectedRoute && !req.auth) {
    const locale = routing.locales.find((l) => pathname.startsWith(`/${l}`)) ?? routing.defaultLocale;
    const signInUrl = new URL(`/${locale}/auth/signin`, req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
