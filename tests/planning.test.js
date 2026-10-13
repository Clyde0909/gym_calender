import test from "node:test";
import assert from "node:assert/strict";
import { encode91, decode91, alphabet } from "../src/base91.js";
import { encode, decode } from "../src/codec.js";
import {
  weekStart,
  weekDates,
  daySchedule,
  scheduledSession,
  makeWeekPlan,
  mergeWeekPlans,
} from "../src/planning.js";
import { programs, programWeek } from "../src/programs.js";
import { validateState, newState } from "../src/data.js";
import { defaultSettings, library } from "../src/library.js";
test("base91 uses 91 symbols and roundtrips boundary bit patterns", () => {
  assert.equal(new Set(alphabet).size, 91);
  for (const n of [0, 1, 2, 3, 7, 13, 14, 255, 10000])
    for (const mode of ["random", "zero", "high"]) {
      const bytes =
        mode === "random"
          ? crypto.getRandomValues(new Uint8Array(n))
          : new Uint8Array(n).fill(mode === "high" ? 255 : 0);
      assert.deepEqual(decode91(encode91(bytes)), bytes);
    }
  assert.throws(() => decode91("💪"));
  assert.throws(() => decode91(" "));
});
test("both share formats and encryption roundtrip with punctuation inside the body", async () => {
  const data = {
    message: "Korean 한국어 日本語",
    photo: "data:image/webp;base64," + "abcd".repeat(300),
  };
  for (const encoding of ["compact", "compatible"])
    for (const pw of ["", "password"]) {
      const code = await encode(data, pw, { encoding });
      assert.equal(code.slice(0, 3), encoding === "compact" ? "GW3" : "GW4");
      assert.deepEqual(await decode(code, pw), data);
      if (pw) await assert.rejects(() => decode(code, "wrong"));
    }
});
test("week dates, plan snapshots and routine fallbacks stay isolated", () => {
  const state = { ...newState(), settings: defaultSettings(), weekPlans: [] };
  const plan = programWeek(programs[1], "2026-10-13", "Week A");
  state.weekPlans = [plan];
  assert.equal(plan.weekStart, "2026-10-12");
  assert.equal(weekStart("2026-10-18"), "2026-10-12");
  assert.equal(weekDates(plan.weekStart)[6].date, "2026-10-18");
  const s = scheduledSession(state, "2026-10-14");
  assert.ok(s.exercises.length);
  s.exercises[0].sets[0].done = true;
  s.exercises[0].sets[0].weight = 90;
  assert.equal(plan.days[3][0].sets[0].weight, 0);
  assert.equal(scheduledSession(state, "2026-10-13"), null);
  assert.doesNotThrow(() => validateState(state));
  const replacement = {
    ...structuredClone(plan),
    id: crypto.randomUUID(),
    name: "Replacement",
  };
  assert.equal(mergeWeekPlans([plan], [replacement]).length, 1);
  assert.equal(mergeWeekPlans([plan], [replacement])[0].name, "Replacement");
});
test("reject invalid plans and duplicated weeks; all preset exercises exist in the expanded library", () => {
  const state = {
    ...newState(),
    settings: defaultSettings(),
    weekPlans: [programWeek(programs[0], "2026-10-13", "Week")],
  };
  const bad = structuredClone(state);
  delete bad.weekPlans[0].days[4];
  assert.throws(() => validateState(bad));
  const duplicate = structuredClone(state);
  duplicate.weekPlans.push({
    ...duplicate.weekPlans[0],
    id: crypto.randomUUID(),
  });
  assert.throws(() => validateState(duplicate));
  assert.equal(library.length, 60);
  assert.throws(() => weekStart("2026-99-99"));
  for (const p of programs)
    for (const day of Object.values(p.days))
      for (const e of day)
        assert.ok(
          library.some((item) => item.name === e.name),
          e.name,
        );
});
