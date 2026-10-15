import test from "node:test";
import assert from "node:assert/strict";
import { utcDayStart } from "./utc-day.ts";

test("profile view day starts at UTC midnight regardless of local timezone offset", () => {
  assert.equal(utcDayStart(new Date("2026-10-15T00:30:00+02:00")), "2026-10-14T00:00:00.000Z");
});
