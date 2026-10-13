// Find the next unfinished set in workout order; completed records stay intact.
export function nextPending(session) {
  if (!session) return null;
  for (let i = 0; i < session.exercises.length; i++) {
    const j = session.exercises[i].sets.findIndex((set) => !set.done);
    if (j >= 0) return { i, j };
  }
  return null;
}
export function remainingRest(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function focusProgress(session) {
  const sets = session.exercises.flatMap((e) => e.sets);
  return { total: sets.length, done: sets.filter((set) => set.done).length };
}
