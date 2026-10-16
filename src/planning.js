import { t } from "./i18n.js";
export function weekStart(date) {
  const d = new Date(date + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(d.getTime()) ||
    d.toISOString().slice(0, 10) !== date
  )
    throw Error(t("weekInvalid"));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function weekDates(start) {
  const monday = weekStart(start);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
  });
}
export function cleanExercises(exercises) {
  return structuredClone(exercises).map((e) => ({
    ...e,
    sets: e.sets.map((s) => ({ ...s, done: false })),
  }));
}
export function daySchedule(state, date) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  const plan = state.weekPlans?.find((p) => p.weekStart === weekStart(date));
  if (plan)
    return {
      source: "week",
      id: plan.id,
      name: plan.name,
      weekday: day,
      exercises: plan.days[day] || [],
    };
  const routine = state.routines.find(
    (r) => r.id === state.settings?.schedule?.[day],
  );
  return routine
    ? {
        source: "routine",
        id: routine.id,
        name: routine.name,
        weekday: day,
        exercises: routine.exercises,
      }
    : null;
}
export function scheduledSession(state, date) {
  const plan = daySchedule(state, date);
  if (!plan?.exercises.length) return null;
  return {
    date,
    note: "",
    photo: null,
    exercises: cleanExercises(plan.exercises),
    plannedFrom: plan.id,
  };
}
export function makeWeekPlan(state, start, name, assignments) {
  const days = {};
  for (let i = 0; i < 7; i++) {
    const routine = state.routines.find((r) => r.id === assignments[i]);
    days[i] = routine ? cleanExercises(routine.exercises) : [];
  }
  return { id: crypto.randomUUID(), weekStart: weekStart(start), name, days };
}
export function mergeWeekPlans(current, incoming) {
  const map = new Map(current.map((plan) => [plan.weekStart, plan]));
  for (const plan of incoming) map.set(plan.weekStart, plan);
  return [...map.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );
}

export function copyWeekPlan(plan, target) {
  return {
    ...structuredClone(plan),
    id: crypto.randomUUID(),
    weekStart: weekStart(target),
    days: Object.fromEntries(
      Object.entries(plan.days).map(([day, exercises]) => [
        day,
        cleanExercises(exercises),
      ]),
    ),
  };
}
export function weekProgress(state, plan) {
  const days = weekDates(plan.weekStart).map(({ date, weekday }) => {
    const record = state.sessions.find((s) => s.date === date);
    const sets = (record?.exercises || plan.days[weekday]).flatMap(
      (e) => e.sets,
    );
    const done = record ? sets.filter((s) => s.done).length : 0;
    return {
      date,
      weekday,
      total: sets.length,
      done,
      planned: plan.days[weekday].length > 0,
      status:
        record?.endedAt || (sets.length > 0 && done === sets.length)
          ? "weekDone"
          : record?.startedAt || done > 0
            ? "weekInProgress"
            : plan.days[weekday].length
              ? "weekPending"
              : "휴식",
    };
  });
  return {
    days,
    total: days.filter((d) => d.planned).length,
    done: days.filter((d) => d.planned && d.status === "weekDone").length,
  };
}
