# EMS mobile app — Manager screens

Expo (React Native) app for the Employee Management System, built on `feature/manager`.
It talks to the Express API in `../backend`; it never connects to PostgreSQL directly.

## Run it

Start PostgreSQL and the backend first (`node server.js` in `../backend`, port 5000). Then:

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

## Sign in

The backend has no login endpoint yet, so sign-in is a demo: pick a role, any email works,
and the password is not checked or sent. **Manager** opens the manager app; HR Admin and
Employee show a placeholder (those screens are built on `feature/hr-admin` / `feature/employee`).

## What is real and what is sample data

| Screen | Data | Backend endpoint that will replace the sample |
|---|---|---|
| My Team, member details | **Real** — `GET /api/employees` (all employees until `Employee` has a manager link) | `GET /api/manager/team` |
| Attendance (team, member last 7 days) | Sample | `GET /api/manager/attendance?date=YYYY-MM-DD` |
| Leave approvals, leave history | Sample (approve/reject kept in memory) | `GET /api/manager/leave-requests`, `PATCH /api/manager/leave-requests/:id` |
| Overview | Team size real, the rest sample | — |

Screens with sample data show a yellow **Sample data** badge. All data access goes through
`src/api/manager.js` — swap a function's body for a `request()` call when its endpoint exists.

## Layout

```
src/app/            screens (Expo Router — every file is a route)
  login.js          demo sign-in
  (manager)/        bottom tabs: Overview, My Team, Attendance, Leave
  member/[id].js    team member details
  coming-soon.js    HR Admin / Employee placeholder
src/api/            client.js (fetch wrapper), employees.js, manager.js, mock.js
src/components/     shared UI
src/auth/           demo session (replace with JWT + expo-secure-store)
```
