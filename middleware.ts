import createMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { NextResponse } from "next/server";
import { isMastermind } from "@/lib/admin/auth";

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Admin routes — bypass i18n, require Mastermind
  if (pathname.startsWith("/admin")) {
    const discordId = (req.auth?.user as any)?.discordId;
    if (!isMastermind(discordId)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Edit mode — require Mastermind on locale routes with editMode=1
  if (req.nextUrl.searchParams.get('editMode') === '1') {
    const isLocaleRoute = routing.locales.some((l) => pathname.startsWith(`/${l}`));
    if (isLocaleRoute) {
      const discordId = (req.auth?.user as any)?.discordId;
      if (!isMastermind(discordId)) {
        const cleanUrl = new URL(req.url);
        cleanUrl.searchParams.delete('editMode');
        return NextResponse.redirect(cleanUrl);
      }
    }
  }

  // Check protected routes — /profile and /bazaar under any locale
  const isProtectedRoute = routing.locales.some(
    (locale) =>
      pathname.startsWith(`/${locale}/profile`) ||
      pathname === `/${locale}/profile` ||
      pathname.startsWith(`/${locale}/bazaar`) ||
      pathname === `/${locale}/bazaar`
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
