const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
function transpile(path) {
  return ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
}
const domain = {};
vm.runInNewContext(transpile("lib/calendar.ts"), { exports: domain });
const code = transpile("pages/api/calendars/index.ts");
const owner = "owner@example.test";
const calendar = { id: "custom-123", label: "Viajes", color: "#FF0088" };
function harness() {
  const records = [];
  const calls = [];
  let email = owner;
  const env = { NEXTAUTH_URL: "https://calendar.example.test", CALENDAR_ADMIN_EMAILS: owner };
  const permissions = {};
  vm.runInNewContext(transpile("lib/calendarPermissions.ts"), { exports: permissions, process: { env } });
  const modules = {
    "next-auth/jwt": { getToken: async () => email ? { email, calendarEmailVerified: true } : null },
    "lib/dbConnect": async () => calls.push(["connect"]),
    "lib/calendar": domain,
    "lib/calendarPermissions": permissions,
    "models/calendar": {
      find(query) {
        calls.push(["find", query]);
        return { lean: async () => records.filter(r => r.owner === query.owner) };
      },
      async findOneAndUpdate(query, update, options) {
        calls.push(["update", query, update, options]);
        const record = records.find(r => r.owner === query.owner && r.calendarId === query.calendarId);
        if (record) return Object.assign(record, update.$set);
        const created = { ...query, ...update.$set };
        records.push(created);
        return created;
      },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: n => modules[n], process: { env },
  });
  return {
    calls, setEmail: value => { email = value; },
    async invoke(method, body, headers = {}) {
      const res = {
        statusCode: 200, headers: {},
        setHeader(key, value) { this.headers[key] = value; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
      };
      await exports.default({ method, body, headers }, res);
      return res;
    },
  };
}
test("public reads use defaults; anonymous, cross-origin and malformed writes never touch storage", async () => {
  const h = harness();
  h.setEmail(null);
  assert.equal((await h.invoke("GET")).statusCode, 200);
  assert.equal((await h.invoke("PUT", calendar)).statusCode, 401);
  h.setEmail(owner);
  assert.equal((await h.invoke("PUT", calendar, { origin: "https://other.example.test" })).statusCode, 403);
  for (const patch of [{ id: { $ne: null } }, { label: " " }, { color: "red" }, { label: "x".repeat(61) }])
    assert.equal((await h.invoke("PUT", { ...calendar, ...patch })).statusCode, 400);
  assert.equal((await h.invoke("DELETE", calendar)).statusCode, 405);
  assert.equal(h.calls.length, 0);
});
test("only the administrator can customize calendars; other accounts cannot change them", async () => {
  const h = harness();
  const saved = await h.invoke("PUT", { ...calendar, owner: "victim@example.test", _id: "injected" });
  assert.equal(saved.statusCode, 200);
  const update = h.calls.find(c => c[0] === "update");
  assert.equal(update[1].owner, owner);
  assert.equal(update[1].calendarId, calendar.id);
  assert.equal(update[2].$set.owner, undefined);
  assert.equal(saved.body.owner, undefined);
  h.setEmail("second@example.test");
  const second = await h.invoke("GET");
  assert.equal(second.body.length, 4);
  assert.equal(second.headers["Cache-Control"], "no-store");
  const count = h.calls.length;
  assert.equal((await h.invoke("PUT", calendar)).statusCode, 403);
  assert.equal(h.calls.length, count);
  h.setEmail(owner);
  let first = await h.invoke("GET");
  assert.equal(first.body.find(c => c.id === calendar.id).label, "Viajes");
  await h.invoke("PUT", { id: "personal", label: " Mi familia ", color: "#ffffff" });
  first = await h.invoke("GET");
  assert.equal(first.body.length, 5);
  assert.equal(first.body.find(c => c.id === "personal").label, "Mi familia");
});
