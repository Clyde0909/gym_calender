import { encode } from "./codec.js";
export function sessionPayload(session) {
  return {
    format: "gymlog",
    version: 1,
    kind: "session",
    createdAt: new Date().toISOString(),
    data: { version: 1, sessions: [structuredClone(session)], routines: [] },
  };
}
export function createShareFile(text, date) {
  return new File([text], `gym-log-${date}.txt`, { type: "text/plain" });
}
// Compression must finish BEFORE the share gesture, particularly on iOS.
export function shareData(text, date, title, api = navigator) {
  if (typeof api.share !== "function") return null;
  const file = createShareFile(text, date);
  if (api.canShare?.({ files: [file] }))
    return api.share({ files: [file], title });
  if (text.length <= 30000 && (!api.canShare || api.canShare({ text, title })))
    return api.share({ text, title });
  return null;
}
export function createSessionShareCache() {
  let key = null,
    prepared = null,
    pending = null;
  return {
    prepare(session) {
      if (!session) {
        key = null;
        prepared = null;
        pending = null;
        return Promise.resolve(null);
      }
      const nextKey = JSON.stringify(session);
      if (nextKey === key) return pending;
      key = nextKey;
      prepared = null;
      const snapshot = structuredClone(session);
      pending = encode(sessionPayload(snapshot)).then((text) => {
        const result = { text, date: snapshot.date };
        if (key === nextKey) prepared = result;
        return result;
      });
      return pending;
    },
    ready(session) {
      return JSON.stringify(session) === key ? prepared : null;
    },
  };
}
