# Kalora Web Push setup

Background push is opt-in and requires a signed-in Kalora account. Local notifications can still appear while the app is open if device permission is granted.

1. Review and apply `supabase/push_notifications_migration.sql` to a staging Supabase project. It adds private subscription and delivery tables plus a service-role-only reminder query. It is not included in `schema.sql` and has not been applied to production.
2. Generate a VAPID key pair with `pnpm exec web-push generate-vapid-keys`.
3. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and a random `CRON_SECRET` in the local environment and Vercel. Keep the private VAPID key and cron secret server-only.
4. Run the project tests, install the PWA on a test device, allow notifications, select reminder types in Profile, and activate push for that device.
5. Vercel registers the daily `/api/push/dispatch` reminder job on deployment. It sends weekly, two-week, or monthly weighing reminders. Deploy only after staging checks and explicit release approval.

On iPhone, install Kalora from Safari using **Share → Add to Home Screen** before requesting push permission (iOS/iPadOS 16.4 or later). Android browsers with Web Push support can subscribe from the installed PWA or browser. A browser/device without Push API support can use local notifications while Kalora is open.
