// "Find my program": turns four quiz answers into one of the premade programs
// (js/premadeRoutines.js), a runner-up, a reason, and the program's days
// adjusted to the person's goal and time. No screens here, so every rule can
// be tested on its own.
//
// The rules, in order:
// 1. Days a week and goal pick the program (pickByDays below).
// 2. People new to lifting never get Arnold Split, 5/3/1 or Bro Split, and
//    are steered to 4 days at most. Arnold Split needs a year or more.
// 3. 45-minute workouts don't get Arnold Split (6 exercises a day, 6 days).
// 4. Reps follow the goal: strength trims high reps, fat loss raises them.
//    Sets of 5 or fewer stay as written, since those are the heavy main lifts.
// 5. Time trims or adds work: 45 min keeps the first 4 exercises of each day;
//    90 min adds a set to each day's first 2 exercises.
const ProgramQuiz = (() => {
  const GOALS = {
    strength: "get stronger",
    muscle: "build muscle",
    fatLoss: "lose fat",
    general: "stay fit",
  };
  const DAY_CHOICES = [2, 3, 4, 5, 6];
  const EXPERIENCE = {
    new: "new to lifting",
    some: "lifting under a year",
    experienced: "lifting a year or more",
  };
  const MINUTES = [45, 60, 90];

  const SHORT_WORKOUT_EXERCISES = 4;
  const MAX_SETS = 5;
  const STRENGTH_REP_DROP = 2;
  const STRENGTH_MIN_REPS = 5;
  const FAT_LOSS_REP_RAISE = 3;
  const FAT_LOSS_MAX_REPS = 15;
  // Sets this heavy are the main lifts and keep their reps for every goal.
  const HEAVY_REPS = 5;
  // New lifters recover best on 4 days or fewer.
  const NEW_LIFTER_MAX_DAYS = 4;
  const ADVANCED_ONLY = ["Arnold Split", "5/3/1", "Bro Split"];

  function program(name) {
    const found = PREMADE_PROGRAMS.find((item) => item.name === name);
    if (!found) {
      throw new Error(`No premade program named ${name}`);
    }
    return found;
  }

  // [pick, runner-up] for an experienced lifter, by days a week and goal.
  function pickByDays(days, goal) {
    if (days === 2) {
      return goal === "strength" ? ["5×5 Strength", "Full Body"] : ["Full Body", "5×5 Strength"];
    }
    if (days === 3) {
      if (goal === "strength") return ["5×5 Strength", "Full Body"];
      if (goal === "muscle") return ["Push / Pull / Legs", "Full Body"];
      return ["Full Body", "Push / Pull / Legs"];
    }
    if (days === 4) {
      return goal === "strength" ? ["5/3/1", "Upper / Lower"] : ["Upper / Lower", "Full Body"];
    }
    if (days === 5) {
      if (goal === "strength") return ["5/3/1", "Upper / Lower"];
      if (goal === "muscle") return ["Bro Split", "Push / Pull / Legs"];
      return ["Push / Pull / Legs", "Upper / Lower"];
    }
    if (goal === "muscle") return ["Arnold Split", "Push / Pull / Legs"];
    if (goal === "strength") return ["5/3/1", "Push / Pull / Legs"];
    return ["Push / Pull / Legs", "Arnold Split"];
  }

  // The first program in `order` that suits this lifter, skipping `except`.
  function firstSuitable(order, answers, except) {
    return order.find((name) => name !== except && suits(name, answers));
  }

  function suits(name, { experience, minutes }) {
    if (experience === "new" && ADVANCED_ONLY.includes(name)) return false;
    if (name === "Arnold Split" && experience !== "experienced") return false;
    if (minutes === 45 && name === "Arnold Split") return false;
    return true;
  }

  // What to try if the first choices don't suit: simplest programs first.
  const FALLBACK_ORDER = ["Upper / Lower", "Push / Pull / Legs", "Full Body", "5×5 Strength"];

  function adjustReps(reps, goal) {
    if (reps <= HEAVY_REPS) return reps;
    if (goal === "strength") return Math.max(STRENGTH_MIN_REPS, reps - STRENGTH_REP_DROP);
    if (goal === "fatLoss") return Math.min(FAT_LOSS_MAX_REPS, reps + FAT_LOSS_REP_RAISE);
    return reps;
  }

  function tailorDay(day, { goal, minutes }) {
    const kept = minutes === 45 ? day.exercises.slice(0, SHORT_WORKOUT_EXERCISES) : day.exercises;
    return {
      name: day.name,
      exercises: kept.map((exercise, index) => ({
        name: exercise.name,
        sets: minutes === 90 && index < 2 ? Math.min(MAX_SETS, exercise.sets + 1) : exercise.sets,
        reps: adjustReps(exercise.reps, goal),
      })),
    };
  }

  function isValid(answers) {
    return (
      Boolean(answers) &&
      // hasOwn, not `in`: "toString" is in every object but isn't a goal.
      Object.hasOwn(GOALS, answers.goal) &&
      DAY_CHOICES.includes(answers.days) &&
      Object.hasOwn(EXPERIENCE, answers.experience) &&
      MINUTES.includes(answers.minutes)
    );
  }

  function reasonFor(name, answers, daysUsed) {
    const goal = GOALS[answers.goal];
    const why = {
      "5×5 Strength": "a few heavy barbell lifts you add weight to every session, the simplest way to get stronger",
      "Push / Pull / Legs": "each day trains muscles that work together, so they get a full day off before the next one",
      "Upper / Lower": "each muscle is trained twice a week, which suits building muscle and burning calories",
      "Full Body": "every muscle is trained each time, so nothing gets skipped when you only have a few days",
      "Arnold Split": "lots of sets per muscle across six days, for lifters who recover well",
      "5/3/1": "one heavy main lift a day that gets a little heavier each month",
      "Bro Split": "one muscle group a day gets a long session and a full week to recover",
    }[name];
    const plural = daysUsed === 1 ? "day" : "days";
    return `You want to ${goal} with ${daysUsed} ${plural} a week: ${why}.`;
  }

  // Notes about how the plan was changed to fit the answers.
  function notesFor(name, answers) {
    const notes = [];
    if (answers.experience === "new" && answers.days > NEW_LIFTER_MAX_DAYS) {
      notes.push(`New lifters recover best on ${NEW_LIFTER_MAX_DAYS} days a week or fewer, so this plan uses ${NEW_LIFTER_MAX_DAYS}. Use the other days for walks or cardio.`);
    }
    if (name === "Push / Pull / Legs" && answers.days >= 5) {
      notes.push(answers.days === 6 ? "Run the three days twice a week." : "Rotate through the three days, so each one comes up about every 3 days.");
    }
    if (name === "5×5 Strength" && answers.days === 3) {
      notes.push("Alternate Workout A and B: A, B, A one week, then B, A, B the next.");
    }
    if (name === "5/3/1" && answers.days > 4) {
      notes.push(`5/3/1 is 4 days; use the other ${answers.days - 4 === 1 ? "day" : "days"} for cardio or rest.`);
    }
    if (name === "Arnold Split") {
      notes.push("Run the three days twice a week, with one day off.");
    }
    if (answers.goal === "strength") {
      notes.push("Higher-rep sets were cut by 2 reps so you can go heavier. Rest 2–3 minutes between heavy sets.");
    }
    if (answers.goal === "fatLoss") {
      notes.push("Higher-rep sets got 3 more reps. Keep rests short (about 60 seconds) to burn more.");
    }
    if (answers.minutes === 45) {
      notes.push("To fit 45 minutes, each day keeps its first 4 exercises.");
    }
    if (answers.minutes === 90) {
      notes.push("With 90 minutes, each day's first 2 exercises get an extra set.");
    }
    return notes;
  }

  // answers: { goal, days, experience, minutes } using the keys above.
  // Returns null if any answer is missing or not one of the choices.
  function recommend(answers) {
    if (!isValid(answers)) {
      return null;
    }
    const daysUsed = answers.experience === "new" ? Math.min(answers.days, NEW_LIFTER_MAX_DAYS) : answers.days;
    const [first, second] = pickByDays(daysUsed, answers.goal);
    const pickName = firstSuitable([first, second, ...FALLBACK_ORDER], answers, null);
    const runnerUpName = firstSuitable([second, first, ...FALLBACK_ORDER], answers, pickName);
    const picked = program(pickName);
    return {
      program: pickName,
      description: picked.description,
      reason: reasonFor(pickName, answers, daysUsed),
      runnerUp: runnerUpName,
      daysUsed,
      notes: notesFor(pickName, answers),
      days: picked.days.map((day) => tailorDay(day, answers)),
    };
  }

  return { GOALS, DAY_CHOICES, EXPERIENCE, MINUTES, recommend, adjustReps };
})();
