# Employee Management System

A mobile app and API for a small company: HR keeps the employee records and attendance, managers
approve their team's leave, and employees check in and out and ask for leave from their phone.

| Folder | What it is |
|---|---|
| [`backend/`](backend/README.md) | Express 5 + Prisma 7 + PostgreSQL API |
| [`mobile/`](mobile/README.md) | Expo (React Native) app for HR admins, managers and employees |

## Who uses it

| Role | What they do in the app |
|---|---|
| **HR admin** | Adds, edits and deletes employees, approves the phone each person checks in from, writes or corrects attendance (and approves managers' correction requests), and sees and decides everyone's leave (this is how leave gets decided for people with no manager) |
| **Manager** | Sees their own team, the team's attendance for a day (and asks HR to correct a wrong one), approves or rejects the team's leave, and checks in like an employee |
| **Employee** | Checks in and out from their registered phone (with a fingerprint), sees their profile and manager, their attendance and leave balance, and asks for or cancels leave |

Manager and employee accounts each belong to one employee. Everyone signs in with an email and a
password, and the server decides which screens they get from their role. Anyone can change their
own password in the app (the key icon in the header), which signs them out on their other devices.

## Get it running

You need Node.js 20.19 or newer and PostgreSQL.

1. **Backend** (see [`backend/README.md`](backend/README.md) for the details):

   ```bash
   cd backend
   npm install
   cp .env.example .env            # fill in DATABASE_URL and JWT_SECRET
   npm run migrate:deploy          # create the tables
   npm run create-admin            # the first account: choose HR_ADMIN
   npm start                       # http://localhost:5000
   ```

2. **Mobile app** (see [`mobile/README.md`](mobile/README.md)):

   ```bash
   cd mobile
   npm install
   cp .env.example .env            # on a phone, set EXPO_PUBLIC_API_URL to your computer's LAN address
   npx expo start --clear          # scan the QR code with Expo Go, or press w for the browser
   ```

3. Sign in as the HR admin and add some employees. Open an employee and use **App login** to create
   their login (employee or manager): the app shows a temporary password once, you give it to the
   person, and they choose their own when they first sign in. The same card resets a forgotten
   password, turns a login off or on, and switches it between employee and manager. Give employees a
   manager by editing them in the app.

## Day to day

- **Tests:** `npm test` in `backend/` (uses its own `_test` database, never your real one) and
  `npx expo lint` in `mobile/`.
- **Branches:** one branch per piece of work, opened as a pull request into `main`.
- **Rules built in:** a day without a check-in counts as absent only after the shift ends;
  check-in after 09:05 is late; weekends have no shift, but anyone who works one checks in as
  usual; leave counts Monday to Friday, can't overlap another request or go past the year's
  balance. The shift (09:00 to 17:00), the timezone and the leave days are set in `backend/.env`.
