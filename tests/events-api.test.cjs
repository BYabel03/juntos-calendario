const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const domain = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("lib/calendar.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: domain, Date, String, Number, Object, Array, isNaN }
);
const code = ts.transpileModule(
  fs.readFileSync("pages/api/events/index.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }
).outputText;
const owner = "calendar-test@example.test";
const event = {
  title: "Private event",
  date: "2026-10-15",
  start: "09:00",
  end: "10:00",
  location: "Park",
  description: "Notes",
  category: "personal",
};
const id = "507f1f77bcf86cd799439011";
function harness({ email = owner, token = true, calendarExists = true,
  verified = false, adminEmails = "admin@example.test", records = [] } = {}) {
  const env = { NEXTAUTH_URL: "http://localhost:3000", NEXT_AUTH_SECRET: "synthetic-test-only", CALENDAR_ADMIN_EMAILS: adminEmails };
  const permissions = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/calendarPermissions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: permissions, process: { env } });
  const calls = [];
  const model = {
    find: (query) => {
      calls.push(["find", query]);
      return { sort: () => ({ lean: async () => records.filter(r => !query.owner || r.owner === query.owner) }) };
    },
    create: async (data) => {
      calls.push(["create", data]);
      const record = { _id: id, ...data };
      records.push(record);
      return record;
    },
    findOne: (query) => {
      calls.push(["findOne", query]);
      return { lean: async () => records.find(r => r._id === query._id) || null };
    },
    findOneAndUpdate: async (query, data, options) => {
      calls.push(["update", query, data, options]);
      const record = records.find(r => r._id === query._id && r.owner === query.owner);
      return record ? Object.assign(record, data.$set) : null;
    },
    deleteOne: async (query) => {
      calls.push(["delete", query]);
      const index = records.findIndex(r => r._id === query._id);
      if (index >= 0) records.splice(index, 1);
      return { deletedCount: index >= 0 ? 1 : 0 };
    },
  };
  const exports = {};
  const modules = {
    "next-auth/jwt": { getToken: async () => (token ? { email, calendarEmailVerified: verified } : null) },
    "lib/calendarPermissions": permissions,
    mongoose: { isValidObjectId: (value) => /^[a-f0-9]{24}$/.test(value) },
    "lib/dbConnect": async () => calls.push(["connect"]),
    "models/event": model,
    "models/calendar": { exists: async (query) => { calls.push(["calendar", query]); return calendarExists; } },
    "lib/calendar": domain,
  };
  vm.runInNewContext(code, {
    exports,
    require: (name) => modules[name],
    process: { env },
  });
  async function invoke(method, body, headers = {}) {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.body = data;
        return this;
      },
      end() {
        return this;
      },
    };
    await exports.default({ method, body, headers }, res);
    return res;
  }
  return { calls, invoke, setAdmins: (value) => { env.CALENDAR_ADMIN_EMAILS = value; } };
}
test("anonymous visitors cannot edit or delete reservations", async () => {
  const h = harness({ token: false });
  for (const method of ["PUT", "DELETE"])
    assert.equal((await h.invoke(method, event)).statusCode, 401);
  assert.equal(h.calls.length, 0);
});
test("anonymous visitors create shared reservations and read every owner's details after reload", async () => {
  const records = [{ ...event, _id: "507f1f77bcf86cd799439012", owner: "old-account@example.test" }];
  const visitor = harness({ token: false, records });
  const created = await visitor.invoke("POST", { ...event, color: "#123456", owner: "forged@example.test" });
  assert.equal(created.statusCode, 201);
  assert.equal(created.body.owner, undefined);
  assert.equal(records[1].owner, "public-link");
  const otherVisitor = harness({ token: false, records });
  const listed = await otherVisitor.invoke("GET");
  assert.equal(listed.statusCode, 200);
  assert.equal(listed.body.length, 2);
  assert.equal(listed.body[1].color, "#123456");
  assert.equal(listed.body[0].location, "Park");
  assert.equal(listed.body[0].description, "Notes");
  assert.equal(listed.body[0].owner, undefined);
  assert.equal(Object.keys(otherVisitor.calls[1][1]).length, 0);
  assert.equal(listed.headers["Cache-Control"], "no-store");
});
test("client cannot assign event ownership or extra fields", async () => {
  const h = harness();
  const res = await h.invoke("POST", {
    ...event,
    owner: "victim@example.test",
    _id: id,
  });
  assert.equal(res.statusCode, 201);
  const saved = h.calls[1][1];
  assert.equal(saved.owner, "public-link");
  assert.equal(saved._id, undefined);
  assert.equal(res.body.owner, undefined);
  assert.equal(res.body.id, id);
});
test("ordinary users can create but cannot modify reservations or grant themselves admin", async () => {
  const h = harness();
  for (const method of ["PUT", "DELETE"]) {
    const res = await h.invoke(method, { ...event, id, isCalendarAdmin: true, role: "admin", owner: "admin@example.test" });
    assert.equal(res.statusCode, 403);
  }
  assert.equal(h.calls.length, 0);
  assert.equal((await h.invoke("POST", event)).statusCode, 201);
  assert.equal((await h.invoke("PATCH", event)).statusCode, 405);
});
test("rejects malformed dates, hours and cross-origin writes before storage", async () => {
  const h = harness();
  assert.equal(
    (await h.invoke("POST", { ...event, date: "2026-02-30" })).statusCode,
    400
  );
  assert.equal(
    (await h.invoke("POST", { ...event, end: "08:00" })).statusCode,
    400
  );
  assert.equal(
    (await h.invoke("POST", event, { origin: "https://other.example.test" }))
      .statusCode,
    403
  );
  assert.equal(h.calls.length, 0);
  assert.equal((await h.invoke("PATCH", event)).statusCode, 405);
});

test("custom calendar validation uses server-assigned creator and preserves arbitrary colors", async () => {
  const h = harness();
  const res = await h.invoke("POST", { ...event, category: "custom-123", color: "#ff12AB" });
  assert.equal(res.statusCode, 201);
  assert.equal(h.calls[1][0], "calendar");
  assert.equal(h.calls[1][1].owner, "public-link");
  assert.equal(h.calls[1][1].calendarId, "custom-123");
  assert.equal(res.body.category, "custom-123");
  assert.equal(res.body.color, "#ff12AB");
  const missing = harness({ calendarExists: false });
  assert.equal((await missing.invoke("POST", { ...event, category: "foreign-123" })).statusCode, 400);
  assert.equal(missing.calls.filter(c => c[0] === "create").length, 0);
  const invalid = harness();
  assert.equal((await invalid.invoke("POST", { ...event, color: "url(invalid)" })).statusCode, 400);
  assert.equal(invalid.calls.length, 0);
});

test("only one configured verified administrator gets creator identities or write permissions", async () => {
  const records = [{ ...event, _id: id, owner }, { ...event, _id: "507f1f77bcf86cd799439012", owner: "second@example.test" }];
  const user = harness({ records });
  const own = await user.invoke("GET");
  assert.equal(own.body.length, 2);
  assert.equal(own.body[0].owner, undefined);
  const admin = harness({ email: "ADMIN@example.test", verified: true, adminEmails: " admin@example.test ", records });
  const all = await admin.invoke("GET");
  assert.equal(all.body.length, 2);
  assert.equal(all.body[0].owner, owner);
  assert.equal(Object.keys(admin.calls[1][1]).length, 0);
  for (const config of [
    { email: "admin@example.test", verified: false },
    { email: "admin@example.test", verified: true, adminEmails: "" },
    { email: "admin@example.test.evil", verified: true },
    { email: "admin@example.test", verified: true, adminEmails: "admin@example.test,second@example.test" },
  ]) {
    const denied = harness(config);
    assert.equal((await denied.invoke("PUT", { ...event, id })).statusCode, 403);
    assert.equal(denied.calls.length, 0);
  }
});
test("admin edits and deletes another owner's reservation while preserving its creator", async () => {
  const records = [{ ...event, _id: id, owner, category: "custom-123" }];
  const admin = harness({ email: "admin@example.test", verified: true, records });
  const changed = await admin.invoke("PUT", { ...event, id, title: "Updated by admin", category: "custom-123", owner: "injected@example.test", color: "#ffffff" });
  assert.equal(changed.statusCode, 200);
  assert.equal(changed.body.owner, owner);
  assert.equal(changed.body.title, "Updated by admin");
  const category = admin.calls.find(c => c[0] === "calendar");
  assert.equal(category[1].owner, owner);
  const update = admin.calls.find(c => c[0] === "update");
  assert.equal(update[1].owner, owner);
  assert.equal(update[2].$set.owner, undefined);
  assert.equal(update[3].runValidators, true);
  assert.equal((await admin.invoke("DELETE", { id })).statusCode, 204);
  assert.equal((await admin.invoke("DELETE", { id })).statusCode, 404);
});
test("admin writes validate inputs and revocation takes effect on the next request", async () => {
  const h = harness({ email: "admin@example.test", verified: true });
  assert.equal((await h.invoke("PUT", { ...event, id: { $ne: null } })).statusCode, 400);
  assert.equal((await h.invoke("DELETE", { id: "bad" })).statusCode, 400);
  assert.equal((await h.invoke("PUT", { ...event, id, end: "08:00" })).statusCode, 400);
  assert.equal((await h.invoke("PUT", { ...event, id }, { origin: "https://evil.example.test" })).statusCode, 403);
  assert.equal(h.calls.length, 0);
  assert.equal((await h.invoke("PUT", { ...event, id })).statusCode, 404);
  h.calls.length = 0;
  h.setAdmins("");
  assert.equal((await h.invoke("DELETE", { id })).statusCode, 403);
  assert.equal(h.calls.length, 0);
});

test("admin creates own reservations while public clients cannot forge admin ownership", async () => {
  const admin = harness({ email: "admin@example.test", verified: true });
  const response = await admin.invoke("POST", { ...event, owner: "forged@example.test" });
  assert.equal(response.statusCode, 201);
  assert.equal(response.body.owner, "admin@example.test");
});
