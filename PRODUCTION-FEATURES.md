# Castora production feature upgrade

This build adds five major production capabilities.

1. **Host Control Room** — live connected/stage/raised-hand counts, stage lock, chat pause, Q&A pause, slow mode, cloud recording and invitations.
2. **Email invitations & reminders** — sends invitations through Resend and stores reminder jobs. `netlify/functions/reminders.mts` runs every five minutes.
3. **Cloud recording** — starts/stops LiveKit room-composite egress and writes MP4 files to configured S3-compatible storage.
4. **500+ audience safeguards** — retains the 1,000 participant room ceiling and 10 publisher stage ceiling and adds stage lock, chat/Q&A pause and slow mode. Provider capacity still requires load testing.
5. **Analytics dashboard** — unique attendees, active users, approximate total/average watch time, peak concurrency snapshots, invitations, reminders and a minute-level concurrency timeline.

## Required after deployment

Run `supabase/setup.sql` in the same Supabase project. It creates the new production tables and updates the heartbeat/stage functions.

For invitations/reminders configure `RESEND_API_KEY` and `CASTORA_FROM_EMAIL`.

For cloud recording configure `CASTORA_RECORDING_BUCKET`, `CASTORA_RECORDING_REGION`, `CASTORA_RECORDING_ACCESS_KEY`, `CASTORA_RECORDING_SECRET_KEY`, and optionally `CASTORA_RECORDING_ENDPOINT`.

The existing Supabase and LiveKit environment variables remain required.
