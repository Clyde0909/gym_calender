import test from "node:test";
import assert from "node:assert/strict";
import { encode, decode } from "../src/codec.js";
import {
  newState,
  validateState,
  mergeSessions,
  volume,
  completed,
} from "../src/data.js";
const session = {
  date: "2026-10-13",
  note: "오늘도 운동 💪",
  photo: "data:image/webp;base64,AAAA",
  exercises: [
    {
      name: "스쿼트",
      sets: [
        { weight: 100, reps: 5, done: true },
        { weight: 100, reps: 5, done: false },
      ],
    },
  ],
};
const payload = {
  format: "gymlog",
  version: 1,
  kind: "session",
  data: { version: 1, sessions: [session], routines: [] },
};
test("photo + Korean session roundtrip and compression", async () => {
  const code = await encode(payload);
  assert.deepEqual(await decode(code), payload);
  const repeated = { ...payload, note: "운동 기록 ".repeat(1000) };
  assert.ok(
    (await encode(repeated)).length < JSON.stringify(repeated).length / 2,
  );
});
test("encrypted roundtrip, random salts, password failure and tampering", async () => {
  const code = await encode(payload, "튼튼한 비밀번호");
  assert.deepEqual(await decode(code, "튼튼한 비밀번호"), payload);
  assert.notEqual(code, await encode(payload, "튼튼한 비밀번호"));
  await assert.rejects(() => decode(code, "wrong"));
  await assert.rejects(() => decode(code));
  const pos = code.length - 20;
  await assert.rejects(() =>
    decode(
      code.slice(0, pos) +
        (code[pos] === "A" ? "B" : "A") +
        code.slice(pos + 1),
      "튼튼한 비밀번호",
    ),
  );
});
test("invalid formats fail", async () => {
  for (const code of ["abc", "GW2.P.a", "GW1.P.!", "GW1.P.AAAA"])
    await assert.rejects(() => decode(code));
});
test("validation rejects unsafe photo and invalid sets", () => {
  assert.deepEqual(validateState(newState()), newState());
  assert.doesNotThrow(() => validateState(payload.data));
  const unsafe = structuredClone(payload.data);
  unsafe.sessions[0].photo = "data:image/svg+xml;base64,AAAA";
  assert.throws(() => validateState(unsafe));
  const bad = structuredClone(payload.data);
  bad.sessions[0].exercises[0].sets[0].weight = -1;
  assert.throws(() => validateState(bad));
});
test("merge replaces only same date and statistics count completed sets", () => {
  const before = { ...session, date: "2026-10-12" };
  assert.deepEqual(
    mergeSessions([before, session], [{ ...session, note: "교체" }]),
    [before, { ...session, note: "교체" }],
  );
  assert.equal(volume(session), 500);
  assert.equal(completed(session), 1);
});
import {
  searchExercises,
  estimate1RM,
  defaultSettings,
} from "../src/library.js";
test("initial consonants, equipment and body filters", () => {
  assert.equal(searchExercises("ㅂㅊㅍㄹㅅ")[0].name, "벤치 프레스");
  assert.ok(searchExercises("", "가슴", "바벨").length >= 2);
  assert.ok(
    searchExercises("", "가슴", "바벨").every(
      (e) => e.body === "가슴" && e.equipment === "바벨",
    ),
  );
  assert.equal(
    searchExercises("스쿼트", "", "케틀벨")[0].name,
    "고블릿 스쿼트",
  );
});
test("1RM estimate respects low repetition range", () => {
  assert.equal(estimate1RM(100, 1), 100);
  assert.equal(estimate1RM(60, 10), 80);
  assert.equal(estimate1RM(60, 20), 0);
});
test("settings and times validation", () => {
  assert.doesNotThrow(() =>
    validateState({ ...newState(), settings: defaultSettings() }),
  );
  assert.throws(() =>
    validateState({
      ...newState(),
      settings: { ...defaultSettings(), restSeconds: -1 },
    }),
  );
  assert.throws(() =>
    validateState({
      ...newState(),
      sessions: [{ ...session, startedAt: 100, endedAt: 99 }],
    }),
  );
});
