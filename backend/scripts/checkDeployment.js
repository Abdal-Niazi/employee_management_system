// Checks a running API from the outside, the way a phone sees it, and says what looks wrong.
// Run from backend:  npm run check-deploy -- https://your-api.example.com
// It sends a few harmless requests (one of them a wrong sign-in) and changes nothing.

const isLocal = (url) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);

// Each check says whether it passed and, when it didn't, what was seen. `note` is for things worth
// knowing that aren't a failure.
const checks = (base, send) => [
  {
    name: "The API answers at /",
    run: async () => {
      const res = await send("/");
      const body = await res.json().catch(() => null);
      return { ok: res.status === 200 && Boolean(body?.message), detail: `HTTP ${res.status}` };
    },
  },
  {
    name: "The database is reachable (/health)",
    run: async () => {
      const started = Date.now();
      const res = await send("/health");
      const body = await res.json().catch(() => null);
      const seconds = (Date.now() - started) / 1000;
      return {
        ok: res.status === 200 && body?.status === "ok",
        detail: `HTTP ${res.status} in ${seconds.toFixed(1)}s`,
        // The app waits 10 seconds for an answer: a host that sleeps when idle can be slower than that
        note: seconds > 8 ? "Slow: a host that sleeps when idle would make the first request of the day fail in the app" : null,
      };
    },
  },
  {
    name: "It is served over HTTPS (release builds of the app need that)",
    run: async () => {
      if (base.startsWith("https://")) return { ok: true, detail: "https" };
      if (isLocal(base)) return { ok: true, detail: "skipped: a local address", skipped: true };
      return { ok: false, detail: `${base} is plain http: passwords would travel unprotected` };
    },
  },
  {
    name: "A request without a login is refused",
    run: async () => {
      const res = await send("/api/employees");
      return { ok: res.status === 401, detail: `HTTP ${res.status}, expected 401` };
    },
  },
  {
    name: "A wrong password is a clean 401",
    run: async () => {
      const res = await send("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.invalid", password: "not-a-real-password" }),
      });
      return { ok: res.status === 401, detail: `HTTP ${res.status}, expected 401` };
    },
  },
  {
    name: "Another website is not invited to call it (CORS)",
    run: async () => {
      const res = await send("/", { headers: { Origin: "https://another-site.example" } });
      const allowed = res.headers.get("access-control-allow-origin");
      return { ok: !allowed, detail: allowed ? `it answered access-control-allow-origin: ${allowed}` : "no CORS header" };
    },
  },
  {
    name: "It doesn't announce which framework it runs",
    run: async () => {
      const res = await send("/");
      const powered = res.headers.get("x-powered-by");
      return { ok: !powered, detail: powered ? `x-powered-by: ${powered}` : "no x-powered-by" };
    },
  },
  {
    name: "Requests are rate limited",
    run: async () => {
      const res = await send("/api/employees");
      const limit = res.headers.get("ratelimit") ?? res.headers.get("ratelimit-policy");
      return { ok: Boolean(limit), detail: limit ? `ratelimit: ${limit}` : "no ratelimit header" };
    },
  },
  {
    name: "An unknown route gives a JSON 404",
    run: async () => {
      const res = await send("/api/does-not-exist");
      const body = await res.json().catch(() => null);
      return { ok: res.status === 404 && Boolean(body?.message), detail: `HTTP ${res.status}` };
    },
  },
];

// Runs every check against `baseUrl`. Never throws: a check that can't even connect fails.
const runChecks = async (baseUrl) => {
  const base = baseUrl.replace(/\/+$/, "");
  const send = (path, options = {}) => fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000), ...options });

  const results = [];
  for (const check of checks(base, send)) {
    try {
      results.push({ name: check.name, ...(await check.run()) });
    } catch (error) {
      results.push({ name: check.name, ok: false, detail: `Couldn't connect: ${error.cause?.code ?? error.message}` });
    }
  }

  return results;
};

const main = async () => {
  const url = process.argv[2];
  if (!url || !/^https?:\/\//.test(url)) {
    console.error("Give the API address. Usage: npm run check-deploy -- https://your-api.example.com");
    process.exitCode = 1;
    return;
  }

  console.log(`Checking ${url}\n`);
  const results = await runChecks(url);

  for (const { name, ok, detail, note, skipped } of results) {
    console.log(`${skipped ? "-" : ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
    if (note) console.log(`     note: ${note}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? "\nEverything checked looks fine." : `\n${failed.length} check(s) failed.`);
  process.exitCode = failed.length === 0 ? 0 : 1;
};

if (require.main === module) main();

module.exports = { runChecks };
