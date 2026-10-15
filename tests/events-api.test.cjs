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
function harness({ email = owner, token = true } = {}) {
  const calls = [];
  const model = {
    find: (query) => {
      calls.push(["find", query]);
      return { sort: () => ({ lean: async () => [] }) };
    },
    create: async (data) => {
      calls.push(["create", data]);
      return { _id: id, ...data };
    },
    findOneAndUpdate: async (query, data) => {
      calls.push(["update", query, data]);
      return null;
    },
    deleteOne: async (query) => {
      calls.push(["delete", query]);
      return { deletedCount: 0 };
    },
  };
  const exports = {};
  const modules = {
    "next-auth/jwt": { getToken: async () => (token ? { email } : null) },
    mongoose: { isValidObjectId: (value) => /^[a-f0-9]{24}$/.test(value) },
    "lib/dbConnect": async () => calls.push(["connect"]),
    "models/event": model,
    "lib/calendar": domain,
  };
  vm.runInNewContext(code, {
    exports,
    require: (name) => modules[name],
    process: {
      env: {
        NEXTAUTH_URL: "http://localhost:3000",
        NEXT_AUTH_SECRET: "synthetic-test-only",
      },
    },
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
  return { calls, invoke };
}
test("unauthenticated requests never touch storage", async () => {
  const h = harness({ token: false });
  for (const method of ["GET", "POST", "PUT", "DELETE"])
    assert.equal((await h.invoke(method, event)).statusCode, 401);
  assert.equal(h.calls.length, 0);
});
test("reads are limited to the verified account", async () => {
  const h = harness();
  const res = await h.invoke("GET");
  assert.equal(res.statusCode, 200);
  assert.equal(h.calls[1][1].owner, owner);
  assert.equal(res.headers["Cache-Control"], "no-store");
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
  assert.equal(saved.owner, owner);
  assert.equal(saved._id, undefined);
  assert.equal(res.body.owner, undefined);
  assert.equal(res.body.id, id);
});
test("updates and deletes include ownership and return 404 for foreign events", async () => {
  const h = harness();
  assert.equal(
    (await h.invoke("PUT", { ...event, id, owner: "victim@example.test" }))
      .statusCode,
    404
  );
  assert.equal(
    (await h.invoke("DELETE", { id, owner: "victim@example.test" })).statusCode,
    404
  );
  const writes = h.calls.filter((c) => ["update", "delete"].includes(c[0]));
  assert.equal(writes.length, 2);
  for (const [, query] of writes) {
    assert.equal(query.owner, owner);
    assert.equal(query._id, id);
  }
});
test("rejects malformed identifiers, dates, hours and cross-origin writes before storage", async () => {
  const h = harness();
  assert.equal(
    (await h.invoke("DELETE", { id: { $ne: null } })).statusCode,
    400
  );
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
