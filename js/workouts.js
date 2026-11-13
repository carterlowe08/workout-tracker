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
  // rpeAsked: the end-of-workout RPE sheet has been shown; rpe: the answer, if any.
  let draft = {
    name: storedDraft.name,
    exercises: storedDraft.exercises.map(toPerSetExercise),
    rpeAsked: Boolean(storedDraft.rpeAsked),
    rpe: storedDraft.rpe ?? null,
  };
  let savedWorkouts = Store.read(KEYS.workouts, []);
  let customExercises = Store.read(KEYS.customExercises, []);
  // Routines are saved workouts to reuse: { name, exercises: [{ name, group, sets: [{ weight, reps }] }] }.
  let routines = Store.read(KEYS.routines, []);
  let activeGroup = "All";
  let activeEquipment = "All";
  // Exercises whose note is showing; kept here so it stays open when cards redraw.
  const openNotes = new Set();
  // Drawing hundreds of rows at once is slow on phones; filters and search narrow it down.
  const MAX_LIBRARY_ROWS = 100;

  const nameInput = document.getElementById("workout-name");
  const draftList = document.getElementById("draft-list");
  const draftSetsDone = document.getElementById("draft-sets-done");
  const draftMinutes = document.getElementById("draft-minutes");
  const draftTotals = document.getElementById("draft-totals");
  const draftSegments = document.getElementById("draft-segments");
  const saveButton = document.getElementById("save-workout");
  const clearButton = document.getElementById("clear-workout");
  const saveRoutineButton = document.getElementById("save-routine");
  const routineList = document.getElementById("routine-list");
  const premadeList = document.getElementById("premade-list");
  const myRoutinesTab = document.getElementById("tab-my-routines");
  const premadeTab = document.getElementById("tab-premade");
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
              exerciseNameButton(exercise.name),
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

  async function deleteCustomExercise(name) {
    const question = `Delete "${name}" from your exercise list? Saved workouts keep it.`;
    if (!(await UI.ask(question, { confirmLabel: "Delete", danger: true }))) {
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

  async function removeExercise(index) {
    const exercise = draft.exercises[index];
    const earlierSets = exercise.sets.length - WorkoutLogic.ownSets(exercise).length;
    const question = `Remove ${exercise.name} and the ${UI.plural(earlierSets, "finished set")} from before the swap?`;
    if (earlierSets > 0 && !(await UI.ask(question, { confirmLabel: "Remove", danger: true }))) {
      return;
    }
    draft.exercises.splice(draft.exercises.indexOf(exercise), 1);
    draft.exercises = WorkoutLogic.withoutLoneSupersets(draft.exercises);
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

  function removeLastSet(exercise) {
    exercise.sets.pop();
    saveDraft();
    renderDraft();
  }

  function setsDoneText(exercise) {
    const sets = WorkoutLogic.ownSets(exercise);
    const doneCount = sets.filter((set) => set.done).length;
    const warmupCount = Object.keys(exercise.warmups || {}).length;
    const warmups = warmupCount > 0 ? ` · ${UI.plural(warmupCount, "warm-up")} done` : "";
    return `${exercise.group} · ${doneCount}/${sets.length} sets done${warmups}`;
  }

  // Warm-ups are not sets: they add no load, but the time they were done is
  // kept (exercise.warmups maps a step to that time) so they count toward
  // the workout's duration and calories.
  function warmupTracking(exercise) {
    return {
      done: exercise.warmups || {},
      onToggle: (stepKey, isDone) => {
        const warmups = { ...exercise.warmups };
        if (isDone) {
          warmups[stepKey] = Date.now();
        } else {
          delete warmups[stepKey];
        }
        exercise.warmups = warmups;
        saveDraft();
        renderDraft();
        return warmups;
      },
    };
  }

  // Typing in a number box updates the draft and the totals without
  // re-drawing the list, so the cursor stays where it is.
  // Weights are typed in the chosen unit (lb or kg) and saved in pounds.
  function setInput(set, field, max, label, { dumbbell = false } = {}) {
    const isWeight = field === "weight";
    const input = el("input", {
      type: "number",
      inputmode: "decimal",
      min: "0",
      max: String(isWeight ? Units.fromPounds(max) : max),
      step: isWeight ? String(Units.weightStep({ dumbbell })) : "any",
      value: String(isWeight ? Units.fromPounds(set[field]) : set[field]),
      "aria-label": label,
    });
    input.addEventListener("input", () => {
      const value = Number(input.value);
      const typed = input.value === "" || Number.isNaN(value) ? 0 : value;
      set[field] = isWeight ? Units.toPounds(typed) : typed;
      saveDraft();
      updateDraftSummary();
    });
    // Select the whole number when the box is tapped, so typing replaces it
    // instead of adding digits to the end. The short delay is needed on
    // phones, which otherwise place the cursor after the tap and undo the selection.
    input.addEventListener("focus", () => setTimeout(() => input.select(), 0));
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

  function advanceSet(exercise, set, setIndex) {
    const now = Date.now();
    const state = setState(set);
    const exerciseIndex = draft.exercises.indexOf(exercise);
    if (state === "ready") {
      // Starting a set means the rest is over.
      RestTimer.stop();
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
    } else {
      set.done = false;
      delete set.startedAt;
      delete set.endedAt;
      // Undoing the set just finished takes back the rest that followed it.
      if (RestTimer.countdownAfter(draft.exercises, exerciseIndex, setIndex)) {
        RestTimer.stop();
      }
    }
    saveDraft();
    // Ending the last set finishes the workout, so ask how hard it was instead of resting.
    const finishesWorkout = state === "active" && allSets().every((other) => other.done) && !draft.rpeAsked;
    if (finishesWorkout) {
      RestTimer.stop();
    } else if (state === "active") {
      // In a superset, rest waits until the round's last exercise is done.
      const nextExercise = WorkoutLogic.nextInRound(draft.exercises, exercise, setIndex);
      if (nextExercise) {
        UI.showToast(`No rest. Next: ${nextExercise.name}`);
      } else {
        RestTimer.start(exercise.name, exerciseIndex, setIndex);
      }
    }
    renderDraft();
    if (finishesWorkout) {
      askEndOfWorkoutQuestions();
    }
  }

  // Asks for the workout's RPE once per workout and saves it as today's check-in.
  async function askWorkoutRpe() {
    draft.rpeAsked = true;
    saveDraft();
    const load = WorkoutLogic.workoutLoad(draft.exercises);
    const minutes = WorkoutLogic.workoutMinutes(draft.exercises, Date.now());
    const rpe = await RpeCheckIn.ask(
      `Workout done · ${minutes} min · ${Units.format(load, { whole: true })}`,
    );
    if (rpe === null) {
      return;
    }
    if (!RpeCheckIn.saveToday(rpe)) {
      UI.showSaveError();
      return;
    }
    draft.rpe = rpe;
    saveDraft();
    UI.showToast(`RPE ${rpe} saved · streak updated`);
  }

  // How hard was it, then whether to leave notes for next time.
  async function askEndOfWorkoutQuestions() {
    await askWorkoutRpe();
    const savedCount = await ExerciseNotes.askForWorkout(WorkoutLogic.exercisesToNote(WorkoutLogic.finishedExercises(draft.exercises)));
    renderDraft();
    if (savedCount > 0) {
      UI.showToast(`Saved ${UI.plural(savedCount, "note")} for next time`);
    }
  }

  function renderSetRow(exercise, set, setIndex, previousSets) {
    // Numbered among this exercise's own sets, not ones done before a swap.
    const ownIndex = WorkoutLogic.ownSets({ sets: exercise.sets.slice(0, setIndex) }).length;
    const setName = `${exercise.name} set ${ownIndex + 1}`;
    const previous = previousSets ? previousSets[ownIndex] : null;
    const state = setState(set);
    const isNextUp = set === nextUpSetInWorkout();
    const row = el("div", { class: `set-row ${state}${isNextUp ? " next-up" : ""}` });
    const { text, action } = SET_BUTTONS[state];
    const stepButton = el(
      "button",
      {
        type: "button",
        class: `set-step ${state}`,
        "aria-label": `${action} ${setName}`,
        onclick: () => advanceSet(exercise, set, setIndex),
      },
      text,
    );
    row.append(
      el("span", { class: "set-number" }, String(ownIndex + 1)),
      previousSet(previous),
      setInput(set, "weight", MAX_WEIGHT_LB, `${setName} weight in ${Units.current()}`, {
        dumbbell: isDumbbellExercise(exercise.name),
      }),
      setInput(set, "reps", MAX_REPS, `${setName} reps`),
      SetRpe.box(set, exercise.name, ownIndex + 1, saveDraft),
      platesButton(exercise, set, setName),
      stepButton,
    );
    return row;
  }

  // The Last column: last time's weight on top, with × reps and its RPE (if
  // one was logged) on a smaller line under it, so a weight like 61.2 kg fits.
  function previousSet(previous) {
    if (!previous) {
      return el("span", { class: "set-previous", "aria-label": "No previous set" }, "—");
    }
    const rpeTag = WorkoutLogic.setRpeTag(previous);
    return el(
      "span",
      {
        class: "set-previous",
        "aria-label": `Last time: ${Units.format(previous.weight)} for ${previous.reps} reps${
          rpeTag ? `, RPE ${WorkoutLogic.setRpe(previous.rpe)}` : ""
        }`,
      },
      el("span", { class: "set-previous-weight" }, UI.formatNumber(Units.fromPounds(previous.weight))),
      el(
        "span",
        { class: "set-previous-detail" },
        el("span", {}, `×${previous.reps}`),
        rpeTag ? el("span", { class: "set-previous-rpe" }, rpeTag) : null,
      ),
    );
  }

  // The set a superset moves to next, unless a set is running right now.
  function nextUpSetInWorkout() {
    if (allSets().some((set) => setState(set) === "active")) {
      return null;
    }
    const ids = new Set(draft.exercises.map((exercise) => exercise.supersetId).filter(Boolean));
    for (const id of ids) {
      const nextUp = WorkoutLogic.nextUpSet(WorkoutLogic.supersetMembers(draft.exercises, id));
      if (nextUp) {
        return nextUp;
      }
    }
    return null;
  }

  // The line between two sets showing the rest time; tap it to change the time.
  function restLine(exerciseName) {
    const clock = WorkoutLogic.formatClock(RestTimer.secondsFor(exerciseName));
    return el(
      "button",
      {
        type: "button",
        class: "rest-line",
        "data-exercise": exerciseName,
        "aria-label": `Change rest for ${exerciseName}, now ${clock}`,
        onclick: () => RestTimer.openPicker(exerciseName),
      },
      `Rest ${clock}`,
    );
  }

  // The rest line after this set's round, or null after the last one. A lone
  // exercise's rounds are just its sets.
  function restLineAfterRound(exercise, setIndex) {
    const members = exercise.supersetId
      ? WorkoutLogic.supersetMembers(draft.exercises, exercise.supersetId)
      : [exercise];
    return setIndex < WorkoutLogic.supersetRoundCount(members) - 1
      ? restLine(WorkoutLogic.lastInRound(members, setIndex).name)
      : null;
  }

  // What follows a set: the running countdown, the rest line, or nothing after the last set.
  function afterSet(exercise, exerciseIndex, setIndex) {
    const countdown = RestTimer.countdownAfter(draft.exercises, exerciseIndex, setIndex);
    if (countdown) {
      return countdown;
    }
    return setIndex < exercise.sets.length - 1 ? restLine(exercise.name) : null;
  }

  // A rest time changed: update its lines without redrawing the sets being typed in.
  function updateRestLines(exerciseName) {
    for (const line of draftList.querySelectorAll(".rest-line")) {
      if (line.dataset.exercise === exerciseName) {
        line.replaceWith(restLine(exerciseName));
      }
    }
  }

  function isDumbbellExercise(exerciseName) {
    const libraryEntry = EXERCISE_LIBRARY.find((item) => item.name === exerciseName);
    return WorkoutLogic.usesDumbbells(exerciseName, libraryEntry ? libraryEntry.equipment : "");
  }

  // Which bar the plates button opens with, or null for exercises without a bar.
  function barTypeFor(exerciseName) {
    const name = exerciseName.toLowerCase();
    if (/\b(trap|hex) bar\b/.test(name)) {
      return "trap";
    }
    const libraryEntry = EXERCISE_LIBRARY.find((item) => item.name === exerciseName);
    const equipment = libraryEntry ? libraryEntry.equipment : "";
    if (equipment === "EZ bar" || /\bez[- ]?bar\b/.test(name)) {
      return "ez";
    }
    if (equipment === "Barbell" || /\bbarbell\b/.test(name)) {
      return "olympic";
    }
    return null;
  }

  // A small icon: a bar with a plate on each end.
  function platesIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const [tag, attributes] of [
      ["line", { x1: 1, y1: 12, x2: 23, y2: 12 }],
      ["rect", { x: 4, y: 5, width: 4, height: 14, rx: 1 }],
      ["rect", { x: 16, y: 5, width: 4, height: 14, rx: 1 }],
    ]) {
      const shape = document.createElementNS(namespace, tag);
      Object.entries(attributes).forEach(([name, value]) => shape.setAttribute(name, value));
      svg.append(shape);
    }
    return svg;
  }

  function platesButton(exercise, set, setName) {
    const barType = barTypeFor(exercise.name);
    if (!barType) {
      return el("span", {});
    }
    return el(
      "button",
      {
        type: "button",
        class: "set-plates",
        "aria-label": `Show plates for ${setName}`,
        onclick: () => PlateCalculator.open(set.weight, barType, warmupTracking(exercise)),
      },
      platesIcon(),
    );
  }

  // An exercise's name, tappable to open its how-to and history.
  function exerciseNameButton(name) {
    return el(
      "button",
      {
        type: "button",
        class: "exercise-name-button",
        "aria-label": `${name}: how to do it and your history`,
        onclick: () => ExerciseHistory.open(name),
      },
      name,
    );
  }

  // Opens the warm-up guide for the heaviest set entered for this exercise.
  function warmupButton(exercise) {
    const barType = barTypeFor(exercise.name);
    if (!barType) {
      return null;
    }
    return el(
      "button",
      {
        type: "button",
        class: "button-secondary small warmup-button",
        "aria-label": `Warm-up for ${exercise.name}`,
        onclick: () => {
          const topSet = Math.max(0, ...WorkoutLogic.ownSets(exercise).map((set) => set.weight));
          if (!(topSet > 0)) {
            UI.showToast("Type your working weight in a set first, then tap Warm-up.", true);
            return;
          }
          PlateCalculator.open(topSet, barType, warmupTracking(exercise), { showWarmup: true });
        },
      },
      "Warm-up",
    );
  }

  // The Note button on a card, or null when the exercise has no note.
  function noteButton(exerciseName, noteText) {
    if (!noteText) {
      return null;
    }
    return el(
      "button",
      {
        type: "button",
        class: "note-button",
        "aria-expanded": String(openNotes.has(exerciseName)),
        "aria-label": `Note for ${exerciseName}`,
        onclick: () => {
          if (!openNotes.delete(exerciseName)) {
            openNotes.add(exerciseName);
          }
          renderDraft();
        },
      },
      "Note",
    );
  }

  function openNote(exerciseName, noteText) {
    if (!noteText || !openNotes.has(exerciseName)) {
      return null;
    }
    return el(
      "div",
      { class: "exercise-note" },
      el("p", {}, noteText),
      el(
        "button",
        {
          type: "button",
          class: "link-button",
          "aria-label": `Delete note for ${exerciseName}`,
          onclick: () => deleteNote(exerciseName),
        },
        "Delete",
      ),
    );
  }

  async function deleteNote(exerciseName) {
    const question = `Delete your note for ${exerciseName}?`;
    if (!(await UI.ask(question, { confirmLabel: "Delete", danger: true }))) {
      return;
    }
    if (ExerciseNotes.save(exerciseName, "")) {
      openNotes.delete(exerciseName);
      renderDraft();
      UI.showToast(`Deleted note for ${exerciseName}`);
    }
  }

  // A small icon: two chain links.
  function linkIcon() {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    for (const path of ["M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1", "M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"]) {
      const shape = document.createElementNS(namespace, "path");
      shape.setAttribute("d", path);
      svg.append(shape);
    }
    return svg;
  }

  function linkButton(exercise) {
    return el(
      "button",
      {
        type: "button",
        class: `link-exercise${exercise.supersetId ? " linked" : ""}`,
        "aria-label": `Superset ${exercise.name} with other exercises`,
        onclick: () => editSuperset(exercise),
      },
      linkIcon(),
    );
  }

  async function editSuperset(exercise) {
    const sourceIndex = draft.exercises.indexOf(exercise);
    const others = draft.exercises.flatMap((other, index) => (index === sourceIndex ? [] : [{ other, index }]));
    if (others.length === 0) {
      UI.showToast("Add another exercise to the workout first.", true);
      return;
    }
    const isLinked = ({ other }) => Boolean(exercise.supersetId) && other.supersetId === exercise.supersetId;
    const picked = await SupersetSheet.open(
      exercise.name,
      others.map((entry) => ({
        name: entry.other.name,
        checked: isLinked(entry),
        inOtherSuperset: Boolean(entry.other.supersetId) && !isLinked(entry),
      })),
    );
    if (picked === null) {
      return;
    }
    const wasLinked = Boolean(exercise.supersetId);
    const chosen = picked.map((position) => others[position]);
    draft.exercises = WorkoutLogic.linkExercises(
      draft.exercises,
      sourceIndex,
      chosen.map(({ index }) => index),
    );
    saveDraft();
    renderDraft();
    if (chosen.length > 0) {
      UI.showToast(`Superset: ${[exercise, ...chosen.map(({ other }) => other)].map((item) => item.name).join(" + ")}`);
    } else if (wasLinked) {
      UI.showToast("Superset removed");
    }
  }

  async function swapExercise(exercise) {
    const choice = await SwapSheet.open(
      exercise,
      allExercises(),
      draft.exercises.map((item) => item.name),
    );
    if (!choice) {
      return;
    }
    const swapped = WorkoutLogic.swapExercise(exercise, choice, lastTimeSets(choice.name), Date.now());
    draft.exercises[draft.exercises.indexOf(exercise)] = swapped;
    RestTimer.renameExercise(exercise.name, choice.name);
    saveDraft();
    renderDraft();
    renderLibrary();
    const finishedCount = swapped.sets.length - WorkoutLogic.ownSets(swapped).length;
    const kept = finishedCount > 0 ? ` ${UI.plural(finishedCount, "finished set")} kept.` : "";
    UI.showToast(`Swapped to ${choice.name}.${kept}`);
  }

  // Shown until every set is finished, when there's nothing left to swap.
  function swapButton(exercise) {
    if (WorkoutLogic.ownSets(exercise).every((set) => set.done)) {
      return null;
    }
    return el(
      "button",
      {
        type: "button",
        class: "swap-button",
        "aria-label": `Swap ${exercise.name} for another exercise`,
        onclick: () => swapExercise(exercise),
      },
      "Swap",
    );
  }

  // "135×10" in the chosen unit.
  function setText(set) {
    return `${UI.formatNumber(Units.fromPounds(set.weight))}×${set.reps}`;
  }

  // The green strip of sets finished before a swap.
  function swappedOutStrip(exercise) {
    return WorkoutLogic.swappedOut(exercise).map((part) =>
      el(
        "div",
        { class: "finished-strip" },
        el("strong", {}, `Finished: ${part.name}`),
        part.sets.map(setText).join(", "),
      ),
    );
  }

  // The green box offering more weight or reps, before the exercise is started,
  // when the last session matched the one before it.
  function progressionBox(exercise) {
    const sets = WorkoutLogic.ownSets(exercise);
    const started = sets.some((set) => set.done || set.startedAt);
    const lastSets = started || exercise.hintClosed ? null : WorkoutLogic.progressionHint(savedWorkouts, exercise.name, exercise.group);
    if (!lastSets) {
      return null;
    }
    const step = Units.weightStep({ dumbbell: isDumbbellExercise(exercise.name) });
    const stepPounds = Units.toPounds(step);
    const preview = (choice) => setText(WorkoutLogic.applyProgression([{}], lastSets, choice, stepPounds)[0]);
    const close = (message) => {
      exercise.hintClosed = true;
      saveDraft();
      renderDraft();
      if (message) {
        UI.showToast(message);
      }
    };
    const choose = (choice, message) => {
      exercise.sets = WorkoutLogic.applyProgression(exercise.sets, lastSets, choice, stepPounds, {
        maxReps: MAX_REPS,
        maxWeight: MAX_WEIGHT_LB,
      });
      close(message);
    };
    const stepText = `${UI.formatNumber(step)} ${Units.current()}`;
    // A bodyweight move has no weight to add to.
    const hasWeight = lastSets.some((set) => set.weight > 0);
    return el(
      "div",
      { class: "progress-hint" },
      el("strong", {}, "You matched last time. Go up?"),
      el(
        "div",
        { class: `progress-hint-buttons${hasWeight ? "" : " single"}` },
        hasWeight
          ? el(
              "button",
              {
                type: "button",
                "aria-label": `Add ${stepText} to ${exercise.name}`,
                onclick: () => choose("weight", `${exercise.name}: ${stepText} more on every set`),
              },
              `+${stepText}`,
              el("small", {}, preview("weight")),
            )
          : null,
        el(
          "button",
          {
            type: "button",
            "aria-label": `Add 1 rep to ${exercise.name}`,
            onclick: () => choose("reps", `${exercise.name}: 1 more rep on every set`),
          },
          "+1 rep",
          el("small", {}, preview("reps")),
        ),
      ),
      el(
        "button",
        {
          type: "button",
          class: "progress-hint-dismiss",
          "aria-label": `Not now for ${exercise.name}`,
          onclick: () => close(),
        },
        "Not now",
      ),
    );
  }

  // One exercise's name, link button, progress, note and actions.
  function exerciseHeader(exercise, index) {
    const noteText = ExerciseNotes.textFor(exercise.name);
    return [
      el(
        "div",
        { class: "exercise-card-header" },
        el("div", { class: "exercise-name-line" }, exerciseNameButton(exercise.name), linkButton(exercise)),
        el("span", { class: "row-meta" }, setsDoneText(exercise)),
        el(
          "div",
          { class: "row-actions" },
          swapButton(exercise),
          warmupButton(exercise),
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
        noteButton(exercise.name, noteText),
      ),
      openNote(exercise.name, noteText),
      progressionBox(exercise),
    ];
  }

  function setLabels() {
    return el(
      "div",
      { class: "set-row set-labels", "aria-hidden": "true" },
      el("span", {}, "Set"),
      el("span", {}, "Last"),
      el("span", {}, Units.current()),
      el("span", {}, "Reps"),
      el("span", {}, "RPE"),
      el("span", {}, ""),
      el("span", {}, ""),
    );
  }

  // Adds a round: one more set for each exercise in the superset.
  function addRound(members) {
    if (members.some((member) => member.sets.length >= MAX_SETS_PER_EXERCISE)) {
      UI.showToast(`An exercise can have at most ${MAX_SETS_PER_EXERCISE} sets.`, true);
      return;
    }
    for (const member of members) {
      const lastSet = member.sets[member.sets.length - 1];
      member.sets.push({ weight: lastSet.weight, reps: lastSet.reps, done: false });
    }
    saveDraft();
    renderDraft();
  }

  // Removes the last round: the last set of each exercise that has one in it.
  function removeRound(members) {
    const roundCount = WorkoutLogic.supersetRoundCount(members);
    for (const member of members) {
      // Sets finished before a swap stay; only the exercise's own sets come off.
      if (member.sets.length === roundCount && !member.sets[roundCount - 1].doneAs) {
        member.sets.pop();
      }
    }
    saveDraft();
    renderDraft();
  }

  // A superset's merged card: each exercise's header, then the sets round by round.
  function renderSupersetCard(members) {
    const roundCount = WorkoutLogic.supersetRoundCount(members);
    const memberIndex = (member) => draft.exercises.indexOf(member);
    const setsInCard = members.flatMap((member) => member.sets);
    const rounds = Array.from({ length: roundCount }, (_, round) => {
      const inRound = members.filter((member) => member.sets[round]);
      const countdown = inRound
        .map((member) => RestTimer.countdownAfter(draft.exercises, memberIndex(member), round))
        .find(Boolean);
      return [
        el("p", { class: "superset-round" }, `Round ${round + 1}`),
        ...inRound.flatMap((member) => {
          const set = member.sets[round];
          if (set.doneAs) {
            return [el("p", { class: "superset-round-done" }, `${set.doneAs.name}: ${setText(set)} ✓`)];
          }
          return [
            el("p", { class: "superset-round-exercise" }, member.name),
            renderSetRow(member, set, round, lastTimeSets(member.name)),
          ];
        }),
        countdown || restLineAfterRound(members[0], round),
      ];
    }).flat();
    return el(
      "li",
      { class: "exercise-card superset-card" },
      el(
        "p",
        { class: "superset-title" },
        "Superset",
        el("span", {}, ` · ${setsInCard.filter((set) => set.done).length}/${setsInCard.length} sets done`),
      ),
      members.map((member) => el("div", { class: "superset-member" }, exerciseHeader(member, memberIndex(member)))),
      setLabels(),
      rounds,
      el(
        "div",
        { class: "set-buttons" },
        el(
          "button",
          { type: "button", class: "add-set", disabled: roundCount === 1, onclick: () => removeRound(members) },
          "− Remove round",
        ),
        el("button", { type: "button", class: "add-set", onclick: () => addRound(members) }, "+ Add round"),
      ),
    );
  }

  function renderExerciseCard(exercise, index) {
    const previousSets = lastTimeSets(exercise.name);
    return el(
      "li",
      { class: "exercise-card" },
      exerciseHeader(exercise, index),
      swappedOutStrip(exercise),
      setLabels(),
      ...exercise.sets.flatMap((set, setIndex) =>
        // A set from before a swap shows in the strip, but its rest may still be running.
        set.doneAs
          ? [RestTimer.countdownAfter(draft.exercises, index, setIndex)]
          : [renderSetRow(exercise, set, setIndex, previousSets), afterSet(exercise, index, setIndex)],
      ),
      el(
        "div",
        { class: "set-buttons" },
        el(
          "button",
          {
            type: "button",
            class: "add-set",
            "aria-label": `Remove the last set of ${exercise.name}`,
            disabled: WorkoutLogic.ownSets(exercise).length === 1,
            onclick: () => removeLastSet(exercise),
          },
          "− Remove set",
        ),
        el("button", { type: "button", class: "add-set", onclick: () => addSet(exercise) }, "+ Add set"),
      ),
    );
  }

  function renderDraft() {
    if (draft.exercises.length === 0) {
      draftList.replaceChildren(
        el("li", { class: "empty" }, "No exercises yet. Tap Add on any exercise in the list."),
      );
    } else {
      const drawnSupersets = new Set();
      const cards = draft.exercises.flatMap((exercise, index) => {
        if (!exercise.supersetId) {
          return [renderExerciseCard(exercise, index)];
        }
        if (drawnSupersets.has(exercise.supersetId)) {
          return [];
        }
        drawnSupersets.add(exercise.supersetId);
        return [renderSupersetCard(WorkoutLogic.supersetMembers(draft.exercises, exercise.supersetId))];
      });
      draftList.replaceChildren(...cards);
    }
    RestTimer.stopIfNotShown();
    updateDraftSummary();
  }

  function countSets() {
    const allSets = draft.exercises.flatMap((exercise) => exercise.sets);
    return { done: allSets.filter((set) => set.done).length, total: allSets.length };
  }

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

  // The blue tile at the top: duration, calories and load so far, and one
  // segment per set that fills in as sets are finished.
  function updateDraftSummary() {
    const load = WorkoutLogic.workoutLoad(draft.exercises);
    const minutes = WorkoutLogic.workoutMinutes(draft.exercises, Date.now());
    const bodyweight = knownBodyweight();
    // Without a bodyweight there is no estimate; the Plan page asks for it.
    const calories = bodyweight ? `${UI.formatNumber(caloriesFor(minutes, bodyweight))} kcal` : "– kcal";
    draftMinutes.textContent = minutes;
    draftTotals.textContent = `${calories} · ${Units.format(load, { whole: true })}`;
    const sets = countSets();
    draftSetsDone.textContent = `${sets.done} of ${UI.plural(sets.total, "set")}`;
    draftSegments.style.gridTemplateColumns = `repeat(${Math.max(sets.total, 1)}, minmax(0, 1fr))`;
    draftSegments.replaceChildren(
      ...allSets().map((set) => el("span", { class: set.done ? "filled" : "" })),
    );
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

  async function saveWorkout() {
    const sets = countSets();
    if (sets.done === 0) {
      UI.showToast("Finish at least one set (tap Start, then End) before saving.", true);
      return;
    }
    const invalidSet = findInvalidSet();
    if (invalidSet) {
      const limits = `reps must be 1–${MAX_REPS}, weight 0–${Units.format(MAX_WEIGHT_LB)}`;
      UI.showToast(`Check ${invalidSet}: ${limits}.`, true);
      return;
    }
    const unfinished = sets.total - sets.done;
    const unfinishedMessage = `${UI.plural(unfinished, "set")} not checked off won't be saved. Save anyway?`;
    if (unfinished > 0 && !(await UI.ask(unfinishedMessage, { confirmLabel: "Save anyway" }))) {
      return;
    }
    // Workouts saved without ending every set haven't been asked for an RPE yet.
    if (!draft.rpeAsked) {
      await askEndOfWorkoutQuestions();
    }
    // Only finished sets are saved, under the exercise each was done as.
    const finishedExercises = WorkoutLogic.finishedExercises(draft.exercises);
    const today = UI.todayKey();
    const workout = {
      id: Date.now(),
      date: today,
      name: draft.name.trim() || `Workout on ${UI.formatDate(today)}`,
      exercises: finishedExercises,
      load: WorkoutLogic.workoutLoad(finishedExercises),
    };
    if (draft.rpe) {
      workout.rpe = draft.rpe;
    }
    // Time covers the whole session, including a set left unfinished.
    workout.minutes = WorkoutLogic.workoutMinutes(draft.exercises, Date.now());
    const bodyweight = knownBodyweight();
    workout.calories = bodyweight ? caloriesFor(workout.minutes, bodyweight) : 0;
    if (!Store.write(KEYS.workouts, [workout, ...savedWorkouts])) {
      UI.showSaveError();
      return;
    }
    const newRecords = WorkoutLogic.recordsBroken(savedWorkouts, [workout, ...savedWorkouts]);
    savedWorkouts = [workout, ...savedWorkouts];
    logWorkoutCalories(workout);
    const checkedIn = RpeCheckIn.countToday();
    RestTimer.stop();
    draft = { name: "", exercises: [] };
    nameInput.value = "";
    saveDraft();
    renderDraft();
    renderLibrary();
    renderSaved();
    const burned = workout.calories ? ` · ~${UI.formatNumber(workout.calories)} cal burned` : "";
    const streak = checkedIn ? " · streak updated" : "";
    const saved = `Workout saved: ${Units.format(workout.load, { whole: true })} load${burned}${streak}`;
    UI.showToast(newRecords.length > 0 ? `${recordsMessage(newRecords)} · ${saved}` : saved);
  }

  // "New record: Bench Press 185×6", or the lifts' names when there are several.
  function recordsMessage(newRecords) {
    if (newRecords.length > 1) {
      return `New records: ${newRecords.map((record) => record.name).join(", ")}`;
    }
    const [record] = newRecords;
    const set =
      record.kind === "weight"
        ? `${UI.formatNumber(Units.fromPounds(record.set.weight))}×${record.set.reps}`
        : `${record.best} reps`;
    return `New record: ${record.name} ${set}`;
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

  function showRoutineTab(tabName) {
    const isPremade = tabName === "premade";
    myRoutinesTab.setAttribute("aria-selected", String(!isPremade));
    premadeTab.setAttribute("aria-selected", String(isPremade));
    document.getElementById("panel-my-routines").hidden = isPremade;
    document.getElementById("panel-premade").hidden = !isPremade;
  }

  // A premade day as a routine: its sets and reps, with weights from the last
  // time each exercise was logged (or 0 the first time).
  function premadeDayAsRoutine(day) {
    return {
      name: day.name,
      exercises: day.exercises.map((exercise) => {
        const previous = lastTimeSets(exercise.name) || [];
        const libraryEntry = EXERCISE_LIBRARY.find((item) => item.name === exercise.name);
        return {
          name: exercise.name,
          group: libraryEntry ? libraryEntry.group : WorkoutLogic.guessMuscleGroup(exercise.name),
          sets: Array.from({ length: exercise.sets }, (_, index) => ({
            weight: (previous[index] || previous[previous.length - 1] || { weight: 0 }).weight,
            reps: exercise.reps,
          })),
        };
      }),
    };
  }

  function renderPremade() {
    premadeList.replaceChildren(
      ...PREMADE_PROGRAMS.map((program) =>
        el(
          "section",
          { class: "premade-program" },
          el("h3", {}, program.name),
          el("p", { class: "muted premade-description" }, program.description),
          ...program.days.map((day) =>
            el(
              "div",
              { class: "premade-day" },
              el(
                "div",
                { class: "premade-day-header" },
                el("span", { class: "row-title" }, day.name),
                el(
                  "button",
                  {
                    type: "button",
                    class: "button small",
                    "aria-label": `Start ${day.name}`,
                    onclick: () => startRoutine(premadeDayAsRoutine(day)),
                  },
                  "Start",
                ),
              ),
              el(
                "ul",
                { class: "premade-exercises" },
                ...day.exercises.map((exercise) =>
                  el(
                    "li",
                    {},
                    el("span", {}, exercise.name),
                    el("span", { class: "premade-sets" }, `${exercise.sets} × ${exercise.reps}`),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  async function saveRoutine() {
    const name = draft.name.trim() || `Workout on ${UI.formatDate(UI.todayKey())}`;
    const existing = routines.find((routine) => routine.name.toLowerCase() === name.toLowerCase());
    const replaceQuestion = `Replace your "${existing?.name}" routine with this workout?`;
    if (existing && !(await UI.ask(replaceQuestion, { confirmLabel: "Replace" }))) {
      return;
    }
    const routine = {
      name,
      exercises: draft.exercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        ...(exercise.supersetId ? { supersetId: exercise.supersetId } : {}),
        sets: WorkoutLogic.ownSets(exercise).map((set) => ({ weight: set.weight, reps: set.reps })),
      })),
    };
    const updated = [routine, ...routines.filter((item) => item !== existing)];
    if (!Store.write(KEYS.routines, updated)) {
      UI.showSaveError();
      return;
    }
    routines = updated;
    renderRoutines();
    showRoutineTab("mine");
    UI.showToast(existing ? `Updated routine "${name}"` : `Saved routine "${name}"`);
  }

  // Fills the workout with the routine's exercises and sets, ready to log.
  async function startRoutine(routine) {
    const question = `Replace your current workout with "${routine.name}"?`;
    if (draft.exercises.length > 0 && !(await UI.ask(question, { confirmLabel: "Replace" }))) {
      return;
    }
    draft = {
      name: routine.name,
      exercises: routine.exercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        ...(exercise.supersetId ? { supersetId: exercise.supersetId } : {}),
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

  async function deleteRoutine(routine) {
    const question = `Delete the "${routine.name}" routine? Workouts you've saved stay.`;
    if (!(await UI.ask(question, { confirmLabel: "Delete", danger: true }))) {
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

  async function clearWorkout() {
    const question = "Clear this workout? The exercises you added will be removed.";
    if (!(await UI.ask(question, { confirmLabel: "Clear", danger: true }))) {
      return;
    }
    draft = { name: "", exercises: [] };
    nameInput.value = "";
    saveDraft();
    renderDraft();
    renderLibrary();
  }

  // Removes a saved workout and the calories-burned entry it added. Returns
  // true on success. The caller has already asked the user to confirm.
  function removeSavedWorkout(id) {
    const remaining = savedWorkouts.filter((workout) => workout.id !== id);
    if (!Store.write(KEYS.workouts, remaining)) {
      UI.showSaveError();
      return false;
    }
    savedWorkouts = remaining;
    const calorieEntries = Store.read(KEYS.calories, []);
    Store.write(KEYS.calories, calorieEntries.filter((entry) => entry.workoutId !== id));
    afterHistoryChange();
    UI.showToast("Workout deleted");
    return true;
  }

  async function deleteWorkout(id) {
    if (await UI.ask("Delete this saved workout?", { confirmLabel: "Delete", danger: true })) {
      removeSavedWorkout(id);
    }
  }

  // Saves an edited workout from the history editor. Returns true on success.
  function updateSavedWorkout(updated) {
    const workouts = savedWorkouts.map((workout) => (workout.id === updated.id ? updated : workout));
    if (!Store.write(KEYS.workouts, workouts)) {
      UI.showSaveError();
      return false;
    }
    savedWorkouts = workouts;
    afterHistoryChange();
    UI.showToast(`Saved changes to ${updated.name}`);
    return true;
  }

  // History feeds the "Last" column and the saved list, so redraw them.
  function afterHistoryChange() {
    renderSaved();
    renderDraft();
  }

  function openWorkout(workout) {
    WorkoutEditor.open(workout, { onSave: updateSavedWorkout, onDelete: removeSavedWorkout });
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
            "button",
            {
              type: "button",
              class: "saved-workout-open",
              "aria-label": `View and edit ${workout.name}, ${UI.formatDate(workout.date)}`,
              onclick: () => openWorkout(workout),
            },
            el(
              "span",
              { class: "row-title" },
              workout.name,
              el("span", { class: "meal-chevron", "aria-hidden": "true" }, "›"),
            ),
            el(
              "span",
              { class: "row-meta" },
              `${UI.formatDate(workout.date)} · ${UI.plural(workout.exercises.length, "exercise")} · ` +
                `${UI.plural(countSavedSets(workout), "set")} · ${Units.format(workout.load, { whole: true })} load` +
                (workout.minutes ? ` · ${workout.minutes} min` : "") +
                (workout.calories ? ` · ~${UI.formatNumber(workout.calories)} cal` : "") +
                (workout.rpe ? ` · RPE ${workout.rpe}` : ""),
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

  RestTimer.connect({
    // Where a countdown ends: the rest line, if there's another set after it.
    replacementFor: (timer) => {
      const exercise = draft.exercises.find((item) => item.name === timer.exerciseName);
      return exercise ? restLineAfterRound(exercise, timer.setIndex) : null;
    },
    onSecondsChanged: updateRestLines,
  });
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
  renderPremade();
  myRoutinesTab.addEventListener("click", () => showRoutineTab("mine"));
  premadeTab.addEventListener("click", () => showRoutineTab("premade"));
  // New users have no routines of their own yet, so start them on the premade ones.
  showRoutineTab(routines.length > 0 ? "mine" : "premade");
  // Keep the duration and calorie estimate current while a workout is going.
  setInterval(() => {
    if (draft.exercises.length > 0) {
      updateDraftSummary();
    }
  }, 15000);
})();
