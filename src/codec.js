import { encode91, decode91 } from "./base91.js";
import { t as tr } from "./i18n.js";
import { compress, decompress } from "./lz.js";
const MAX = 24 * 1024 * 1024,
  enc = new TextEncoder(),
  dec = new TextDecoder("utf-8", { fatal: true });
// Keep photo and backup compression off the UI thread. Node tests use the
// same implementation directly; Vite bundles and precaches this local worker.
async function lz(action, value) {
  if (typeof Worker === "undefined")
    return action === "compress" ? compress(value) : decompress(value, MAX);
  const worker = new Worker(new URL("./lz-worker.js", import.meta.url), {
    type: "module",
  });
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) =>
        data.error ? reject(Error("Invalid LZ data")) : resolve(data.result);
      worker.onerror = () => reject(Error("LZ worker failed"));
      worker.postMessage({ action, value, limit: MAX });
    });
  } finally {
    worker.terminate();
  }
}
function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function unb64(s) {
  if (!/^[A-Za-z0-9_-]+$/.test(s) || s.length > MAX * 2)
    throw Error(tr("공유 문자열이 올바르지 않습니다."));
  const str = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}
async function transform(bytes, stream) {
  const writer = stream.writable.getWriter();
  const reading = (async () => {
    const reader = stream.readable.getReader();
    let size = 0,
      chunks = [];
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX) {
          await reader.cancel();
          throw Error(tr("데이터 크기 제한을 초과했습니다."));
        }
        chunks.push(value);
      }
      const out = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        out.set(c, offset);
        offset += c.length;
      }
      return out;
    } finally {
      reader.releaseLock();
    }
  })();
  const writing = (async () => {
    await writer.write(bytes);
    await writer.close();
  })();
  return (await Promise.all([reading, writing]))[0];
}
async function key(password, salt) {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encode(payload, password = "", options = {}) {
  const compact = options.encoding !== "compatible";
  const version = compact ? "GW3" : "GW4";
  const represent = compact ? encode91 : b64;
  const json = JSON.stringify(payload);
  const raw = enc.encode(json);
  if (raw.length > MAX)
    throw Error(tr("데이터가 너무 큽니다. 날짜별로 나누어 공유하세요."));
  const compressed = await lz("compress", json);
  if (!password) return finish("P", compressed);
  function finish(mode, bytes) {
    const body = represent(bytes);
    if (body.length > MAX * 2)
      throw Error(tr("데이터가 너무 큽니다. 날짜별로 나누어 공유하세요."));
    return version + "." + mode + "." + body;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode(version + ".E") },
      await key(password, salt),
      compressed,
    ),
  );
  const result = new Uint8Array(28 + encrypted.length);
  result.set(salt);
  result.set(iv, 16);
  result.set(encrypted, 28);
  return finish("E", result);
}
export async function decode(text, password = "") {
  const match = /^(GW[1234])\.(P|E)\.([\s\S]+)$/.exec(text.trim());
  if (!match) throw Error(tr("지원하지 않는 공유 문자열입니다."));
  const [, version, mode, body] = match;
  if (body.length > MAX * 2)
    throw Error(tr("데이터 크기 제한을 초과했습니다."));
  let bytes;
  try {
    bytes =
      version === "GW2" || version === "GW3" ? decode91(body) : unb64(body);
  } catch {
    throw Error(tr("공유 문자열이 올바르지 않습니다."));
  }
  if (mode === "E") {
    if (!password) throw Error(tr("해독 비밀번호를 입력하세요."));
    if (bytes.length < 44) throw Error(tr("암호화 데이터가 손상되었습니다."));
    try {
      bytes = new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: bytes.slice(16, 28),
            additionalData: enc.encode(version + ".E"),
          },
          await key(password, bytes.slice(0, 16)),
          bytes.slice(28),
        ),
      );
    } catch {
      throw Error(tr("비밀번호가 다르거나 데이터가 손상되었습니다."));
    }
  }
  try {
    const json =
      version === "GW3" || version === "GW4"
        ? await lz("decompress", bytes)
        : dec.decode(await transform(bytes, new DecompressionStream("gzip")));
    if (enc.encode(json).length > MAX)
      throw Error("Decoded data exceeds limit");
    return JSON.parse(json);
  } catch {
    throw Error(tr("공유 데이터가 손상되었거나 크기 제한을 초과했습니다."));
  }
}
