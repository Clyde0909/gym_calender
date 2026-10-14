import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const readJson = (file) =>
  JSON.parse(
    readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8"),
  );
const existing = readJson("exercises-existing.json");
const [fresh] = readJson("exercises-new.json");
const bench = existing.find((r) => r.name === "벤치 프레스");
const languages = ["ko", "en", "ja"];
const sections = ["setup", "execution", "breathing", "precautions"];
// Independent expectations: labels captured from the original translations.
const bodyLabels = {
  가슴: { en: "Chest", ja: "胸" },
  등: { en: "Back", ja: "背中" },
  하체: { en: "Legs", ja: "下半身" },
  어깨: { en: "Shoulders", ja: "肩" },
  팔: { en: "Arms", ja: "腕" },
  코어: { en: "Core", ja: "体幹" },
  유산소: { en: "Cardio", ja: "有酸素" },
};
const equipmentLabels = {
  바벨: { en: "Barbell", ja: "バーベル" },
  덤벨: { en: "Dumbbell", ja: "ダンベル" },
  머신: { en: "Machine", ja: "マシン" },
  케틀벨: { en: "Kettlebell", ja: "ケトルベル" },
  맨몸: { en: "Bodyweight", ja: "自重" },
};
const ws = (text) => text.replace(/\s+/g, " ").trim();
const label = (record, lang) => (lang === "ko" ? record.name : record.labels[lang]);
const part = (value, labels, lang) => (lang === "ko" ? value : labels[value][lang]);
const card = (page, text) =>
  page
    .locator(".guide-card")
    .filter({ has: page.getByRole("heading", { name: text, exact: true }) });
async function expectGuideCard(page, record, lang) {
  const target = card(page, label(record, lang));
  await expect(target).toHaveCount(1);
  await expect(target.locator(".eyebrow")).toHaveText(
    `${part(record.body, bodyLabels, lang)} · ${part(record.equipment, equipmentLabels, lang)}`,
  );
  for (const section of sections)
    await expect(target).toContainText(ws(record.guide[lang][section]));
  await expect(target.locator('[data-action="guide-add"]')).toHaveAttribute(
    "data-name",
    record.name,
  );
  return target;
}
const storedNames = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("gym-calendar-store");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const get = db.transaction("state").objectStore("state").get("main");
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            db.close();
            resolve(
              (get.result?.sessions ?? []).flatMap((s) =>
                s.exercises.map((e) => e.name),
              ),
            );
          };
        };
      }),
  );

for (const lang of languages)
  test(`new library exercise is searchable, guided and stored canonically in ${lang}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#language-select").selectOption(lang);
    await page.locator('[data-tab="guide"]').click();
    await page.locator("#guide-search").fill(label(fresh, lang));
    const target = await expectGuideCard(page, fresh, lang);
    await target.locator('[data-action="guide-add"]').click();
    await page.locator('[data-tab="calendar"]').click();
    await expect(page.locator(".exercise-head")).toContainText(
      label(fresh, lang),
    );
    await expect.poll(() => storedNames(page)).toContain(fresh.name);
    if (lang !== "ko")
      expect(await storedNames(page)).not.toContain(label(fresh, lang));

    await page.reload();
    await expect(page.locator("#language-select")).toHaveValue(lang);
    await expect(page.locator(".exercise-head")).toContainText(
      label(fresh, lang),
    );
    for (const other of languages) {
      await page.locator("#language-select").selectOption(other);
      await expect(page.locator(".exercise-head")).toContainText(
        label(fresh, other),
      );
    }
    expect(await storedNames(page)).toContain(fresh.name);
  });

test("new exercise guide text follows language switching and filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill(fresh.name);
  for (const lang of languages) {
    await page.locator("#language-select").selectOption(lang);
    await expectGuideCard(page, fresh, lang);
  }
  await page.locator("#guide-body").selectOption(fresh.body);
  await page.locator("#guide-equipment").selectOption(fresh.equipment);
  await expect(card(page, label(fresh, "ja"))).toHaveCount(1);
  const otherBody = Object.keys(bodyLabels).find((b) => b !== fresh.body);
  await page.locator("#guide-body").selectOption(otherBody);
  await expect(card(page, label(fresh, "ja"))).toHaveCount(0);
  await expect(page.locator("#guide-results")).toBeVisible();
});

test("existing exercise guide search, localized guide and add remain available", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill("ㅂㅊㅍㄹㅅ");
  const target = await expectGuideCard(page, bench, "ko");
  await page.locator("#language-select").selectOption("en");
  await expectGuideCard(page, bench, "en");
  await page.locator("#language-select").selectOption("ja");
  await expectGuideCard(page, bench, "ja");
  await page.locator("#language-select").selectOption("ko");
  await target.locator('[data-action="guide-add"]').click();
  await page.locator('[data-tab="calendar"]').click();
  await expect(page.locator(".exercise-head")).toContainText("벤치 프레스");
  await expect.poll(() => storedNames(page)).toContain("벤치 프레스");
});
