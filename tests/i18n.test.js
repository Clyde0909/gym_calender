import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initialLanguage,
  resolveLanguage,
  setLanguage,
  t,
  messages,
  weekdays,
  dateLabel,
  monthLabel,
} from "../src/i18n.js";
import {
  library,
  canonicalExercise,
  exerciseLabel,
  searchExercises,
} from "../src/library.js";
test("language detection supports regions and defaults every other language to English", () => {
  for (const [input, expected] of [
    ["en-US", "en"],
    ["ko-KR", "ko"],
    ["ja-JP", "ja"],
    ["fr-FR", "en"],
    ["zh-CN", "en"],
    ["de", "en"],
    [undefined, "en"],
  ])
    assert.equal(resolveLanguage(input), expected);
  assert.equal(initialLanguage({ browser: "fr-FR" }), "en");
  assert.equal(initialLanguage({ browser: "ja-JP" }), "ja");
  assert.equal(initialLanguage({ saved: "ko", browser: "en-US" }), "ko");
  assert.equal(
    initialLanguage({ requested: "ja", saved: "ko", browser: "en-US" }),
    "ja",
  );
});
test("all source message keys and built-in exercise content have both translations", () => {
  for (const file of ["app", "data", "codec", "storage"]) {
    const source = readFileSync(
      new URL(`../src/${file}.js`, import.meta.url),
      "utf8",
    );
    for (const [, literal] of source.matchAll(
      /tr\(\s*("(?:[^"\\]|\\.)*")\s*[,)]/g,
    )) {
      const key = JSON.parse(literal);
      assert.ok(messages[key]?.en, key + " English");
      assert.ok(messages[key]?.ja, key + " Japanese");
    }
  }
  for (const e of library)
    for (const key of [e.name, e.body, e.equipment, e.guide])
      for (const lang of ["en", "ja"])
        assert.ok(messages[key]?.[lang], key + " " + lang);
});
test("built-in exercise aliases retain canonical identities and user names remain unchanged", () => {
  for (const lang of ["en", "ja", "ko"]) {
    setLanguage(lang);
    assert.equal(
      canonicalExercise(exerciseLabel("벤치 프레스")),
      "벤치 프레스",
    );
    assert.equal(exerciseLabel("나만의 운동"), "나만의 운동");
  }
  assert.equal(searchExercises("bench press")[0].name, "벤치 프레스");
  assert.equal(searchExercises("スクワット")[0].name, "스쿼트");
  setLanguage("en");
});
test("dates and messages follow active language", () => {
  setLanguage("en");
  assert.equal(t("운동 캘린더"), "Workout calendar");
  assert.match(monthLabel(new Date(2026, 9, 1)), /October/);
  assert.match(dateLabel("2026-10-13"), /Oct/);
  assert.equal(weekdays()[0], "Sun");
  setLanguage("ja");
  assert.equal(t("운동 캘린더"), "ワークアウトカレンダー");
  assert.equal(weekdays()[0], "日");
  setLanguage("ko");
  assert.equal(t("운동 캘린더"), "운동 캘린더");
  setLanguage("en");
});

test("translated parameter messages preserve zero values", () => {
  setLanguage("en");
  assert.equal(
    t("importConflicts", { count: 0 }),
    "Records on 0 existing dates will be replaced.",
  );
  setLanguage("ja");
  assert.equal(
    t("importConflicts", { count: 2 }),
    "2日分の既存記録を置き換えます。",
  );
  setLanguage("en");
});
