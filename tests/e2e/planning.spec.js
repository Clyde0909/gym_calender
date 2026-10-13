import { test, expect } from "@playwright/test";
test("recommended weekly list auto-loads, edits, persists real records and is backed up", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  await page.locator('[data-tab="programs"]').click();
  await page.locator("#program-week").fill("2026-10-13");
  await page
    .locator('[data-action="program-create"][data-id="full-3"]')
    .click();
  await expect(page.locator(".week-plan")).toHaveCount(1);
  await page.locator('[data-history="2026-10-14"]').click();
  await expect(page.locator(".exercise-card")).toHaveCount(4);
  await expect(page.locator(".exercise-head").first()).toContainText(
    "루마니안 데드리프트",
  );
  await page.locator('[data-field="weight"]').first().fill("65");
  await page.locator('[data-field="weight"]').first().press("Tab");
  await expect(page.locator('[data-field="weight"]').first()).toHaveAttribute(
    "value",
    "65",
  );
  await page.locator('[data-action="toggle-set"]').first().click();
  await expect(page.locator(".session-stats")).toContainText("1");
  await page.locator('[data-tab="routines"]').click();
  await page.locator('[data-action="week-edit-day"][data-day="3"]').click();
  await page.locator('[data-edit-field="weight"]').first().fill("90");
  await page.locator('[data-edit-field="weight"]').first().press("Tab");
  await page.locator('[data-action="commit-edit"]').click();
  await page.locator('[data-history="2026-10-14"]').click();
  await expect(page.locator('[data-field="weight"]').first()).toHaveValue("65");
  await expect(
    page.locator('[data-action="toggle-set"]').first(),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-tab="transfer"]').click();
  await page.locator("#export-kind").selectOption("backup");
  await page.locator('[data-action="export"]').click();
  await expect(page.locator("#export-output")).toHaveValue(/^GW3\.P\./);
  const compact = await page.locator("#export-output").inputValue();
  await page.locator("#export-encoding").selectOption("compatible");
  await page.locator('[data-action="export"]').click();
  await expect(page.locator("#export-output")).toHaveValue(/^GW4\.P\./);
  const old = await page.locator("#export-output").inputValue();
  expect(compact.length).toBeLessThan(old.length);
  await page.locator("#import-input").fill(compact);
  await page.locator('[data-action="inspect-import"]').click();
  await expect(page.locator("#import-preview")).toContainText("주간 계획 1개");
  await page.locator('[data-action="apply-import"]').click();
  await page.reload();
  await page.locator('[data-tab="routines"]').click();
  await expect(page.locator(".week-plan")).toHaveCount(1);
});
test("recurring routine auto-loads in an empty date and can start immediately", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  await page.locator('[data-tab="routines"]').click();
  await page.locator('[data-action="new-routine"]').click();
  await page.locator("#edit-name").fill("자동 루틴");
  await page.locator("#edit-exercise-name").fill("해머 컬");
  await page.locator('[data-action="edit-add"]').click();
  await page.locator('[data-action="commit-edit"]').click();
  await page
    .locator('[data-schedule="3"]')
    .selectOption({ label: "자동 루틴" });
  await page.locator('[data-tab="calendar"]').click();

  await page.locator('[data-tab="routines"]').click();
  await page.locator("#week-date").fill("2026-10-13");
  await page.locator('[data-weekday="3"]').selectOption({ label: "자동 루틴" });
  await page.locator('[data-action="week-create"]').click();
  await page.locator('[data-history="2026-10-14"]').click();
  await expect(page.locator(".exercise-card")).toHaveCount(1);
  await expect(page.locator(".exercise-head")).toContainText("해머 컬");
  await page.locator('[data-action="start-session"]').click();
  if (page.viewportSize().width <= 850)
    await expect(page.locator(".phase-running")).toBeVisible();
  else
    await expect(page.locator(".session-controls")).toContainText(
      "운동 진행 중",
    );
});

test("large photo compact encrypted export restores safely with symbol-rich text", async ({
  page,
}) => {
  await page.goto("/?lang=ko");
  const photo = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d"),
      image = ctx.createImageData(320, 240);
    let seed = 42;
    for (let i = 0; i < image.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        image.data[i + c] = seed >>> 24;
      }
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL("image/webp", 0.65).split(",")[1];
  });
  await page
    .locator("#photo")
    .setInputFiles({
      name: "detail.webp",
      mimeType: "image/webp",
      buffer: Buffer.from(photo, "base64"),
    });
  await expect(page.locator(".photo-wrap img")).toBeVisible();
  await page.locator('[data-tab="transfer"]').click();
  await page.locator("#export-password").fill("large-photo");
  await page.locator('[data-action="export"]').click();
  await expect(page.locator("#export-output")).toHaveValue(/^GW3\.E\./);
  const code = await page.locator("#export-output").inputValue();
  expect(code.length).toBeGreaterThan(10000);
  await page.locator("#import-input").fill(code);
  await page.locator("#import-password").fill("large-photo");
  await page.locator('[data-action="inspect-import"]').click();
  await expect(page.locator("#import-preview")).toContainText("사진 1장");
});
