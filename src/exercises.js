import existingExercises from "./exercises-existing.json" with { type: "json" };
import newExercises from "./exercises-new.json" with { type: "json" };

export const exerciseCatalog = [...existingExercises, ...newExercises];
export const exerciseGuideKey = (name) => `exerciseGuide:${name}`;
