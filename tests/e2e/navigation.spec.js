import { test, expect } from "@playwright/test";
test("menu pages support back and forward without recording dates or filters", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  await expect(page).toHaveURL(/#\/calendar$/);
  const initial = await page.evaluate(() => history.length);
  await page.locator("[data-date]").first().click();
  await page.locator('[data-action="next-month"]').click();
  expect(await page.evaluate(() => history.length)).toBe(initial);
  await page.locator('[data-tab="routines"]').click();
  await expect(page).toHaveURL(/#\/routines$/);
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill("스쿼트");
  await page.locator("#guide-body").selectOption("하체");
  expect(await page.evaluate(() => history.length)).toBe(initial + 2);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "나의 루틴", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "운동 캘린더", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "나의 루틴", exact: true }),
  ).toBeVisible();
  await page.locator('[data-tab="routines"]').click();
  expect(await page.evaluate(() => history.length)).toBe(initial + 2);
});
test("direct menu links and reload retain page and language", async ({
  page,
}) => {
  await page.goto("/?lang=ja#/settings");
  await expect(page.locator("#pwa-panel")).toBeVisible();
  await page.reload();
  await expect(page.locator("#pwa-panel")).toBeVisible();
  await page.locator("#language-select").selectOption("en");
  await expect(page).toHaveURL(/lang=en#\/settings$/);
  await page.locator('[data-tab="stats"]').click();
  await page.goBack();
  await expect(page.locator("#pwa-panel")).toBeVisible();
  await expect(page.locator("#language-select")).toHaveValue("en");
});
test("returning from a workout page closes focus and preserves workout progress", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  await page.locator("#exercise-name").fill("뒤로가기 운동");
  await page.locator('[data-action="add-exercise"]').click();
  await page.locator('[data-tab="routines"]').click();
  await page.locator('nav [data-tab="calendar"]').click();
  await page.locator('[data-action="start-session"]').click();
  if (page.viewportSize().width <= 850)
    await expect(page.locator(".focus-overlay")).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "나의 루틴", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".focus-overlay")).toHaveCount(0);
  await page.goForward();
  await expect(page.locator(".exercise-card")).toContainText("뒤로가기 운동");
  await expect(page.locator(".session-controls")).toContainText("운동 진행 중");
});
