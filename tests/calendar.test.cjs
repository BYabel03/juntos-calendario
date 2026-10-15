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
test("validates event dates, times, lengths, and calendar IDs", () => {
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
    { category: "" },
    { category: { $ne: null } },
    { category: "a".repeat(65) },
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

test("custom calendars and colors retain legacy event compatibility", () => {
  assert.equal(validEvent(event), true);
  assert.equal(validEvent({ ...event, category: "custom-123", color: "#FF00aa" }), true);
  assert.equal(validEvent({ ...event, color: "" }), true);
  for (const color of ["red", "#abc", "#12345678", "url(https://invalid.test)", {}, null])
    assert.equal(validEvent({ ...event, color }), false);
  assert.equal(exported.validCalendar({ id: "custom-123", label: "Viajes ✈️", color: "#00aabb" }), true);
  for (const patch of [{ label: "  " }, { label: "a".repeat(61) }, { id: "__proto__" }, { color: "red" }])
    assert.equal(exported.validCalendar({ id: "custom-123", label: "Viajes", color: "#00aabb", ...patch }), false);
  const merged = exported.mergeCalendars([
    { id: "personal", label: "Familia", color: "#ff0000" },
    { id: "custom-123", label: "Viajes", color: "#00aabb" },
  ]);
  assert.equal(merged.length, 5);
  assert.equal(merged.find(c => c.id === "personal").label, "Familia");
  assert.equal(exported.defaultCalendars[0].label, "Personal");
});
test("light, dark and saturated custom colors have readable text", () => {
  function luminance(hex) {
    return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).reduce((sum,c,i) =>
      sum + (c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4)*[0.2126,0.7152,0.0722][i],0);
  }
  function contrast(a,b) { const x=luminance(a), y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); }
  for (const color of ["#ffffff", "#000000", "#ffff00", "#00ffff", "#ff0000", "#9064bc"]) {
    const result = exported.colorAppearance(color);
    assert.equal(result.color, color);
    assert.ok(contrast(result.text, result.background) >= 4.5, color);
    assert.ok(contrast(result.ink, color) >= 4.5, color);
  }
});
