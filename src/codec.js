import { encode91, decode91 } from "./base91.js";
import { t as tr } from "./i18n.js";
import { gzip } from "fflate";
const MAX = 24 * 1024 * 1024,
  enc = new TextEncoder(),
  dec = new TextDecoder("utf-8", { fatal: true });
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
  const version = compact ? "GW2" : "GW1";
  const represent = compact ? encode91 : b64;
  const raw = enc.encode(JSON.stringify(payload));
  if (raw.length > MAX)
    throw Error(tr("데이터가 너무 큽니다. 날짜별로 나누어 공유하세요."));
  const compressed = await new Promise((resolve, reject) =>
    gzip(raw, { level: 9 }, (error, data) =>
      error ? reject(error) : resolve(data),
    ),
  );
  if (!password) return version + ".P." + represent(compressed);
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
  return version + ".E." + represent(result);
}
export async function decode(text, password = "") {
  const match = /^(GW[12])\.(P|E)\.([\s\S]+)$/.exec(text.trim());
  if (!match) throw Error(tr("지원하지 않는 공유 문자열입니다."));
  const [, version, mode, body] = match;
  if (body.length > MAX * 2)
    throw Error(tr("데이터 크기 제한을 초과했습니다."));
  let bytes;
  try {
    bytes = version === "GW2" ? decode91(body) : unb64(body);
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
    return JSON.parse(
      dec.decode(await transform(bytes, new DecompressionStream("gzip"))),
    );
  } catch {
    throw Error(tr("공유 데이터가 손상되었거나 크기 제한을 초과했습니다."));
  }
}
