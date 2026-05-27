import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';

// Only the admin root ('/') is protected. Slug redirects, the login page, and
// the API (which does its own cookie/bearer check) are all public.
export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get(AUTH_COOKIE);
  if (!authCookie || authCookie.value !== process.env.GO_PASSWORD) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
