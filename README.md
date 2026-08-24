# Reading Race

An app for tracking reading progress across a school, with every teacher's
class racing to be the first where **every student** hits the goal.

Each student's goal: **10 books minimum**, with **at least 2 from WonderRoom**
(the school library) and the rest from anywhere else (EPIC, home, personal
books, etc). Students can read more WonderRoom books, and more books overall,
than the minimum. A class "finishes the race" the moment its last remaining
student crosses the line — the **Race standings** page ranks every class by
that finish time.

## How it's built

- **Frontend**: React + TypeScript (Vite), talking to the backend over `/api`.
- **Backend**: a single Node.js + Express process, serving both the API and
  the built frontend on one port.
- **Database**: Postgres, via a `DATABASE_URL` connection string. Any
  Postgres host works; [Neon](https://neon.tech) has a reliable free tier
  and is what these docs walk through.
- **Auth**: Google sign-in, restricted to your school's email domain. Each
  teacher signs in with their Google account; teachers only see and manage
  their own class(es). The race standings page shows every class's name,
  teacher, and progress so classes can see how they're doing against each
  other.
- **Admin**: one or more designated teachers can set the race's start/deadline
  dates and see (and delete) every class across the school, for cleanup —
  but even admins don't edit another teacher's students or book log day to
  day.

This is intentionally the simplest possible shape — one app server process,
one database — so it's easy to run anywhere and move to something bigger
(multiple server instances, a paid database tier, etc) later without
changing how the app is built, only how it's deployed.

## Database setup (Neon, free)

The app server itself doesn't store any data on its own disk — everything
lives in Postgres, so the app can run on a host with no persistent storage
(like a free Render web service) without any risk of losing data on
restart/redeploy.

1. Go to [neon.tech](https://neon.tech) and sign up (a Google account works).
2. Create a new project — any name and region are fine.
3. On the project dashboard, find the **connection string** (usually shown
   right away, or under "Connection Details"). It looks like:
   `postgresql://user:password@ep-something.region.aws.neon.tech/dbname?sslmode=require`
4. Copy that whole string — this is your `DATABASE_URL`.

That's the entire database setup. The app creates its own tables
automatically the first time it starts against that connection string.

## Running it locally

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL (see above) and see "Google sign-in setup" below
npm run dev
```

This starts the Vite dev server (frontend) and the API server together, and
proxies `/api` requests between them. Open the URL Vite prints (usually
http://localhost:5173).

**Don't have a Google OAuth client set up yet?** Leave `GOOGLE_CLIENT_ID`
blank in `.env` — the sign-in screen will offer a test sign-in (name + email,
no password) so you can try the whole app immediately. It's automatically
disabled the moment you configure a real `GOOGLE_CLIENT_ID`.

## Google sign-in setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (create a project first if you don't have one).
2. **Create Credentials → OAuth client ID → Application type: Web application**.
3. Under **Authorized JavaScript origins**, add the URL(s) you'll run the app
   at — e.g. `http://localhost:5173` for local dev, plus your real server's
   URL once you deploy it.
4. Copy the generated **Client ID** into `GOOGLE_CLIENT_ID` in your `.env`.
5. Restart the app. The sign-in screen will now show a real "Sign in with
   Google" button.

Set `ALLOWED_EMAIL_DOMAIN` in `.env` (e.g. `suwoncca.org`) so only accounts on
your school's domain can sign in — anyone else gets a clear "only @yourdomain
accounts can sign in" message instead of a class. Any account within that
domain gets their own class(es) automatically — there's no separate invite
step. Set `ADMIN_EMAILS` (comma-separated) to grant specific teachers the
Admin tab (race dates, all-classes oversight — see below).

## Race dates

An admin (see `ADMIN_EMAILS` above) can set a start date and/or deadline from
the **Admin** tab. They control which book log entries count toward each
student's 10-book / 2-WonderRoom goal on the **Race standings** page:
entries logged before the start date or after the deadline don't count
toward finishing. Once the deadline passes, no further reading can push a
class over the line — the standings are final. Leave either date blank to
leave that side open-ended (e.g. no deadline yet). This only affects the
race standings — a teacher's own "My class" view still shows every book
they've logged.

## Deploying (Render, no terminal needed)

This deploys straight from the GitHub repo through Render's web dashboard —
no local install, no command line.

1. Do the [Database setup](#database-setup-neon-free) above first and keep
   the `DATABASE_URL` handy.
2. Go to [render.com](https://render.com) and sign up (a GitHub account
   works, and makes step 3 easier).
3. **New → Web Service**, then connect it to the `kevkim4/reading-race`
   GitHub repo (grant Render access if it asks) and pick the
   `claude/reading-race-tracker-oy6g74` branch (or whichever branch has
   this merged into it by the time you deploy).
4. Fill in:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Instance Type**: Free is fine — the app server holds no data of its
     own, so a free instance restarting doesn't lose anything.
5. Under **Environment Variables**, add each of these (values from
   `.env.example` / the sections above):
   - `DATABASE_URL` — your Neon connection string
   - `GOOGLE_CLIENT_ID`
   - `ALLOWED_EMAIL_DOMAIN`
   - `ADMIN_EMAILS`
   - `JWT_SECRET` — any long random string
   - `NODE_ENV` = `production`
6. Click **Create Web Service**. Render builds and starts it, then gives you
   a URL like `https://reading-race.onrender.com`.
7. **Go back to your Google OAuth client** (Google Cloud Console →
   Credentials) and add that Render URL under **Authorized JavaScript
   origins** — sign-in won't work from it until you do.

Free Render web services go to sleep after inactivity and take ~30-60
seconds to wake up on the next visit — normal, not a bug. If that's ever
annoying, Render's cheapest paid instance type removes the sleep, with no
other changes needed (the database is unaffected either way, since it's not
on the app server itself).

The app is also installable as a PWA (Settings/Share → Add to Home Screen on
a phone) — this works automatically once the app is on a real HTTPS URL like
the Render one above.

## Development

```bash
npm run dev          # frontend + API together, with live reload
npm run dev:server   # just the API server
npm run build         # production build of the frontend
npm run lint          # oxlint
```
