# EMS mobile app — Manager and Employee screens

Expo (React Native) app for the Employee Management System: the Manager screens
(`feature/manager`) and the Employee screens (`feature/employee`).
It talks to the Express API in `../backend`; it never connects to PostgreSQL directly.

## Run it

Start PostgreSQL and the backend first (see `../backend/README.md`): `npm install`,
`npm run migrate:deploy`, a manager account (below), optionally `npm run seed` for sample leave
requests and attendance, then `npm start` (port 5000). Then, here:

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

### A manager account

Each manager signs in with their own account, which belongs to one employee. In `../backend` run
`npm run create-admin`, choose role `MANAGER`, and give that employee's database `id` (not their
employee code). The manager then sees the employees whose `managerId` is that id; HR sets it with
`PATCH /api/employees/:id` and `{ "managerId": 4 }` (`null` removes it).

### An employee account

Same script, role `EMPLOYEE`, and the employee's database `id`. That person then signs in to
check themselves in and out and see their own attendance.

### Release builds

A release build only accepts an `https://` `EXPO_PUBLIC_API_URL`; plain `http://` works in
development only.

## Sign in

Sign-in calls `POST /api/auth/login`, and the server says which role the account has
(`HR_ADMIN`, `MANAGER` or `EMPLOYEE`; create accounts with `npm run create-admin` in `backend/`).
Managers see the manager screens, and only for their own team; employees see their own Today and
My attendance tabs; HR admins see a placeholder until their screens are built. The JWT is kept in
`expo-secure-store` on phones (in memory on web, so a reload signs you out) and sent as a Bearer
token. A 401 signs you out. If the server can't be reached when the app starts, you stay signed in
and get a "Can't connect to the server" screen with **Retry**.

## Where the data comes from

Every screen shows real data from the backend; all calls go through `src/api/manager.js`.

| Screen | Backend |
|---|---|
| My Team, member details | `GET /api/manager/team`, `GET /api/manager/team/:id` (employees whose `managerId` is the manager) |
| Leave approvals, leave history | `GET /api/manager/leave-requests?status=`, `GET /api/manager/team/:id/leave-requests`, `PATCH /api/manager/leave-requests/:id` |
| Attendance, member's last 7 days | `GET /api/manager/attendance?date=YYYY-MM-DD`, `GET /api/manager/team/:id/attendance?days=7` |
| Correction requests | `POST /api/manager/attendance-corrections`, `GET /api/manager/attendance-corrections` |
| Overview | today's attendance and pending leave |

"Today" always comes from the server (`today` in the attendance answers), never from the phone's
clock: the company day is Asia/Karachi, and a phone set to another timezone would otherwise ask for
the wrong day — or one the server sees as the future.

Attendance records come from people checking themselves in (below); `npm run seed` in `backend/`
adds six weeks of sample check-ins for the past. **Managers can't change their team's attendance.** On the Attendance tab, tapping a person (today and the 6 days before) opens a form to
ask HR for a correction with a reason. The day then shows "Correction waiting for HR"; only an HR
approval changes it ("Corrected by HR"). **My correction requests** lists every request and HR's
answer. Team members whose record isn't active show as "Inactive" instead of "Absent", aren't
counted, and can't be corrected from the app (HR handles them).

## Checking in (employees, and managers for themselves)

All calls go through `src/api/me.js` (`/api/me/...`, always the signed-in person's own employee).

| Screen | Backend |
|---|---|
| Today tab, and the card on the manager's Overview | `GET /api/me/attendance/today`, `POST /api/me/attendance/check-in`, `POST /api/me/attendance/check-out` |
| My attendance (7 / 14 / 30 days) | `GET /api/me/attendance?days=` |

`CheckInCard` shows **Check in**, then **Check out** (which asks once more, since a check-out can't
be undone), then "Done for today". The server's clock sets the times and the server decides what
is allowed: on weekends, on approved leave, before the first day or for an employee who isn't
active, the card shows the server's reason instead of a button. A forgotten or wrong time is fixed
by the manager's correction request to HR.

## Layout

```
src/app/            screens (Expo Router — every file is a route)
  login.js          email + password sign-in
  (manager)/        bottom tabs: Overview, My Team, Attendance, Leave
  (employee)/       bottom tabs: Today, My attendance
  member/[id].js    team member details
  corrections.js    the manager's attendance correction requests
  coming-soon.js    placeholder for roles without screens yet (HR admin)
src/api/            client.js (fetch wrapper + Bearer token), auth.js, manager.js, me.js
src/components/     shared UI
src/auth/           session (AuthContext) and token storage
```
