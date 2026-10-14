import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  library,
  canonicalExercise,
  exerciseLabel,
  searchExercises,
} from "../src/library.js";
import { messages, setLanguage, t } from "../src/i18n.js";

// Independent fixtures captured from the pre-expansion 60-exercise library
// and src/translations.json: [name, body, equipment, English label, Japanese label].
const ORIGINAL = [
  ["벤치 프레스", "가슴", "바벨", "Bench press", "ベンチプレス"],
  [
    "인클라인 덤벨 프레스",
    "가슴",
    "덤벨",
    "Incline dumbbell press",
    "インクラインダンベルプレス",
  ],
  ["체스트 프레스", "가슴", "머신", "Chest press", "チェストプレス"],
  ["푸시업", "가슴", "맨몸", "Push-up", "プッシュアップ"],
  ["랫 풀다운", "등", "머신", "Lat pulldown", "ラットプルダウン"],
  ["시티드 로우", "등", "머신", "Seated row", "シーテッドロウ"],
  ["바벨 로우", "등", "바벨", "Barbell row", "バーベルロウ"],
  ["풀업", "등", "맨몸", "Pull-up", "プルアップ"],
  ["스쿼트", "하체", "바벨", "Squat", "スクワット"],
  ["데드리프트", "하체", "바벨", "Deadlift", "デッドリフト"],
  ["레그 프레스", "하체", "머신", "Leg press", "レッグプレス"],
  ["레그 컬", "하체", "머신", "Leg curl", "レッグカール"],
  ["런지", "하체", "덤벨", "Lunge", "ランジ"],
  ["고블릿 스쿼트", "하체", "케틀벨", "Goblet squat", "ゴブレットスクワット"],
  ["숄더 프레스", "어깨", "덤벨", "Shoulder press", "ショルダープレス"],
  ["사이드 레터럴 레이즈", "어깨", "덤벨", "Lateral raise", "サイドレイズ"],
  ["덤벨 컬", "팔", "덤벨", "Dumbbell curl", "ダンベルカール"],
  [
    "트라이셉스 푸시다운",
    "팔",
    "머신",
    "Triceps pushdown",
    "トライセプスプッシュダウン",
  ],
  ["플랭크", "코어", "맨몸", "Plank", "プランク"],
  ["런닝", "유산소", "머신", "Running", "ランニング"],
  [
    "덤벨 벤치 프레스",
    "가슴",
    "덤벨",
    "Dumbbell bench press",
    "ダンベルベンチプレス",
  ],
  [
    "디클라인 벤치 프레스",
    "가슴",
    "바벨",
    "Decline bench press",
    "デクラインベンチプレス",
  ],
  ["덤벨 플라이", "가슴", "덤벨", "Dumbbell fly", "ダンベルフライ"],
  ["케이블 플라이", "가슴", "머신", "Cable fly", "ケーブルフライ"],
  ["딥스", "가슴", "맨몸", "Dip", "ディップス"],
  [
    "원암 덤벨 로우",
    "등",
    "덤벨",
    "One-arm dumbbell row",
    "ワンハンドダンベルロウ",
  ],
  [
    "체스트 서포티드 로우",
    "등",
    "덤벨",
    "Chest-supported row",
    "チェストサポートロウ",
  ],
  ["티바 로우", "등", "바벨", "T-bar row", "Tバーロウ"],
  [
    "스트레이트 암 풀다운",
    "등",
    "머신",
    "Straight-arm pulldown",
    "ストレートアームプルダウン",
  ],
  ["어시스트 풀업", "등", "머신", "Assisted pull-up", "アシストプルアップ"],
  ["인버티드 로우", "등", "맨몸", "Inverted row", "インバーテッドロウ"],
  ["페이스 풀", "어깨", "머신", "Face pull", "フェイスプル"],
  ["프론트 스쿼트", "하체", "바벨", "Front squat", "フロントスクワット"],
  [
    "루마니안 데드리프트",
    "하체",
    "바벨",
    "Romanian deadlift",
    "ルーマニアンデッドリフト",
  ],
  ["스모 데드리프트", "하체", "바벨", "Sumo deadlift", "スモウデッドリフト"],
  [
    "불가리안 스플릿 스쿼트",
    "하체",
    "덤벨",
    "Bulgarian split squat",
    "ブルガリアンスクワット",
  ],
  [
    "레그 익스텐션",
    "하체",
    "머신",
    "Leg extension",
    "レッグエクステンション",
  ],
  [
    "스탠딩 카프 레이즈",
    "하체",
    "머신",
    "Standing calf raise",
    "スタンディングカーフレイズ",
  ],
  [
    "시티드 카프 레이즈",
    "하체",
    "머신",
    "Seated calf raise",
    "シーテッドカーフレイズ",
  ],
  ["힙 쓰러스트", "하체", "바벨", "Hip thrust", "ヒップスラスト"],
  ["글루트 브리지", "하체", "맨몸", "Glute bridge", "グルートブリッジ"],
  ["스텝 업", "하체", "덤벨", "Step-up", "ステップアップ"],
  ["밀리터리 프레스", "어깨", "바벨", "Military press", "ミリタリープレス"],
  ["아놀드 프레스", "어깨", "덤벨", "Arnold press", "アーノルドプレス"],
  ["리어 델트 플라이", "어깨", "덤벨", "Rear delt fly", "リアデルトフライ"],
  [
    "머신 숄더 프레스",
    "어깨",
    "머신",
    "Machine shoulder press",
    "マシンショルダープレス",
  ],
  ["프론트 레이즈", "어깨", "덤벨", "Front raise", "フロントレイズ"],
  ["바벨 컬", "팔", "바벨", "Barbell curl", "バーベルカール"],
  ["해머 컬", "팔", "덤벨", "Hammer curl", "ハンマーカール"],
  ["프리처 컬", "팔", "머신", "Preacher curl", "プリーチャーカール"],
  [
    "인클라인 덤벨 컬",
    "팔",
    "덤벨",
    "Incline dumbbell curl",
    "インクラインダンベルカール",
  ],
  [
    "오버헤드 트라이셉스 익스텐션",
    "팔",
    "덤벨",
    "Overhead triceps extension",
    "オーバーヘッドトライセプスエクステンション",
  ],
  ["스컬 크러셔", "팔", "바벨", "Skull crusher", "スカルクラッシャー"],
  [
    "클로즈 그립 벤치 프레스",
    "팔",
    "바벨",
    "Close-grip bench press",
    "クローズグリップベンチプレス",
  ],
  ["크런치", "코어", "맨몸", "Crunch", "クランチ"],
  ["레그 레이즈", "코어", "맨몸", "Leg raise", "レッグレイズ"],
  ["케이블 크런치", "코어", "머신", "Cable crunch", "ケーブルクランチ"],
  ["러시안 트위스트", "코어", "맨몸", "Russian twist", "ロシアンツイスト"],
  ["실내 자전거", "유산소", "머신", "Stationary bike", "エアロバイク"],
  ["로잉 머신", "유산소", "머신", "Rowing machine", "ローイングマシン"],
];
const BODY_LABELS = {
  가슴: { en: "Chest", ja: "胸" },
  등: { en: "Back", ja: "背中" },
  하체: { en: "Legs", ja: "下半身" },
  어깨: { en: "Shoulders", ja: "肩" },
  팔: { en: "Arms", ja: "腕" },
  코어: { en: "Core", ja: "体幹" },
  유산소: { en: "Cardio", ja: "有酸素" },
};
const EQUIPMENT_LABELS = {
  바벨: { en: "Barbell", ja: "バーベル" },
  덤벨: { en: "Dumbbell", ja: "ダンベル" },
  머신: { en: "Machine", ja: "マシン" },
  케틀벨: { en: "Kettlebell", ja: "ケトルベル" },
  맨몸: { en: "Bodyweight", ja: "自重" },
};

const readJson = (file) =>
  JSON.parse(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"));
const existingRecords = readJson("exercises-existing.json");
const newRecords = readJson("exercises-new.json");
const records = [...existingRecords, ...newRecords];
const languages = ["ko", "en", "ja"];
const sections = ["setup", "execution", "breathing", "precautions"];
const bodies = Object.keys(BODY_LABELS);
const equipments = Object.keys(EQUIPMENT_LABELS);
const ws = (text) => text.replace(/\s+/g, " ").trim();
const normalize = (text) => text.toLowerCase().replaceAll(" ", "");
const hangul = /[가-힣]/;
const japanese = /[\u3040-\u30ff\u4e00-\u9fff]/;
const leadConsonants = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const expectedInitials = (text) =>
  [...text]
    .map((c) =>
      /[가-힣]/.test(c)
        ? leadConsonants[c.normalize("NFD").codePointAt(0) - 0x1100]
        : c,
    )
    .join("");
const guideKey = (name) => "exerciseGuide:" + name;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

test("library has exactly 120 unique exercises and preserves the original 60 in order", () => {
  assert.equal(ORIGINAL.length, 60);
  assert.equal(existingRecords.length, 60);
  assert.equal(newRecords.length, 60);
  assert.equal(library.length, 120);
  assert.equal(new Set(library.map((e) => e.name)).size, 120);
  assert.deepEqual(
    library.slice(0, 60),
    ORIGINAL.map(([name, body, equipment]) => ({
      name,
      body,
      equipment,
      guide: guideKey(name),
    })),
  );
  assert.deepEqual(
    library.slice(60),
    newRecords.map(({ name, body, equipment }) => ({
      name,
      body,
      equipment,
      guide: guideKey(name),
    })),
  );
  for (const e of library) {
    assert.deepEqual(Object.keys(e).sort(), [
      "body",
      "equipment",
      "guide",
      "name",
    ]);
    assert.ok(bodies.includes(e.body), e.name + " body " + e.body);
    assert.ok(
      equipments.includes(e.equipment),
      e.name + " equipment " + e.equipment,
    );
  }
});

test("source records are complete, localized and individual to each exercise", () => {
  assert.deepEqual(
    existingRecords.map(({ name, body, equipment, labels }) => [
      name,
      body,
      equipment,
      labels.en,
      labels.ja,
    ]),
    ORIGINAL,
  );
  for (const r of records) {
    assert.deepEqual(Object.keys(r).sort(), [
      "body",
      "equipment",
      "guide",
      "labels",
      "name",
    ]);
    assert.deepEqual(Object.keys(r.labels).sort(), ["en", "ja"]);
    assert.deepEqual(Object.keys(r.guide).sort(), ["en", "ja", "ko"]);
    assert.ok(hangul.test(r.name), r.name);
    assert.ok(r.labels.en.trim() && !/[가-힣\u3040-\u30ff]/.test(r.labels.en));
    assert.ok(japanese.test(r.labels.ja) && !hangul.test(r.labels.ja));
    for (const lang of languages) {
      assert.deepEqual(Object.keys(r.guide[lang]).sort(), [...sections].sort());
      for (const s of sections)
        assert.ok(
          typeof r.guide[lang][s] === "string" && r.guide[lang][s].trim(),
          `${r.name} ${lang} ${s}`,
        );
    }
    for (const s of sections) {
      assert.match(r.guide.ko[s], hangul, r.name + " ko " + s);
      assert.doesNotMatch(
        r.guide.en[s],
        /[가-힣\u3040-\u30ff\u4e00-\u9fff]/,
        r.name + " en " + s,
      );
      assert.match(r.guide.ja[s], /[\u3040-\u30ff]/, r.name + " ja " + s);
      assert.doesNotMatch(r.guide.ja[s], hangul, r.name + " ja " + s);
    }
  }
  for (const lang of languages)
    assert.equal(
      new Set(records.map((r) => sections.map((s) => r.guide[lang][s]).join("|")))
        .size,
      120,
    );
});

test("messages keep original translations and add labels and guides for every exercise", () => {
  for (const [name, body, equipment, en, ja] of ORIGINAL) {
    assert.equal(messages[name].en, en, name);
    assert.equal(messages[name].ja, ja, name);
    assert.ok(body in BODY_LABELS && equipment in EQUIPMENT_LABELS);
  }
  for (const [key, labels] of [
    ...Object.entries(BODY_LABELS),
    ...Object.entries(EQUIPMENT_LABELS),
  ]) {
    assert.equal(messages[key].en, labels.en, key);
    assert.equal(messages[key].ja, labels.ja, key);
  }
  for (const r of records) {
    assert.equal(messages[r.name].en, r.labels.en, r.name);
    assert.equal(messages[r.name].ja, r.labels.ja, r.name);
    const entry = messages[guideKey(r.name)];
    assert.ok(entry, guideKey(r.name));
    for (const lang of languages) {
      assert.ok(entry[lang]?.trim(), `${r.name} ${lang} guide`);
      for (const s of sections)
        assert.ok(
          ws(entry[lang]).includes(ws(r.guide[lang][s])),
          `${r.name} ${lang} ${s}`,
        );
    }
  }
  for (const lang of languages) {
    setLanguage(lang);
    for (const e of library) {
      const rendered = ws(t(e.guide));
      const source = records.find((r) => r.name === e.name).guide[lang];
      for (const s of sections)
        assert.ok(rendered.includes(ws(source[s])), `${e.name} ${lang} ${s}`);
    }
  }
  setLanguage("en");
});

test("every alias is distinct and round-trips to its canonical name in all languages", () => {
  const owners = new Map();
  for (const r of records)
    for (const alias of [r.name, r.labels.en, r.labels.ja]) {
      const key = normalize(alias);
      assert.ok(
        !owners.has(key) || owners.get(key) === r.name,
        `${alias} collides with ${owners.get(key)}`,
      );
      owners.set(key, r.name);
    }
  assert.equal(owners.size, 360);
  for (const lang of languages) {
    setLanguage(lang);
    for (const r of records) {
      const expected = lang === "ko" ? r.name : r.labels[lang];
      assert.equal(exerciseLabel(r.name), expected, `${lang} ${r.name}`);
      assert.equal(canonicalExercise(expected), r.name);
    }
  }
  for (const r of records)
    for (const alias of [r.name, r.labels.en, r.labels.ja]) {
      assert.equal(canonicalExercise(alias.toUpperCase()), r.name);
      assert.equal(canonicalExercise(`  ${alias.replaceAll(" ", "   ")} `), r.name);
    }
  setLanguage("en");
});

test("search matches names in all languages and Korean initials", () => {
  assert.equal(searchExercises("").length, 120);
  assert.equal(searchExercises("bench press")[0].name, "벤치 프레스");
  assert.equal(searchExercises("スクワット")[0].name, "스쿼트");
  assert.equal(searchExercises("ㅂㅊㅍㄹㅅ")[0].name, "벤치 프레스");
  for (const r of records) {
    for (const alias of [r.name, r.labels.en, r.labels.ja])
      for (const query of [alias, alias.toUpperCase(), alias.replaceAll(" ", "")])
        assert.ok(
          searchExercises(query).some((e) => e.name === r.name),
          `${query} -> ${r.name}`,
        );
    const initial = expectedInitials(r.name).replaceAll(" ", "");
    assert.ok(
      searchExercises(initial).some((e) => e.name === r.name),
      `${initial} -> ${r.name}`,
    );
  }
  assert.equal(searchExercises("zzzz 없는 운동 12345").length, 0);
});

test("body, equipment and query filters combine", () => {
  assert.equal(
    bodies.reduce((n, b) => n + searchExercises("", b).length, 0),
    120,
  );
  assert.equal(
    equipments.reduce((n, q) => n + searchExercises("", "", q).length, 0),
    120,
  );
  for (const b of bodies)
    for (const q of equipments)
      assert.deepEqual(
        searchExercises("", b, q).map((e) => e.name),
        records.filter((r) => r.body === b && r.equipment === q).map((r) => r.name),
        `${b}/${q}`,
      );
  for (const r of records) {
    for (const alias of [r.name, r.labels.en, r.labels.ja]) {
      assert.ok(
        searchExercises(alias, r.body, r.equipment).some((e) => e.name === r.name),
      );
      for (const e of searchExercises(alias, r.body, r.equipment)) {
        assert.equal(e.body, r.body);
        assert.equal(e.equipment, r.equipment);
      }
    }
    const otherBody = bodies.find((b) => b !== r.body);
    const otherEquipment = equipments.find((q) => q !== r.equipment);
    assert.ok(!searchExercises(r.name, otherBody).some((e) => e.name === r.name));
    assert.ok(
      !searchExercises(r.labels.en, "", otherEquipment).some(
        (e) => e.name === r.name,
      ),
    );
  }
  assert.ok(same(searchExercises("ㅂㅊ", "가슴", "바벨").map((e) => e.name).slice(0, 1), ["벤치 프레스"]));
});

test("custom exercise names pass through every language unchanged", () => {
  for (const lang of languages) {
    setLanguage(lang);
    for (const name of [
      "나만의 운동",
      "My Custom Lift",
      "벤치 프레스 변형",
      "Bench press!",
      guideKey("벤치 프레스"),
    ]) {
      assert.equal(exerciseLabel(name), name);
      assert.equal(canonicalExercise(name), name);
    }
  }
  setLanguage("en");
});
