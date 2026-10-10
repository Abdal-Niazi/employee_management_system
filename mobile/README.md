# EMS mobile app — Manager screens

Expo (React Native) app for the Employee Management System, built on `feature/manager`.
It talks to the Express API in `../backend`; it never connects to PostgreSQL directly.

## Run it

Start PostgreSQL and the backend first (see `../backend/README.md`): `npm install`,
`npm run migrate:deploy`, a manager account (below), optionally `npm run seed` for sample leave
requests, then `npm start` (port 5000). Then, here:

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

### Manager and employee accounts

Each manager and each employee signs in with their own account, which belongs to one employee. In
`../backend` run `npm run create-admin`, choose role `MANAGER` or `EMPLOYEE`, and give that employee's
database `id` (not their employee code). The manager then sees the employees whose `managerId` is that id; HR sets it with
`PATCH /api/employees/:id` and `{ "managerId": 4 }` (`null` removes it).

### Release builds

A release build only accepts an `https://` `EXPO_PUBLIC_API_URL`; plain `http://` works in
development only.

## Sign in

Sign-in calls `POST /api/auth/login`, and the server says which role the account has
(`HR_ADMIN`, `MANAGER` or `EMPLOYEE`; create accounts with `npm run create-admin` in `backend/`).
HR admins get the employee and attendance screens, managers get their team's screens, and employees
get their own profile, attendance and leave. The JWT is kept in `expo-secure-store` on phones (in memory on web, so a reload signs you
out) and sent as a Bearer token. A 401 signs you out.

## Where the data comes from

Every manager screen reads real data from `/api/manager`, through `src/api/manager.js`:

| Screen | Endpoints |
|---|---|
| My Team, member details | `GET /api/manager/team`, `GET /api/manager/team/:id` (employees whose `managerId` is the manager) |
| Leave approvals, leave history | `GET /api/manager/leave-requests?status=`, `GET /api/manager/team/:id/leave-requests`, `PATCH /api/manager/leave-requests/:id` |
| Attendance (team, member last 7 days) | `GET /api/manager/attendance?date=YYYY-MM-DD`, `GET /api/manager/team/:id/attendance?days=7` |
| Overview | team, pending leave and today's attendance counts from the endpoints above |

Attendance is recorded by HR admins (`PUT /api/attendance`); a day with no check-in is worked out
as weekend, on leave, not in yet or absent. HR admin screens use `src/api/hr.js` (`/api/employees`,
`/api/attendance`).

Employee screens read `/api/me` through `src/api/me.js`:

| Screen | Endpoints |
|---|---|
| My profile | `GET /api/me` (their details and manager) |
| My attendance | `GET /api/me/attendance?days=14` |
| My leave | `GET /api/me/leave-requests`, `POST /api/me/leave-requests`, `DELETE /api/me/leave-requests/:id` (pending only) |

## Layout

```
src/app/            screens (Expo Router — every file is a route)
  login.js          email + password sign-in
  (manager)/        bottom tabs: Overview, My Team, Attendance, Leave
  member/[id].js    team member details
  coming-soon.js    placeholder for roles without screens yet
src/api/            client.js (fetch wrapper + Bearer token), auth.js, manager.js, hr.js
src/components/     shared UI
src/auth/           session (AuthContext) and token storage
```
