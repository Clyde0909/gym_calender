import { readFileSync, writeFileSync } from "node:fs";
import { encode, decode } from "../src/codec.js";
if (!process.argv[2])
  throw Error("Usage: node scripts/measure-sharing.mjs path/to/sample.webp");
const photo =
  "data:image/webp;base64," + readFileSync(process.argv[2]).toString("base64");
const payload = {
  format: "gymlog",
  version: 1,
  kind: "session",
  data: {
    version: 1,
    sessions: [
      {
        date: "2026-10-13",
        note: "Measurement",
        photo: null,
        exercises: [
          { name: "스쿼트", sets: [{ weight: 80, reps: 5, done: true }] },
        ],
      },
    ],
    routines: [],
  },
};
const results = [];
for (const [sample, value, password] of [
  ["session", payload, ""],
  [
    "session+photo",
    {
      ...payload,
      data: {
        ...payload.data,
        sessions: [{ ...payload.data.sessions[0], photo }],
      },
    },
    "",
  ],
  [
    "encrypted+photo",
    {
      ...payload,
      data: {
        ...payload.data,
        sessions: [{ ...payload.data.sessions[0], photo }],
      },
    },
    "measurement-only",
  ],
]) {
  const compatible = await encode(value, password, { encoding: "compatible" }),
    compact = await encode(value, password);
  if (JSON.stringify(await decode(compact, password)) !== JSON.stringify(value))
    throw Error("Roundtrip failed");
  results.push({
    sample,
    base64: compatible.length,
    base91: compact.length,
    reductionPercent: +((1 - compact.length / compatible.length) * 100).toFixed(
      2,
    ),
  });
}
console.log(JSON.stringify(results, null, 2));
if (process.argv[3])
  writeFileSync(process.argv[3], JSON.stringify(results, null, 2) + "\n");
