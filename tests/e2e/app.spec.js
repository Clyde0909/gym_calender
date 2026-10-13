import { test, expect } from "@playwright/test";
test("record persists, routine, encrypted photo sharing and restore", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "운동 캘린더", exact: true }),
  ).toBeVisible();
  await page.getByPlaceholder("운동 검색 또는 직접 입력").fill("벤치 프레스");
  await page.getByRole("button", { name: "＋ 추가", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "벤치 프레스 1세트 무게" })
    .fill("60");
  await page
    .getByRole("spinbutton", { name: "벤치 프레스 1세트 무게" })
    .press("Tab");
  await page.getByRole("button", { name: "1세트 완료", exact: true }).click();
  await expect(page.locator(".session-stats")).toContainText("600");
  await page.locator("#note").fill("좋은 운동!");
  await page.locator("#note").press("Tab");
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    c.getContext("2d").fillRect(0, 0, 64, 64);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page.locator("#photo").setInputFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await expect(page.locator(".photo-wrap img")).toBeVisible();
  page.once("dialog", (d) => d.accept("상체 루틴"));
  await page.getByRole("button", { name: "현재 운동을 루틴으로 저장" }).click();
  await page.reload();
  await expect(page.locator("#note")).toHaveValue("좋은 운동!");
  await expect(page.locator(".photo-wrap img")).toBeVisible();
  await page.locator('[data-tab="transfer"]').click();
  await page.locator("#export-password").fill("test-password");
  await page.getByRole("button", { name: "압축 문자열 만들기" }).click();
  await expect(page.locator("#export-output")).toHaveValue(/^GW1\.E\./);
  const code = await page.locator("#export-output").inputValue();
  await page.locator("#import-input").fill(code);
  await page.locator("#import-password").fill("bad");
  await page.getByRole("button", { name: "내용 확인", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("비밀번호가 다르거나");
  await expect(
    page.getByRole("button", { name: "확인하고 가져오기" }),
  ).toHaveCount(0);
  await page.locator("#import-password").fill("test-password");
  await page.getByRole("button", { name: "내용 확인", exact: true }).click();
  await expect(page.locator("#import-preview")).toContainText("사진 1장");
  await expect(page.locator("#import-preview")).toContainText(
    "1일의 기존 기록",
  );
  await page.getByRole("button", { name: "확인하고 가져오기" }).click();
  await expect(page.locator("#toast")).toContainText("가져왔습니다");
  await page.getByRole("button", { name: "나의 루틴", exact: false }).click();
  await expect(page.getByRole("heading", { name: "상체 루틴" })).toBeVisible();
  await page.getByRole("button", { name: "기록 분석", exact: false }).click();
  await expect(page.locator(".history")).toContainText("600 kg");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("import never renders malicious markup", async ({ page }) => {
  await page.goto("/");
  await page
    .getByPlaceholder("운동 검색 또는 직접 입력")
    .fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "＋ 추가", exact: true }).click();
  await expect(page.locator(".exercise-head")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".exercise-head img")).toHaveCount(0);
});
test("library search, editable scheduled routine, sessions, units and 1RM", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "운동 가이드", exact: false }).click();
  await page.locator("#guide-search").fill("ㅂㅊㅍㄹㅅ");
  await expect(page.locator(".guide-card")).toHaveCount(1);
  await page.getByRole("button", { name: "선택 날짜 운동에 추가" }).click();
  await page.getByRole("button", { name: "나의 루틴", exact: false }).click();
  await page.getByRole("button", { name: "＋ 새 루틴" }).click();
  await page.locator("#edit-name").fill("하체 A");
  await page.locator("#edit-exercise-name").fill("스쿼트");
  await page.getByRole("button", { name: "＋ 운동 추가", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "루틴 1종목 1세트 무게" })
    .fill("100");
  await page
    .getByRole("spinbutton", { name: "루틴 1종목 1세트 무게" })
    .press("Tab");
  await page.getByRole("button", { name: "루틴 저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: "하체 A" })).toBeVisible();
  const weekday = await page.evaluate(() => new Date().getDay());
  await page
    .locator(`[data-schedule="${weekday}"]`)
    .selectOption({ label: "하체 A" });
  await page.getByRole("button", { name: "운동 캘린더", exact: false }).click();
  await expect(page.locator(".session-controls")).toContainText("하체 A");
  await page
    .getByRole("button", { name: "운동에 추가 ↗", exact: true })
    .click();
  await page.getByRole("button", { name: "▶ 운동 시작", exact: true }).click();
  if (page.viewportSize().width <= 850) {
    await expect(page.locator(".focus-overlay")).toBeVisible();
    await page.locator('[data-action="focus-exit"]').click();
    await expect(page.locator(".focus-overlay")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "■ 운동 종료", exact: true }).click();
  await expect(page.locator(".session-controls")).toContainText("운동 시간");
  await page.getByRole("button", { name: "개인 설정", exact: false }).click();
  await page.locator("#unit").selectOption("lbs");
  await page.reload();
  await page.getByRole("button", { name: "개인 설정", exact: false }).click();
  await expect(page.locator("#unit")).toHaveValue("lbs");
  await page.getByRole("button", { name: "기록 분석", exact: false }).click();
  await page.locator("#rm-weight").fill("100");
  await page.locator("#rm-reps").fill("1");
  await page.getByRole("button", { name: "계산", exact: true }).click();
  await expect(page.locator("#rm-result")).toHaveText("추정 1RM: 100 lbs");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("previous record reuse and automatic rest countdown", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-13T12:00:00") });
  await page.goto("/");
  await page.locator('[data-date="2026-10-12"]').click();
  await page.getByPlaceholder("운동 검색 또는 직접 입력").fill("스쿼트");
  await page.getByRole("button", { name: "＋ 추가", exact: true }).click();
  await page.getByRole("spinbutton", { name: "스쿼트 1세트 무게" }).fill("80");
  await page
    .getByRole("spinbutton", { name: "스쿼트 1세트 무게" })
    .press("Tab");
  await page.getByRole("button", { name: "1세트 완료", exact: true }).click();
  await expect(page.locator(".timer")).toBeVisible();
  await page.clock.fastForward(95000);
  await expect(page.locator(".timer")).toBeHidden();
  await page.locator('[data-date="2026-10-13"]').click();
  await page.getByPlaceholder("운동 검색 또는 직접 입력").fill("스쿼트");
  await page.getByRole("button", { name: "＋ 추가", exact: true }).click();
  await page.getByRole("button", { name: "↶ 이전 기록", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "스쿼트 1세트 무게" }),
  ).toHaveValue("80");
  await expect(
    page.getByRole("button", { name: "1세트 완료", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
