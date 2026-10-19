// Build Workout page: pick exercises from the library into a draft workout,
// then save it to the list of past workouts.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  const MAX_SETS_PER_EXERCISE = 20;
  const MAX_REPS = 500;
  const MAX_WEIGHT_LB = 2000;

  // Drafts saved before per-set logging stored { sets: 3, reps: 10, weight: 135 };
  // turn those into one row per set.
  function toPerSetExercise(exercise) {
    if (Array.isArray(exercise.sets)) {
      return exercise;
    }
    const setCount = Math.min(Math.max(Math.round(exercise.sets) || 1, 1), MAX_SETS_PER_EXERCISE);
    return {
      name: exercise.name,
      group: exercise.group,
      sets: Array.from({ length: setCount }, () => ({
        weight: exercise.weight || 0,
        reps: exercise.reps || 0,
        done: false,
      })),
    };
  }

  const storedDraft = Store.read(KEYS.draft, { name: "", exercises: [] });
  let draft = { name: storedDraft.name, exercises: storedDraft.exercises.map(toPerSetExercise) };
  let savedWorkouts = Store.read(KEYS.workouts, []);
  let customExercises = Store.read(KEYS.customExercises, []);
  // Routines are saved workouts to reuse: { name, exercises: [{ name, group, sets: [{ weight, reps }] }] }.
  let routines = Store.read(KEYS.routines, []);
  let activeGroup = "All";
  let activeEquipment = "All";
  // Drawing hundreds of rows at once is slow on phones; filters and search narrow it down.
  const MAX_LIBRARY_ROWS = 100;

  const nameInput = document.getElementById("workout-name");
  const draftList = document.getElementById("draft-list");
  const draftRing = document.getElementById("draft-ring");
  const draftSetsDone = document.getElementById("draft-sets-done");
  const draftMinutes = document.getElementById("draft-minutes");
  const draftCalories = document.getElementById("draft-calories");
  const draftCaloriesLabel = document.getElementById("draft-calories-label");
  const saveButton = document.getElementById("save-workout");
  const clearButton = document.getElementById("clear-workout");
  const saveRoutineButton = document.getElementById("save-routine");
  const routineList = document.getElementById("routine-list");
  const searchInput = document.getElementById("exercise-search");
  const groupFilters = document.getElementById("group-filters");
  const equipmentFilters = document.getElementById("equipment-filters");
  const libraryCount = document.getElementById("library-count");
  const libraryList = document.getElementById("library-list");
  const savedList = document.getElementById("saved-list");
  const customForm = document.getElementById("custom-form");
  const customNameInput = document.getElementById("custom-name");
  const customNameError = document.getElementById("custom-name-error");
  const customGroupSelect = document.getElementById("custom-group");

  // Once the user picks a group by hand, stop overwriting it with guesses.
  let customGroupChosenByUser = false;

  // Custom exercises come first so a newly added one is easy to find.
  function allExercises() {
    const custom = customExercises.map((exercise) => ({ ...exercise, equipment: "Other", custom: true }));
    return [...custom, ...EXERCISE_LIBRARY];
  }

  function saveDraft() {
    if (!Store.write(KEYS.draft, draft)) {
      UI.showSaveError();
    }
  }

  function renderChips(container, options, activeOption, onSelect) {
    container.replaceChildren(
      ...options.map((option) =>
        el(
          "button",
          {
            type: "button",
            class: "chip",
            "aria-pressed": String(option === activeOption),
            onclick: () => onSelect(option),
          },
          option,
        ),
      ),
    );
  }

  // Only offer filters that match at least one exercise.
  function renderFilters() {
    const exercises = allExercises();
    const groups = ["All", ...MUSCLE_GROUPS.filter((group) => exercises.some((e) => e.group === group))];
    const equipment = ["All", ...EQUIPMENT_TYPES.filter((type) => exercises.some((e) => e.equipment === type))];
    if (!groups.includes(activeGroup)) {
      activeGroup = "All";
    }
    if (!equipment.includes(activeEquipment)) {
      activeEquipment = "All";
    }
    renderChips(groupFilters, groups, activeGroup, (group) => {
      activeGroup = group;
      renderFilters();
      renderLibrary();
    });
    renderChips(equipmentFilters, equipment, activeEquipment, (type) => {
      activeEquipment = type;
      renderFilters();
      renderLibrary();
    });
  }

  // Every word typed must appear in the name or muscle, in any order,
  // so "incline bench" finds "Incline Dumbbell Bench Press".
  function matchesSearch(exercise, words) {
    const text = `${exercise.name} ${exercise.muscle || ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  }

  function exerciseDetails(exercise) {
    return [exercise.group, exercise.muscle !== exercise.group ? exercise.muscle : null, exercise.equipment]
      .filter(Boolean)
      .join(" · ");
  }

  function renderLibrary() {
    const words = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = allExercises().filter(
      (exercise) =>
        (activeGroup === "All" || exercise.group === activeGroup) &&
        (activeEquipment === "All" || exercise.equipment === activeEquipment) &&
        matchesSearch(exercise, words),
    );
    libraryCount.textContent =
      matches.length > MAX_LIBRARY_ROWS
        ? `Showing ${MAX_LIBRARY_ROWS} of ${UI.formatNumber(matches.length)} exercises. Search or filter to narrow down.`
        : UI.plural(matches.length, "exercise");
    if (matches.length === 0) {
      const typedName = searchInput.value.trim();
      libraryList.replaceChildren(
        el(
          "li",
          { class: "empty" },
          "No exercises match your search and filters.",
          typedName
            ? el(
                "div",
                {},
                el(
                  "button",
                  {
                    type: "button",
                    class: "button-secondary small",
                    onclick: () => startCustomExercise(typedName),
                  },
                  `Create "${typedName}"`,
                ),
              )
            : null,
        ),
      );
      return;
    }
    const addedNames = new Set(draft.exercises.map((exercise) => exercise.name));
    libraryList.replaceChildren(
      ...matches.slice(0, MAX_LIBRARY_ROWS).map((exercise) => {
        const isAdded = addedNames.has(exercise.name);
        return el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el(
              "span",
              { class: "row-title" },
              exercise.name,
              exercise.custom ? el("span", { class: "custom-tag" }, "Custom") : null,
            ),
            el("span", { class: "row-meta" }, exerciseDetails(exercise)),
          ),
          el(
            "div",
            { class: "row-actions" },
            exercise.custom
              ? el(
                  "button",
                  {
                    type: "button",
                    class: "link-button",
                    "aria-label": `Delete custom exercise ${exercise.name}`,
                    onclick: () => deleteCustomExercise(exercise.name),
                  },
                  "Delete",
                )
              : null,
            el(
              "button",
              {
                type: "button",
                class: isAdded ? "button-secondary small" : "button small",
                disabled: isAdded,
                "aria-label": isAdded ? `${exercise.name} added` : `Add ${exercise.name}`,
                onclick: () => addExercise(exercise),
              },
              isAdded ? "Added" : "Add",
            ),
          ),
        );
      }),
    );
  }

  // The sets from the most recent saved workout with this exercise, or null.
  // savedWorkouts is newest first. Workouts saved before per-set logging are skipped.
  function lastTimeSets(exerciseName) {
    const name = exerciseName.toLowerCase();
    for (const workout of savedWorkouts) {
      const match = workout.exercises.find(
        (exercise) => exercise.name.toLowerCase() === name && Array.isArray(exercise.sets),
      );
      if (match) {
        return match.sets;
      }
    }
    return null;
  }

  function addExercise(exercise) {
    // Start from last time's sets when there are any, otherwise 3 sets of 10.
    const previous = lastTimeSets(exercise.name);
    const sets = previous
      ? previous.map((set) => ({ weight: set.weight, reps: set.reps, done: false }))
      : Array.from({ length: 3 }, () => ({ weight: 0, reps: 10, done: false }));
    draft.exercises.push({ name: exercise.name, group: exercise.group, sets });
    saveDraft();
    renderDraft();
    renderLibrary();
    UI.showToast(`Added ${exercise.name}`);
  }

  function updateCustomGroupGuess() {
    if (!customGroupChosenByUser) {
      const name = customNameInput.value.trim();
      customGroupSelect.value = name ? WorkoutLogic.guessMuscleGroup(name) : "Other";
    }
  }

  function startCustomExercise(name) {
    customNameInput.value = name;
    customGroupChosenByUser = false;
    updateCustomGroupGuess();
    customNameInput.scrollIntoView({ behavior: "smooth", block: "center" });
    customNameInput.focus({ preventScroll: true });
  }

  function addCustomExercise(event) {
    event.preventDefault();
    const name = customNameInput.value.trim().replace(/\s+/g, " ");
    let error = "";
    if (!name) {
      error = "Enter a name for the exercise.";
    } else if (allExercises().some((exercise) => exercise.name.toLowerCase() === name.toLowerCase())) {
      error = `"${name}" is already in the exercise list.`;
    }
    customNameError.textContent = error;
    customNameInput.setAttribute("aria-invalid", error ? "true" : "false");
    if (error) {
      return;
    }
    const exercise = { name, group: customGroupSelect.value };
    if (!Store.write(KEYS.customExercises, [exercise, ...customExercises])) {
      UI.showSaveError();
      return;
    }
    customExercises = [exercise, ...customExercises];
    customForm.reset();
    customGroupChosenByUser = false;
    updateCustomGroupGuess();
    // Show the new exercise at the top of the list.
    searchInput.value = "";
    activeGroup = "All";
    activeEquipment = "All";
    renderFilters();
    renderLibrary();
    libraryList.scrollTop = 0;
    UI.showToast(`Added ${name} (${exercise.group}) to the exercise list`);
  }

  function deleteCustomExercise(name) {
    if (!confirm(`Delete "${name}" from your exercise list? Saved workouts keep it.`)) {
      return;
    }
    const remaining = customExercises.filter((exercise) => exercise.name !== name);
    if (!Store.write(KEYS.customExercises, remaining)) {
      UI.showSaveError();
      return;
    }
    customExercises = remaining;
    renderFilters();
    renderLibrary();
    UI.showToast(`Deleted ${name}`);
  }

  function removeExercise(index) {
    draft.exercises.splice(index, 1);
    saveDraft();
    renderDraft();
    renderLibrary();
  }

  function addSet(exercise) {
    if (exercise.sets.length >= MAX_SETS_PER_EXERCISE) {
      UI.showToast(`An exercise can have at most ${MAX_SETS_PER_EXERCISE} sets.`, true);
      return;
    }
    // Start the new set with the same weight and reps as the last one.
    const lastSet = exercise.sets[exercise.sets.length - 1] || { weight: 0, reps: 10 };
    exercise.sets.push({ weight: lastSet.weight, reps: lastSet.reps, done: false });
    saveDraft();
    renderDraft();
  }

  function removeSet(exercise, setIndex) {
    exercise.sets.splice(setIndex, 1);
    saveDraft();
    renderDraft();
  }

  function setsDoneText(exercise) {
    const doneCount = exercise.sets.filter((set) => set.done).length;
    return `${exercise.group} · ${doneCount}/${exercise.sets.length} sets done`;
  }

  // Typing in a number box updates the draft and the totals without
  // re-drawing the list, so the cursor stays where it is.
  function setInput(set, field, max, label) {
    const input = el("input", {
      type: "number",
      inputmode: "decimal",
      min: "0",
      max: String(max),
      step: "any",
      value: String(set[field]),
      "aria-label": label,
    });
    input.addEventListener("input", () => {
      const value = Number(input.value);
      set[field] = input.value === "" || Number.isNaN(value) ? 0 : value;
      saveDraft();
      updateDraftSummary();
    });
    return input;
  }

  // Each set goes Start -> End -> done (✓). Tapping ✓ undoes it.
  const SET_BUTTONS = {
    ready: { text: "Start", action: "Start" },
    active: { text: "End", action: "End" },
    done: { text: "✓", action: "Undo" },
  };

  function setState(set) {
    if (set.done) {
      return "done";
    }
    return set.startedAt ? "active" : "ready";
  }

  function allSets() {
    return draft.exercises.flatMap((exercise) => exercise.sets);
  }

  function advanceSet(set) {
    const now = Date.now();
    const state = setState(set);
    if (state === "ready") {
      // Starting a set means any set still running is finished.
      for (const other of allSets()) {
        if (setState(other) === "active") {
          other.endedAt = now;
          other.done = true;
        }
      }
      set.startedAt = now;
    } else if (state === "active") {
      set.endedAt = now;
      set.done = true;
      RestTimer.start();
    } else {
      set.done = false;
      delete set.startedAt;
      delete set.endedAt;
    }
    saveDraft();
    renderDraft();
  }

  function renderSetRow(exercise, set, setIndex, previousSets) {
    const setName = `${exercise.name} set ${setIndex + 1}`;
    const previous = previousSets ? previousSets[setIndex] : null;
    const state = setState(set);
    const row = el("div", { class: `set-row ${state}` });
    const { text, action } = SET_BUTTONS[state];
    const stepButton = el(
      "button",
      {
        type: "button",
        class: `set-step ${state}`,
        "aria-label": `${action} ${setName}`,
        onclick: () => advanceSet(set),
      },
      text,
    );
    row.append(
      el("span", { class: "set-number" }, String(setIndex + 1)),
      el(
        "span",
        {
          class: "set-previous",
          "aria-label": previous
            ? `Last time: ${previous.weight} pounds for ${previous.reps} reps`
            : "No previous set",
        },
        previous ? `${UI.formatNumber(previous.weight)}×${previous.reps}` : "—",
      ),
      setInput(set, "weight", MAX_WEIGHT_LB, `${setName} weight in pounds`),
      setInput(set, "reps", MAX_REPS, `${setName} reps`),
      stepButton,
      el(
        "button",
        {
          type: "button",
          class: "set-remove",
          "aria-label": `Remove ${setName}`,
          disabled: exercise.sets.length === 1,
          onclick: () => removeSet(exercise, setIndex),
        },
        "×",
      ),
    );
    return row;
  }

  function renderExerciseCard(exercise, index) {
    const metaLine = el("span", { class: "row-meta" }, setsDoneText(exercise));
    const previousSets = lastTimeSets(exercise.name);
    return el(
      "li",
      { class: "exercise-card" },
      el(
        "div",
        { class: "exercise-card-header" },
        el("div", {}, el("span", { class: "row-title" }, exercise.name), metaLine),
        el(
          "button",
          {
            type: "button",
            class: "link-button",
            "aria-label": `Remove ${exercise.name}`,
            onclick: () => removeExercise(index),
          },
          "Remove",
        ),
      ),
      el(
        "div",
        { class: "set-row set-labels", "aria-hidden": "true" },
        el("span", {}, "Set"),
        el("span", {}, "Last"),
        el("span", {}, "lb"),
        el("span", {}, "Reps"),
        el("span", {}, ""),
        el("span", {}),
      ),
      ...exercise.sets.map((set, setIndex) => renderSetRow(exercise, set, setIndex, previousSets)),
      el(
        "button",
        { type: "button", class: "add-set", onclick: () => addSet(exercise) },
        "+ Add set",
      ),
    );
  }

  function renderDraft() {
    if (draft.exercises.length === 0) {
      draftList.replaceChildren(
        el("li", { class: "empty" }, "No exercises yet. Tap Add on any exercise in the list."),
      );
    } else {
      draftList.replaceChildren(...draft.exercises.map(renderExerciseCard));
    }
    updateDraftSummary();
  }

  function countSets() {
    const allSets = draft.exercises.flatMap((exercise) => exercise.sets);
    return { done: allSets.filter((set) => set.done).length, total: allSets.length };
  }

  // The ring compares this workout's load with the best single day so far.
  // Bodyweight from the Calories tab's exercise form, or else the nutrition plan.
  function knownBodyweight() {
    const answers = Store.read(KEYS.planAnswers, null);
    return Store.read(KEYS.bodyweight, null) || (answers && answers.weightLb) || null;
  }

  function caloriesFor(minutes, bodyweight) {
    return WorkoutLogic.estimateCalories("Weight training", bodyweight, minutes);
  }

  // Also counts calories burned on the Calories tab, linked to this workout.
  function logWorkoutCalories(workout) {
    if (!workout.calories) {
      return;
    }
    const entries = Store.read(KEYS.calories, []);
    const entry = {
      id: workout.id,
      workoutId: workout.id,
      date: workout.date,
      activity: "Weight training",
      minutes: workout.minutes,
      calories: workout.calories,
      workoutName: workout.name,
    };
    Store.write(KEYS.calories, [entry, ...entries]);
  }

  function updateDraftSummary() {
    const load = WorkoutLogic.workoutLoad(draft.exercises);
    const bestDay = WorkoutLogic.bestDayTotal(savedWorkouts, (workout) => workout.load);
    let caption = "Finish sets to fill the ring";
    if (bestDay > 0) {
      caption = `Best day: ${UI.formatNumber(bestDay)} lb`;
    } else if (load > 0) {
      caption = "Your first workout sets the bar";
    }
    draftRing.replaceChildren(
      UI.ring({
        fraction: bestDay > 0 ? load / bestDay : load > 0 ? 1 : 0,
        value: UI.formatNumber(load),
        unit: "lb",
        label: "Load",
        caption,
        color: "var(--load)",
      }),
    );
    const sets = countSets();
    draftSetsDone.textContent = `${sets.done} / ${sets.total}`;
    const minutes = WorkoutLogic.workoutMinutes(draft.exercises, Date.now());
    const bodyweight = knownBodyweight();
    draftMinutes.textContent = `${minutes} min`;
    draftCalories.textContent = bodyweight ? UI.formatNumber(caloriesFor(minutes, bodyweight)) : "–";
    draftCaloriesLabel.textContent = bodyweight ? "Est. calories" : "Est. calories (add your weight in Plan)";
    const isEmpty = draft.exercises.length === 0;
    saveButton.disabled = isEmpty;
    saveRoutineButton.disabled = isEmpty;
    clearButton.disabled = isEmpty;
  }

  function findInvalidSet() {
    for (const exercise of draft.exercises) {
      const setIndex = exercise.sets.findIndex(
        (set) =>
          set.done &&
          (!(set.reps >= 1 && set.reps <= MAX_REPS) || !(set.weight >= 0 && set.weight <= MAX_WEIGHT_LB)),
      );
      if (setIndex !== -1) {
        return `${exercise.name} set ${setIndex + 1}`;
      }
    }
    return null;
  }

  function saveWorkout() {
    const sets = countSets();
    if (sets.done === 0) {
      UI.showToast("Finish at least one set (tap Start, then End) before saving.", true);
      return;
    }
    const invalidSet = findInvalidSet();
    if (invalidSet) {
      UI.showToast(`Check ${invalidSet}: reps must be 1–${MAX_REPS}, weight 0–${MAX_WEIGHT_LB} lb.`, true);
      return;
    }
    const unfinished = sets.total - sets.done;
    const unfinishedMessage = `${UI.plural(unfinished, "set")} not checked off won't be saved. Save anyway?`;
    if (unfinished > 0 && !confirm(unfinishedMessage)) {
      return;
    }
    // Only finished sets are saved; exercises with none finished are left out.
    const finishedExercises = draft.exercises
      .map((exercise) => ({ ...exercise, sets: exercise.sets.filter((set) => set.done) }))
      .filter((exercise) => exercise.sets.length > 0);
    const today = UI.todayKey();
    const workout = {
      id: Date.now(),
      date: today,
      name: draft.name.trim() || `Workout on ${UI.formatDate(today)}`,
      exercises: finishedExercises,
      load: WorkoutLogic.workoutLoad(finishedExercises),
    };
    // Time covers the whole session, including a set left unfinished.
    workout.minutes = WorkoutLogic.workoutMinutes(draft.exercises, Date.now());
    const bodyweight = knownBodyweight();
    workout.calories = bodyweight ? caloriesFor(workout.minutes, bodyweight) : 0;
    if (!Store.write(KEYS.workouts, [workout, ...savedWorkouts])) {
      UI.showSaveError();
      return;
    }
    savedWorkouts = [workout, ...savedWorkouts];
    logWorkoutCalories(workout);
    RestTimer.stop();
    draft = { name: "", exercises: [] };
    nameInput.value = "";
    saveDraft();
    renderDraft();
    renderLibrary();
    renderSaved();
    const burned = workout.calories ? ` · ~${UI.formatNumber(workout.calories)} cal burned` : "";
    UI.showToast(`Workout saved: ${UI.formatNumber(workout.load)} lb load${burned}`);
  }

  function countRoutineSets(routine) {
    return routine.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  }

  function renderRoutines() {
    if (routines.length === 0) {
      routineList.replaceChildren(
        el(
          "li",
          { class: "empty" },
          "No routines yet. Build a workout, give it a name, and tap Save as routine.",
        ),
      );
      return;
    }
    routineList.replaceChildren(
      ...routines.map((routine) =>
        el(
          "li",
          { class: "routine" },
          el(
            "button",
            {
              type: "button",
              class: "routine-start",
              "aria-label": `Start ${routine.name}`,
              onclick: () => startRoutine(routine),
            },
            el("span", { class: "row-title" }, routine.name),
            el(
              "span",
              { class: "row-meta" },
              `${UI.plural(routine.exercises.length, "exercise")} · ${UI.plural(countRoutineSets(routine), "set")}`,
            ),
            el("span", { class: "row-meta" }, routine.exercises.map((exercise) => exercise.name).join(", ")),
          ),
          el(
            "button",
            {
              type: "button",
              class: "set-remove",
              "aria-label": `Delete routine ${routine.name}`,
              onclick: () => deleteRoutine(routine),
            },
            "×",
          ),
        ),
      ),
    );
  }

  function saveRoutine() {
    const name = draft.name.trim();
    if (!name) {
      UI.showToast("Type a workout name first. That becomes the routine's name.", true);
      nameInput.focus();
      return;
    }
    const existing = routines.find((routine) => routine.name.toLowerCase() === name.toLowerCase());
    if (existing && !confirm(`Replace your "${existing.name}" routine with this workout?`)) {
      return;
    }
    const routine = {
      name,
      exercises: draft.exercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        sets: exercise.sets.map((set) => ({ weight: set.weight, reps: set.reps })),
      })),
    };
    const updated = [routine, ...routines.filter((item) => item !== existing)];
    if (!Store.write(KEYS.routines, updated)) {
      UI.showSaveError();
      return;
    }
    routines = updated;
    renderRoutines();
    UI.showToast(existing ? `Updated routine "${name}"` : `Saved routine "${name}"`);
  }

  // Fills the workout with the routine's exercises and sets, ready to log.
  function startRoutine(routine) {
    if (draft.exercises.length > 0 && !confirm(`Replace your current workout with "${routine.name}"?`)) {
      return;
    }
    draft = {
      name: routine.name,
      exercises: routine.exercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        sets: exercise.sets.map((set) => ({ weight: set.weight, reps: set.reps, done: false })),
      })),
    };
    nameInput.value = draft.name;
    saveDraft();
    renderDraft();
    renderLibrary();
    draftList.scrollIntoView({ behavior: "smooth", block: "start" });
    UI.showToast(`Started ${routine.name}`);
  }

  function deleteRoutine(routine) {
    if (!confirm(`Delete the "${routine.name}" routine? Workouts you've saved stay.`)) {
      return;
    }
    const updated = routines.filter((item) => item !== routine);
    if (!Store.write(KEYS.routines, updated)) {
      UI.showSaveError();
      return;
    }
    routines = updated;
    renderRoutines();
    UI.showToast(`Deleted routine "${routine.name}"`);
  }

  function clearWorkout() {
    if (!confirm("Clear this workout? The exercises you added will be removed.")) {
      return;
    }
    draft = { name: "", exercises: [] };
    nameInput.value = "";
    saveDraft();
    renderDraft();
    renderLibrary();
  }

  function deleteWorkout(id) {
    if (!confirm("Delete this saved workout?")) {
      return;
    }
    const remaining = savedWorkouts.filter((workout) => workout.id !== id);
    if (!Store.write(KEYS.workouts, remaining)) {
      UI.showSaveError();
      return;
    }
    savedWorkouts = remaining;
    const calorieEntries = Store.read(KEYS.calories, []);
    Store.write(KEYS.calories, calorieEntries.filter((entry) => entry.workoutId !== id));
    renderSaved();
    UI.showToast("Workout deleted");
  }

  // Workouts saved before per-set logging store a number of sets instead of a list.
  function countSavedSets(workout) {
    return workout.exercises.reduce(
      (total, exercise) => total + (Array.isArray(exercise.sets) ? exercise.sets.length : exercise.sets),
      0,
    );
  }

  function renderSaved() {
    if (savedWorkouts.length === 0) {
      savedList.replaceChildren(
        el("li", { class: "empty" }, "No saved workouts yet. Build one above and tap Save workout."),
      );
      return;
    }
    savedList.replaceChildren(
      ...savedWorkouts.map((workout) =>
        el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el("span", { class: "row-title" }, workout.name),
            el(
              "span",
              { class: "row-meta" },
              `${UI.formatDate(workout.date)} · ${UI.plural(workout.exercises.length, "exercise")} · ` +
                `${UI.plural(countSavedSets(workout), "set")} · ${UI.formatNumber(workout.load)} lb load` +
                (workout.minutes ? ` · ${workout.minutes} min` : "") +
                (workout.calories ? ` · ~${UI.formatNumber(workout.calories)} cal` : ""),
            ),
            el("span", { class: "row-meta" }, workout.exercises.map((exercise) => exercise.name).join(", ")),
          ),
          el(
            "button",
            {
              type: "button",
              class: "link-button",
              "aria-label": `Delete ${workout.name}`,
              onclick: () => deleteWorkout(workout.id),
            },
            "Delete",
          ),
        ),
      ),
    );
  }

  nameInput.value = draft.name;
  nameInput.addEventListener("input", () => {
    draft.name = nameInput.value;
    saveDraft();
  });
  searchInput.addEventListener("input", renderLibrary);
  customGroupSelect.replaceChildren(...MUSCLE_GROUPS.map((group) => el("option", { value: group }, group)));
  customGroupSelect.value = "Other";
  customNameInput.addEventListener("input", () => {
    customNameError.textContent = "";
    customNameInput.setAttribute("aria-invalid", "false");
    updateCustomGroupGuess();
  });
  customGroupSelect.addEventListener("change", () => {
    customGroupChosenByUser = true;
  });
  customForm.addEventListener("submit", addCustomExercise);
  saveButton.addEventListener("click", saveWorkout);
  clearButton.addEventListener("click", clearWorkout);
  saveRoutineButton.addEventListener("click", saveRoutine);

  renderFilters();
  renderLibrary();
  renderDraft();
  renderSaved();
  renderRoutines();
  // Keep the duration and calorie estimate current while a workout is going.
  setInterval(() => {
    if (draft.exercises.length > 0) {
      updateDraftSummary();
    }
  }, 15000);
})();
