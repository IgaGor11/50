# 50 поводов сказать спасибо

Static event website with Supabase Auth, private media, personal albums and organizer console.

## Hosting
This repository serves static files from its root on GitHub Pages. There are no build dependencies. Configure Pages to deploy main / root for this repository. Production configuration contains only the public publishable key; authorization is enforced by database functions and Storage policies.

## Usage
- Guest: open a personal invite generated in the organizer guest list. Invite links are single-use. The profile offers an optional Remember me checkbox, off by default. On another device or after logout, ask the organizer for a new invitation.
- Organizer: #admin, email/password created in Supabase. Organizer permissions are granted server-side.
- Demo: ?demo=1#admin. Uses isolated browser IndexedDB, no production access or private scenario.
- Runbook: admin only, synchronized every 5 seconds. No automatic music/video playback. Step durations were not supplied, so timer shows elapsed time.
- Public program is edited separately. NEVER paste the private scenario into public program, code or repository.
- Photos: upload JPG/PNG/WebP, optimized to WebP (2200 px). Upload transparent PNG/WebP for decorative cutouts. Photos remain in a private bucket.
- Albums: upload birthday cover, individual/pair portrait and common photos, then publish albums. Pair members get identical albums when they share a portrait and both consent. Opt-out removes personal spreads.
- Keep high-resolution common originals in Google Drive / Yandex Disk and set the shared folder link in Albums. This link is visible to all invited guests; no private portraits there.

## Validation
npm test; npm run check. SQL regression tests run inside a transaction and roll back synthetic fixtures. Browser UI and PDF export checked locally. Stress test is 5,000 local album builds against 1,000 synthetic guests / 500 photos; it is not a production concurrent-load test.

## Limits
Free service storage/traffic limits still apply. Monitor Supabase usage before the event. Downloaded files and already issued signed URLs cannot be recalled. Sessions use sessionStorage by default; only explicit guest opt-in persists their session in localStorage. Use profile logout on a shared device. Private runbook content is intentionally absent from migrations and this repository.
