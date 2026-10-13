import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
async function addExercise(page, name, weight, reps = 5) {
  await page.locator("#exercise-name").fill(name);
  await page.locator('[data-action="add-exercise"]').click();
  const card = page.locator(".exercise-card").filter({ hasText: name });
  await card.locator('[data-field="weight"]').fill(String(weight));
  await card.locator('[data-field="weight"]').press("Tab");
  await expect(card.locator('[data-field="weight"]')).toHaveAttribute(
    "value",
    String(weight),
  );
  await card.locator('[data-field="reps"]').fill(String(reps));
  await card.locator('[data-field="reps"]').press("Tab");
  await expect(card.locator('[data-field="reps"]')).toHaveAttribute(
    "value",
    String(reps),
  );
}
test("mobile full-screen workout progresses through rest, next exercise and photo finish", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date("2026-10-13T12:00:00") });
  await page.goto("/");
  await page.locator('[data-tab="settings"]').click();
  await page.locator("#rest-seconds").fill("10");
  await page.locator("#rest-seconds").press("Tab");
  await page.locator('[data-tab="calendar"]').click();
  await addExercise(page, "스쿼트", 80);
  await page.locator('[data-action="add-set"]').click();
  await expect(page.locator(".set-row")).toHaveCount(2);
  await addExercise(page, "벤치 프레스", 50, 10);
  await page.locator('[data-action="start-session"]').click();
  await expect(page.locator(".focus-overlay")).toBeVisible();
  await expect(page.locator(".focus-touch h1")).toHaveText("스쿼트");
  await expect(page.locator(".focus-values")).toContainText("80");
  await page.locator('[data-action="focus-tap"]').click();
  await expect(page.locator(".phase-rest")).toBeVisible();
  await expect(page.locator("#focus-countdown")).toHaveText("10");
  await page.clock.fastForward(11000);
  await expect(page.locator(".phase-ready")).toBeVisible();
  await page.locator('[data-action="focus-tap"]').dblclick();
  await expect(page.locator(".phase-running")).toBeVisible();
  await page.clock.fastForward(400);
  await page.locator('[data-action="focus-tap"]').click();
  await expect(page.locator(".phase-rest h1")).toHaveText("벤치 프레스");
  await page.reload();
  await expect(page.locator(".phase-rest")).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(page.locator(".phase-ready")).toBeVisible();
  await page.locator('[data-action="focus-tap"]').click();
  await page.clock.fastForward(400);
  await page.locator('[data-action="focus-tap"]').click();
  await expect(page.locator(".focus-finished")).toBeVisible();
  await expect(page.locator(".focus-finish h1")).toHaveText(
    "오늘의 운동 완료!",
  );
  await expect(page.locator(".focus-finish h2")).toHaveText(
    "운동 사진을 등록할까요?",
  );
  const choosing = page.waitForEvent("filechooser");
  await page.locator('[data-action="focus-photo-picker"]').click();
  await (
    await choosing
  ).setFiles({
    name: "camera.HEIC",
    mimeType: "image/heic",
    buffer: readFileSync(new URL("../fixtures/workout.heic", import.meta.url)),
  });
  await expect(page.locator(".focus-saved-photo")).toBeVisible();
  await page.locator('[data-action="focus-dismiss"]').click();
  await expect(page.locator(".focus-overlay")).toHaveCount(0);
  await expect(page.locator(".session-stats")).toContainText("3");
  await expect(page.locator(".session-controls")).toContainText("운동 시간");
  await page.reload();
  await expect(page.locator(".photo-wrap img")).toBeVisible();
});
test("native share uses an active tap and permission rejection has a useful fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.shareCalls = [];
    Object.defineProperty(navigator, "canShare", {
      value: () => true,
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data) => {
        window.shareCalls.push({
          active: navigator.userActivation.isActive,
          hasFile: !!data.files,
          title: data.title,
        });
        return window.rejectShare
          ? Promise.reject(
              new DOMException("Permission denied", "NotAllowedError"),
            )
          : Promise.resolve();
      },
    });
  });
  await page.goto("/");
  await addExercise(page, "스쿼트", 50);
  await page.locator('[data-action="share-day"]').click();
  if (await page.locator("#share-dialog").count())
    await page.locator('[data-share="native"]').click();
  await expect
    .poll(() => page.evaluate(() => window.shareCalls.length))
    .toBe(1);
  expect(await page.evaluate(() => window.shareCalls[0])).toMatchObject({
    active: true,
    hasFile: true,
  });
  await page.evaluate(() => (window.rejectShare = true));
  await page.locator('[data-action="share-day"]').click();
  await expect(page.locator("#share-dialog")).toBeVisible();
  await expect(page.locator(".share-message")).toContainText("파일 다운로드");
  await expect(page.locator(".share-code")).toHaveValue(/^GW1\.P\./);
  await expect(page.locator('[data-share="download"]')).toBeEnabled();
  await page.locator('[data-share="close"]').click();
  await page.evaluate(() => (window.rejectShare = false));
  await page.locator('[data-tab="transfer"]').click();
  await page.locator("#export-password").fill("share-secret");
  await page.locator('[data-action="export"]').click();
  await expect(page.locator("#export-output")).toHaveValue(/^GW1\.E\./);
  await page.locator('[data-action="native-share"]').click();
  await expect
    .poll(() => page.evaluate(() => window.shareCalls.length))
    .toBe(3);
  expect(await page.evaluate(() => window.shareCalls.at(-1))).toMatchObject({
    active: true,
    hasFile: true,
  });
});
test("HEIF file with no MIME type decodes locally, malformed HEIC gives a translated error", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#photo").setInputFiles({
    name: "camera.heif",
    mimeType: "",
    buffer: readFileSync(
      new URL("../fixtures/workout-10bit.heic", import.meta.url),
    ),
  });
  await expect(page.locator(".photo-wrap img")).toBeVisible();
  await page.locator("#photo").setInputFiles({
    name: "broken.heic",
    mimeType: "image/heic",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.locator("#toast")).toContainText("HEIC/HEIF");
  await expect(page.locator(".photo-wrap img")).toBeVisible();
});
