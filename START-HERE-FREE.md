# Free Setup — Step by Step

Follow these in order. Everything here stays on free tiers ($0/month). The
keep-alive job (already in the code) stops Supabase's free project from pausing,
so your TV board won't go blank.

Before you start, install on your computer:
- Node.js 18+  → nodejs.org
- Git          → git-scm.com
Then unzip this project.

------------------------------------------------------------------
STEP 1 — Put the code on GitHub (free)
------------------------------------------------------------------
1. Make a free account at github.com.
2. Click + (top right) → New repository. Name it `ship-calendar`.
   Leave it empty (no README). Create.
3. In a terminal, inside the unzipped project folder, run these one at a time,
   replacing YOUR-USERNAME:
     git init
     git add .
     git commit -m "initial"
     git remote add origin https://github.com/YOUR-USERNAME/ship-calendar.git
     git branch -M main
     git push -u origin main

------------------------------------------------------------------
STEP 2 — Create the database (Supabase, free)
------------------------------------------------------------------
1. Sign up at supabase.com → New project.
2. Pick a name, set a database password (save it somewhere), pick the region
   closest to your office. Wait ~2 minutes.
3. Left sidebar → SQL Editor → New query.
4. Open `supabase/schema.sql` from this project, copy ALL of it, paste, Run.
   You should see "Success."
5. Left sidebar → Project Settings → API. Copy these three (paste into a notes
   file for Step 5):
     • Project URL
     • anon public key
     • service_role secret key   (keep private)

------------------------------------------------------------------
STEP 3 — Slack reminder webhook (free)
------------------------------------------------------------------
1. Go to api.slack.com/apps → Create New App → From scratch. Name it, pick your
   workspace.
2. Left menu → Incoming Webhooks → toggle On.
3. Add New Webhook to Workspace → choose the channel (e.g. #shipping) → Allow.
4. Copy the webhook URL (starts https://hooks.slack.com/services/...). Save it.

------------------------------------------------------------------
STEP 4 — Make a CRON_SECRET
------------------------------------------------------------------
Make up a long random string (like a password), e.g. mash the keyboard for
30+ characters. Save it. You'll paste it in Step 5. This protects the
scheduled jobs.

------------------------------------------------------------------
STEP 5 — Deploy on Vercel (free)
------------------------------------------------------------------
1. Go to vercel.com → sign up WITH GitHub.
2. Add New → Project → import `ship-calendar` → Deploy. (First deploy may fail
   before env vars exist — that's expected.)
3. Open the project → Settings → Environment Variables. Add these six:

     NEXT_PUBLIC_SUPABASE_URL        = Project URL         (Step 2.5)
     NEXT_PUBLIC_SUPABASE_ANON_KEY   = anon public key     (Step 2.5)
     SUPABASE_SERVICE_ROLE_KEY       = service_role key    (Step 2.5)
     SLACK_WEBHOOK_URL               = webhook URL         (Step 3.4)
     CRON_SECRET                     = your random string  (Step 4)
     NEXT_PUBLIC_SITE_URL            = your Vercel URL, e.g.
                                       https://ship-calendar.vercel.app

   (You'll know your Vercel URL after the first deploy — it's on the project
   page. If unsure, deploy once, copy the URL, then add this var.)
4. Deployments tab → Redeploy the latest, so it picks up the variables.

------------------------------------------------------------------
STEP 6 — Point Supabase back at your site
------------------------------------------------------------------
Supabase → Authentication → URL Configuration:
  • Site URL:  your Vercel URL
  • Redirect URLs — add BOTH:
      https://YOUR-APP.vercel.app/auth/callback
      https://YOUR-APP.vercel.app/set-password
Save. (Without this, invites, password resets, and Google login won't work.)

------------------------------------------------------------------
STEP 7 — Make yourself the first user
------------------------------------------------------------------
The Invite button only works once you're signed in — so create your own account
first:
  Supabase → Authentication → Users → Add user → enter your email + a password
  → create. (Tick "auto-confirm" if shown.)
Now go to your Vercel URL, sign in with that email + password. You're in.
From now on, use the Invite button in the app to add colleagues.

------------------------------------------------------------------
STEP 8 — Turn on the office TV
------------------------------------------------------------------
On the TV browser, open:  https://YOUR-APP.vercel.app/board
It's public and read-only — no login. Full-screen it. Done.

------------------------------------------------------------------
OPTIONAL — Google sign-in
------------------------------------------------------------------
Skip this to stay simple; email + password already works. To add it later:
Supabase → Authentication → Providers → Google → follow its instructions to
create a Google OAuth client (console.cloud.google.com) and paste in the
Client ID + Secret.

------------------------------------------------------------------
QUICK TESTS
------------------------------------------------------------------
• Add an event dated ~2 weeks out → a SHIP request pill appears one week before.
• Tick "Local event" on one → it shows a PACK request instead.
• Test Slack now: set an event's ship date to TODAY, then in a terminal run:
    curl https://YOUR-APP.vercel.app/api/cron/ship-reminder \
      -H "Authorization: Bearer YOUR_CRON_SECRET"
  A Slack message should post within seconds.

------------------------------------------------------------------
STAYING FREE
------------------------------------------------------------------
• The keep-alive job runs every 2 days to stop Supabase pausing — no action
  needed from you.
• Free Supabase has no backups. Your events aren't critical historical data,
  but if you want a safety net later, Supabase Pro ($25/mo) adds backups and
  removes any pausing risk entirely. Not required to run.
• If invite emails don't arrive, check spam. Supabase's free email is fine for
  occasional invites.
