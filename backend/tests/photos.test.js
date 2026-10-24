const { after, before, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { app, prisma, request, seedFixtures, login } = require("./helpers");

let data;
let hr;
let managerA; // Alice: manages A-1 and A-2
let managerB; // Bob: manages B-1
let amir; // A-1, an employee account

// The start and end of a JPEG with some bytes in between: all the server looks at is the start.
const jpeg = (size = 300) => Buffer.concat([Buffer.from("ffd8ffe000104a46494600010100000100010000", "hex"), Buffer.alloc(size, 1), Buffer.from("ffd9", "hex")]);
const send = (id, bytes, headers = hr) => request(app).put(`/api/photos/${id}`).set(headers).send({ image: bytes.toString("base64") });
const fetchPhoto = (id, headers = hr) => request(app).get(`/api/photos/${id}`).set(headers).buffer(true).parse((res, done) => {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
});

before(async () => {
  data = await seedFixtures();
  hr = await login("hr@example.com");
  managerA = await login("manager.a@example.com");
  managerB = await login("manager.b@example.com");
  amir = await login("employee.a1@example.com");
});
after(() => prisma.$disconnect());

describe("setting a photo", () => {
  test("HR sets it, and the picture comes back unchanged with a date on the employee", async () => {
    const photo = jpeg(500);
    const res = await send(data.a1.id, photo);

    assert.equal(res.status, 200);
    assert.ok(res.body.photoUpdatedAt);

    const back = await fetchPhoto(data.a1.id);
    assert.equal(back.status, 200);
    assert.equal(back.headers["content-type"], "image/jpeg");
    assert.match(back.headers["cache-control"], /private/);
    assert.ok(photo.equals(back.body));

    // The employee records when it was set; the picture is not in the employee's own data
    const employee = (await request(app).get(`/api/employees/${data.a1.id}`).set(hr)).body.employee;
    assert.equal(employee.photoUpdatedAt, res.body.photoUpdatedAt);
    assert.equal("photo" in employee, false);
  });

  test("the employee list carries the date but never the picture", async () => {
    const list = (await request(app).get("/api/employees?pageSize=100").set(hr)).body.employees;

    assert.ok(list.find((e) => e.id === data.a1.id).photoUpdatedAt);
    assert.equal(list.find((e) => e.id === data.a2.id).photoUpdatedAt, null);
    assert.ok(list.every((e) => !("photo" in e) && !("data" in e)));
  });

  test("the attendance day of a manager and of HR carries the date too", async () => {
    for (const [url, headers] of [
      ["/api/manager/attendance?date=2026-03-10", managerA],
      ["/api/attendance?date=2026-03-10", hr],
    ]) {
      const rows = (await request(app).get(url).set(headers)).body.rows;
      const employeeOf = (id) => rows.find((row) => row.employee.id === id).employee;

      assert.ok(employeeOf(data.a1.id).photoUpdatedAt, url);
      assert.equal(employeeOf(data.a2.id).photoUpdatedAt, null, url);
    }
  });

  test("a new photo replaces the old one and moves the date on", async () => {
    const before = (await request(app).get(`/api/employees/${data.a1.id}`).set(hr)).body.employee.photoUpdatedAt;
    await new Promise((resolve) => setTimeout(resolve, 15));
    const replacement = jpeg(900);
    const res = await send(data.a1.id, replacement);

    assert.equal(res.status, 200);
    assert.ok(new Date(res.body.photoUpdatedAt) > new Date(before));
    assert.ok(replacement.equals((await fetchPhoto(data.a1.id)).body));
    assert.equal(await prisma.employeePhoto.count({ where: { employeeId: data.a1.id } }), 1);
  });

  test("only HR puts a photo on someone or takes it off", async () => {
    for (const headers of [managerA, amir]) {
      assert.equal((await send(data.a2.id, jpeg(), headers)).status, 403);
      assert.equal((await request(app).delete(`/api/photos/${data.a1.id}`).set(headers)).status, 403);
    }
    assert.equal((await request(app).put(`/api/photos/${data.a2.id}`).send({ image: "x" })).status, 401);
  });

  test("refuses what isn't a small JPEG, and an employee that doesn't exist", async () => {
    const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(100, 1)]);
    const notJpeg = await send(data.a2.id, png);
    assert.equal(notJpeg.status, 400);
    assert.match(notJpeg.body.message, /isn't a JPEG/);

    const notBase64 = await request(app).put(`/api/photos/${data.a2.id}`).set(hr).send({ image: "this is not base64 !!" });
    assert.equal(notBase64.status, 400);

    // 210 KB of picture: over the 200 KB limit, but small enough to be read
    const tooBig = await send(data.a2.id, jpeg(210_000));
    assert.equal(tooBig.status, 400);
    assert.match(tooBig.body.message, /too big/);

    assert.equal((await request(app).put(`/api/photos/${data.a2.id}`).set(hr).send({ image: "" })).status, 422);
    assert.equal((await request(app).put(`/api/photos/${data.a2.id}`).set(hr).send({})).status, 422);
    assert.equal((await send(99999, jpeg())).status, 404);

    // Nothing was saved by any of them
    assert.equal((await fetchPhoto(data.a2.id)).status, 404);
  });

  test("a body over the photo limit is refused, and the other routes keep the small limit", async () => {
    const huge = await request(app).put(`/api/photos/${data.a2.id}`).set(hr).send({ image: "A".repeat(500_000) });
    assert.equal(huge.status, 413);

    const other = await request(app).post("/api/employees").set(hr).send({ firstName: "x".repeat(150_000) });
    assert.equal(other.status, 413);
  });
});

describe("who sees a photo", () => {
  before(async () => {
    await send(data.a2.id, jpeg(400));
    await send(data.managerA.id, jpeg(450));
    await send(data.b1.id, jpeg(350));
  });

  test("HR sees everyone's", async () => {
    for (const id of [data.a1.id, data.a2.id, data.b1.id, data.managerA.id]) assert.equal((await fetchPhoto(id)).status, 200);
  });

  test("a manager sees their own team's, and not other teams'", async () => {
    assert.equal((await fetchPhoto(data.a1.id, managerA)).status, 200);
    assert.equal((await fetchPhoto(data.a2.id, managerA)).status, 200);
    assert.equal((await fetchPhoto(data.b1.id, managerA)).status, 404);
    assert.equal((await fetchPhoto(data.a1.id, managerB)).status, 404);
    assert.equal((await fetchPhoto(data.b1.id, managerB)).status, 200);
  });

  test("an employee sees their own and their manager's, nobody else's", async () => {
    assert.equal((await fetchPhoto(data.a1.id, amir)).status, 200);
    assert.equal((await fetchPhoto(data.managerA.id, amir)).status, 200);
    assert.equal((await fetchPhoto(data.a2.id, amir)).status, 404);
    assert.equal((await fetchPhoto(data.b1.id, amir)).status, 404);
    assert.equal((await fetchPhoto(data.managerB.id, amir)).status, 404);
  });

  test("it needs a login, and a person without a photo is a 404 for everyone", async () => {
    assert.equal((await request(app).get(`/api/photos/${data.a1.id}`)).status, 401);

    const without = await prisma.employee.create({
      data: { employeeId: "NO-PHOTO", firstName: "No", lastName: "Photo", email: "no-photo@example.com", hireDate: new Date("2024-01-15") },
    });
    assert.equal((await fetchPhoto(without.id)).status, 404);
    assert.equal((await fetchPhoto("abc")).status, 400);
  });

  test("the profile, the team and the manager shown on a profile carry the photo's date", async () => {
    const profile = (await request(app).get("/api/me").set(amir)).body.employee;
    assert.ok(profile.photoUpdatedAt);
    assert.ok(profile.manager.photoUpdatedAt);

    const team = (await request(app).get("/api/manager/team").set(managerA)).body.team;
    assert.ok(team.every((member) => member.photoUpdatedAt));
  });
});

describe("taking a photo off", () => {
  test("HR removes it: the picture and the date are gone", async () => {
    const res = await request(app).delete(`/api/photos/${data.a2.id}`).set(hr);

    assert.equal(res.status, 200);
    assert.equal((await fetchPhoto(data.a2.id)).status, 404);
    assert.equal((await request(app).get(`/api/employees/${data.a2.id}`).set(hr)).body.employee.photoUpdatedAt, null);
    assert.equal((await request(app).delete("/api/photos/99999").set(hr)).status, 404);
  });

  test("deleting the employee deletes the photo with them", async () => {
    const gone = await prisma.employee.create({
      data: { employeeId: "TO-GO", firstName: "To", lastName: "Go", email: "to-go@example.com", hireDate: new Date("2024-01-15") },
    });
    await send(gone.id, jpeg());
    assert.equal(await prisma.employeePhoto.count({ where: { employeeId: gone.id } }), 1);

    assert.equal((await request(app).delete(`/api/employees/${gone.id}`).set(hr)).status, 200);
    assert.equal(await prisma.employeePhoto.count({ where: { employeeId: gone.id } }), 0);
  });
});
