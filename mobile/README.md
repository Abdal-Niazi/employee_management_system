# EMS mobile app — Manager screens

Expo (React Native) app for the Employee Management System, built on `feature/manager`.
It talks to the Express API in `../backend`; it never connects to PostgreSQL directly.

## Run it

Start PostgreSQL and the backend first. Once, in `../backend`: add `JWT_SECRET` to `.env` (any long
random string), run `npm install` and `npx prisma migrate deploy`, and create an account with
`npm run create-admin`. For sample leave requests, run `npm run seed` (safe to repeat: people who
already have requests are skipped). Then start it with `node server.js` (port 5000). Then, here:

```bash
npm install
npm run web      # opens in the browser
npm start        # QR code for Expo Go on a phone
```

### Testing on a phone (Expo Go)

On the phone, `localhost` is the phone itself. Create `mobile/.env` with your computer's
LAN address (find it with `ipconfig`), then restart `npm start`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:5000
```

The phone and computer must be on the same Wi-Fi, and Windows Firewall must allow port 5000.

### Which manager's team you see

Managers can't sign in yet, so the app shows the team of the employee set in `mobile/.env`
(their database `id`, not their employee code):

```
EXPO_PUBLIC_MANAGER_ID=4
```

An employee's manager is set by HR with `PATCH /api/employees/:id` and `{ "managerId": 4 }`
(`null` removes it). Restart with `npx expo start --clear` after changing `.env`.

## Sign in

Sign-in calls `POST /api/auth/login`, and the server says which role the account has
(`HR_ADMIN` or `MANAGER`; create accounts with `npm run create-admin` in `backend/`). Managers see
the manager screens; for now HR admins see them too, since their own screens are not built yet. The JWT is kept in `expo-secure-store` on phones (in memory on web, so a reload signs you
out) and sent as a Bearer token. A 401 signs you out.

## What is real and what is sample data

| Screen | Data | Backend endpoint that will replace the sample |
|---|---|---|
| My Team, member details | **Real** — `GET /api/manager/team`, `GET /api/manager/team/:id` (employees whose `managerId` is the manager) | — |
| Leave approvals, leave history | **Real** — `GET /api/manager/leave-requests?status=`, `GET /api/manager/team/:id/leave-requests`, `PATCH /api/manager/leave-requests/:id` | — |
| Attendance (team, member last 7 days) | Sample, but real approved leave shows as "On leave" | `GET /api/manager/attendance?date=YYYY-MM-DD` |
| Overview | Team size and pending leave real, attendance sample | — |

Screens with sample data show a yellow **Sample data** badge. All data access goes through
`src/api/manager.js` — swap a function's body for a `request()` call when its endpoint exists.

## Layout

```
src/app/            screens (Expo Router — every file is a route)
  login.js          email + password sign-in
  (manager)/        bottom tabs: Overview, My Team, Attendance, Leave
  member/[id].js    team member details
  coming-soon.js    placeholder for roles without screens yet
src/api/            client.js (fetch wrapper + Bearer token), auth.js, manager.js, mock.js
src/components/     shared UI
src/auth/           session (AuthContext) and token storage
```
