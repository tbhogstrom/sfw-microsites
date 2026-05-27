import { cookies } from 'next/headers';

export const AUTH_COOKIE = 'go-auth';

export async function hasValidCookie(): Promise<boolean> {
  const store = await cookies();
  const c = store.get(AUTH_COOKIE);
  return !!c && c.value === process.env.GO_PASSWORD;
}

export function hasValidBearer(request: Request): boolean {
  const auth = request.headers.get('Authorization');
  const token = process.env.SHORTENER_API_TOKEN;
  return !!token && auth === `Bearer ${token}`;
}

// Humans use the admin cookie; automation uses the bearer token.
export async function isAuthorized(request: Request): Promise<boolean> {
  return (await hasValidCookie()) || hasValidBearer(request);
}
