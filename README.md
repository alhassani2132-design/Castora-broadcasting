# Castora for Netlify

Open **START-HERE.html** for the deployment guide.

- Next.js App Router and Netlify's current Next.js adapter.
- Supabase Auth with email one-time codes and HttpOnly cookies.
- Supabase Postgres for events and attendance; private Storage for recordings.
- LiveKit for real-time audio/video and live data channels.

Deploy using Netlify's Git import or CLI. This is not a static drag-and-drop build.
Build: `pnpm run build`. Publish directory: `.next`. Node: 22.

Run `supabase/setup.sql` in your Supabase project. Set the variables in `.env.example` through Netlify's environment settings. Only email addresses listed in CASTORA_HOST_EMAILS can host. Configure a production email sender and the OTP templates described in the guide before inviting your audience.

No credentials or node_modules are included. The earlier Sites deployment has not been modified. Its data is not automatically migrated.

## Validation and limits

The original package was production-build validated. This enhanced package has been source/syntax checked in this workspace; a full dependency-backed Next.js build could not be rerun here because the package registry is unavailable. Netlify will install dependencies during deployment. Verify the Supabase migration, email delivery, scheduled reminders, LiveKit connection, cloud recording, and 500+ capacity with your connected services.

Recording uploads go directly to a signed Supabase URL and remain limited to 50 MB. Production cloud recording is also available from the Host control room when S3-compatible recording storage is configured.

Production additions in this build:
- Host Control Room with live status, stage lock, chat/Q&A controls and slow mode.
- Email invitations through Resend with a Netlify scheduled function for automatic reminders.
- LiveKit provider-side room-composite cloud recording to S3-compatible object storage.
- 500+ audience safeguards: 1,000-participant room ceiling, 10-publisher stage ceiling, stage locking, chat/Q&A pause and slow mode. Actual capacity still depends on your LiveKit plan and must be load-tested.
- Analytics dashboard with unique attendance, approximate watch time, current active users, invitation/reminder counts, and minute-level peak concurrency snapshots.

Run the updated `supabase/setup.sql` after deployment even if you already ran an older version. Existing core tables are preserved and the new production tables are created idempotently.
