// Pure calculations shared by the pages. Nothing here touches the page or
// storage, so these functions can be tested on their own.
const WorkoutLogic = (() => {
  // MET values (energy cost relative to sitting still) from the Compendium of
  // Physical Activities. Calorie numbers built on them are rough estimates.
  const MET_VALUES = {
    "Weight training": 5.0,
    Running: 9.8,
    Cycling: 7.5,
    Walking: 3.5,
    Rowing: 7.0,
    HIIT: 8.0,
    Swimming: 6.0,
  };

  const KG_PER_LB = 0.453592;

  // Local calendar date as "YYYY-MM-DD", so a workout at 11pm counts for that day.
  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function addDays(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return toDateKey(new Date(year, month - 1, day + days));
  }

  // Total load is weight x reps, added up over every checked-off set.
  // Each exercise looks like { name, sets: [{ weight, reps, done }] }.
  function workoutLoad(exercises) {
    return exercises.reduce(
      (total, exercise) =>
        total +
        exercise.sets.reduce((exerciseTotal, set) => {
          const valid = set.done && [set.weight, set.reps].every((n) => Number.isFinite(n) && n >= 0);
          return valid ? exerciseTotal + set.weight * set.reps : exerciseTotal;
        }, 0),
      0,
    );
  }

  // The Sunday that starts the week containing `dateKey`.
  function startOfWeek(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return addDays(dateKey, -new Date(year, month - 1, day).getDay());
  }

  // One value per week (Sunday to Saturday) for the last `weekCount` weeks,
  // oldest first. `valueOf(workout)` gives a workout's number, or null to skip
  // it; `combine` merges two numbers from the same week. Weeks with nothing
  // logged have a value of null.
  function weeklyValues(workouts, todayKey, weekCount, valueOf, combine) {
    const thisWeek = startOfWeek(todayKey);
    const weeks = Array.from({ length: weekCount }, (_, index) => ({
      week: addDays(thisWeek, (index - weekCount + 1) * 7),
      value: null,
    }));
    const weeksByStart = new Map(weeks.map((week) => [week.week, week]));
    for (const workout of workouts) {
      const value = valueOf(workout);
      const week = weeksByStart.get(startOfWeek(workout.date));
      if (value !== null && week) {
        week.value = week.value === null ? value : combine(week.value, value);
      }
    }
    return weeks;
  }

  // The heaviest weight lifted for an exercise in one workout, or null.
  function heaviestSet(workout, exerciseName) {
    const name = exerciseName.toLowerCase();
    const weights = workout.exercises
      .filter((exercise) => exercise.name.toLowerCase() === name && Array.isArray(exercise.sets))
      .flatMap((exercise) => exercise.sets.map((set) => set.weight));
    return weights.length > 0 ? Math.max(...weights) : null;
  }

  // Adds up a value per calendar day and returns the biggest day's total,
  // e.g. the most load lifted in a single day. Items need a "date" key.
  function bestDayTotal(items, valueOf) {
    const totals = new Map();
    for (const item of items) {
      totals.set(item.date, (totals.get(item.date) || 0) + valueOf(item));
    }
    return Math.max(0, ...totals.values());
  }

  // About how long one warm-up set takes, used to place it on the workout's clock.
  const WARMUP_SET_MS = 60 * 1000;

  // Minutes from the first set's start to the last set's end; a set still
  // running counts up to `now`. Warm-ups marked done (exercise.warmups maps a
  // step to the time it was done) stretch that window, so warming up before
  // the first set counts toward time and calories without adding load. Sets
  // checked off without times (logged before Start/End existed) count as 3
  // minutes each, rest included.
  function workoutMinutes(exercises, now) {
    const sets = exercises.flatMap((exercise) => exercise.sets);
    const timedSets = sets.filter((set) => set.startedAt);
    const warmupTimes = exercises.flatMap((exercise) => Object.values(exercise.warmups || {}));
    let minutes = 0;
    if (timedSets.length > 0 || warmupTimes.length > 0) {
      const start = Math.min(
        ...timedSets.map((set) => set.startedAt),
        ...warmupTimes.map((time) => time - WARMUP_SET_MS),
      );
      const end = Math.max(...timedSets.map((set) => set.endedAt || now), ...warmupTimes);
      minutes = (end - start) / 60000;
    }
    const untimedDoneSets = sets.filter((set) => set.done && !set.startedAt).length;
    return Math.round(minutes + untimedDoneSets * 3);
  }

  function estimateCalories(activity, bodyweightLb, minutes) {
    const met = MET_VALUES[activity];
    if (!met || !(bodyweightLb > 0) || !(minutes > 0)) {
      return 0;
    }
    return Math.round((met * bodyweightLb * KG_PER_LB * minutes) / 60);
  }

  // Consecutive days with a check-in, ending today. If today has no check-in
  // yet, the streak still counts up to yesterday, so it does not reset at midnight.
  function currentStreak(dateKeys, todayKey) {
    const days = new Set(dateKeys);
    let day = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
    let streak = 0;
    while (days.has(day)) {
      streak += 1;
      day = addDays(day, -1);
    }
    return streak;
  }

  function bestStreak(dateKeys) {
    const days = [...new Set(dateKeys)].sort();
    let best = 0;
    let run = 0;
    days.forEach((day, index) => {
      run = index > 0 && addDays(days[index - 1], 1) === day ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return best;
  }

  // Words in an exercise name that hint at its muscle group.
  const MUSCLE_GROUP_KEYWORDS = {
    Legs: [
      "leg", "leg curl", "leg extension", "leg press", "squat", "lunge", "calf", "calves",
      "hamstring", "quad", "glute", "hip thrust", "step up", "split squat", "bulgarian",
      "hack", "sled", "adductor", "abductor", "adduction", "abduction", "thigh",
      "good morning", "romanian", "romanian deadlift", "rdl", "stiff leg", "sumo",
      "wall sit", "box jump", "pistol", "nordic",
    ],
    Chest: ["bench", "chest", "pec", "fly", "flye", "push up", "pushup", "incline", "decline"],
    Back: [
      "row", "pull up", "pullup", "chin up", "chinup", "lat", "pulldown", "deadlift", "back",
      "back extension", "hyperextension", "shrug", "pullover", "supported row",
    ],
    Shoulders: [
      "shoulder", "overhead press", "military", "ohp", "lateral", "front raise", "rear delt",
      "delt", "arnold", "upright row", "face pull",
    ],
    Arms: [
      "curl", "tricep", "bicep", "skull", "pushdown", "kickback", "extension", "dip",
      "forearm", "wrist", "hammer", "preacher",
    ],
    Cardio: [
      "run", "running", "jog", "treadmill", "bike", "cycling", "elliptical", "stair", "stairmaster",
      "jump rope", "sprint", "swim", "swimming", "rowing", "erg", "air bike",
    ],
    Core: [
      "ab", "abs", "core", "plank", "crunch", "crunches", "sit up", "situp", "twist",
      "oblique", "hollow", "rollout", "v up", "dead bug", "mountain climber",
      "leg raise", "knee raise", "russian",
    ],
  };

  // Lowercases, turns punctuation into spaces, and drops a plural "s" so that
  // "Squats" and "squat" match the same keyword.
  function normalizeWords(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(" ")
      .map((word) => (word.length > 2 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word))
      .join(" ");
  }

  // Picks the group whose keyword matches the most specific (longest) phrase
  // in the name, so "Leg Raise" is Core even though "leg" alone means Legs.
  function guessMuscleGroup(exerciseName) {
    const name = ` ${normalizeWords(exerciseName)} `;
    let bestGroup = "Other";
    let bestLength = 0;
    for (const [group, keywords] of Object.entries(MUSCLE_GROUP_KEYWORDS)) {
      for (const keyword of keywords) {
        const phrase = normalizeWords(keyword);
        if (phrase.length > bestLength && name.includes(` ${phrase} `)) {
          bestGroup = group;
          bestLength = phrase.length;
        }
      }
    }
    return bestGroup;
  }

  function roundToTenth(number) {
    return Math.round(number * 10) / 10;
  }

  // Nutrition for `grams` of a food whose values are given per 100 g.
  function nutritionForGrams(per100g, grams) {
    const factor = grams / 100;
    return {
      calories: Math.round(per100g.calories * factor),
      protein: roundToTenth(per100g.protein * factor),
      carbs: roundToTenth(per100g.carbs * factor),
      fat: roundToTenth(per100g.fat * factor),
    };
  }

  function sumNutrition(items) {
    const total = items.reduce(
      (sum, item) => ({
        calories: sum.calories + item.calories,
        protein: sum.protein + item.protein,
        carbs: sum.carbs + item.carbs,
        fat: sum.fat + item.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      calories: Math.round(total.calories),
      protein: roundToTenth(total.protein),
      carbs: roundToTenth(total.carbs),
      fat: roundToTenth(total.fat),
    };
  }

  // Share of calories from each macro. Carbs and protein have 4 kcal per
  // gram and fat has 9, so 10 g of fat counts for more than 10 g of carbs.
  function macroPercents({ protein, carbs, fat }) {
    const caloriesFrom = { carbs: carbs * 4, fat: fat * 9, protein: protein * 4 };
    const total = caloriesFrom.carbs + caloriesFrom.fat + caloriesFrom.protein;
    if (total === 0) {
      return { carbs: 0, fat: 0, protein: 0 };
    }
    return {
      carbs: Math.round((caloriesFrom.carbs / total) * 100),
      fat: Math.round((caloriesFrom.fat / total) * 100),
      protein: Math.round((caloriesFrom.protein / total) * 100),
    };
  }

  // Activity multipliers for total daily energy use (BMR x multiplier).
  const ACTIVITY_LEVELS = {
    sedentary: { multiplier: 1.2, label: "Sedentary", description: "Little or no exercise" },
    light: { multiplier: 1.375, label: "Lightly active", description: "1–3 workouts a week" },
    moderate: { multiplier: 1.55, label: "Moderately active", description: "3–5 workouts a week" },
    very: { multiplier: 1.725, label: "Very active", description: "6–7 hard workouts a week" },
    extreme: { multiplier: 1.9, label: "Extremely active", description: "Training twice a day or a physical job" },
  };

  const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

  function macroCalories({ protein, carbs, fat }) {
    return protein * CALORIES_PER_GRAM.protein + carbs * CALORIES_PER_GRAM.carbs + fat * CALORIES_PER_GRAM.fat;
  }

  // Suggests daily calories and macros from a questionnaire.
  //  - Calories burned at rest (BMR) use the Mifflin-St Jeor formula.
  //  - Daily burn (TDEE) is BMR times the activity multiplier.
  //  - Losing weight: eat 500 less (about 1 lb a week). Gaining: 250 more
  //    (about 1/2 lb a week). Within 2 lb of the goal: maintain.
  //  - Never below a safe minimum (1,500 for men, 1,200 for women) or BMR.
  //  - Protein 0.8 g per lb of goal weight, fat 25% of calories, carbs the rest.
  function suggestNutritionPlan({ sex, age, heightInches, weightLb, goalWeightLb, activity }) {
    const weightKg = weightLb * KG_PER_LB;
    const heightCm = heightInches * 2.54;
    const sexAdjustment = sex === "male" ? 5 : -161;
    const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment);
    const tdee = Math.round(bmr * ACTIVITY_LEVELS[activity].multiplier);

    const weightChange = goalWeightLb - weightLb;
    let direction = "maintain";
    let adjustment = 0;
    if (weightChange < -2) {
      direction = "lose";
      adjustment = -500;
    } else if (weightChange > 2) {
      direction = "gain";
      adjustment = 250;
    }

    const minimum = Math.max(sex === "male" ? 1500 : 1200, bmr);
    const target = tdee + adjustment;
    const calories = Math.round(Math.max(target, minimum) / 10) * 10;
    const protein = Math.round(goalWeightLb * 0.8);
    const fat = Math.round((calories * 0.25) / CALORIES_PER_GRAM.fat);
    const carbs = Math.max(
      0,
      Math.round((calories - protein * CALORIES_PER_GRAM.protein - fat * CALORIES_PER_GRAM.fat) / CALORIES_PER_GRAM.carbs),
    );

    return {
      bmr,
      tdee,
      direction,
      adjustment,
      raisedToMinimum: target < minimum,
      calories,
      protein,
      carbs,
      fat,
    };
  }

  // Standard gym plates, heaviest first, in pounds and in kilograms.
  const PLATE_SIZES = [45, 35, 25, 10, 5, 2.5];
  const PLATE_SIZES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

  // The plates to load on EACH side of the bar to reach `target`, heaviest
  // first, using `plateSizes` (all in the same unit as the weights). When the
  // exact weight can't be made, it returns the closest weight below the target.
  function platesPerSide(target, barWeight, plateSizes = PLATE_SIZES) {
    let remaining = (target - barWeight) / 2;
    const plates = [];
    for (const plate of plateSizes) {
      // The tiny allowance keeps decimals like 2.5 from being missed by rounding.
      while (remaining >= plate - 1e-9) {
        plates.push(plate);
        remaining -= plate;
      }
    }
    const perSide = plates.reduce((sum, plate) => sum + plate, 0);
    return { plates, total: barWeight + perSide * 2 };
  }

  // A warm-up ladder for a working weight: the empty bar, then about 40%, 60%
  // and 80% of the working weight, each rounded to the nearest weight you can
  // load (`step` is the smallest jump: 5 lb, or 2.5 kg). Steps that would be
  // no heavier than the bar, or as heavy as the working weight, are skipped.
  const WARMUP_LADDER = [
    { key: "bar", share: 0, reps: 10 },
    { key: "40", share: 0.4, reps: 5 },
    { key: "60", share: 0.6, reps: 3 },
    { key: "80", share: 0.8, reps: 2 },
  ];

  function warmupSteps(workingWeight, barWeight, step) {
    if (!(workingWeight > barWeight)) {
      return [];
    }
    const steps = [];
    for (const { key, share, reps } of WARMUP_LADDER) {
      const weight = share === 0 ? barWeight : Math.round((workingWeight * share) / step) * step;
      const previous = steps[steps.length - 1];
      const heavierThanLast = !previous || weight > previous.weight;
      if ((share === 0 || weight > barWeight) && weight < workingWeight && heavierThanLast) {
        steps.push({ key, weight, reps });
      }
    }
    return steps;
  }

  function rpeLabel(rpe) {
    if (rpe <= 2) return "Very easy";
    if (rpe <= 4) return "Easy";
    if (rpe <= 6) return "Moderate";
    if (rpe <= 8) return "Hard";
    if (rpe === 9) return "Very hard";
    return "Max effort";
  }

  return {
    MET_VALUES,
    toDateKey,
    addDays,
    workoutLoad,
    startOfWeek,
    weeklyValues,
    heaviestSet,
    workoutMinutes,
    bestDayTotal,
    estimateCalories,
    currentStreak,
    bestStreak,
    guessMuscleGroup,
    PLATE_SIZES,
    PLATE_SIZES_KG,
    platesPerSide,
    warmupSteps,
    nutritionForGrams,
    sumNutrition,
    macroPercents,
    ACTIVITY_LEVELS,
    macroCalories,
    suggestNutritionPlan,
    rpeLabel,
  };
})();

if (typeof module !== "undefined") {
  module.exports = WorkoutLogic;
}
