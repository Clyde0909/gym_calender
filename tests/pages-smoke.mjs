import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};
const server = createServer(async (req, res) => {
  try {
    let path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/gym_calender/")) throw Error();
    path = decodeURIComponent(path.slice("/gym_calender/".length));
    const file = resolve(root, path || "index.html");
    if (!file.startsWith(root + sep)) throw Error();
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  });
  const context = await browser.newContext({ locale: "ko-KR" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/gym_calender/`);
  await page
    .getByRole("heading", { name: "운동 캘린더", exact: true })
    .waitFor();
  await page.waitForFunction(async () =>
    Boolean((await navigator.serviceWorker.getRegistration())?.active),
  );
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", { name: "운동 캘린더", exact: true })
    .waitFor();
  await page
    .getByPlaceholder("운동 검색 또는 직접 입력")
    .fill("오프라인 스쿼트");
  await page.getByRole("button", { name: "＋ 추가", exact: true }).click();
  await page.getByRole("heading", { name: "01오프라인 스쿼트" }).waitFor();
  await page.locator("#photo").setInputFiles({
    name: "offline.heic",
    mimeType: "image/heic",
    buffer: readFileSync(
      new URL("./fixtures/workout-10bit.heic", import.meta.url),
    ),
  });
  await page.locator(".photo-wrap img").waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "01오프라인 스쿼트" }).waitFor();
  await page.getByRole("button", { name: "공유 ↗", exact: true }).click();
  await page.locator("#export-password").fill("offline-test");
  await page.getByRole("button", { name: "압축 문자열 만들기" }).click();
  await page.waitForFunction(() =>
    document.querySelector("#export-output")?.value.startsWith("GW2.E."),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: GitHub Pages subpath, offline HEIC decoding, persistent recording and encrypted sharing.",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
