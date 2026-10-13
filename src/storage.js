import { t as tr } from "./i18n.js";
import { decodePhoto } from "./images.js";
import { validateState, newState } from "./data.js";
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export const db = new Promise((resolve, reject) => {
  const req = indexedDB.open("gym-calendar-store", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("state");
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
export async function load() {
  const conn = await db;
  return validateState(
    (await request(
      conn.transaction("state").objectStore("state").get("main"),
    )) || newState(),
  );
}
export async function save(state) {
  validateState(state);
  const conn = await db;
  await new Promise((resolve, reject) => {
    const tx = conn.transaction("state", "readwrite");
    tx.objectStore("state").put(state, "main");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function photoData(file) {
  if (file.size > 25 * 1024 * 1024)
    throw Error(tr("25MB 이하의 사진을 선택하세요."));
  const bitmap = await decodePhoto(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob;
  for (const q of [0.75, 0.6, 0.45, 0.3]) {
    blob = await new Promise((r) => canvas.toBlob(r, "image/webp", q));
    if (blob && blob.size <= 600 * 1024) break;
  }
  if (!blob || blob.size > 600 * 1024)
    throw Error(tr("사진이 너무 복잡합니다. 더 작은 사진을 선택하세요."));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
