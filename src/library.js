import { t, messages } from "./i18n.js";
export const library = [
  [
    "벤치 프레스",
    "가슴",
    "바벨",
    "견갑을 고정하고 발을 바닥에 붙인 뒤 바를 가슴 쪽으로 천천히 내립니다.",
  ],
  [
    "인클라인 덤벨 프레스",
    "가슴",
    "덤벨",
    "벤치를 30도 정도로 조절하고 팔꿈치를 과하게 벌리지 않습니다.",
  ],
  [
    "체스트 프레스",
    "가슴",
    "머신",
    "손잡이를 가슴 높이에 맞추고 등을 등받이에 고정합니다.",
  ],
  [
    "푸시업",
    "가슴",
    "맨몸",
    "몸을 일직선으로 유지하고 팔꿈치를 몸에서 45도 정도로 벌립니다.",
  ],
  [
    "랫 풀다운",
    "등",
    "머신",
    "가슴을 들어 올리고 팔꿈치를 몸통 쪽으로 당깁니다. 목 뒤로 내리지 않습니다.",
  ],
  [
    "시티드 로우",
    "등",
    "머신",
    "허리를 중립으로 유지하며 팔꿈치를 뒤로 당깁니다.",
  ],
  [
    "바벨 로우",
    "등",
    "바벨",
    "엉덩이를 뒤로 접고 허리를 중립으로 고정한 채 바를 복부 쪽으로 당깁니다.",
  ],
  [
    "풀업",
    "등",
    "맨몸",
    "반동을 줄이고 어깨를 내리며 턱이 바 높이에 오도록 당깁니다.",
  ],
  [
    "스쿼트",
    "하체",
    "바벨",
    "무릎을 발끝 방향으로 보내고 발바닥 전체로 바닥을 누릅니다.",
  ],
  [
    "데드리프트",
    "하체",
    "바벨",
    "바를 몸 가까이 두고 허리를 중립으로 유지하며 엉덩이와 무릎을 함께 폅니다.",
  ],
  [
    "레그 프레스",
    "하체",
    "머신",
    "허리가 뜨지 않는 범위로 내려가며 무릎을 완전히 잠그지 않습니다.",
  ],
  ["레그 컬", "하체", "머신", "골반을 패드에 붙이고 천천히 무릎을 굽힙니다."],
  [
    "런지",
    "하체",
    "덤벨",
    "앞발 전체에 체중을 싣고 상체를 세운 채 무릎을 굽힙니다.",
  ],
  [
    "고블릿 스쿼트",
    "하체",
    "케틀벨",
    "무게를 가슴 앞에 붙이고 무릎과 발끝 방향을 맞춥니다.",
  ],
  [
    "숄더 프레스",
    "어깨",
    "덤벨",
    "몸통을 고정하고 허리를 과하게 꺾지 않으며 머리 위로 밀어 올립니다.",
  ],
  [
    "사이드 레터럴 레이즈",
    "어깨",
    "덤벨",
    "가벼운 무게로 팔꿈치를 살짝 굽혀 어깨 높이까지만 올립니다.",
  ],
  [
    "덤벨 컬",
    "팔",
    "덤벨",
    "팔꿈치를 몸통에 고정하고 반동 없이 팔을 굽힙니다.",
  ],
  [
    "트라이셉스 푸시다운",
    "팔",
    "머신",
    "팔꿈치를 고정한 채 전완만 움직여 손잡이를 아래로 누릅니다.",
  ],
  [
    "플랭크",
    "코어",
    "맨몸",
    "복부와 엉덩이에 힘을 주고 머리부터 발까지 일직선을 유지합니다.",
  ],
  [
    "런닝",
    "유산소",
    "머신",
    "대화 가능한 속도로 시작하고 충분한 준비 운동과 정리 운동을 합니다.",
  ],
].map(([name, body, equipment, guide]) => ({ name, body, equipment, guide }));
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
