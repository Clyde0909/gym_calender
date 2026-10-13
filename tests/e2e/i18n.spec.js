import { test, expect } from "@playwright/test";
const variants = [
  ["en-US", "en", "Workout calendar"],
  ["ko-KR", "ko", "운동 캘린더"],
  ["ja-JP", "ja", "ワークアウトカレンダー"],
  ["fr-FR", "en", "Workout calendar"],
];
for (const [locale, language, title] of variants)
  test(`browser ${locale} selects ${language}`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5173",
      locale,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(page.locator("#language-select")).toHaveValue(language);
      for (const tab of [
        "calendar",
        "routines",
        "guide",
        "stats",
        "transfer",
        "settings",
      ]) {
        await page.locator(`[data-tab="${tab}"]`).click();
        if (language !== "ko") {
          const text = await page.locator("main").evaluate((el) => {
            const clone = el.cloneNode(true);
            clone.querySelector("#language-select")?.remove();
            return clone.textContent;
          });
          expect(text).not.toMatch(/[가-힣]/);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    } finally {
      await context.close();
    }
  });
test("language switching persists and does not translate user data or lose records", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#exercise-name").fill("사용자 운동 이름");
  await page.locator('[data-action="add-exercise"]').click();
  await page.locator("#note").fill("운동 캘린더 · My note");
  await page.locator("#note").press("Tab");
  await page.locator("#language-select").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator(".exercise-head")).toContainText(
    "사용자 운동 이름",
  );
  await expect(page.locator("#note")).toHaveValue("운동 캘린더 · My note");
  await page.reload();
  await expect(page.locator("#language-select")).toHaveValue("en");
  await page.locator("#language-select").selectOption("ja");
  await expect(page.locator(".exercise-head")).toContainText(
    "사용자 운동 이름",
  );
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill("ベンチプレス");
  await expect(
    page
      .locator(".guide-card")
      .filter({
        has: page.getByRole("heading", { name: "ベンチプレス", exact: true }),
      }),
  ).toHaveCount(1);
  await page
    .locator(".guide-card")
    .filter({
      has: page.getByRole("heading", { name: "ベンチプレス", exact: true }),
    })
    .locator('[data-action="guide-add"]')
    .click();
  await page.locator('[data-tab="calendar"]').click();
  await expect(page.locator(".exercise-head")).toContainText([
    "사용자 운동 이름",
    "ベンチプレス",
  ]);
  await page.locator("#language-select").selectOption("en");
  await expect(page.locator(".exercise-head")).toContainText([
    "사용자 운동 이름",
    "Bench press",
  ]);
});
test("translated import errors and query language remain consistent after selection", async ({
  page,
}) => {
  await page.goto("/?lang=ja");
  await expect(page.locator("#language-select")).toHaveValue("ja");
  await page.locator("#language-select").selectOption("en");
  await page.reload();
  await expect(page.locator("#language-select")).toHaveValue("en");
  await page.locator('[data-tab="transfer"]').click();
  await page.locator("#import-input").fill("broken");
  await page.locator('[data-action="inspect-import"]').click();
  await expect(page.locator("#toast")).toContainText(
    "Unsupported share string",
  );
});
