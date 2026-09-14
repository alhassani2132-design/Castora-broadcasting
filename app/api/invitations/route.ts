import {
  user,
  eventFor,
  failure,
  sameOrigin,
  rows,
  insert,
  update,
  requireHost,
  json,
} from '@/lib/server';

export const dynamic = 'force-dynamic';

function emails(v: unknown) {
  return String(v || '')
    .split(/[\s,;]+/)
    .map((x) => x.trim().toLowerCase())
    .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    .slice(0, 500);
}

async function sendEmail(
  to: string,
  subject: string,
  html: string
) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.CASTORA_FROM_EMAIL;

  if (!key || !from) {
    throw new Error(
      'Email delivery is not configured. Add RESEND_API_KEY and CASTORA_FROM_EMAIL in Netlify.'
    );
  }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!r.ok) {
    throw new Error('Email provider rejected the invitation.');
  }
}

export async function GET(r: Request) {
  try {
    const u = await user();
    requireHost(u);

    const e = await eventFor(
      new URL(r.url).searchParams.get('id') || '',
      u.userId
    );

    if (e.owner !== u.userId) {
      throw new Error('Only the host can view invitations.');
    }

    return json({
      invites: await rows('invites', {
        event: 'eq.' + e.id,
        select:
          'id,email,status,sent_at,remind_at,reminder_sent',
        order: 'created.desc',
      }),
    });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(r: Request) {
  try {
    sameOrigin(r);

    const u = await user();
    requireHost(u);

    const b = await r.json();
    const e = await eventFor(b.id, u.userId);

    if (e.owner !== u.userId) {
      throw new Error('Only the host can invite attendees.');
    }

    const list = emails(b.emails);

    if (!list.length) {
      throw new Error('Enter at least one valid email address.');
    }

    const origin = new URL(r.url).origin;

    const joinUrl = new URL('/join', origin);
    joinUrl.searchParams.set('event', e.id);

    if (e.access === 'private') {
      joinUrl.searchParams.set('invite', e.invite);
    }

    const reminder = Number(b.reminderMinutes || 60);

    const remindAt = new Date(
      Date.parse(e.start) -
        Math.max(5, Math.min(10080, reminder)) * 60000
    ).toISOString();

    let sent = 0;

    for (const email of list) {
      const existing = await rows('invites', {
        event: 'eq.' + e.id,
        email: 'eq.' + email,
        limit: '1',
      });

      const id = existing[0]?.id || crypto.randomUUID();

      if (!existing[0]) {
        await insert('invites', {
          id,
          event: e.id,
          owner: u.userId,
          email,
          status: 'queued',
          remind_at: remindAt,
        });
      }

      try {
        await sendEmail(
          email,
          `You're invited: ${e.title}`,
          `
            <h2>${e.title}</h2>

            <p>
              ${
                e.description ||
                'Join the live Castora event.'
              }
            </p>

            <p>
              <strong>
                ${new Date(e.start).toUTCString()}
              </strong>
            </p>

            <p>
              <a href="${joinUrl.toString()}">
                Join event
              </a>
            </p>

            <p>
              Open the invitation link and enter your
              name and email to join.
            </p>

            <p>
              No OTP or password is required for participants.
            </p>
          `
        );

        await update(
          'invites',
          { id: 'eq.' + id },
          {
            status: 'sent',
            sent_at: new Date().toISOString(),
            remind_at: remindAt,
          }
        );

        sent++;
      } catch (err) {
        await update(
          'invites',
          { id: 'eq.' + id },
          { status: 'failed' }
        );

        if (list.length === 1) {
          throw err;
        }
      }
    }

    return json({
      ok: true,
      sent,
      scheduled: list.length,
    });
  } catch (e) {
    return failure(e);
  }
}
