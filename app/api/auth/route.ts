import { cookies } from 'next/headers';
import { authCall, failure, sameOrigin, json } from '@/lib/server';

export const dynamic = 'force-dynamic';

async function saveSession(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}) {
  const cookieStore = await cookies();

  cookieStore.set('castora_access', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.expires_in || 3600,
  });

  cookieStore.set('castora_refresh', session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);

    const body = await request.json();

    if (body.action === 'send') {
      const email = String(body.email || '').trim().toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254
      ) {
        throw new Error('Enter a valid email address.');
      }

      await authCall('otp', {
        email,
        create_user: true,
      });

      return json({
        ok: true,
        message: 'Verification code sent.',
      });
    }

    if (body.action === 'verify') {
      const email = String(body.email || '').trim().toLowerCase();
      const code = String(body.code || '').trim();

      if (!/^\d{6,10}$/.test(code)) {
        throw new Error('Enter the numeric code from your email.');
      }

      const session = await authCall('verify', {
        email,
        token: code,
        type: 'email',
      });

      if (!session.access_token || !session.refresh_token) {
        throw new Error('Sign-in could not be completed.');
      }

      await saveSession(session);

      return json({
        ok: true,
        signedIn: true,
      });
    }

    if (body.action === 'refresh') {
      const cookieStore = await cookies();
      const refreshToken = cookieStore.get('castora_refresh')?.value;

      if (!refreshToken) {
        return Response.json(
          { error: 'Please sign in to continue.' },
          { status: 401 }
        );
      }

      const session = await authCall(
        'token?grant_type=refresh_token',
        {
          refresh_token: refreshToken,
        }
      );

      if (!session.access_token || !session.refresh_token) {
        throw new Error('Session refresh failed.');
      }

      await saveSession(session);

      return json({ ok: true });
    }

    if (body.action === 'signout') {
      const cookieStore = await cookies();
      const accessToken = cookieStore.get('castora_access')?.value;

      try {
        if (accessToken) {
          await authCall('logout?scope=local', {}, accessToken);
        }
      } catch {}

      cookieStore.delete('castora_access');
      cookieStore.delete('castora_refresh');

      return json({ ok: true });
    }

    throw new Error('Unknown sign-in action.');
  } catch (error) {
    return failure(error);
  }
}
