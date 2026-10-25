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
    barWeights: "workoutTracker.barWeights",
    weightUnit: "workoutTracker.weightUnit",
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
      const value = raw === null ? null : JSON.parse(raw);
      // A stored null (for example from an older backup) means "nothing saved".
      return value === null ? fallback : value;
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

  function remove(key) {
    checkKey(key);
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }

  return { KEYS, read, write, remove };
})();
