// Saves and loads app data in the browser's localStorage, as JSON.
const Store = (() => {
  const KEYS = {
    workouts: "workoutTracker.workouts",
    draft: "workoutTracker.draftWorkout",
    customExercises: "workoutTracker.customExercises",
    routines: "workoutTracker.routines",
    calories: "workoutTracker.calorieEntries",
    foodLog: "workoutTracker.foodLog",
    recentFoods: "workoutTracker.recentFoods",
    nutritionGoals: "workoutTracker.nutritionGoals",
    planAnswers: "workoutTracker.planAnswers",
    restTimer: "workoutTracker.restTimer",
    restSeconds: "workoutTracker.restSeconds",
    checkIns: "workoutTracker.checkIns",
    bodyweight: "workoutTracker.bodyweightLb",
  };

  // A missing key means a typo or an outdated copy of this file; fail loudly
  // instead of saving everything under the name "undefined".
  function checkKey(key) {
    if (!Object.values(KEYS).includes(key)) {
      throw new Error(`Unknown storage key: ${key}`);
    }
  }

  function read(key, fallback) {
    checkKey(key);
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  // Returns false when the browser refuses to save (private mode, storage full).
  function write(key, value) {
    checkKey(key);
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return { KEYS, read, write };
})();
