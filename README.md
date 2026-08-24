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
- **Database**: SQLite (one file on disk — `data/reading-race.db`), via
  `better-sqlite3`. No separate database server to run.
- **Auth**: Google sign-in, restricted to your school's email domain. Each
  teacher signs in with their Google account; teachers only see and manage
  their own class(es). The race standings page shows every class's name,
  teacher, and progress so classes can see how they're doing against each
  other.
- **Admin**: one or more designated teachers can set the race's start/deadline
  dates and see (and delete) every class across the school, for cleanup —
  but even admins don't edit another teacher's students or book log day to
  day.

This is intentionally the simplest possible shape — one process, one file
database — so it's easy to run anywhere first and move to something bigger
(a managed Postgres database, multiple server instances, etc) later without
changing how the app is built, only how it's deployed.

## Running it locally

```bash
npm install
cp .env.example .env   # see "Google sign-in setup" below
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

## Running it in production (on your own small server)

```bash
npm install
npm run build      # builds the frontend into dist/
npm run start       # one Node process, serves the API + the built frontend
```

Set these environment variables (a `.env` file works, or your host's own
mechanism):

- `GOOGLE_CLIENT_ID` — required for real sign-in (see above; add your
  server's real URL as an authorized origin).
- `ALLOWED_EMAIL_DOMAIN` — restricts sign-in to that domain (e.g.
  `suwoncca.org`). Strongly recommended once this is reachable by anyone
  outside your school.
- `ADMIN_EMAILS` — comma-separated teacher emails who get the Admin tab.
- `JWT_SECRET` — a long random string (see `.env.example` for how to
  generate one). Without it, sessions reset every time the server restarts.
- `PORT` — defaults to 3000.
- `DB_PATH` — defaults to `data/reading-race.db`. Back this file up
  periodically; it's the only place data lives.

The app is also installable as a PWA (Settings/Share → Add to Home Screen on
a phone), which needs the site served over HTTPS to fully work — a reverse
proxy like Caddy or nginx in front of the Node process is the easiest way to
get that.

## Development

```bash
npm run dev          # frontend + API together, with live reload
npm run dev:server   # just the API server
npm run build         # production build of the frontend
npm run lint          # oxlint
```
