// basE91 (Henke alphabet): 91 printable ASCII symbols, no whitespace.
export const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';
const values = new Map([...alphabet].map((c, i) => [c, i]));
export function encode91(bytes) {
  let buffer = 0,
    bits = 0,
    chunk = "",
    out = [];
  const append = (a, b = "") => {
    chunk += a + b;
    if (chunk.length >= 8192) {
      out.push(chunk);
      chunk = "";
    }
  };
  for (const byte of bytes) {
    buffer |= byte << bits;
    bits += 8;
    if (bits > 13) {
      let value = buffer & 8191;
      if (value > 88) {
        buffer >>>= 13;
        bits -= 13;
      } else {
        value = buffer & 16383;
        buffer >>>= 14;
        bits -= 14;
      }
      append(alphabet[value % 91], alphabet[Math.floor(value / 91)]);
    }
  }
  if (bits) {
    append(alphabet[buffer % 91]);
    if (bits > 7 || buffer > 90) append(alphabet[Math.floor(buffer / 91)]);
  }
  out.push(chunk);
  return out.join("");
}
export function decode91(text) {
  let buffer = 0,
    bits = 0,
    value = -1,
    offset = 0;
  const out = new Uint8Array(Math.ceil((text.length * 7) / 8));
  for (const c of text) {
    const n = values.get(c);
    if (n === undefined) throw Error("Invalid base91 character");
    if (value < 0) value = n;
    else {
      value += n * 91;
      buffer |= value << bits;
      bits += (value & 8191) > 88 ? 13 : 14;
      do {
        out[offset++] = buffer & 255;
        buffer >>>= 8;
        bits -= 8;
      } while (bits > 7);
      value = -1;
    }
  }
  if (value >= 0) out[offset++] = (buffer | (value << bits)) & 255;
  const bytes = out.slice(0, offset);
  if (encode91(bytes) !== text) throw Error("Non-canonical base91 data");
  return bytes;
}
