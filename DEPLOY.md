# Putting the system online

Today the API runs on one laptop and the app only opens through Expo Go on the same Wi-Fi, so nobody
else can sign in. To change that you need three things: the API running on a server with an `https://`
address, a PostgreSQL database for it, and an installable Android app (an APK) that points at that
address.

```
phone (APK)  ──https──▶  API on Render  ──▶  PostgreSQL on Neon
```

This guide uses **Render** for the API, **Neon** for the database and **Expo's build service (EAS)** for
the APK. The repository is already prepared for it: `render.yaml`, `mobile/eas.json`, the `build` and
`start:prod` scripts, and a script that checks the result (`npm run check-deploy`). Any other host that
runs Node and gives you HTTPS works too: see "Another host" at the end.

## What it costs

Nothing is bought by following the first steps, and you can try the whole thing for free. Prices and
limits change, and these come from the providers' pages as summarised in October 2026: check each page
when you sign up.

| | Free | Always on, for real use |
|---|---|---|
| API on Render ([pricing](https://render.com/pricing)) | Yes, but it **sleeps after 15 minutes** without a request, and the first request after that takes 30 to 60 seconds. The app waits 10 seconds, so the first sign-in of the day can fail ("did not respond"). Good for trying it out. | A paid instance, around $7 a month at the time of writing |
| Database on Neon ([pricing](https://neon.com/pricing)) | Yes: 1 GB, no time limit. It sleeps when idle and wakes in a moment. | Not needed for a small company |
| APK from Expo ([pricing](https://expo.dev/pricing)) | Yes: 15 Android builds a month, in a slower queue | Not needed |
| A domain name (optional) | | A few dollars to about $10 a year |

A card from Pakistan may or may not be accepted by a provider: check at sign-up, before you rely on it.

## 1. The database (Neon)

1. Create an account at neon.com and a new project. Choose the region closest to Pakistan
   (Singapore) so the API and the database are near each other.
2. In the project, open **Connect** and copy the connection string. Use the **plain** one, not the
   pooled one (its host name contains `-pooler`): the migrations may not work through a pooler. It
   looks like `postgresql://user:password@ep-something.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it private. Anyone with it can read and change everyone's data.

Do not copy your development database. The online database starts empty: no test accounts, no sample
people.

## 2. The API (Render)

1. Push the repository to GitHub (it is already there).
2. Create an account at render.com. Choose **New > Blueprint**, connect the GitHub repository, and
   Render reads `render.yaml`.
3. It asks for **`DATABASE_URL`**: paste the Neon string. Everything else is filled in: the region
   (Singapore), `NODE_ENV=production`, `TRUST_PROXY=1`, the company timezone, and a random
   `JWT_SECRET` that Render makes and keeps (changing it later signs everybody out).
4. Apply. Render installs, runs `npm run build`, then starts the service with `npm run start:prod`,
   which applies the database migrations that are still missing and starts the server. The first build
   takes a few minutes; the Node version it used is printed at the top of the build log (it should be 22).
5. Open `https://<your-service>.onrender.com/health`. `{"status":"ok"}` means the API reaches the
   database. The service name in `render.yaml` is `ems-api`, so the address is probably
   `https://ems-api.onrender.com`, but Render shows the real one.

`TRUST_PROXY=1` matters. Render puts a proxy in front of the server; without this setting every
user counts as the same address for the rate limits, and **a few wrong passwords from one person block
everybody's sign-in for 15 minutes**. (Tested: without it, a second client was blocked by the first.)
The server prints a warning at startup in production if it isn't set.

## 3. The first HR admin

The online database has no accounts. Create the first HR admin from your own computer, aimed at the
online database for that one command:

```powershell
cd backend
$env:DATABASE_URL = "postgresql://...the Neon string..."
npm run create-admin
Remove-Item Env:DATABASE_URL
```

```bash
cd backend
DATABASE_URL="postgresql://...the Neon string..." npm run create-admin
```

Choose `HR_ADMIN`, an email and a strong password. Don't run anything else with that address set
(`npm run seed` refuses a database on another machine, and `npm test` refuses anything that doesn't
end in `_test`). Every other login is then made by HR in the app: **Employees > a person > App login**.

## 4. Check it

```bash
cd backend
npm run check-deploy -- https://ems-api.onrender.com
```

It sends a few harmless requests and says what looks wrong: the API answers, the database is
reachable, it is served over HTTPS, requests without a login are refused, other websites aren't
invited (CORS), the rate limit is on. On the free plan it also tells you when the answer was slow.

## 5. The Android app (EAS)

1. Make an account at expo.dev. From the `mobile` folder:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` links the app to your Expo account and writes a project id into `app.json`: commit that change.
2. In `mobile/eas.json`, replace the placeholder under `EXPO_PUBLIC_API_URL` with the API's address
   (`https://ems-api.onrender.com`, no slash at the end). The `.env` file is not sent to the build
   service, so this is where the address comes from. A release build refuses anything that isn't
   `https://`.
3. Build the APK:

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

   When it is done, Expo gives a link to the APK. Open it on the phone, download, and install (Android
   asks to allow installing from this source, and may warn about an app that isn't from the Play Store).
4. Sign in with the HR admin from step 3, add the employees, give each one a login, and hand the
   temporary passwords over. Each person then registers their phone on the **Today** tab and HR
   approves it on the employee's page.

The Android package name is `com.abdalniazi.ems` (in `mobile/app.json`). It becomes permanent once the
app is on the Play Store, so change it now if you want another one. iPhones need an Apple developer
account (about $99 a year) and a different build: not covered here.

The address is built into the APK. If it ever changes (another host), the app has to be built and
installed again. A domain name of your own avoids that: point it at the host and put the domain in
`eas.json`.

## Before real people use it

- [ ] `check-deploy` passes, and a sign-in from a phone on mobile data (not your Wi-Fi) works.
- [ ] The only accounts are the real ones: no `manager@test.com`, no `employee@test.com`.
- [ ] Every person chose their own password at their first sign-in (the app forces it).
- [ ] You know where the Neon connection string and the Render dashboard login are kept.
- [ ] A first backup exists (below).
- [ ] People know their data is stored on a server in Singapore, and the company is fine with that.

## Backups

Neon keeps a short history on its own (check how long on the plan you use), but keep your own copy
too. With the PostgreSQL tools installed (`pg_dump`):

```bash
pg_dump "postgresql://...the Neon string..." --format=custom --file=ems-backup-2026-11-01.dump
```

Restore into an empty database with `pg_restore --no-owner --dbname=<address> ems-backup-2026-11-01.dump`.
A dump holds everyone's personal data: keep it private and delete old ones.

## Changing things later

- **A change to the API:** merge it into `main`. Render builds and deploys it, and `start:prod` applies
  new migrations on its own.
- **A change to the app screens:** build a new APK (step 5) and have people install it over the old one.
  Raise `version` in `mobile/app.json` when you do.
- **One server only.** The rate limits are counted in the server's memory, so keep a single instance.

## When something is wrong

| What you see | Likely cause |
|---|---|
| The app says the API "did not respond" in the morning, then works | The free instance was asleep. Retry, or move to an always-on plan. |
| "Cannot reach the API at …" | The address in `eas.json` is wrong, or the build was made before it was set. |
| "This build needs an https:// API address" | `eas.json` still has the placeholder, or the address isn't `https://`. |
| Everybody is told "too many failed sign-in attempts" | `TRUST_PROXY` isn't set (see above). |
| Everybody was signed out | `JWT_SECRET` changed. |
| The service won't start | Open the logs in Render: a missing setting is named in the first lines. |
| `/health` says the database can't be reached | The Neon string is wrong, or you copied the pooled one. |

## Another host

Anything that can run Node 22 and gives you HTTPS works (Railway, Fly.io, a VPS behind nginx or
Caddy). Give it the settings of `backend/.env.example`, with these set in production:
`DATABASE_URL`, a `JWT_SECRET` of at least 32 characters, `NODE_ENV=production` and `TRUST_PROXY` (the
number of proxies in front of the server). Build with `npm ci && npm run build`, start with
`npm run start:prod`, and use `/health` as the health check.
