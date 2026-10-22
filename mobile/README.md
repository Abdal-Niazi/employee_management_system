# EMS mobile app

Expo (React Native) app for the Employee Management System, with screens for HR admins, managers
and employees. It talks to the Express API in `../backend`; it never connects to PostgreSQL directly.

## Run it

Start PostgreSQL and the backend first (see `../backend/README.md`): `npm install`,
`npm run migrate:deploy`, an account (below), optionally `npm run seed` for sample leave
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

### Accounts

Each manager and each employee signs in with their own account, which belongs to one employee. In
`../backend` run `npm run create-admin`, choose role `MANAGER` or `EMPLOYEE`, and give that employee's
ID (the code shown in the app, such as `EMP001`). A manager then sees the employees whose manager is
that employee; HR sets that by editing an employee in the app and choosing the manager.

### Release builds

A release build only accepts an `https://` `EXPO_PUBLIC_API_URL`; plain `http://` works in
development only.

## Sign in

Sign-in calls `POST /api/auth/login`, and the server says which role the account has
(`HR_ADMIN`, `MANAGER` or `EMPLOYEE`). HR admins get the HR screens, managers get their team's
screens, and employees get their own. The JWT is kept in `expo-secure-store` on phones (in memory
on web, so a reload signs you out) and sent as a Bearer token. A 401 signs you out. If the server
can't be reached when the app starts, you stay signed in and get a "Can't connect to the server"
screen with **Retry**.

**Change password.** Every role has a key icon next to **Sign out** in the header (employees also
have a button on their Profile tab). It opens `change-password.js`: the current password, the new
one twice, each with a show/hide eye. The app checks the length and that both match, then calls
`POST /api/auth/change-password`. The answer's new token replaces the saved one, so this phone stays
signed in, while the account's other phones and browsers are signed out. If the phone can't save the new
token, it removes the old (now ended) one and says the next app start will ask to sign in.

**Logins (HR).** An employee's page has an **App login** card above **Check-in phone**. With no login
it offers **Create login** (the email starts as the employee's own, and a role of Employee or
Manager); with one it shows the email, the role and whether the person has chosen their own password
yet, and offers **Reset password**, **Make manager / Make employee** and **Turn login off / on**, each
after a confirmation. Creating and resetting show the **temporary password once** (it can be selected
and copied, and the server keeps only a hash). A person who signs in with a temporary password gets
only the change-password screen (the root navigator shows nothing else while `mustChangePassword`
is true) and goes to their own screens after choosing a password.

"Today" always comes from the server (`today` in the answers), never from the phone's clock: the
company day is Asia/Karachi, and a phone set to another timezone would otherwise ask for the wrong
day — or one the server sees as the future.

## HR admin screens

All calls go through `src/api/hr.js`.

| Screen | Backend |
|---|---|
| Employees: list, search, details, add, edit, delete | `GET/POST /api/employees`, `GET/PATCH/DELETE /api/employees/:id` |
| Employee's check-in phone: approve, reject, reset | `GET /api/employees/:id/device`, `POST /api/employees/:id/device/approve`, `DELETE /api/employees/:id/device` |
| Leave: every employee's requests, approve or reject any | `GET /api/leave-requests?status=`, `PATCH /api/leave-requests/:id` |
| Attendance: everyone's day | `GET /api/attendance?date=`, `PUT /api/attendance`, `DELETE /api/attendance/:employeeId/:date` |
| Monthly report (a month per person, CSV export) | `GET /api/attendance/report?month=` (and `&format=csv`) |
| Requests from managers | `GET /api/attendance-corrections?status=`, `PATCH /api/attendance-corrections/:id` |

HR decides leave for anyone, which is how leave gets decided for people who have no manager; the
card then says "by Name (HR)". On **Attendance**, tapping a person opens a form to write, fix or
remove their check-in for that day, with an optional note. Every HR change is kept in the history
(who, when, the times before and the note), and managers and employees see the day as "Corrected
by HR". **Requests from managers** (with the number waiting) lists the corrections managers asked
for; approving one changes the record.

**Photos.** On an employee's page HR has **Add photo** (or **Change photo** and **Remove**).
`utils/pickPhoto.js` opens the gallery (`expo-image-picker`), cuts a square from the middle and shrinks
it to 400 px as a JPEG (`expo-image-manipulator`), and the app sends it as base64 text. Every `Avatar`
that is given the employee (`photoFor={employee}`) shows the photo when the employee has one
(`photoUpdatedAt`), else the initials, and falls back to the initials if the picture can't be loaded.
Photos are only for signed-in people, so a phone's `<Image>` loads them with the login as a header
(`photoSource` in `api/client.js`); a browser can't do that with an `<img>`, so on the web
`hooks/usePhotoSource.js` fetches the picture with the login and shows a local copy. They show in the
HR employee list and page, the manager's team and a team member's page, and on an employee's own
profile (with their manager's). On iOS the permission text is set in `app.json`.

**Monthly report.** A row on the Attendance tab opens `attendance-report.js`: a month at a time (the
arrows stop at the company's current month, which the server sends), with the whole company's
person-days (present, late, absent, on leave), the hours worked, and for each person their present,
late, absent and leave days, the hours, and how many days were left without a check-out. **Export as
CSV** downloads the file in a browser; on a phone it saves the file and opens the share sheet (Drive,
WhatsApp, email, Sheets or Excel). It uses `expo-file-system` and `expo-sharing`, which Expo Go includes.

## Manager screens

All calls go through `src/api/manager.js`.

| Screen | Backend |
|---|---|
| My Team, member details | `GET /api/manager/team`, `GET /api/manager/team/:id` (employees whose `managerId` is the manager) |
| Leave approvals, leave history (each pending request shows what the employee has left) | `GET /api/manager/leave-requests?status=`, `GET /api/manager/team/:id/leave-requests`, `PATCH /api/manager/leave-requests/:id` |
| Attendance, member's last 7 days | `GET /api/manager/attendance?date=YYYY-MM-DD`, `GET /api/manager/team/:id/attendance?days=7` |
| Correction requests | `POST /api/manager/attendance-corrections`, `GET /api/manager/attendance-corrections` |
| Overview | today's attendance and pending leave, plus the manager's own check-in card |

Attendance records come from people checking themselves in (below); `npm run seed` in `backend/`
adds six weeks of sample check-ins for the past. **Managers can't change their team's
attendance.** On the Attendance tab, tapping a person (today and the 6 days before) opens a form to
ask HR for a correction with a reason. The day then shows "Correction waiting for HR"; only an HR
approval changes it ("Corrected by HR"). **My correction requests** lists every request and HR's
answer. Team members whose record isn't active show as "Inactive" instead of "Absent", aren't
counted, and can't be corrected from the app (HR handles them). Weekends show everyone too (as
"Off", or present for anyone who worked), with a short note that no shift is scheduled.

## Employee screens (and checking in)

All calls go through `src/api/me.js` (`/api/me/...`, always the signed-in person's own employee).

| Screen | Backend |
|---|---|
| Today tab, and the card on the manager's Overview | `GET /api/me/attendance/today`, `POST /api/me/device`, `POST /api/me/attendance/check-in`, `POST /api/me/attendance/check-out` |
| My attendance (7 / 14 / 30 days) | `GET /api/me/attendance?days=` |
| My leave: days left this year (with the days carried over from last year), request, track, cancel a pending one | `GET /api/me/leave-requests`, `GET /api/me/leave-balance`, `POST /api/me/leave-requests`, `DELETE /api/me/leave-requests/:id` |
| My profile, and who they report to | `GET /api/me` |

`CheckInCard` shows **Check in**, then **Check out** (which asks once more, since a check-out can't
be undone), then "Done for today". The server's clock sets the times and the server decides what
is allowed: on approved leave, before the first day or for an employee who isn't active, the card
shows the server's reason instead of a button. Weekends have no shift, but check-in works there
too, for anyone who works one. A forgotten or wrong time is fixed
by the manager's correction request to HR, or by HR directly.

**Registered phone + fingerprint.** People check in from one registered phone, which an HR admin
approves. The first time, the card offers **Register this phone**: the phone asks for its
fingerprint or face (or its PIN if those aren't set up), makes a random key (`expo-crypto`), saves
it in `expo-secure-store` first and then registers it (`src/auth/deviceKey.js`), so a lost answer
can't leave it registered without its key. The card then says the phone is waiting for HR. On the
employee's screen HR sees **Check-in phone** with **Approve** and **Reject** (and **Reset phone**
once approved); the Employees list marks phones waiting for approval. Once approved, every check-in
and check-out asks for the fingerprint again (`src/auth/confirmIdentity.js`) and sends the key; the
phone does the fingerprint check itself, so nothing biometric leaves it. On another phone the card
says it isn't the registered one, and HR resets a lost or replaced phone (or
`npm run reset-device -- EMP001` in `backend/`). The web app can't check in at all.

In Expo Go the fingerprint works on Android; iPhone Face ID needs a development build, so Expo Go
asks for the iPhone's passcode instead. A phone without any screen lock can't check in.

**Leave.** Annual, Sick or Casual, from a first to a last day (weekends aren't counted, at most 60
days). A request that overlaps a pending or approved one, or needs more days of that kind than are left this year, is refused. The manager (or HR) approves
or rejects it; a pending request can be cancelled.

## Layout

```
src/app/                screens (Expo Router — every file is a route)
  login.js              email + password sign-in
  (hr)/                 bottom tabs: Employees (its own stack), Leave, Attendance
  attendance-requests.js  HR: managers' correction requests
  (manager)/            bottom tabs: Overview, My Team, Attendance, Leave
  member/[id].js        team member details
  corrections.js        the manager's attendance correction requests
  (employee)/           bottom tabs: Today, My attendance, Leave, Profile
  coming-soon.js        shown only for a role this version of the app doesn't know
  change-password.js    any signed-in account: change your own password
src/api/                client.js (fetch wrapper + Bearer token), auth.js, hr.js, manager.js, me.js
src/components/         shared UI
src/auth/               session (AuthContext), token storage, the phone key and the fingerprint prompt
```
