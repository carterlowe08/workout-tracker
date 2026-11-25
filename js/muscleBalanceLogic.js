// Muscle balance: how many sets each muscle got this week (Sunday to
// Saturday), from saved workouts. A set is 1 for a main muscle and half for a
// muscle that also works. Nothing here touches the page.
const MuscleBalance = (() => {
  const HELPER_CREDIT = 0.5;
  const DEFAULT_TARGET = 10;
  const MIN_TARGET = 4;
  const MAX_TARGET = 20;

  // One ring each. Muscles without a ring (forearms, neck, inner and outer
  // thighs) still shade the body map.
  const GROUPS = [
    { name: "Chest", muscles: ["chest"] },
    { name: "Back", muscles: ["lats", "middle back", "lower back", "traps"] },
    { name: "Shoulders", muscles: ["shoulders"] },
    { name: "Biceps", muscles: ["biceps"] },
    { name: "Triceps", muscles: ["triceps"] },
    { name: "Quads", muscles: ["quadriceps"] },
    { name: "Hamstrings", muscles: ["hamstrings"] },
    { name: "Glutes", muscles: ["glutes"] },
    { name: "Calves", muscles: ["calves"] },
    { name: "Core", muscles: ["abdominals"] },
  ];
  const OTHER_MUSCLES = ["forearms", "neck", "abductors", "adductors"];
  const MUSCLES = [...GROUPS.flatMap((group) => group.muscles), ...OTHER_MUSCLES];

  // Custom exercises only have a broad group. These name one ring; Legs, Arms
  // and Other could be several muscles, so those sets are left out.
  const CUSTOM_GROUP_RINGS = ["Chest", "Back", "Shoulders", "Core"];

  const databaseById = new Map(EXERCISE_DATABASE.map((exercise) => [exercise.id, exercise]));
  const listedByName = new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.name.toLowerCase(), exercise]));

  // The list's entry for a name, with its muscles; null for custom exercises.
  function findListed(name) {
    const listed = listedByName.get(name.trim().toLowerCase());
    return (listed && databaseById.get(listed.id)) || null;
  }

  // Workouts from before set-by-set logging saved the number of sets.
  function setCount(exercise) {
    return Array.isArray(exercise.sets) ? exercise.sets.length : Number(exercise.sets) || 0;
  }

  function creditFor(entry, muscles) {
    if (entry.main.some((muscle) => muscles.includes(muscle))) return 1;
    return entry.also.some((muscle) => muscles.includes(muscle)) ? HELPER_CREDIT : 0;
  }

  // The week containing todayKey: {
  //   groups: { Chest: 10, ... }, sets per ring,
  //   muscles: { lats: 4, ... }, sets per muscle on the body map,
  //   lifts: { Chest: [["Bench Press", 7], ...], forearms: [...] }, most sets first,
  //   uncounted: sets of custom exercises whose muscle isn't known }.
  function weekSets(workouts, todayKey) {
    const start = WorkoutLogic.startOfWeek(todayKey);
    const end = WorkoutLogic.addDays(start, 6);
    const groups = Object.fromEntries(GROUPS.map((group) => [group.name, 0]));
    const muscles = Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0]));
    const liftSets = new Map([...GROUPS.map((group) => group.name), ...OTHER_MUSCLES].map((key) => [key, new Map()]));
    let uncounted = 0;

    function addLift(key, name, sets) {
      const byName = liftSets.get(key);
      byName.set(name, (byName.get(name) || 0) + sets);
    }

    function addGroup(name, exerciseName, sets) {
      groups[name] += sets;
      addLift(name, exerciseName, sets);
    }

    const exercises = workouts
      .filter((workout) => workout.date >= start && workout.date <= end)
      .flatMap((workout) => workout.exercises || []);
    for (const exercise of exercises) {
      const sets = setCount(exercise);
      const entry = findListed(exercise.name);
      const name = exercise.name.trim();
      // Cardio machines list a leg muscle, but they aren't lifting sets.
      if (sets === 0 || (entry || exercise).group === "Cardio") continue;
      if (!entry) {
        if (!CUSTOM_GROUP_RINGS.includes(exercise.group)) {
          uncounted += sets;
          continue;
        }
        addGroup(exercise.group, name, sets);
        // With one muscle in the group, the body map can show it too.
        const group = GROUPS.find((item) => item.name === exercise.group);
        if (group.muscles.length === 1) muscles[group.muscles[0]] += sets;
        continue;
      }
      // A group counts a set once, even when the lift works several of its muscles.
      for (const group of GROUPS) {
        const credit = creditFor(entry, group.muscles) * sets;
        if (credit > 0) addGroup(group.name, name, credit);
      }
      for (const muscle of MUSCLES) {
        const credit = creditFor(entry, [muscle]) * sets;
        muscles[muscle] += credit;
        if (credit > 0 && OTHER_MUSCLES.includes(muscle)) addLift(muscle, name, credit);
      }
    }

    const lifts = Object.fromEntries(
      [...liftSets].map(([key, byName]) => [key, [...byName].sort((a, b) => b[1] - a[1])]),
    );
    return { groups, muscles, lifts, uncounted };
  }

  // How much color a muscle gets on the body map, from 0 (no sets) to 100
  // (target reached). Any set starts at 35, so a trained muscle stands out.
  function shade(sets, target) {
    if (sets <= 0) return 0;
    return Math.round(35 + 65 * Math.min(sets / target, 1));
  }

  function clampTarget(target) {
    const number = Math.round(Number(target));
    if (!Number.isFinite(number) || number === 0) return DEFAULT_TARGET;
    return Math.min(MAX_TARGET, Math.max(MIN_TARGET, number));
  }

  // The popular lift to suggest for a ring: the first whose main muscle is in it.
  function suggestedLift(groupName) {
    const { muscles } = GROUPS.find((group) => group.name === groupName);
    return POPULAR_EXERCISES.find((exercise) => creditFor(findListed(exercise.name), muscles) === 1).name;
  }

  return {
    GROUPS,
    OTHER_MUSCLES,
    DEFAULT_TARGET,
    MIN_TARGET,
    MAX_TARGET,
    weekSets,
    shade,
    clampTarget,
    suggestedLift,
  };
})();
