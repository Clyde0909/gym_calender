import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const media = JSON.parse(
  readFileSync(new URL("../../src/exercise-media.json", import.meta.url), "utf8"),
);
const readJson = (file) =>
  JSON.parse(readFileSync(new URL(`../../src/${file}`, import.meta.url), "utf8"));
const existing = readJson("exercises-existing.json");
const catalog = [...existing, ...readJson("exercises-new.json")];
const benchRecord = existing.find((e) => e.name === "벤치 프레스");
const bench = media.exercises["벤치 프레스"];
const benchEn = benchRecord.labels.en;
const benchJa = benchRecord.labels.ja;
const unmapped = catalog.find((e) => !Object.hasOwn(media.exercises, e.name));
const card = (page, name) =>
  page
    .locator(".guide-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
const openGuide = async (page, lang, query = "벤치 프레스") => {
  await page.goto(`/?lang=${lang}`);
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill(query);
};

test("bench press shows two local photos with source and license", async ({
  page,
}) => {
  const external = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.hostname !== "127.0.0.1") external.push(r.url());
  });
  await openGuide(page, "ko");
  const c = card(page, "벤치 프레스");
  const imgs = c.locator(".exercise-photos img");
  await expect(imgs).toHaveCount(2);
  for (const [i, img] of (await imgs.all()).entries()) {
    await expect(img).toHaveAttribute("src", new RegExp(`${bench.images[i]}$`));
    await expect(img).toHaveAttribute("loading", "lazy");
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
      .toBe(true);
  }
  const { source } = media;
  await expect(c.locator(".exercise-source a").first()).toHaveAttribute(
    "href",
    `${source.repository}/tree/${source.revision}/exercises/${bench.id}`,
  );
  await expect(c.locator(".exercise-source")).toContainText("Unlicense");
  expect(external).toEqual([]);
});

test("alt text and pose labels follow language", async ({ page }) => {
  await openGuide(page, "en", benchEn);
  const c = card(page, benchEn);
  await expect(c.locator("figcaption")).toHaveText(["Pose 1", "Pose 2"]);
  await expect(c.locator("img").first()).toHaveAttribute(
    "alt",
    `${benchEn} demonstration photo, pose 1`,
  );
  await page.locator("#language-select").selectOption("ja");
  const ja = card(page, benchJa);
  await expect(ja.locator("figcaption").first()).toHaveText("ポーズ 1");
  await expect(ja.locator("img").first()).toHaveAttribute(
    "alt",
    `${benchJa}のデモ写真、ポーズ1`,
  );
  await page.locator("#language-select").selectOption("ko");
  await expect(page.locator(".guide-card figcaption").first()).toHaveText(
    "자세 1",
  );
});

test("unmapped exercise keeps icon fallback without photos", async ({
  page,
}) => {
  expect(unmapped).toBeTruthy();
  const name = unmapped.name;
  await openGuide(page, "ko", name);
  const c = card(page, name);
  await expect(c).toHaveCount(1);
  await expect(c.locator(".exercise-illustration")).toBeVisible();
  await expect(c.locator("img")).toHaveCount(0);
});

test("search and add still work with photos", async ({ page }) => {
  await openGuide(page, "ko", "ㅂㅊㅍㄹㅅ");
  const c = card(page, "벤치 프레스");
  await expect(c.locator("img")).toHaveCount(2);
  await c.getByRole("button", { name: /선택 날짜 운동에 추가/ }).click();
  await page.locator('[data-tab="calendar"]').click();
  await expect(page.locator(".exercise-head")).toContainText("벤치 프레스");
});

test("offline uncached image request falls back and keeps text and add action", async ({
  page,
  context,
}) => {
  await page.goto("/?lang=en");
  await page.locator('[data-tab="guide"]').click();
  await context.setOffline(true);
  await page.route("**/exercise-media/**", (route) => route.abort("internetdisconnected"));
  await page.locator("#guide-search").fill(benchEn);
  const c = card(page, benchEn);
  await expect(c.locator(".exercise-media-fallback")).toBeVisible();
  await expect(c.locator("p")).not.toBeEmpty();
  await expect(c.getByRole("button", { name: /Add/ })).toBeVisible();
  await expect(c.locator(".exercise-source a").nth(1)).toHaveAttribute(
    "href",
    /exercise-media\/LICENSE\.md$/,
  );
});

test("image failure keeps guide and shows unavailable text", async ({
  page,
}) => {
  await page.route("**/exercise-media/**", (route) => route.abort());
  await openGuide(page, "en", benchEn);
  const c = card(page, benchEn);
  await expect(c.locator(".exercise-media-fallback")).toBeVisible();
  await expect(c.locator(".exercise-media-fallback")).toContainText(
    "unavailable",
  );
  await expect(c.locator(".exercise-photos")).toBeHidden();
  await expect(c.getByRole("heading", { name: benchEn, exact: true })).toBeVisible();
  await expect(
    c.getByRole("button", { name: /Add/ }),
  ).toBeVisible();
});
