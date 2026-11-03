// Pure calculations for lift and cardio goals: where you should be on the
// straight path from your starting number to your target, what to aim for
// this week, and, when you're behind, what in the past week might explain it.
// Nothing here touches the page or storage, so it can be tested on its own.
//
// A goal looks like:
// { id, name: "Bench Press", kind: "lift" | "cardio", measure: "weight" | "reps" | "distance" | "time",
//   distanceUnit: "mi" | "km", start: 135, target: 185, startDate: "2026-11-03", endDate: "2027-01-26",
//   updates: [{ date, value }] }
// Weights are in pounds, like everywhere else in the app.
const GoalLogic = (() => {
  const { addDays } = WorkoutLogic;

  const MEASURES = {
    weight: { kind: "lift", label: "Weight", step: 2.5, max: 2000 },
    reps: { kind: "lift", label: "Reps", step: 1, max: 1000 },
    distance: { kind: "cardio", label: "Distance", step: 0.1, max: 500 },
    time: { kind: "cardio", label: "Time", step: 1 / 60, max: 1440 },
  };

  // Cardio a goal can be for. `activity` is the matching choice in the
  // Calories page's cardio log; `exercises` are matching exercise-list names.
  const CARDIO_OPTIONS = [
    { name: "Running", activity: "Running", exercises: ["Running, Treadmill", "Jogging, Treadmill", "Trail Running/Walking"] },
    { name: "Walking", activity: "Walking", exercises: ["Walking, Treadmill"] },
    { name: "Cycling", activity: "Cycling", exercises: ["Bicycling", "Bicycling, Stationary", "Recumbent Bike"] },
    { name: "Rowing", activity: "Rowing", exercises: ["Rowing, Stationary"] },
    { name: "Swimming", activity: "Swimming", exercises: [] },
    { name: "Elliptical", activity: null, exercises: ["Elliptical Trainer"] },
    { name: "Stair climber", activity: null, exercises: ["Stairmaster", "Step Mill"] },
  ];

  const MAX_DAYS = 2 * 365;
  // Within this share of the whole change from start to target counts as on track.
  const ON_TRACK_SHARE = 0.05;
  const HARD_RPE = 8.5;
  const EASY_RPE = 4;
  const CALORIE_SHORTFALL = 300;

  function daysBetween(fromKey, toKey) {
    const utc = (key) => {
      const [year, month, day] = key.split("-").map(Number);
      return Date.UTC(year, month - 1, day);
    };
    return Math.round((utc(toKey) - utc(fromKey)) / 86400000);
  }

  function isDateKey(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
  }

  // A typed number, or NaN for blank or non-numeric text ("" would otherwise be 0).
  // People type units and commas too: "135 lbs", "1,000" and "2,5" all work,
  // and a time like "9:30" is read as 9.5 minutes.
  function parseNumber(text) {
    let trimmed = String(text ?? "")
      .trim()
      .replace(/\s*[a-z]+\.?$/i, "");
    if (/^\d+(:[0-5]\d){1,2}$/.test(trimmed)) {
      const parts = trimmed.split(":").map(Number);
      return parts.length === 3 ? parts[0] * 60 + parts[1] + parts[2] / 60 : parts[0] + parts[1] / 60;
    }
    trimmed = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed.replace(",", ".");
    return trimmed === "" ? NaN : Number(trimmed);
  }

  const KG_PER_LB = 0.45359237;
  const KG_STEP = 1.25;

  // Rounds to what you can actually do: 2.5 lb plates (1.25 kg when lifting
  // in kilograms), whole reps, whole seconds (times are in minutes), tenths
  // of a mile. Weights stay in pounds either way.
  function roundForMeasure(value, measure, weightUnit = "lb") {
    if (measure === "weight" && weightUnit === "kg") {
      return (Math.round((value * KG_PER_LB) / KG_STEP) * KG_STEP) / KG_PER_LB;
    }
    const step = MEASURES[measure]?.step ?? 1;
    return Math.round(Math.round(value / step) * step * 10000) / 10000;
  }

  // Minutes as "9:05", or "1:02:30" for an hour or more.
  function formatMinutes(minutes) {
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = String(totalSeconds % 60).padStart(2, "0");
    return hours ? `${hours}:${String(mins).padStart(2, "0")}:${secs}` : `${mins}:${secs}`;
  }

  // What's wrong with a typed number, or "" when it's fine. `label` names it: "your goal".
  function numberProblem(measure, value, label = "a number") {
    const info = MEASURES[measure];
    const name = `${label[0].toUpperCase()}${label.slice(1)}`;
    if (!Number.isFinite(value)) return `Enter ${label} as a number.`;
    if (value < 0) return `${name} can't be negative.`;
    if (info && value > info.max) return `${name} looks too big. Check the number.`;
    if (measure === "reps" && !Number.isInteger(value)) return "Reps are whole numbers.";
    return "";
  }

  // Problems with a new or edited goal, as [{ field, message }]; empty when it can be saved.
  // `start` and `target` are numbers in the stored unit (pounds for weight).
  function validateGoal({ name, measure, start, target, endDate }, todayKey) {
    const errors = [];
    const info = MEASURES[measure];
    if (!String(name ?? "").trim()) {
      errors.push({ field: "name", message: "Pick an exercise or cardio machine." });
    }
    if (!info) {
      errors.push({ field: "measure", message: "Pick what you're tracking." });
    }
    for (const [field, value, label] of [["start", start, "where you are now"], ["target", target, "your goal"]]) {
      const message = numberProblem(measure, value, label);
      if (message) errors.push({ field, message });
    }
    if (Number.isFinite(start) && Number.isFinite(target) && start === target) {
      errors.push({ field: "target", message: "Your goal should be different from where you are now." });
    } else if (Number.isFinite(target) && target === 0) {
      errors.push({ field: "target", message: "Your goal should be more than 0." });
    }
    if (!isDateKey(endDate)) {
      errors.push({ field: "endDate", message: "Pick when you want to reach it." });
    } else if (endDate <= todayKey) {
      errors.push({ field: "endDate", message: "Pick a date after today." });
    } else if (daysBetween(todayKey, endDate) > MAX_DAYS) {
      errors.push({ field: "endDate", message: "Pick a date within 2 years." });
    }
    return errors;
  }

  // True when a saved goal has everything the card needs, so one damaged entry
  // (say, from an edited backup) can't break the whole Goals card.
  function isUsableGoal(goal) {
    return (
      Boolean(goal) &&
      typeof goal.name === "string" &&
      goal.name.trim() !== "" &&
      Boolean(MEASURES[goal.measure]) &&
      Number.isFinite(goal.start) &&
      Number.isFinite(goal.target) &&
      goal.start !== goal.target &&
      isDateKey(goal.startDate) &&
      isDateKey(goal.endDate) &&
      goal.endDate > goal.startDate &&
      (goal.updates === undefined ||
        (Array.isArray(goal.updates) &&
          goal.updates.every((update) => update && isDateKey(update.date) && Number.isFinite(update.value))))
    );
  }

  function endDateForWeeks(todayKey, weeks) {
    return addDays(todayKey, Math.round(weeks) * 7);
  }

  // Where the straight path from start to target says you should be on `dateKey`.
  function expectedValue(goal, dateKey) {
    const total = Math.max(daysBetween(goal.startDate, goal.endDate), 1);
    const elapsed = Math.min(Math.max(daysBetween(goal.startDate, dateKey), 0), total);
    return goal.start + ((goal.target - goal.start) * elapsed) / total;
  }

  // Logging again on the same day replaces that day's number; oldest first.
  function recordUpdate(updates, dateKey, value) {
    return [...updates.filter((update) => update.date !== dateKey), { date: dateKey, value }].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
  }

  function latest(goal) {
    const updates = goal.updates || [];
    return updates.length ? updates[updates.length - 1] : { date: goal.startDate, value: goal.start };
  }

  // One checkpoint per week of the goal: [{ week, date, value }], ending on the goal date.
  function weeklyPlan(goal, weightUnit = "lb") {
    const total = Math.max(daysBetween(goal.startDate, goal.endDate), 1);
    const weeks = Math.ceil(total / 7);
    return Array.from({ length: weeks }, (_, index) => {
      const date = index === weeks - 1 ? goal.endDate : addDays(goal.startDate, (index + 1) * 7);
      return { week: index + 1, date, value: roundForMeasure(expectedValue(goal, date), goal.measure, weightUnit) };
    });
  }

  // Everything the goal card shows. `state` is "reached", "missed" (date passed),
  // "behind", "ahead" or "on-track". `weightUnit` decides how weights round.
  function goalStatus(goal, todayKey, weightUnit = "lb") {
    const direction = Math.sign(goal.target - goal.start);
    const change = Math.abs(goal.target - goal.start);
    const now = latest(goal);
    const expectedNow = expectedValue(goal, todayKey);
    const gap = (now.value - expectedNow) * direction;
    const totalDays = Math.max(daysBetween(goal.startDate, goal.endDate), 1);
    const daysLeft = daysBetween(todayKey, goal.endDate);
    const totalWeeks = Math.ceil(totalDays / 7);
    const weekNumber = Math.min(Math.max(Math.floor(daysBetween(goal.startDate, todayKey) / 7) + 1, 1), totalWeeks);
    const plan = weeklyPlan(goal, weightUnit);

    let state = "on-track";
    if ((now.value - goal.target) * direction >= 0) {
      state = "reached";
    } else if (daysLeft < 0) {
      state = "missed";
    } else if (gap < -change * ON_TRACK_SHARE) {
      state = "behind";
    } else if (gap > change * ON_TRACK_SHARE) {
      state = "ahead";
    }

    return {
      state,
      latest: now,
      expectedNow: roundForMeasure(expectedNow, goal.measure, weightUnit),
      aimThisWeek: plan[weekNumber - 1].value,
      weekNumber,
      totalWeeks,
      daysLeft,
      perWeek: ((goal.target - goal.start) * 7) / totalDays,
      // Share of the way from start to target, 0 to 1 (going backwards shows as 0).
      progress: Math.min(Math.max(((now.value - goal.start) * direction) / change, 0), 1),
    };
  }

  // "once", "2 times".
  function times(count) {
    return count === 1 ? "once" : `${count} times`;
  }

  // Names in workouts that count as doing this goal's exercise or cardio.
  function matchingNames(goal) {
    const option = goal.kind === "cardio" ? CARDIO_OPTIONS.find((item) => item.name === goal.name) : null;
    return new Set([goal.name, ...(option ? option.exercises : [])].map((name) => name.toLowerCase()));
  }

  // Days from `fromKey` to `toKey` (inclusive) with a session of this goal's exercise or cardio.
  function sessionDays(goal, data, fromKey, toKey) {
    const names = matchingNames(goal);
    const activity = CARDIO_OPTIONS.find((item) => item.name === goal.name && goal.kind === "cardio")?.activity;
    const inRange = (date) => date >= fromKey && date <= toKey;
    const days = new Set();
    for (const workout of data.workouts || []) {
      const did = (workout.exercises || []).some(
        (exercise) =>
          names.has(String(exercise.name).toLowerCase()) && (exercise.sets || []).some((set) => set.done !== false),
      );
      if (did && inRange(workout.date)) {
        days.add(workout.date);
      }
    }
    if (activity) {
      for (const entry of data.cardioEntries || []) {
        if (entry.activity === activity && !entry.workoutId && inRange(entry.date)) {
          days.add(entry.date);
        }
      }
    }
    return days.size;
  }

  function heaviestWeight(goal, workouts, fromKey, toKey) {
    const name = goal.name.toLowerCase();
    let heaviest = 0;
    for (const workout of workouts || []) {
      if (workout.date < fromKey || workout.date > toKey) continue;
      for (const exercise of workout.exercises || []) {
        if (String(exercise.name).toLowerCase() !== name) continue;
        for (const set of exercise.sets || []) {
          if (set.done !== false && Number.isFinite(set.weight)) {
            heaviest = Math.max(heaviest, set.weight);
          }
        }
      }
    }
    return heaviest;
  }

  // Up to three plain-language reasons a goal might be behind, from the past 7
  // days (compared with the 7 before). `data` holds the app's saved lists:
  // { workouts, checkIns, cardioEntries, foodLog, nutritionGoals, weekGoal }.
  // `format(value)` shows a number in the goal's unit, like "185 lb".
  function offTrackReasons(goal, data, todayKey, format = String) {
    const weekStart = addDays(todayKey, -6);
    const previousStart = addDays(todayKey, -13);
    const previousEnd = addDays(todayKey, -7);
    const reasons = [];
    const doing = goal.kind === "cardio" ? `logged ${goal.name.toLowerCase()}` : `did ${goal.name}`;

    const recentSessions = sessionDays(goal, data, weekStart, todayKey);
    const earlierSessions = sessionDays(goal, data, previousStart, previousEnd);
    if (recentSessions === 0) {
      reasons.push(
        goal.kind === "cardio"
          ? `You didn't log any ${goal.name.toLowerCase()} in the past 7 days.`
          : `You didn't do ${goal.name} in the past 7 days.`,
      );
    } else if (recentSessions < earlierSessions) {
      reasons.push(
        `You ${doing} ${times(recentSessions)} in the past 7 days, down from ${times(earlierSessions)} the week before.`,
      );
    }

    const daysSinceUpdate = daysBetween(latest(goal).date, todayKey);
    if (daysSinceUpdate >= 7) {
      reasons.push(
        `You haven't updated this goal in ${daysSinceUpdate} days, so you may be further along than it shows.`,
      );
    }

    if (goal.measure === "weight") {
      const recentHeaviest = heaviestWeight(goal, data.workouts, weekStart, todayKey);
      const earlierHeaviest = heaviestWeight(goal, data.workouts, previousStart, previousEnd);
      if (recentHeaviest > 0 && recentHeaviest < earlierHeaviest) {
        reasons.push(
          `Your heaviest ${goal.name} set dropped from ${format(earlierHeaviest)} to ${format(recentHeaviest)} this week.`,
        );
      }
    }

    const checkIns = data.checkIns || {};
    const recentCheckIns = Object.keys(checkIns).filter((date) => date >= weekStart && date <= todayKey);
    const weekGoal = data.weekGoal || WorkoutLogic.DEFAULT_WEEK_GOAL;
    if (recentCheckIns.length < weekGoal) {
      reasons.push(
        `You went to the gym ${recentCheckIns.length} of the past 7 days. Your goal is ${weekGoal} days a week.`,
      );
    }

    const ratings = recentCheckIns.map((date) => checkIns[date]?.rpe).filter((rpe) => Number.isFinite(rpe));
    if (ratings.length >= 2) {
      const average = Math.round((ratings.reduce((sum, rpe) => sum + rpe, 0) / ratings.length) * 10) / 10;
      if (average >= HARD_RPE) {
        reasons.push(
          `Your workouts felt very hard (average RPE ${average}). Tired muscles recover slower, so a lighter day or more sleep may help.`,
        );
      } else if (average <= EASY_RPE) {
        reasons.push(`Your workouts felt easy (average RPE ${average}). Pushing a little harder may help you progress.`);
      }
    }

    const calorieGoal = data.nutritionGoals?.calories;
    if (Number.isFinite(calorieGoal)) {
      const byDay = new Map();
      for (const entry of data.foodLog || []) {
        if (entry.date >= weekStart && entry.date <= todayKey && Number.isFinite(entry.calories)) {
          byDay.set(entry.date, (byDay.get(entry.date) || 0) + entry.calories);
        }
      }
      if (byDay.size >= 3) {
        const average = [...byDay.values()].reduce((sum, calories) => sum + calories, 0) / byDay.size;
        const shortfall = Math.round((calorieGoal - average) / 10) * 10;
        if (shortfall >= CALORIE_SHORTFALL) {
          reasons.push(
            `On days you logged food, you ate about ${shortfall} kcal under your plan. Too little food makes progress harder.`,
          );
        }
      }
    }

    if (reasons.length === 0) {
      reasons.push(
        "Nothing in your past week stands out. Your goal may be too big a jump for the time you gave it. Try a later date.",
      );
    }
    return reasons.slice(0, 3);
  }

  return {
    MEASURES,
    CARDIO_OPTIONS,
    daysBetween,
    parseNumber,
    roundForMeasure,
    formatMinutes,
    numberProblem,
    validateGoal,
    isUsableGoal,
    endDateForWeeks,
    expectedValue,
    recordUpdate,
    latest,
    weeklyPlan,
    goalStatus,
    offTrackReasons,
  };
})();
