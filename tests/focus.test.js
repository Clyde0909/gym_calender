import test from "node:test";
import assert from "node:assert/strict";
import { nextPending, remainingRest, focusProgress } from "../src/focus.js";
import { shareData, createSessionShareCache } from "../src/sharing.js";
import { isHighEfficiency } from "../src/images.js";
import { decode } from "../src/codec.js";
const session = {
  date: "2026-10-13",
  note: "",
  photo: null,
  exercises: [
    {
      name: "스쿼트",
      sets: [
        { weight: 80, reps: 5, done: true },
        { weight: 80, reps: 5, done: false },
      ],
    },
    { name: "벤치 프레스", sets: [{ weight: 50, reps: 10, done: false }] },
  ],
};
test("focus advances in exercise order and skips previously completed sets", () => {
  const s = structuredClone(session);
  assert.deepEqual(nextPending(s), { i: 0, j: 1 });
  s.exercises[0].sets[1].done = true;
  assert.deepEqual(nextPending(s), { i: 1, j: 0 });
  s.exercises[1].sets[0].done = true;
  assert.equal(nextPending(s), null);
  assert.deepEqual(focusProgress(s), { total: 3, done: 3 });
});
test("rest uses the deadline even after background throttling", () => {
  assert.equal(remainingRest(10000, 5100), 5);
  assert.equal(remainingRest(10000, 15000), 0);
});
test("native sharing is invoked synchronously with files, with short-text fallback only", async () => {
  let called = false;
  const api = {
    canShare: () => true,
    share: (data) => {
      called = true;
      assert.equal(data.files[0].type, "text/plain");
      return Promise.resolve();
    },
  };
  const result = shareData("GW1.P.test", session.date, "Workout", api);
  assert.equal(called, true);
  await result;
  let shared;
  shareData("text", session.date, "Workout", {
    canShare: (data) => !data.files,
    share: (data) => {
      shared = data;
      return Promise.resolve();
    },
  });
  assert.equal(shared.text, "text");
  assert.equal(
    shareData("x".repeat(30001), session.date, "Workout", {
      canShare: () => false,
      share() {
        throw Error("Must not truncate photos");
      },
    }),
    null,
  );
});
test("precomputed session share invalidates changed records and preserves full data", async () => {
  const cache = createSessionShareCache(),
    s = structuredClone(session);
  assert.equal(cache.ready(s), null);
  const first = await cache.prepare(s);
  assert.deepEqual((await decode(first.text)).data.sessions, [s]);
  s.note = "edited";
  assert.equal(cache.ready(s), null);
  await cache.prepare(s);
  assert.deepEqual((await decode(cache.ready(s).text)).data.sessions, [s]);
});
test("HEIC/HEIF detection handles extension, MIME and ISO BMFF brands", async () => {
  assert.equal(await isHighEfficiency(new File(["x"], "photo.HEIC")), true);
  assert.equal(
    await isHighEfficiency(new File(["x"], "photo", { type: "image/heif" })),
    true,
  );
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode("ftypheic"), 4);
  assert.equal(await isHighEfficiency(new File([bytes], "photo.bin")), true);
  assert.equal(
    await isHighEfficiency(
      new File(["not a photo"], "photo.jpg", { type: "image/jpeg" }),
    ),
    false,
  );
});
