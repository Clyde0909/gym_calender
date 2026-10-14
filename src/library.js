import { exerciseCatalog, exerciseGuideKey } from "./exercises.js";
import { t, messages } from "./i18n.js";
export const library = exerciseCatalog.map(({ name, body, equipment }) => ({
  name,
  body,
  equipment,
  guide: exerciseGuideKey(name),
}));
const consonants = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];
export function initials(text) {
  return [...text]
    .map((c) => {
      const n = c.charCodeAt(0) - 44032;
      return n >= 0 && n < 11172 ? consonants[Math.floor(n / 588)] : c;
    })
    .join("");
}
export function searchExercises(query, body = "", equipment = "") {
  const q = query.replaceAll(" ", "").toLowerCase();
  return library.filter(
    (e) =>
      (!body || e.body === body) &&
      (!equipment || e.equipment === equipment) &&
      ([e.name, messages[e.name]?.en, messages[e.name]?.ja]
        .filter(Boolean)
        .some((name) => name.replaceAll(" ", "").toLowerCase().includes(q)) ||
        initials(e.name).replaceAll(" ", "").includes(q)),
  );
}
export const estimate1RM = (weight, reps) =>
  reps === 1 ? weight : reps > 0 && reps <= 12 ? weight * (1 + reps / 30) : 0;
export const defaultSettings = () => ({
  unit: "kg",
  restSeconds: 90,
  autoRest: true,
  goal: "근비대",
  weeklyDays: 3,
  schedule: {},
});

export function exerciseLabel(name) {
  return library.some((e) => e.name === name) ? t(name) : name;
}
export function canonicalExercise(name) {
  const normalized = name.toLowerCase().replaceAll(" ", "");
  return (
    library.find((e) =>
      [e.name, messages[e.name]?.en, messages[e.name]?.ja]
        .filter(Boolean)
        .some(
          (alias) => alias.toLowerCase().replaceAll(" ", "") === normalized,
        ),
    )?.name || name
  );
}
