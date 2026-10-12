# EMS backend

Express 5 + Prisma 7 + PostgreSQL API for the Employee Management System.

## Set up

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm run migrate:deploy        # create or update the tables
npm run create-admin          # an HR_ADMIN account, or a MANAGER linked to an employee
npm run seed                  # optional: sample leave requests
npm start                     # http://localhost:5000
```

`create-admin` asks for a role. A `MANAGER` account also needs the **database id** of the
employee it belongs to; that manager then sees the employees whose `managerId` is that id.

## Who can do what

| Route | Who |
|---|---|
| `POST /api/auth/login`, `GET /api/auth/me` | anyone / any signed-in account |
| `/api/employees` (list with `?page=&pageSize=`, get, create, update, delete) | `HR_ADMIN` |
| `/api/manager/...` (team, team member, leave requests, approve/reject) | `MANAGER`, own team only |
| `GET /health` | anyone; `{ "status": "ok" }` or 503 when the database is unreachable |

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

Built in: security headers (helmet), a CORS allow list, 100 kB JSON bodies, 10 failed sign-ins per
15 minutes and 300 requests per minute per IP, bcrypt passwords, 8-hour tokens, role checks on
every route, and input validation with length limits.

### `npm audit`

The packages the API runs on have no known vulnerabilities. `npm audit` still reports issues in
the `prisma` CLI (a dev tool used for migrations: `mysql2` and `deepmerge-ts`, neither used by the
running API). They go away when Prisma ships updated dependencies; don't run
`npm audit fix --force`, which downgrades Prisma to 6.
