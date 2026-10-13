import { compress, decompress } from "./lz.js";
self.onmessage = ({ data }) => {
  try {
    const result =
      data.action === "compress"
        ? compress(data.value)
        : decompress(data.value, data.limit);
    self.postMessage(
      { result },
      result instanceof Uint8Array ? [result.buffer] : [],
    );
  } catch {
    self.postMessage({ error: true });
  }
};
