# EMS backend

Express 5 + Prisma 7 + PostgreSQL API for the Employee Management System.

## Set up

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm run migrate:deploy        # create or update the tables
npm run create-admin          # an HR_ADMIN account, or a MANAGER / EMPLOYEE linked to an employee
npm run reset-device -- 12    # HR: forget employee 12's lost or replaced phone (see below)
npm run seed                  # optional: sample leave requests and six weeks of attendance
npm start                     # http://localhost:5000
```

`create-admin` asks for a role. `MANAGER` and `EMPLOYEE` accounts also need the **database id**
of the employee they belong to. A manager then sees the employees whose `managerId` is that id;
an employee account checks that employee in and out. One account per employee.

## Who can do what

| Route | Who |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | anyone / any signed-in account |
| `/api/employees` (list with `?page=&pageSize=`, get, create, update, delete; `GET`/`DELETE /:id/device` for the registered phone) | `HR_ADMIN` |
| `/api/manager/...` (team, team member, leave requests, approve/reject, attendance, correction requests) | `MANAGER`, own team only |
| `/api/attendance` (everyone's day; write, fix or remove a check-in) | `HR_ADMIN` |
| `/api/attendance-corrections` (list, approve/reject) | `HR_ADMIN` |
| `/api/leave-requests` (everyone's leave, approve/reject any) | `HR_ADMIN` |
| `/api/me/...` (own profile, check-in, check-out, attendance, leave) | `EMPLOYEE`, `MANAGER`; always the signed-in account's own employee |
| `GET /health` | anyone; `{ "status": "ok" }` or 503 when the database is unreachable |

## Attendance

Employees check themselves in and out (`/api/me`, below); managers do too, for their own days.
`npm run seed` fills the last six weeks with sample check-ins, except **today** for anyone who has
a login, since they check in themselves. Managers **can't change** their team's attendance: when a
record is wrong they ask HR for a correction, and only an HR approval changes it. HR admins can
also write, fix or remove anyone's day directly; every such change is kept in the history.

One shift for everyone, Monday to Friday, set in `.env`: `SHIFT_START` (09:00), `SHIFT_END`
(17:00), `LATE_GRACE_MINUTES` (5) and `COMPANY_TIMEZONE` (Asia/Karachi). Times in requests and
responses are `"HH:MM"` in that timezone; days are `"YYYY-MM-DD"`.

A day's status, checked in this order:

| Status | When |
|---|---|
| `OFF` | Saturday, Sunday, or before the hire date |
| `ON_LEAVE` | an approved leave request covers the day |
| `PRESENT` / `LATE` | checked in; late if more than the grace minutes after the shift start |
| `INACTIVE` | no check-in, and the employee's `status` isn't `active` (left or on hold), so they aren't expected at work |
| `NOT_IN` | no check-in yet today, and the shift hasn't ended |
| `ABSENT` | no check-in |

Manager routes (own team only):

| Route | Does |
|---|---|
| `GET /api/manager/attendance?date=YYYY-MM-DD` | the team's day (default today; no future dates): `{ date, today, workday, shift, rows: [{ employee, record }], counts }` |
| `GET /api/manager/team/:id/attendance?days=7` | one member's last 1–31 days, newest first: `{ employee, today, shift, records }` |
| `POST /api/manager/attendance-corrections` | ask HR to fix a day: `{ employeeId, date, checkIn, checkOut?, reason }` (201) |
| `GET /api/manager/attendance-corrections?status=` | the team's requests |

A record is `{ date, status, checkIn, checkOut, correction: { id, status } | null, correctable }`.
`today` is the company's own day, so an app shows that instead of the device's day, which may sit
in another timezone.
`correctable` says whether the manager may ask for a correction now. Requests are allowed for
active employees, for today and the 6 days before it, on work days, not on approved leave, and one waiting request per
person and day (409 otherwise). Leaving out `checkOut` keeps the recorded check-out.

Own attendance (`EMPLOYEE` and `MANAGER` accounts, always the account's own employee):

| Route | Does |
|---|---|
| `GET /api/me/attendance/today` | `{ today, workday, shift, record, canCheckIn, canCheckOut, notice, deviceRegistered }`; `notice` says why check-in is off |
| `POST /api/me/device` | registers this phone (`{ platform: "android" \| "ios" }`); 201 `{ key, device }`, the key only this once; 409 if one is already registered |
| `POST /api/me/attendance/check-in` | header `X-Device-Key: <key>`; starts today's record at the server's time; returns the same object as today |
| `POST /api/me/attendance/check-out` | header `X-Device-Key: <key>`; ends it; returns the same object |
| `GET /api/me/attendance?days=7` | own last 1–31 days, newest first: `{ today, shift, records }` |
| `GET /api/me` | own profile: `{ employee }`, with `manager` (or null) |
| `GET /api/me/leave-requests` | own leave, pending first: `{ today, leaveRequests }` |
| `POST /api/me/leave-requests` | `{ type: "Annual" \| "Sick" \| "Casual", startDate, endDate, reason? }`; 201 `{ leaveRequest }` |
| `DELETE /api/me/leave-requests/:id` | cancels an own request while it is still pending (409 once decided) |

Leave counts working days only (no weekends), covers at most 60 days, and is refused (409) when
it overlaps a pending or approved request. The check and the save run in one Serializable
transaction, so two requests sent at the same moment can't both pass.

Check-in is refused on weekends and before the hire date (400), for an employee whose `status`
isn't `active` (403), on approved leave (409), and a second time the same day (409). Check-out
needs a check-in and works once (409 otherwise). Times always come from the server's clock, never
the phone's. A forgotten or wrong check-in or check-out is fixed the usual way: the manager asks HR
for a correction.

**Registered phones.** Each person checks in from one phone. The first time, the app registers it
and the server returns a random key that the phone keeps in its secure storage; the server stores
only the key's SHA-256 hash. Check-in and check-out are refused (403) without the right key, so
nobody can check in from someone else's phone or from a browser. Before sending the key, the app
asks for the phone's fingerprint or face (or its PIN), and no biometric data ever reaches the server.
When a phone is lost or replaced, an HR admin resets it (`DELETE /api/employees/:id/device`, or
`npm run reset-device -- <id>`), and the person registers the new one.

Limits worth knowing: the fingerprint prompt is checked by the app, not the server (making the key
unreadable without a fingerprint needs a development build, not Expo Go); iPhone Face ID needs a
development build too (Expo Go uses the passcode); and someone technical could register a script
instead of a phone the first time. The strongest option is still an office fingerprint machine.

### For the HR app: attendance corrections

`GET /api/attendance-corrections?status=PENDING` (status optional) returns `{ corrections }`,
waiting ones first:

```json
{
  "id": 3, "employeeId": "EMP002", "employeeDbId": 1, "employeeName": "Second User",
  "department": "Sales", "date": "2026-10-08",
  "requested": { "checkIn": "09:00", "checkOut": "17:00" },
  "before": { "checkIn": "09:40", "checkOut": "17:30" },
  "reason": "Fingerprint machine was down", "status": "PENDING",
  "requestedBy": "Test UI", "requestedAt": "2026-10-09T06:12:00.000Z",
  "decidedBy": null, "decidedAt": null, "decisionNote": null
}
```

`before` is the record as it is now (null if there is none); once approved, it is what the
record said before the change.

`PATCH /api/attendance-corrections/:id` with `{ "status": "APPROVED" | "REJECTED", "note": "optional" }`
decides a waiting request and returns `{ correction }`. Approving writes the requested times
into the attendance record; rejecting changes nothing. A request can only be decided once (409).

The HR app shows these under **Attendance → Requests from managers**.

### HR admins: attendance and leave

| Route | Does |
|---|---|
| `GET /api/attendance?date=YYYY-MM-DD` | everyone's day except people who left (`terminated`): the same shape as the manager's, and each record has `editable` instead of `correctable` |
| `PUT /api/attendance` | `{ employeeId, date, checkIn, checkOut?, note? }` writes or fixes the day ("HH:MM"; no `checkOut` means none); returns `{ record }` |
| `DELETE /api/attendance/:employeeId/:date` | optional body `{ note }`; removes that day's check-in (404 if there is none); returns `{ record }` |
| `GET /api/leave-requests?status=` | every employee's leave, with `managerName` and `decidedBy` |
| `PATCH /api/leave-requests/:id` | `{ status, note? }` decides any pending request (409 once decided); `decidedBy` then reads "Name (HR)" |

HR can't write a weekend, a day before the hire date, a day of approved leave or a future day, and
today's times can't be later than now. Every HR change is saved as an already-approved correction
(`source: "HR"`) with who made it, when, the times before and the note ("Changed by HR" or "Check-in
removed by HR" without one), so managers and employees see "Corrected by HR". These history rows
aren't requests, so they don't appear in the correction lists.

## Tests

`npm test` runs the API tests against a **separate** database, set in `.env` as
`TEST_DATABASE_URL` (its name must end in `_test`; it is created if missing and wiped on every
run). The script refuses to run against `DATABASE_URL`.

## Production checklist

- Serve the API over **HTTPS** only, behind a reverse proxy (nginx, a load balancer), and set
  `TRUST_PROXY=1` so rate limits see the real client IP.
- `NODE_ENV=production`, a random `JWT_SECRET` of 32+ characters (the server refuses to start
  otherwise), and `CORS_ORIGINS` set to the web app's origin if there is one.
- Connect with a database user that can only read and write the EMS tables, not a superuser.
  Run `npm run migrate:deploy` on each release.
- Keep `.env` out of git (it is ignored). Run with a process manager (systemd, pm2, Docker) that
  restarts the server; it shuts down cleanly on `SIGTERM`.
- Never run `npm run seed` there: it refuses when `NODE_ENV=production`, because it adds sample data.

Built in: security headers (helmet), a CORS allow list, 100 kB JSON bodies, bcrypt passwords,
8-hour tokens, role checks on every route, input validation with length limits, and rate limits:
10 failed sign-ins per 15 minutes per IP **and email** (so typos on one office Wi-Fi don't lock
everyone out), and 300 requests per minute per signed-in user (per IP when not signed in).

### `npm audit`

The packages the API runs on have no known vulnerabilities. `npm audit` still reports issues in
the `prisma` CLI (a dev tool used for migrations: `mysql2` and `deepmerge-ts`, neither used by the
running API). They go away when Prisma ships updated dependencies; don't run
`npm audit fix --force`, which downgrades Prisma to 6.
