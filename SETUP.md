# Shipping Calendar — Setup Guide (Phase 1)

This gets you a live website where teammates sign in (Google or email),
share one color-coded calendar, get an auto ship-date one week before each
event, and receive a Slack message on ship day.

**You'll create free accounts on:** GitHub, Vercel, Supabase, and one Slack webhook.
Total time: about 30–45 minutes. Follow the steps in order.

---

## Step 1 — Get the code onto GitHub

1. Create a free account at github.com if you don't have one.
2. Create a new **empty** repository called `ship-calendar` (no README).
3. On your computer, install Node.js 18+ (nodejs.org) and Git (git-scm.com).
4. Unzip this project, open a terminal in the folder, and run:
   ```
   git init
   git add .
   git commit -m "initial"
   git remote add origin https://github.com/YOUR-USERNAME/ship-calendar.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2 — Set up the database (Supabase)

1. Go to supabase.com, sign up, click **New project**. Pick a name and a
   strong database password (save it). Wait ~2 min for it to provision.
2. Left sidebar → **SQL Editor** → **New query**. Open the file
   `supabase/schema.sql` from this project, paste its contents in, click **Run**.
   You should see "Success." (This also creates the `public_board` view the
   TV board reads from, and the tracking fields on each event.)
3. Left sidebar → **Project Settings** → **API**. Copy these three values —
   you'll paste them into Vercel in Step 5:
   - Project URL  → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY`
     (keep this one secret — it can bypass all security rules)

### Turn on sign-in methods
4. Left sidebar → **Authentication** → **Providers**.
   - **Email**: already on. That gives you the "email me a link" option.
   - **Google**: toggle on. It asks for a Client ID and Secret — see Step 3.

---

## Step 3 — Enable Google sign-in

1. Go to console.cloud.google.com → create a new project (top bar).
2. Search "OAuth consent screen" → configure it: User type **External**,
   fill app name + your email, save. Add yourself under **Test users**.
3. Search "Credentials" → **Create credentials** → **OAuth client ID** →
   type **Web application**.
4. Under **Authorized redirect URIs**, add the callback URL Supabase shows
   you on its Google provider page (looks like
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
5. Copy the generated **Client ID** and **Client Secret**, paste them into
   the Supabase Google provider form (Step 2.4), and save.

> If you get stuck here, you can skip Google for now — the email sign-in
> link works on its own. Come back to this later.

---

## Step 4 — Create the Slack reminder webhook

1. Go to api.slack.com/apps → **Create New App** → **From scratch**.
   Name it, pick your workspace.
2. Left menu → **Incoming Webhooks** → toggle **On**.
3. Click **Add New Webhook to Workspace**, choose the channel where reminders
   should post (e.g. `#shipping`), click **Allow**.
4. Copy the **Webhook URL** (starts with `https://hooks.slack.com/services/...`).
   This is `SLACK_WEBHOOK_URL`.

---

## Step 5 — Deploy on Vercel

1. Go to vercel.com, sign up **with your GitHub account**.
2. **Add New → Project** → import your `ship-calendar` repo → **Deploy**
   (the first deploy may fail until env vars are set — that's fine).
3. Go to the project → **Settings → Environment Variables**. Add each of
   these (values from earlier steps):

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Step 2.3 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 2.3 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 2.3 |
   | `SLACK_WEBHOOK_URL` | from Step 4 |
   | `CRON_SECRET` | make up a long random string |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel URL, e.g. `https://ship-calendar.vercel.app` |

4. Go to **Deployments** → **Redeploy** the latest one so it picks up the vars.
5. Open your Vercel URL. You should see the login page. Sign in — you're live.

### Point Supabase back at your real URL
6. Supabase → **Authentication → URL Configuration**. Set **Site URL** to your
   Vercel URL, and add `https://YOUR-APP.vercel.app/auth/callback` under
   **Redirect URLs**. Save. (Without this, Google login bounces to localhost.)

---

## Step 6 — The daily Slack reminder

`vercel.json` already schedules `/api/cron/ship-reminder` to run every day at
13:00 UTC. Vercel Cron sends the `CRON_SECRET` automatically, so only Vercel
can trigger it.

- To change the time, edit the `schedule` in `vercel.json` (it's a standard
  cron expression, in UTC) and redeploy.
- To test it right now without waiting, in a terminal run:
  ```
  curl https://YOUR-APP.vercel.app/api/cron/ship-reminder \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  If an event has a ship date of *today*, a Slack message posts.

---

## Inviting teammates
- Once you're signed in, click **Invite** in the calendar header, enter a
  colleague's email, and send. They get an email with a secure link, click it,
  and set their own password. Their email is their username.
- Only signed-in users can send invites (the invite endpoint checks for a
  valid session), so the button isn't an open door.
- Passwords are handled entirely by Supabase — the app never sees, stores, or
  emails a password. "Forgot password?" on the login page sends a reset link
  to the same set-password screen.

### One required Supabase setting for invites
Supabase → **Authentication → URL Configuration** → under **Redirect URLs**
add: `https://YOUR-APP.vercel.app/set-password`
(alongside the `/auth/callback` one from Step 5.6). Without it, the invite and
reset links won't be allowed to land on your site.

> Email note: Supabase's built-in email sender is fine for a handful of invites
> but is rate-limited and not meant for volume. If invites don't arrive, check
> spam first; for reliable delivery at scale, Supabase lets you plug in your own
> SMTP provider under Authentication → Emails.

## Local events (pack instead of ship)
When adding an event, tick **Local event (pack instead of ship)**. A local
event still gets a request one week before, but it's a 📦 PACK request instead
of a 🚚 SHIP one — the calendar pill, the TV board, and the Slack reminder all
say "pack." Tracking number and carrier are hidden for local events since
there's nothing to track.

## Already set up an earlier version? Update your database
If you ran an older `schema.sql` before, don't re-run the whole file — just run
this once in Supabase → SQL Editor to add the new columns without losing data:
```sql
alter table events add column if not exists tracking_number text default '';
alter table events add column if not exists carrier text default '';
alter table events add column if not exists is_local boolean default false;

create or replace view public_board as
  select id, title, event_date, ship_date, notes, color,
         tracking_number, carrier, is_local
  from events;
grant select on public_board to anon;
```

## You now have
- A shared, sign-in-gated calendar at your Vercel URL — send the link to anyone;
  once they sign in they see and edit the same calendar, live.
- Auto ship date 7 days before each event, editable per event.
- A tracking number + carrier on each event; the number links to the carrier's
  tracking page (UPS, FedEx, USPS, DHL).
- A daily Slack reminder for anything shipping that day.

## The office TV board
- Public, read-only, no login: **`https://YOUR-APP.vercel.app/board`**
- Open that URL on the office TV in full-screen. It shows a large month
  calendar, a "ships today" strip across the top, and an "upcoming shipments"
  panel (with tracking links) down the right side.
- It refreshes live when anyone edits, and re-fetches every 5 minutes as a
  safety net, so it can stay on for days. Because it's read-only and needs no
  login, it's safe to leave running on a shared screen — nobody can edit from it.
- Most smart TVs / TV browsers let you set a "home page" or use a kiosk app to
  auto-open this URL on boot.

> Security note: the board reads through a database *view* (`public_board`)
> that exposes only calendar fields — no user identities. Editing still
> requires signing in on the main calendar.

## What's next (Phase 2 — Google Calendar two-way sync)
Not included in this build. When you're ready, the sync needs: Google Calendar
API scopes added to the OAuth screen, storing each user's refresh token, a
push-notification channel (watch) for changes coming *from* Google, and
write-back when events change here. Tell me when Phase 1 is running and I'll
build it on top of this exact structure.

## Local development (optional)
Copy `.env.example` to `.env.local`, fill in the same values, then:
```
npm install
npm run dev
```
Open http://localhost:3000. Add `http://localhost:3000/auth/callback` to
Supabase Redirect URLs to test login locally.
