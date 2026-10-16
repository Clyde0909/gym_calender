import test from "node:test";
import assert from "node:assert/strict";
import { createInstaller } from "../src/pwa.js";
function fake(standalone = false) {
  const host = new EventTarget();
  host.navigator = { standalone };
  host.matchMedia = () => ({ matches: false, addEventListener() {} });
  return host;
}
test("install fallback and installed modes do not request a browser prompt", async () => {
  assert.equal(await createInstaller(fake()).install(), "instructions");
  assert.equal(await createInstaller(fake(true)).install(), "installed");
});
test("install prompts synchronously from the tap and consumes each event once", async () => {
  const host = fake(),
    installer = createInstaller(host);
  let called = false;
  const event = new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = () => {
    called = true;
    return Promise.resolve();
  };
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  host.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  const result = installer.install();
  assert.equal(called, true);
  assert.equal(await result, "accepted");
  assert.equal(await installer.install(), "instructions");
  host.dispatchEvent(new Event("appinstalled"));
  assert.equal(installer.isInstalled(), true);
  assert.equal(await installer.install(), "installed");
});
test("dismissed and failed prompts can receive a fresh browser event", async () => {
  const host = fake(),
    installer = createInstaller(host);
  for (const outcome of ["dismissed", "accepted"]) {
    const e = new Event("beforeinstallprompt");
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome });
    host.dispatchEvent(e);
    assert.equal(await installer.install(), outcome);
  }
  const e = new Event("beforeinstallprompt");
  e.prompt = () => Promise.reject(Error("unavailable"));
  host.dispatchEvent(e);
  await assert.rejects(installer.install());
  assert.equal(await installer.install(), "instructions");
});
