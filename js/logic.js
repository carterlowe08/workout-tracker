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
    const warmupTimes = exercises.flatMap((exercise) => [
      ...Object.values(exercise.warmups || {}),
      ...(exercise.swappedWarmupTimes || []),
    ]);
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

  // ----- Weekly streak: weeks (Sunday to Saturday) in a row that hit a goal -----

  const DEFAULT_WEEK_GOAL = 4;

  // A goal is a whole number of days a week, 1 to 7; anything else falls back to 4.
  function clampWeekGoal(goal) {
    const number = Math.round(Number(goal));
    if (!Number.isFinite(number)) return DEFAULT_WEEK_GOAL;
    return Math.min(7, Math.max(1, number));
  }

  // Check-in days counted per week, keyed by each week's Sunday. Days after
  // `todayKey` are ignored.
  function checkInsByWeek(dateKeys, todayKey) {
    const counts = new Map();
    new Set(dateKeys).forEach((day) => {
      if (day > todayKey) return;
      const week = startOfWeek(day);
      counts.set(week, (counts.get(week) || 0) + 1);
    });
    return counts;
  }

  // Whether a week keeps the streak going. This week counts as soon as it has
  // one check-in, even before it reaches the goal; a finished week below the
  // goal breaks the streak.
  function weekCounts(count, isThisWeek, goal) {
    return isThisWeek ? count >= 1 : count >= goal;
  }

  // Weeks in a row that kept the streak going, ending with this week. A week
  // with no check-ins yet doesn't break the streak, the same way the day
  // streak doesn't reset at midnight.
  function currentWeekStreak(dateKeys, todayKey, goal) {
    const counts = checkInsByWeek(dateKeys, todayKey);
    const thisWeek = startOfWeek(todayKey);
    let streak = weekCounts(counts.get(thisWeek) || 0, true, goal) ? 1 : 0;
    let week = addDays(thisWeek, -7);
    while (weekCounts(counts.get(week) || 0, false, goal)) {
      streak += 1;
      week = addDays(week, -7);
    }
    return streak;
  }

  function bestWeekStreak(dateKeys, todayKey, goal) {
    const counts = checkInsByWeek(dateKeys, todayKey);
    if (counts.size === 0) return 0;
    const thisWeek = startOfWeek(todayKey);
    let best = 0;
    let run = 0;
    for (let week = [...counts.keys()].sort()[0]; week <= thisWeek; week = addDays(week, 7)) {
      run = weekCounts(counts.get(week) || 0, week === thisWeek, goal) ? run + 1 : 0;
      best = Math.max(best, run);
    }
    return best;
  }

  // The last `weekCount` weeks, oldest first: { week (its Sunday), count,
  // metGoal, isThisWeek }.
  function recentWeeks(dateKeys, todayKey, weekCount, goal) {
    const counts = checkInsByWeek(dateKeys, todayKey);
    const thisWeek = startOfWeek(todayKey);
    return Array.from({ length: weekCount }, (_, index) => {
      const week = addDays(thisWeek, (index - weekCount + 1) * 7);
      const count = counts.get(week) || 0;
      return { week, count, metGoal: count >= goal, isThisWeek: week === thisWeek };
    });
  }

  // The seven date keys of the week containing `todayKey`, Sunday first.
  function weekDays(todayKey) {
    const sunday = startOfWeek(todayKey);
    return Array.from({ length: 7 }, (_, weekday) => addDays(sunday, weekday));
  }

  // One line on what's left to do this week.
  function weekGoalHint(thisWeekCount, goal, weekStreak) {
    if (thisWeekCount >= goal) return "Goal hit this week. Nice work.";
    const daysLeft = goal - thisWeekCount;
    if (thisWeekCount === 0) {
      return weekStreak > 0
        ? `Check in ${daysLeft} ${daysLeft === 1 ? "day" : "days"} this week to keep your streak.`
        : "Check in once to start a streak.";
    }
    return `${daysLeft} more ${daysLeft === 1 ? "day" : "days"} by Saturday to keep your streak.`;
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

  // Whether an exercise is done with dumbbells: listed with Dumbbell equipment,
  // or a custom exercise with "dumbbell" in its name.
  function usesDumbbells(exerciseName, equipment) {
    return equipment === "Dumbbell" || /\bdumbbells?\b/i.test(exerciseName);
  }

  // Estimated one-rep max with the Epley formula: weight x (1 + reps / 30).
  // A single rep is its own max. 185 lb x 8 reps -> about 234 lb.
  function estimatedOneRepMax(weight, reps) {
    if (!(weight > 0) || !(reps > 0)) {
      return 0;
    }
    return reps === 1 ? weight : weight * (1 + reps / 30);
  }

  // Every saved session of one exercise, newest first:
  // [{ date, workoutName, sets: [{ weight, reps }] }]. `workouts` is newest
  // first, as saved. Workouts saved before per-set logging are skipped.
  function exerciseSessions(workouts, exerciseName) {
    const name = exerciseName.toLowerCase();
    const sessions = [];
    for (const workout of workouts) {
      const sets = workout.exercises
        .filter((exercise) => exercise.name.toLowerCase() === name && Array.isArray(exercise.sets))
        .flatMap((exercise) => exercise.sets);
      if (sets.length > 0) {
        sessions.push({ date: workout.date, workoutName: workout.name, sets });
      }
    }
    return sessions;
  }

  // The heaviest set (more reps breaks a tie) and the best estimated one-rep max.
  function bestSets(sessions) {
    let heaviest = null;
    let bestEstimate = 0;
    for (const set of sessions.flatMap((session) => session.sets)) {
      const heavier = !heaviest || set.weight > heaviest.weight;
      const sameWeightMoreReps = heaviest && set.weight === heaviest.weight && set.reps > heaviest.reps;
      if (heavier || sameWeightMoreReps) {
        heaviest = set;
      }
      bestEstimate = Math.max(bestEstimate, estimatedOneRepMax(set.weight, set.reps));
    }
    return { heaviest, bestEstimate };
  }

  // ----- Personal records -----
  const RECORD_TREND_SESSIONS = 8;

  // One record per lift ever saved, newest record first:
  // { name, kind, best, set, date, trend }. A lift with any weighted set is
  // "weight": best is the top estimated one-rep max (lb) and set the set that
  // gave it. A lift only ever done at 0 lb is "reps": best is the most reps.
  // date is the first workout that reached best; trend is each session's
  // best, oldest first, for the last few sessions.
  function personalRecords(workouts) {
    const lifts = new Map();
    // Oldest workout first, so a record keeps the date it was first set.
    for (const workout of [...workouts].reverse()) {
      for (const exercise of workout.exercises) {
        if (!Array.isArray(exercise.sets)) {
          continue;
        }
        const sets = exercise.sets.filter((set) => set.reps > 0 && set.weight >= 0);
        if (sets.length === 0) {
          continue;
        }
        const key = exercise.name.trim().toLowerCase();
        if (!lifts.has(key)) {
          lifts.set(key, { name: exercise.name, sessions: [] });
        }
        const lift = lifts.get(key);
        lift.name = exercise.name;
        lift.sessions.push({ date: workout.date, sets });
      }
    }
    const records = [...lifts.values()].map(({ name, sessions }) => {
      const kind = sessions.some((session) => session.sets.some((set) => set.weight > 0)) ? "weight" : "reps";
      const valueOf = (set) => (kind === "weight" ? estimatedOneRepMax(set.weight, set.reps) : set.reps);
      let best = 0;
      let bestSet = null;
      let date = null;
      const trend = [];
      for (const session of sessions) {
        let sessionBest = 0;
        for (const set of session.sets) {
          const value = valueOf(set);
          sessionBest = Math.max(sessionBest, value);
          if (value > best) {
            best = value;
            bestSet = { weight: set.weight, reps: set.reps };
            date = session.date;
          }
        }
        trend.push(sessionBest);
      }
      return { name, kind, best, set: bestSet, date, trend: trend.slice(-RECORD_TREND_SESSIONS) };
    });
    return records.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }

  // The lifts whose record a newly saved workout beat, as records from
  // personalRecords(after). Lifts done for the first time don't count.
  function recordsBroken(workoutsBefore, workoutsAfter) {
    const before = new Map(personalRecords(workoutsBefore).map((record) => [record.name.toLowerCase(), record]));
    return personalRecords(workoutsAfter).filter((record) => {
      const old = before.get(record.name.toLowerCase());
      return old && old.kind === record.kind && record.best > old.best;
    });
  }

  // Ounces of water logged on one day. Entries look like { date, ounces }.
  function waterForDay(entries, dateKey) {
    return entries.reduce((total, entry) => (entry.date === dateKey ? total + entry.ounces : total), 0);
  }

  // Saves a weigh-in to a log of { date, pounds } kept oldest first. Weighing
  // in again on the same day replaces that day's weight.
  function recordWeight(log, dateKey, pounds) {
    return [...log.filter((entry) => entry.date !== dateKey), { date: dateKey, pounds }].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  // Average of the weigh-ins in the 7 days ending on dateKey, or null if there are none.
  function weightAverage(log, dateKey) {
    const weekStart = addDays(dateKey, -6);
    const week = log.filter((entry) => entry.date >= weekStart && entry.date <= dateKey);
    return week.length === 0 ? null : week.reduce((total, entry) => total + entry.pounds, 0) / week.length;
  }

  // Change from the earliest weigh-in in the week before the latest one, as
  // { pounds, since }, or null when there is no earlier weigh-in that week.
  function weeklyWeightChange(log) {
    const latest = log[log.length - 1];
    if (!latest) {
      return null;
    }
    const weekStart = addDays(latest.date, -7);
    const earlier = log.find((entry) => entry.date >= weekStart && entry.date < latest.date);
    return earlier ? { pounds: latest.pounds - earlier.pounds, since: earlier.date } : null;
  }

  function rpeLabel(rpe) {
    if (rpe <= 2) return "Very easy";
    if (rpe <= 4) return "Easy";
    if (rpe <= 6) return "Moderate";
    if (rpe <= 8) return "Hard";
    if (rpe === 9) return "Very hard";
    return "Max effort";
  }

  // One line under each RPE on the end-of-workout scale.
  const RPE_HINTS = {
    1: "Barely broke a sweat",
    2: "Light, like a walk",
    3: "Lots left in the tank",
    4: "Warmed up, not pushed",
    5: "Working, but comfortable",
    6: "4 or more reps left on sets",
    7: "About 3 reps left on sets",
    8: "About 2 reps left on sets",
    9: "1 rep left on sets",
    10: "Nothing left, sets to failure",
  };

  function rpeHint(rpe) {
    return RPE_HINTS[rpe] || "";
  }

  // ----- RPE per set -----
  // A set can carry rpe: 6–10, picked as how many more reps were left.
  const SET_RPES = [6, 7, 8, 9, 10];

  // The set's RPE if it is one of the choices, otherwise null.
  function setRpe(value) {
    return SET_RPES.includes(value) ? value : null;
  }

  // "2 left" under 8 on the picker: reps that could still have been done.
  function repsLeftLabel(rpe) {
    const repsLeft = 10 - rpe;
    return repsLeft >= 4 ? "4+ left" : `${repsLeft} left`;
  }

  // "@8" after a set in the Last column, or "" with no RPE.
  function setRpeTag(set) {
    const rpe = set ? setRpe(set.rpe) : null;
    return rpe ? `@${rpe}` : "";
  }

  // ----- Exercise notes -----
  // Notes are kept per exercise, whatever the capitalization of its name, as
  // { "bench press": "Seat on 4" }, and stay until they are replaced.
  const MAX_NOTE_LENGTH = 200;

  function exerciseKey(exerciseName) {
    return exerciseName.trim().toLowerCase();
  }

  function exerciseNote(notes, exerciseName) {
    const key = exerciseKey(exerciseName);
    // Own properties only, so an exercise named "constructor" has no note.
    const hasNote = Object.prototype.hasOwnProperty.call(notes, key) && typeof notes[key] === "string";
    return hasNote ? notes[key] : "";
  }

  // A copy of notes with this exercise's note replaced; blank text removes it.
  function withExerciseNote(notes, exerciseName, text) {
    const key = exerciseKey(exerciseName);
    const trimmed = text.trim().slice(0, MAX_NOTE_LENGTH);
    const updated = { ...notes };
    delete updated[key];
    return trimmed ? { ...updated, [key]: trimmed } : updated;
  }

  // The names to ask about at the end of a workout: exercises with a finished
  // set, in workout order, each once.
  function exercisesToNote(exercises) {
    const finished = exercises.filter((exercise) => exercise.sets.some((set) => set.done));
    return [...new Set(finished.map((exercise) => exercise.name))];
  }

  // ----- Rest time per exercise -----
  const MIN_REST_SECONDS = 15;
  const MAX_REST_SECONDS = 600;

  function clampRestSeconds(seconds) {
    return Math.min(Math.max(seconds, MIN_REST_SECONDS), MAX_REST_SECONDS);
  }

  // This exercise's saved rest time, or the fallback if it has none (or an unusable one).
  function restSecondsFor(rests, exerciseName, fallback) {
    const key = exerciseKey(exerciseName);
    const saved = Object.prototype.hasOwnProperty.call(rests, key) ? rests[key] : null;
    return Number.isFinite(saved) ? clampRestSeconds(saved) : fallback;
  }

  function withRestSeconds(rests, exerciseName, seconds) {
    const key = exerciseKey(exerciseName);
    const updated = { ...rests };
    delete updated[key];
    return { ...updated, [key]: clampRestSeconds(seconds) };
  }

  // 90 -> "1:30"
  function formatClock(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
  }

  // ----- Supersets -----
  // Exercises in a superset share a supersetId and sit next to each other.
  // Round 1 is everyone's first set, round 2 everyone's second, and so on.

  // A superset of one isn't a superset, so a lone member loses its id.
  function withoutLoneSupersets(exercises) {
    return exercises.map((exercise) => {
      const isAlone =
        exercise.supersetId && exercises.filter((other) => other.supersetId === exercise.supersetId).length < 2;
      if (!isAlone) {
        return exercise;
      }
      const { supersetId: _removed, ...unlinked } = exercise;
      return unlinked;
    });
  }

  // A new list where the source is in a superset with exactly the chosen
  // exercises, which move right after it. Choosing none removes its superset.
  function linkExercises(exercises, sourceIndex, chosenIndices) {
    const previousId = exercises[sourceIndex].supersetId;
    const chosenSet = new Set(chosenIndices.filter((index) => index !== sourceIndex));
    const unlinked = exercises.map((exercise, index) => {
      const leaves = index === sourceIndex || chosenSet.has(index) || (previousId && exercise.supersetId === previousId);
      if (!leaves) {
        return exercise;
      }
      const { supersetId: _removed, ...rest } = exercise;
      return rest;
    });
    if (chosenSet.size === 0) {
      return withoutLoneSupersets(unlinked);
    }
    const newId = Math.max(0, ...exercises.map((exercise) => exercise.supersetId || 0)) + 1;
    const source = { ...unlinked[sourceIndex], supersetId: newId };
    const chosen = [...chosenSet].sort((a, b) => a - b).map((index) => ({ ...unlinked[index], supersetId: newId }));
    const reordered = unlinked.flatMap((exercise, index) => {
      if (index === sourceIndex) {
        return [source, ...chosen];
      }
      return chosenSet.has(index) ? [] : [exercise];
    });
    return withoutLoneSupersets(reordered);
  }

  function supersetMembers(exercises, supersetId) {
    return exercises.filter((exercise) => exercise.supersetId === supersetId);
  }

  function supersetRoundCount(members) {
    return Math.max(...members.map((member) => member.sets.length));
  }

  // The exercise still to do in this set's round, or null if the round is finished.
  function nextInRound(exercises, exercise, setIndex) {
    if (!exercise.supersetId) {
      return null;
    }
    const members = supersetMembers(exercises, exercise.supersetId);
    return members.find((member) => member.sets[setIndex] && !member.sets[setIndex].done) || null;
  }

  // The set to do next in a round that's partly finished, or null.
  function nextUpSet(members) {
    for (let round = 0; round < supersetRoundCount(members); round += 1) {
      const sets = members.flatMap((member) => (member.sets[round] ? [member.sets[round]] : []));
      if (sets.some((set) => set.done) && !sets.every((set) => set.done)) {
        return sets.find((set) => !set.done);
      }
    }
    return null;
  }

  // The last exercise with a set in this round: the one whose rest follows it.
  function lastInRound(members, round) {
    return members.findLast((member) => member.sets[round]);
  }

  // ----- Swapping an exercise -----
  // A swapped exercise keeps its finished sets in place, each marked with
  // doneAs: the exercise it was really done as. That keeps totals, workout time
  // and superset rounds lined up; saving splits them back out.
  const MAX_SWAP_SUGGESTIONS = 6;
  const MAX_SWAP_RESULTS = 30;

  // The sets still belonging to this exercise, not ones done before a swap.
  function ownSets(exercise) {
    return exercise.sets.filter((set) => !set.doneAs);
  }

  // Exercises to offer for a swap. With no search: suggestions, same muscle
  // first. With a search: every word must match, in any order.
  function swapChoices(allExercises, takenNames, group, typed) {
    const taken = new Set(takenNames.map(exerciseKey));
    const words = typed.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = allExercises.filter((exercise) => {
      const text = `${exercise.name} ${exercise.muscle || ""}`.toLowerCase();
      return !taken.has(exerciseKey(exercise.name)) && words.every((word) => text.includes(word));
    });
    const sameMuscleFirst = [
      ...matches.filter((exercise) => exercise.group === group),
      ...matches.filter((exercise) => exercise.group !== group),
    ];
    return sameMuscleFirst.slice(0, words.length > 0 ? MAX_SWAP_RESULTS : MAX_SWAP_SUGGESTIONS);
  }

  // A copy of the exercise as `choice`: finished sets (and a running one) stay
  // as done by the old exercise, and the sets left move to the new one, keeping
  // their reps and using the weights from its last session (or 0).
  function swapExercise(exercise, choice, previousSets, now) {
    const doneAs = { name: exercise.name, group: exercise.group };
    const previous = previousSets || [];
    const fallback = previous[previous.length - 1] || { weight: 0 };
    let leftCount = 0;
    const sets = exercise.sets.map((set) => {
      if (set.doneAs) {
        return set;
      }
      if (set.done) {
        return { ...set, doneAs };
      }
      if (set.startedAt) {
        return { ...set, endedAt: now, done: true, doneAs };
      }
      const weight = (previous[leftCount] || fallback).weight;
      leftCount += 1;
      return { weight, reps: set.reps, done: false };
    });
    if (leftCount === 0) {
      // The running set was the last one; the new exercise still needs a set.
      const lastReps = sets[sets.length - 1].reps;
      sets.push({ weight: (previous[0] || fallback).weight, reps: lastReps, done: false });
    }
    const { warmups = {}, swappedWarmupTimes = [], hintClosed: _closed, ...rest } = exercise;
    return {
      ...rest,
      name: choice.name,
      group: choice.group,
      sets,
      swappedWarmupTimes: [...swappedWarmupTimes, ...Object.values(warmups)],
    };
  }

  // The exercises this one was swapped out of: [{ name, group, sets }], oldest first.
  function swappedOut(exercise) {
    const parts = [];
    for (const set of exercise.sets) {
      if (set.doneAs) {
        const { doneAs, ...plainSet } = set;
        const part = parts.find((item) => item.name === doneAs.name);
        if (part) {
          part.sets.push(plainSet);
        } else {
          parts.push({ name: doneAs.name, group: doneAs.group, sets: [plainSet] });
        }
      }
    }
    return parts;
  }

  // The workout as it's saved: finished sets only, each under the exercise it
  // was really done as. Exercises with none finished are left out.
  function finishedExercises(exercises) {
    return exercises.flatMap((exercise) => {
      const { swappedWarmupTimes: _times, hintClosed: _closed, ...current } = exercise;
      const own = { ...current, sets: ownSets(exercise).filter((set) => set.done) };
      return [...swappedOut(exercise), own].filter((part) => part.sets.length > 0);
    });
  }

  // ----- Progression hints -----
  // The sets of the exercise's most recent saved sessions, newest first.
  // Workouts are newest first; ones saved before per-set logging are skipped.
  function exerciseSessionSets(workouts, exerciseName) {
    const key = exerciseKey(exerciseName);
    return workouts.flatMap((workout) => {
      const match = workout.exercises.find(
        (exercise) => exerciseKey(exercise.name) === key && Array.isArray(exercise.sets),
      );
      return match && match.sets.length > 0 ? [match.sets] : [];
    });
  }

  // True if every set of the earlier session was matched or beaten, in reps and weight.
  function matchedSession(latestSets, earlierSets) {
    return earlierSets.every(
      (earlier, index) =>
        latestSets[index] && latestSets[index].reps >= earlier.reps && latestSets[index].weight >= earlier.weight,
    );
  }

  // The last session's sets if it's time to go up, otherwise null: needs two
  // sessions to compare. Cardio "reps" aren't something to add to.
  function progressionHint(workouts, exerciseName, group) {
    if (group === "Cardio") {
      return null;
    }
    const [latest, earlier] = exerciseSessionSets(workouts, exerciseName);
    return latest && earlier && matchedSession(latest, earlier) ? latest : null;
  }

  // Sets built from the last session with the hint applied. Only sets not
  // started change; extra sets use the last session's final numbers.
  function applyProgression(sets, lastSets, choice, stepPounds, limits = {}) {
    const { maxReps = 500, maxWeight = 2000 } = limits;
    let position = 0;
    return sets.map((set) => {
      if (set.doneAs || set.done || set.startedAt) {
        return set;
      }
      const base = lastSets[position] || lastSets[lastSets.length - 1];
      position += 1;
      return {
        ...set,
        weight: choice === "weight" ? Math.min(base.weight + stepPounds, maxWeight) : base.weight,
        reps: choice === "reps" ? Math.min(base.reps + 1, maxReps) : base.reps,
      };
    });
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
    DEFAULT_WEEK_GOAL,
    clampWeekGoal,
    checkInsByWeek,
    currentWeekStreak,
    bestWeekStreak,
    recentWeeks,
    weekDays,
    weekGoalHint,
    guessMuscleGroup,
    PLATE_SIZES,
    PLATE_SIZES_KG,
    platesPerSide,
    warmupSteps,
    usesDumbbells,
    estimatedOneRepMax,
    exerciseSessions,
    bestSets,
    personalRecords,
    recordsBroken,
    nutritionForGrams,
    sumNutrition,
    macroPercents,
    ACTIVITY_LEVELS,
    macroCalories,
    suggestNutritionPlan,
    rpeLabel,
    rpeHint,
    SET_RPES,
    setRpe,
    repsLeftLabel,
    setRpeTag,
    waterForDay,
    recordWeight,
    weightAverage,
    weeklyWeightChange,
    MAX_NOTE_LENGTH,
    exerciseNote,
    withExerciseNote,
    exercisesToNote,
    MAX_REST_SECONDS,
    clampRestSeconds,
    restSecondsFor,
    withRestSeconds,
    formatClock,
    withoutLoneSupersets,
    linkExercises,
    supersetMembers,
    supersetRoundCount,
    nextInRound,
    nextUpSet,
    lastInRound,
    ownSets,
    swapChoices,
    swapExercise,
    swappedOut,
    finishedExercises,
    progressionHint,
    applyProgression,
  };
})();

if (typeof module !== "undefined") {
  module.exports = WorkoutLogic;
}
