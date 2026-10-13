import { library } from "./library.js";
import { weekStart } from "./planning.js";
import { t as tr } from "./i18n.js";
export const exercises = library.map((e) => e.name);
export const newState = () => ({ version: 1, sessions: [], routines: [] });
export function validateState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.sessions) ||
    !Array.isArray(state.routines) ||
    state.sessions.length > 10000 ||
    state.routines.length > 1000
  )
    throw Error(tr("지원하지 않는 데이터 형식입니다."));
  if (state.settings) {
    const t = state.settings;
    if (
      !["kg", "lbs"].includes(t.unit) ||
      !["근비대", "근력 향상", "체지방 감량", "건강 유지"].includes(t.goal) ||
      !Number.isInteger(t.weeklyDays) ||
      t.weeklyDays < 1 ||
      t.weeklyDays > 7 ||
      !Number.isInteger(t.restSeconds) ||
      t.restSeconds < 10 ||
      t.restSeconds > 600 ||
      typeof t.autoRest !== "boolean" ||
      !t.schedule ||
      typeof t.schedule !== "object" ||
      Array.isArray(t.schedule) ||
      Object.entries(t.schedule).some(
        ([k, v]) =>
          !/[0-6]/.test(k) ||
          k.length !== 1 ||
          typeof v !== "string" ||
          v.length > 100,
      )
    )
      throw Error(tr("설정 값이 올바르지 않습니다."));
  }
  if (state.weekPlans !== undefined) {
    if (!Array.isArray(state.weekPlans) || state.weekPlans.length > 1040)
      throw Error(tr("weekInvalid"));
    const weeks = new Set(),
      planIds = new Set();
    for (const plan of state.weekPlans) {
      if (
        !plan ||
        typeof plan.id !== "string" ||
        !plan.id ||
        plan.id.length > 100 ||
        planIds.has(plan.id) ||
        typeof plan.name !== "string" ||
        !plan.name.trim() ||
        plan.name.length > 100 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(plan.weekStart) ||
        weekStart(plan.weekStart) !== plan.weekStart ||
        weeks.has(plan.weekStart) ||
        !plan.days ||
        typeof plan.days !== "object" ||
        Array.isArray(plan.days) ||
        Object.keys(plan.days).some((k) => !/^[0-6]$/.test(k))
      )
        throw Error(tr("weekInvalid"));
      weeks.add(plan.weekStart);
      planIds.add(plan.id);
      for (let i = 0; i < 7; i++) {
        if (!Array.isArray(plan.days[i])) throw Error(tr("weekInvalid"));
        validateExercises(plan.days[i]);
      }
    }
  }
  const dates = new Set();
  for (const s of state.sessions) {
    if (
      !s ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.date) ||
      !Number.isFinite(new Date(s.date + "T12:00:00Z").getTime()) ||
      new Date(s.date + "T12:00:00Z").toISOString().slice(0, 10) !== s.date ||
      dates.has(s.date)
    )
      throw Error(tr("운동 날짜가 잘못되었거나 중복되었습니다."));
    dates.add(s.date);
    if (
      typeof s.note !== "string" ||
      s.note.length > 10000 ||
      !Array.isArray(s.exercises) ||
      s.exercises.length > 100
    )
      throw Error(tr("운동 기록이 올바르지 않습니다."));
    for (const key of ["startedAt", "endedAt"])
      if (
        s[key] != null &&
        (!Number.isSafeInteger(s[key]) ||
          s[key] < 0 ||
          s[key] > 8640000000000000)
      )
        throw Error(tr("운동 시간이 올바르지 않습니다."));
    if (s.endedAt != null && (s.startedAt == null || s.endedAt < s.startedAt))
      throw Error(tr("운동 종료 시간이 올바르지 않습니다."));
    validateExercises(s.exercises);
    if (
      s.photo &&
      (typeof s.photo !== "string" ||
        s.photo.length > 2000000 ||
        !/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s.photo))
    )
      throw Error(tr("사진 형식이 올바르지 않습니다."));
  }
  const ids = new Set();
  for (const r of state.routines) {
    if (
      !r ||
      typeof r.name !== "string" ||
      !r.name.trim() ||
      r.name.length > 100 ||
      typeof r.id !== "string" ||
      !Array.isArray(r.exercises)
    )
      throw Error(tr("루틴 형식이 올바르지 않습니다."));
    if (!r.id || r.id.length > 100 || ids.has(r.id))
      throw Error(tr("루틴 ID가 올바르지 않습니다."));
    ids.add(r.id);
    validateExercises(r.exercises);
  }
  return state;
}
function validateExercises(items) {
  if (items.length > 100) throw Error(tr("운동이 너무 많습니다."));
  for (const e of items) {
    if (
      !e ||
      typeof e.name !== "string" ||
      !e.name.trim() ||
      e.name.length > 100 ||
      !Array.isArray(e.sets) ||
      e.sets.length > 100
    )
      throw Error(tr("운동 형식이 올바르지 않습니다."));
    for (const s of e.sets)
      if (
        !s ||
        !Number.isFinite(s.weight) ||
        !Number.isFinite(s.reps) ||
        s.weight < 0 ||
        s.weight > 10000 ||
        s.reps < 0 ||
        s.reps > 100000 ||
        typeof s.done !== "boolean"
      )
        throw Error(tr("세트 형식이 올바르지 않습니다."));
  }
}
export function volume(session) {
  return session.exercises.reduce(
    (sum, e) =>
      sum +
      e.sets.filter((s) => s.done).reduce((n, s) => n + s.weight * s.reps, 0),
    0,
  );
}
export function completed(session) {
  return session.exercises.reduce(
    (n, e) => n + e.sets.filter((s) => s.done).length,
    0,
  );
}
export function mergeSessions(current, incoming) {
  const byDate = new Map(current.map((s) => [s.date, s]));
  for (const s of incoming) byDate.set(s.date, s);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
