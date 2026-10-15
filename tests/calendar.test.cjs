const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const source = ts.transpileModule(fs.readFileSync("lib/calendar.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exported = {};
vm.runInNewContext(source, {
  exports: exported,
  Date,
  String,
  Number,
  Object,
  Array,
  isNaN,
});
const { dateKey, monthDays, validEvent, demoEvents } = exported;
const event = {
  title: "Reunión",
  date: "2026-10-15",
  start: "09:00",
  end: "10:00",
  location: "",
  description: "",
  category: "trabajo",
};
test("calendar starts on Monday and covers complete weeks including leap day", () => {
  for (let month = 0; month < 12; month++) {
    const days = monthDays(new Date(2024, month, 1));
    assert.equal(days[0].getDay(), 1);
    assert.equal(days.length % 7, 0);
    assert.equal(
      days.filter((d) => d.getMonth() === month).length,
      new Date(2024, month + 1, 0).getDate()
    );
  }
});
test("validates event dates, times, lengths, and category allowlist", () => {
  assert.equal(validEvent(event), true);
  for (const patch of [
    { date: "2026-02-30" },
    { date: "2026-13-01" },
    { date: "0099-01-01" },
    { start: "25:00" },
    { end: "09:00" },
    { end: "08:00" },
    { title: "   " },
    { title: "a".repeat(121) },
    { location: 3 },
    { description: "x".repeat(2001) },
    { category: "__proto__" },
    { category: "toString" },
    { category: "other" },
  ]) {
    assert.equal(
      validEvent({ ...event, ...patch }),
      false,
      JSON.stringify(patch)
    );
  }
  assert.equal(validEvent(null), false);
});
test("demo events remain valid around year changes", () => {
  const events = demoEvents(new Date(2026, 11, 31, 12));
  assert.ok(events.every(validEvent));
  assert.equal(events[0].date, "2026-12-31");
  assert.equal(events[3].date, "2027-01-02");
  assert.equal(dateKey(new Date(2026, 0, 1)), "2026-01-01");
});
