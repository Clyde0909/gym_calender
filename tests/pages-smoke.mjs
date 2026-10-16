import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, extname, sep } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".md": "text/plain; charset=utf-8",
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
const profile = await mkdtemp(resolve(tmpdir(), "gym-pwa-test-"));
let browser;
try {
  browser = await chromium.launchPersistentContext(profile, {
    locale: "ko-KR",
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  });
  const context = browser;
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
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill("벤치 프레스");
  const bench = page.locator(".guide-card").filter({
    has: page.getByRole("heading", { name: "벤치 프레스", exact: true }),
  });
  await bench.waitFor();
  assert.equal(await bench.locator("img").count(), 2);
  await bench.locator("img").evaluateAll(async (images) => {
    for (const image of images) {
      await image.decode();
      if (
        !image.naturalWidth ||
        !new URL(image.src).pathname.startsWith("/gym_calender/exercise-media/")
      )
        throw new Error("Invalid Pages exercise image");
    }
  });
  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  assert.deepEqual(manifest.errors, []);
  const config = JSON.parse(manifest.data);
  assert.equal(config.display, "standalone");
  assert.equal(
    new URL(config.start_url, manifest.url).pathname,
    "/gym_calender/",
  );
  for (const icon of config.icons) {
    const response = await context.request.get(
      new URL(icon.src, manifest.url).href,
    );
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"], /image\/png/);
  }
  const installability = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(installability.installabilityErrors, []);
  const cacheName = await page.evaluate(async () =>
    (await caches.keys()).find((name) => name.startsWith("gym-log-")),
  );
  // Reproduce an obsolete HTML shell kept by the old cache-first worker.
  await page.evaluate(async (name) => {
    const cache = await caches.open(name);
    await cache.put(
      new URL("./", location.href),
      new Response("<h1>Obsolete cached shell</h1>", {
        headers: { "Content-Type": "text/html" },
      }),
    );
    const previous = await caches.open("gym-log-previous-test");
    await previous.put(
      new URL("./assets/previous-build.js", location.href),
      new Response("previous build asset"),
    );
  }, cacheName);
  await page.reload();
  await page
    .getByRole("heading", { name: "운동 캘린더", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(async () =>
      (await fetch("./assets/previous-build.js")).text(),
    ),
    "previous build asset",
  );
  await context.setOffline(true);
  await page.reload();
  await page
    .getByRole("heading", { name: "운동 캘린더", exact: true })
    .waitFor();
  await page.locator('[data-tab="guide"]').click();
  await page.locator("#guide-search").fill("벤치 프레스");
  await bench.waitFor();
  assert.equal(await bench.locator("img").count(), 2);
  await bench.locator("img").evaluateAll(async (images) => {
    for (const image of images) {
      await image.decode();
      if (!image.naturalWidth)
        throw new Error("Viewed exercise image unavailable offline");
    }
  });
  await page.locator('[data-tab="calendar"]').click();
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
    document.querySelector("#export-output")?.value.startsWith("GW3.E."),
  );
  // Recovery bypasses legacy cached HTML without clearing IndexedDB records.
  await context.setOffline(false);
  await page.goto(
    `http://127.0.0.1:${server.address().port}/gym_calender/recover.html?lang=ko`,
  );
  await page.locator("#recover").click();
  await page
    .getByRole("heading", { name: "운동 캘린더", exact: true })
    .waitFor();
  await page.getByRole("heading", { name: "01오프라인 스쿼트" }).waitFor();
  await page.locator(".photo-wrap img").waitFor();
  assert.deepEqual(errors, []);
  await context.setOffline(false);
  const failureContext = await browser.browser().newContext();
  const failurePage = await failureContext.newPage();
  await failurePage.route("**/assets/index-*.js", (route) => route.abort());
  await failurePage.goto(
    `http://127.0.0.1:${server.address().port}/gym_calender/?lang=ko`,
  );
  await failurePage.locator("#startup-retry").waitFor({ state: "visible" });
  assert.match(
    await failurePage.locator("#startup-status").textContent(),
    /저장된 운동 기록은 유지됩니다/,
  );
  await failureContext.close();

  console.log(
    "PASS: startup recovery, obsolete HTML migration, previous asset fallback, PWA manifest, PNG icons, Chromium installability, GitHub Pages subpath, self-hosted posture images and viewed-image offline cache, offline HEIC decoding, persistent recording and encrypted sharing.",
  );
} finally {
  await browser?.close();
  await rm(profile, { recursive: true, force: true });
  await new Promise((r) => server.close(r));
}
