import { weekStart, cleanExercises } from "./planning.js";
const ex = (name, sets = 3, reps = 10) => ({
  name,
  sets: Array.from({ length: sets }, () => ({ weight: 0, reps, done: false })),
});
const fullA = [
  ex("스쿼트", 3, 8),
  ex("벤치 프레스", 3, 8),
  ex("시티드 로우"),
  ex("덤벨 컬", 2, 12),
];
const fullB = [
  ex("루마니안 데드리프트", 3, 8),
  ex("숄더 프레스"),
  ex("랫 풀다운"),
  ex("레그 레이즈", 2, 12),
];
const upper = [
  ex("벤치 프레스", 3, 8),
  ex("바벨 로우", 3, 8),
  ex("숄더 프레스"),
  ex("랫 풀다운"),
  ex("덤벨 컬", 2, 12),
];
const lower = [
  ex("스쿼트", 3, 8),
  ex("루마니안 데드리프트", 3, 8),
  ex("레그 컬"),
  ex("레그 익스텐션"),
  ex("스탠딩 카프 레이즈", 3, 15),
];
const push = [
  ex("벤치 프레스", 3, 8),
  ex("인클라인 덤벨 프레스"),
  ex("숄더 프레스"),
  ex("사이드 레터럴 레이즈", 3, 12),
  ex("트라이셉스 푸시다운", 3, 12),
];
const pull = [
  ex("랫 풀다운"),
  ex("시티드 로우"),
  ex("원암 덤벨 로우"),
  ex("페이스 풀", 3, 12),
  ex("해머 컬", 3, 12),
];
const body = [
  ex("푸시업", 3, 8),
  ex("인버티드 로우", 3, 8),
  ex("글루트 브리지", 3, 12),
  ex("런지", 3, 10),
  ex("크런치", 2, 12),
];
export const programSources = [
  {
    name: "r/Fitness Basic Beginner · public program reference",
    url: "https://github.com/astashov/liftosaur/blob/master/programs/builtin/basicBeginner.md",
  },
  {
    name: "Free Exercise DB · public-domain exercise reference",
    url: "https://github.com/yuhonas/free-exercise-db",
  },
  {
    name: "r/Fitness · recommended routines",
    url: "https://thefitness.wiki/routines/strength-training-muscle-building/",
  },
  {
    name: "CDC · physical activity guidelines",
    url: "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html",
  },
];
// Original starter templates; not an official reproduction or endorsement of source programs.
export const programs = [
  {
    id: "full-2",
    title: "programFull2",
    description: "programFullDescription",
    level: "beginner",
    goal: "건강 유지",
    frequency: 2,
    days: { 1: fullA, 4: fullB },
  },
  {
    id: "full-3",
    title: "programFull3",
    description: "programFullDescription",
    level: "beginner",
    goal: "근비대",
    frequency: 3,
    days: { 1: fullA, 3: fullB, 5: fullA },
  },
  {
    id: "upper-lower",
    title: "programUpperLower",
    description: "programUpperDescription",
    level: "intermediate",
    goal: "근비대",
    frequency: 4,
    days: { 1: upper, 2: lower, 4: upper, 5: lower },
  },
  {
    id: "ppl-3",
    title: "programPPL3",
    description: "programPPLDescription",
    level: "intermediate",
    goal: "근비대",
    frequency: 3,
    days: { 1: push, 3: pull, 5: lower },
  },
  {
    id: "ppl-6",
    title: "programPPL6",
    description: "programAdvancedDescription",
    level: "advanced",
    goal: "근비대",
    frequency: 6,
    days: { 1: push, 2: pull, 3: lower, 4: push, 5: pull, 6: lower },
  },
  {
    id: "body-3",
    title: "programBody",
    description: "programBodyDescription",
    level: "beginner",
    goal: "건강 유지",
    frequency: 3,
    days: { 1: body, 3: body, 5: body },
  },
  {
    id: "basic-reference",
    title: "programBasicReference",
    description: "programFullDescription",
    level: "beginner",
    goal: "근력 향상",
    frequency: 3,
    source:
      "https://thefitness.wiki/routines/r-fitness-basic-beginner-routine/",
    caveat: "programBasicNote",
    days: {
      1: [ex("바벨 로우", 3, 5), ex("벤치 프레스", 3, 5), ex("스쿼트", 3, 5)],
      3: [
        ex("랫 풀다운", 3, 5),
        ex("밀리터리 프레스", 3, 5),
        ex("데드리프트", 3, 5),
      ],
      5: [ex("바벨 로우", 3, 5), ex("벤치 프레스", 3, 5), ex("스쿼트", 3, 5)],
    },
  },
];
export function programWeek(program, start, name) {
  const days = {};
  for (let i = 0; i < 7; i++) days[i] = cleanExercises(program.days[i] || []);
  return { id: crypto.randomUUID(), weekStart: weekStart(start), name, days };
}
export function filterPrograms(
  query = "",
  frequency = "",
  level = "",
  goal = "",
) {
  return programs.filter(
    (p) =>
      (!frequency || p.frequency === Number(frequency)) &&
      (!level || p.level === level) &&
      (!goal || p.goal === goal),
  );
}
