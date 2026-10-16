import { test, expect } from "@playwright/test";
test("install button falls back to localized Safari and Android instructions", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  await page.locator('[data-action="install-app"]').click();
  await expect(page.locator("#pwa-panel")).toContainText("홈 화면에 추가");
  await expect(page.locator("#pwa-panel")).toContainText("전체 백업");
  await page.locator("#language-select").selectOption("en");
  await expect(page.locator("#pwa-panel")).toContainText("Add to Home Screen");
  await page.locator("#language-select").selectOption("ja");
  await expect(page.locator("#pwa-panel")).toContainText("ホーム画面に追加");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("browser install event uses the active tap and hides the button after installation", async ({
  page,
}) => {
  await page.goto("/?lang=en");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    event.prompt = () => {
      window.promptActivated = navigator.userActivation.isActive;
      return Promise.resolve();
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.locator('[data-action="install-app"]').click();
  expect(await page.evaluate(() => window.promptActivated)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.locator('[data-action="install-app"]')).toBeHidden();
  await page.locator('[data-tab="settings"]').click();
  await expect(page.locator("#pwa-status")).toContainText("installed");
});
