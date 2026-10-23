# EMS backend

Express 5 + Prisma 7 + PostgreSQL API for the Employee Management System.

## Set up

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm run migrate:deploy        # create or update the tables
npm run create-admin          # an HR_ADMIN account, or a MANAGER / EMPLOYEE linked to an employee
npm run reset-device -- EMP001  # HR: forget EMP001's lost or replaced phone (the app has a button too)
npm run seed                  # optional: sample leave requests and six weeks of attendance
npm start                     # http://localhost:5000
npm run build                 # prisma generate (a host runs it after npm ci)
npm run start:prod            # migrate:deploy, then start: what a host runs
npm run check-deploy -- https://your-api.example.com   # checks an online API from the outside
```

`create-admin` asks for a role. Use it for the **first HR admin**; after that HR creates the logins
of employees in the app (see "Logins for employees" below). A `MANAGER` or `EMPLOYEE` account
belongs to one employee, and the script also takes it by that employee's **employee ID** (the code
shown in the app, such as `EMP001`). A manager then sees the employees whose `managerId` is that
employee, and HR sets that by editing an employee; an employee account checks that employee in and
out. One account per employee.

## Who can do what

| Route | Who |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | anyone / any signed-in account |
| `POST /api/auth/change-password` | any signed-in account, for its own password (see below) |
| `/api/employees` (list with `?page=&pageSize=`, get, create, update, delete; `GET /:id/device`, `POST /:id/device/approve` and `DELETE /:id/device` for the check-in phone; `GET`, `POST`, `PATCH /:id/account` and `POST /:id/account/reset-password` for the person's login) | `HR_ADMIN` |
| `/api/manager/...` (team, team member, leave requests, approve/reject, attendance, correction requests) | `MANAGER`, own team only |
| `/api/attendance` (everyone's day; write, fix or remove a check-in), `GET /api/attendance/report` (a month, per person) | `HR_ADMIN` |
| `GET /api/photos/:employeeId` (the picture) | any signed-in account, for the photos it may see (see below) |
| `PUT`, `DELETE /api/photos/:employeeId` (set or remove a photo) | `HR_ADMIN` |
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

Weekends have no shift, but someone who works one checks in as usual, and HR and managers can fix
that day like any other.

A day's status, checked in this order:

| Status | When |
|---|---|
| `OFF` | before the hire date |
| `PRESENT` / `LATE` | checked in (even on a weekend, or on leave approved afterwards); late if more than the grace minutes after the shift start, never on a weekend |
| `OFF` | Saturday or Sunday without a check-in |
| `ON_LEAVE` | an approved leave request covers the day |
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
active employees, for today and the 6 days before it (weekends too), not on a day of approved leave
without a check-in, and one waiting request per person and day (409 otherwise; the check and the
save run in one Serializable transaction). Leaving out `checkOut` keeps the recorded check-out.

Own attendance (`EMPLOYEE` and `MANAGER` accounts, always the account's own employee):

| Route | Does |
|---|---|
| `GET /api/me/attendance/today` | optional header `X-Device-Key`; `{ today, workday, shift, record, canCheckIn, canCheckOut, notice, device, deviceRegistered }`; `notice` says why check-in is off; `device` is null or `{ status, platform, thisPhone }` |
| `POST /api/me/device` | registers this phone with the key it made: `{ key, platform: "android" \| "ios" }`; 201 `{ device }`, waiting for HR; again while waiting replaces it; 409 once one is approved |
| `POST /api/me/attendance/check-in` | header `X-Device-Key: <key>` of the approved phone; starts today's record at the server's time; returns the same object as today |
| `POST /api/me/attendance/check-out` | header `X-Device-Key: <key>`; ends it; returns the same object |
| `GET /api/me/attendance?days=7` | own last 1–31 days, newest first: `{ today, shift, records }` |
| `GET /api/me` | own profile: `{ employee }`, with `manager` (or null) |
| `GET /api/me/leave-requests` | own leave, pending first: `{ today, leaveRequests }` |
| `GET /api/me/leave-balance?year=` | `{ year, balances: [{ type, entitlement, used, pending, remaining }] }` (default: this year) |
| `POST /api/me/leave-requests` | `{ type: "Annual" \| "Sick" \| "Casual", startDate, endDate, reason? }`; 201 `{ leaveRequest }` |
| `DELETE /api/me/leave-requests/:id` | cancels an own request while it is still pending (409 once decided) |

Leave counts working days only (no weekends), covers at most 60 days, and is refused (409) when
it overlaps a pending or approved request. The check and the save run in one Serializable
transaction, so two requests sent at the same moment can't both pass.

Check-in is refused before the hire date (400), for an employee whose `status` isn't `active`
(403), on approved leave (409), and a second time the same day (409). Check-out
needs a check-in and works once (409 otherwise). Times always come from the server's clock, never
the phone's. A forgotten or wrong check-in or check-out is fixed the usual way: the manager asks HR
for a correction.

**Registered phones.** Each person checks in from one phone. The first time, the phone makes a
random key, saves it in its secure storage and then registers it; the server stores only the key's
SHA-256 hash. The new phone **waits for an HR admin to approve it**, so knowing someone's password
isn't enough to register a phone for them. Check-in and check-out are refused (403) without the
approved phone's key, so nobody can check in from someone else's phone or from a browser. Before
sending the key, the app asks for the phone's fingerprint or face (or its PIN), and no biometric
data ever reaches the server.

HR routes for it (`HR_ADMIN`):

| Route | Does |
|---|---|
| `GET /api/employees/:id/device` | `{ registered, device }`; device is `{ status, platform, registeredAt, approvedAt, approvedBy, lastUsedAt }` or null; `lastUsedAt` is the last check-in or check-out that went through |
| `POST /api/employees/:id/device/approve` | `{ registeredAt }` of the phone HR looked at, required (422 without it; 409 if another one replaced it since, or it is already approved; 404 if none waits) |
| `DELETE /api/employees/:id/device` | rejects a waiting phone, or resets a lost or replaced one; the person registers again. `?registeredAt=` (the phone HR looked at) leaves a phone that replaced it alone (409) |

The employee list has `phoneStatus` (null, `PENDING` or `APPROVED`) on each employee. In the app,
HR approves on the employee's screen (**Check-in phone**), ideally with the person and the phone in
front of them. `npm run reset-device -- EMP001` does the same as **Reset phone**.

Limits worth knowing: the fingerprint prompt is checked by the app, not the server (making the key
unreadable without a fingerprint needs a development build, not Expo Go); iPhone Face ID needs a
development build too (Expo Go uses the passcode); and someone technical could register a script
instead of a phone, which is why HR approves each one. The strongest option is still an office
fingerprint machine.

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
Approving is refused (409) if, since the request, the employee stopped being active or the day
became approved leave without a check-in; rejecting is always possible.

The HR app shows these under **Attendance → Requests from managers**.

### HR admins: attendance and leave

| Route | Does |
|---|---|
| `GET /api/attendance?date=YYYY-MM-DD` | everyone's day except people who left (`terminated`): the same shape as the manager's, and each record has `editable` instead of `correctable` |
| `PUT /api/attendance` | `{ employeeId, date, checkIn, checkOut?, note? }` writes or fixes the day ("HH:MM"; no `checkOut` means none); returns `{ record }` |
| `DELETE /api/attendance/:employeeId/:date` | optional body `{ note }`; removes that day's check-in (404 if there is none); returns `{ record }` |
| `GET /api/leave-requests?status=` | every employee's leave, with `managerName` and `decidedBy` |
| `PATCH /api/leave-requests/:id` | `{ status, note? }` decides any pending request (409 once decided); `decidedBy` then reads "Name (HR)" |

HR can't write a day before the hire date, a day of approved leave without a check-in, or a future
day, and today's times can't be later than now; weekends are fine. Every HR change is saved as an already-approved correction
(`source: "HR"`) with who made it, when, the times before and the note ("Changed by HR" or "Check-in
removed by HR" without one), so managers and employees see "Corrected by HR". These history rows
aren't requests, so they don't appear in the correction lists.

**Deleting an employee** (`DELETE /api/employees/:id`) also deletes their leave, attendance and
registered phone. Their attendance changes are history and stay: each row keeps the person's
employee ID and name (`employeeCode`, `employeeName`), and its `employeeId` becomes null. Requests
still waiting for HR are removed, since nobody can decide them any more.

## Leave balance

Everyone gets the same working days of leave per calendar year, set in `.env`:
`LEAVE_ANNUAL_DAYS` (default 14), `LEAVE_SICK_DAYS` (8) and `LEAVE_CASUAL_DAYS` (6). A request counts
towards the year its first day falls in, only Monday to Friday days are counted, and it is refused
with a 409 if it needs more days than are left of that kind. Approved days are used up and days
waiting for a decision are held back, so asking twice can't get past the limit; rejected and
cancelled requests give their days back. `GET /api/me/leave-balance?year=` shows the numbers: per
kind of leave its `entitlement`, `carriedOver`, `used`, `pending` and `remaining`
(`entitlement + carriedOver - used - pending`, never below 0).

**Carry-over:** annual days nobody took in a year move into the next one, up to
`LEAVE_CARRY_OVER_DAYS` (default 5; 0 turns it off). Days waiting for a decision count as taken, and
rejected or cancelled requests don't. Carried days carry on, but never more than the limit a year, so
a person never has more than the yearly days plus the limit. Sick and casual days never carry over.
Nothing carries into the year a person was hired, and the first year that gets carried days is
`LEAVE_CARRY_OVER_FIRST_YEAR` (default 2027), so balances of earlier years stay as they were. The
numbers come from the requests, nothing is stored: change a setting and every year follows.

The leave lists managers and HR admins decide from carry a `balance` on every pending request (what
is left of that kind in the year it starts in, carried days included, with the request's own days
already held back), and `balance: null` on decided ones.

## Employee photos

An employee can have a photo, put on by HR (`PUT /api/photos/:employeeId` with
`{ image: "<base64 of a JPEG>" }`; `DELETE` takes it off). The picture is kept **in the database**, in
its own table (`EmployeePhoto`, a `bytea` column), so it is backed up with everything else and needs no
file storage on the server (a host's disk is wiped on every deploy). The employee only has
`photoUpdatedAt`: `null` when there is no photo, otherwise when it was set. It is part of every
employee answer (the list, one employee, a team, a profile and the manager shown on it), and the
apps put it in the picture's address (`?v=`), so a new photo is a new address and old ones can be kept.

- **What is accepted:** a JPEG of at most 200 KB once decoded (the app sends a 400 x 400 square cut from
  the middle, about 30 to 60 KB). Only the start of the file is checked (`ff d8 ff`); it is always
  served back as `image/jpeg` with `nosniff`, so whatever else it holds can't run. The request body
  limit for this one route is 400 KB (the others keep 100 KB).
- **Who sees it** (`GET`, which answers the bytes, with `Cache-Control: private`): HR everyone's; a
  manager their team's and their own; an employee their own and their manager's. Anyone else gets a
  404, the same as for a person without a photo, so the answer doesn't say who has one.
- Deleting an employee deletes their photo. A photo adds a few tens of KB per person to the database
  (and to its backups).

## Monthly attendance report

`GET /api/attendance/report?month=2026-10` (HR only) counts one month of everyone's attendance, per
person, with the same status of each day as the day screens. `month` is `YYYY-MM` (default: the
company's current month; a month that hasn't started is a 400). Only days up to today are counted, so
a month in progress has `partial: true` and `to` is today. A row has `scheduledDays` (Monday to Friday
days from the hire date), `counts` (`PRESENT`, `LATE`, `ABSENT`, `ON_LEAVE`, `NOT_IN`, `INACTIVE`),
`daysWorked` (present plus late, so a weekend that was worked counts), `workedMinutes` (from days
with both a check-in and a check-out) and `openDays` (past days with a check-in and no check-out, so
HR knows what to fix). Weekends and days before the hire date are not counted as anything. People who
left (`terminated`) and people hired after the month are left out, like on the day screen. `totals`
adds the rows up, and nothing about a person beyond name, ID, department and position is sent.

`&format=csv` answers the same table as a file download (`attendance-2026-10.csv`): one row per
person and a Total row, with a byte order mark so Excel reads accented letters, Windows line endings,
and a `'` in front of any cell that starts with `=`, `+`, `-` or `@` so a name can't run as a
formula when the file is opened.

## Logins for employees

HR creates and looks after the logins (accounts) of employees, so nobody needs the command line:

| Route | What it does |
|---|---|
| `GET /api/employees/:id/account` | The login, or `account: null` when there is none. Never any password. |
| `POST /api/employees/:id/account` with `{ role, email? }` | Creates it. `role` is `EMPLOYEE` or `MANAGER`; the email defaults to the employee's own. Not for an employee who isn't `active`; 409 if they have a login already or the email is taken. |
| `POST /api/employees/:id/account/reset-password` | For a forgotten password. |
| `PATCH /api/employees/:id/account` with `{ role? , disabled? }` | Switches between `EMPLOYEE` and `MANAGER`, and/or turns the login off (`true`) or on (`false`). |

Creating and resetting answer with a **`temporaryPassword`** (like `Kx7m-Qp3n-Rw9t`) that is shown
**once** in that answer: only its hash is stored, so it can't be looked up again. The account has
`mustChangePassword: true` until the person chooses their own: until then every route except
`GET /api/auth/me` and `POST /api/auth/change-password` answers 403 "Choose your own password
first", and changing the password clears the flag. A reset, a role change and turning a login off or
on each sign out every login the person had (they raise `tokenVersion`, see below). A turned-off login
gets a 403 at sign-in (only if the password is right, so it doesn't reveal which emails have a login)
and its tokens stop working at once. HR admin accounts are not reached by these routes. A manager who
is made an employee keeps the people who report to them, but only HR can decide that team's leave
until HR changes it.

## Changing a password

`POST /api/auth/change-password` with `{ currentPassword, newPassword }` changes the signed-in
account's own password (HR admins, managers and employees alike). The new one needs 8 or more
characters, at most 72 bytes (bcrypt's limit), and must differ from the current one (422
otherwise). A wrong current password is a **400**, not a 401, so an app doesn't sign out over a
typo. Wrong current passwords count per account like failed sign-ins (`LOGIN_RATE_LIMIT` per 15
minutes, then 429); a new password that breaks the rules (422) doesn't use up the attempts.

It answers `{ token, admin }`: **every other login of the account is signed out** (other phones,
browsers, a token someone else got hold of), and this new token keeps the caller signed in. Each
token carries the account's `tokenVersion`; a password change raises it, and older tokens get a
401. Tokens from before this existed carry none and count as 0. Of two changes sent at once only
one goes through (409 for the other).

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
12-hour tokens (`JWT_EXPIRES_IN`, so a shift doesn't end with a sign-in; an existing `.env` that sets it
keeps its own value), role checks on every route, input validation with length limits, and rate limits:
10 failed sign-ins per 15 minutes per IP **and email** (so typos on one office Wi-Fi don't lock
everyone out) plus 50 per IP for all emails together (so one address can't try a password on every
account); 1000 API requests per minute per IP, whatever token is sent, and 300 per signed-in account,
counted after its token is verified.

### `npm audit`

The packages the API runs on have no known vulnerabilities. `npm audit` still reports issues in
the `prisma` CLI (a dev tool used for migrations: `mysql2` and `deepmerge-ts`, neither used by the
running API). They go away when Prisma ships updated dependencies; don't run
`npm audit fix --force`, which downgrades Prisma to 6.
