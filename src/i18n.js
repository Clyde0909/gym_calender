import uiMessages from "./translations.json" with { type: "json" };
import { exerciseCatalog, exerciseGuideKey } from "./exercises.js";
export const languages = ["en", "ko", "ja"];
const messages = { ...uiMessages };
const guideSections = [
  ["setup", "guideSetup"],
  ["execution", "guideExecution"],
  ["breathing", "guideBreathing"],
  ["precautions", "guidePrecautions"],
];
for (const exercise of exerciseCatalog) {
  messages[exercise.name] = { ...exercise.labels, ko: exercise.name };
  messages[exerciseGuideKey(exercise.name)] = Object.fromEntries(
    languages.map((lang) => [
      lang,
      guideSections
        .map(
          ([section, label]) =>
            `${uiMessages[label][lang]}: ${exercise.guide[lang][section]}`,
        )
        .join("\n\n"),
    ]),
  );
}
export function resolveLanguage(value) {
  const base = String(value || "")
    .toLowerCase()
    .split(/[-_]/)[0];
  return languages.includes(base) ? base : "en";
}
export function initialLanguage({ requested, saved, browser } = {}) {
  return requested
    ? resolveLanguage(requested)
    : languages.includes(saved)
      ? saved
      : resolveLanguage(browser);
}
const storageKey = "gym-log-language";
let saved;
try {
  saved = globalThis.localStorage?.getItem(storageKey);
} catch {}
let current = initialLanguage({
  requested:
    typeof location !== "undefined"
      ? new URLSearchParams(location.search).get("lang")
      : null,
  saved,
  browser: globalThis.navigator?.language,
});
export const language = () => current;
export const locale = () =>
  ({ en: "en-US", ko: "ko-KR", ja: "ja-JP" })[current];
export function setLanguage(value) {
  current = resolveLanguage(value);
  try {
    globalThis.localStorage?.setItem(storageKey, current);
  } catch {}
  if (typeof document !== "undefined") {
    document.documentElement.lang = current;
    const url = new URL(location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", current);
      history.replaceState(null, "", url);
    }
  }
  return current;
}
export function t(key, params = {}) {
  const text =
    current === "ko"
      ? (messages[key]?.ko ?? key)
      : (messages[key]?.[current] ?? key);
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
export function weekdays() {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale(), { weekday: "short" }).format(
      new Date(2026, 9, 11 + i),
    ),
  );
}
export function monthLabel(date) {
  return new Intl.DateTimeFormat(locale(), {
    year: "numeric",
    month: "long",
  }).format(date);
}
export function dateLabel(key) {
  return new Intl.DateTimeFormat(locale(), {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(key + "T12:00:00"));
}
export { messages };

if (typeof document !== "undefined") document.documentElement.lang = current;
