import type { SessionUser } from '@probuild/shared';
import { cookies } from 'next/headers';
import { createServerApi } from '@/lib/api/server';

export type ServerSession =
  | { status: 'ok'; user: SessionUser }
  | { status: 'unauthenticated' }
  | { status: 'unavailable' };

/** Resolves the signed-in user on the server by forwarding the browser cookie to the API. */
export async function getServerSession(): Promise<ServerSession> {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return { status: 'unauthenticated' };
  try {
    const { data, response } = await createServerApi(cookieHeader).GET('/v1/auth/me', {
      cache: 'no-store',
    });
    if (response.status === 401) return { status: 'unauthenticated' };
    if (!response.ok || !data) return { status: 'unavailable' };
    return { status: 'ok', user: data };
  } catch {
    return { status: 'unavailable' };
  }
}
