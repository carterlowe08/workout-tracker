// Workout history editor: a sheet that shows every exercise and set of a
// saved workout and lets the user change weights, reps and sets, then save the
// changes or delete the workout. Edits happen on a copy, so nothing changes
// until "Save changes" is tapped.
const WorkoutEditor = (() => {
  const { el } = UI;
  const MAX_REPS = 500;
  const MAX_WEIGHT_LB = 2000;
  const MAX_SETS = 20;

  let editing = null; // the working copy of the workout
  let openedAs = ""; // the copy as JSON when the sheet opened, to tell whether anything changed
  let callbacks = {};

  // ----- Sheet layout -----

  const title = el("h2", { id: "editor-title" });
  const meta = el("p", { class: "muted editor-meta" });
  const summary = el("p", { class: "editor-summary", "aria-live": "polite" });
  const exerciseList = el("div", { class: "exercise-cards editor-exercises" });
  const errorText = el("p", { class: "field-error", "aria-live": "polite" });
  const saveButton = el("button", { type: "button", class: "button" }, "Save changes");
  const cancelButton = el("button", { type: "button", class: "button-secondary" }, "Cancel");
  const deleteButton = el("button", { type: "button", class: "link-button editor-delete" }, "Delete workout");

  const dialog = el(
    "dialog",
    { class: "sheet", "aria-labelledby": "editor-title" },
    el(
      "div",
      { class: "sheet-header" },
      title,
      el("button", { type: "button", class: "sheet-close", "aria-label": "Close", onclick: requestClose }, "×"),
    ),
    meta,
    summary,
    exerciseList,
    deleteButton,
    // Kept at the bottom of the sheet while scrolling, so Save is always in reach.
    el("div", { class: "sheet-footer" }, errorText, el("div", { class: "button-row" }, saveButton, cancelButton)),
  );
  document.body.append(dialog);

  const hasChanges = () => editing !== null && JSON.stringify(editing) !== openedAs;

  // ----- Converting saved workouts -----

  // A copy that is safe to edit. Workouts saved before per-set logging store
  // { sets: 3, reps: 10, weight: 135 }; those become three rows of sets.
  function editableCopy(workout) {
    return {
      ...workout,
      exercises: workout.exercises.map((exercise) => ({
        name: exercise.name,
        group: exercise.group,
        sets: Array.isArray(exercise.sets)
          ? exercise.sets.map((set) => ({ weight: set.weight, reps: set.reps, done: true }))
          : Array.from({ length: Math.max(1, Math.round(exercise.sets) || 1) }, () => ({
              weight: exercise.weight || 0,
              reps: exercise.reps || 0,
              done: true,
            })),
      })),
    };
  }

  // ----- Drawing the sheet -----

  // Weight is shown and typed in the chosen unit (lb or kg) but kept in pounds.
  function numberBox(set, field, label) {
    const isWeight = field === "weight";
    const input = el("input", {
      type: "number",
      inputmode: "decimal",
      min: "0",
      step: isWeight ? String(Units.weightStep()) : "any",
      value: String(isWeight ? Units.fromPounds(set[field]) : set[field]),
      "aria-label": label,
    });
    input.addEventListener("input", () => {
      const value = Number(input.value);
      const typed = input.value === "" || Number.isNaN(value) ? 0 : value;
      set[field] = isWeight ? Units.toPounds(typed) : typed;
      input.setAttribute("aria-invalid", "false");
      errorText.textContent = "";
      updateSummary();
    });
    input.addEventListener("focus", () => setTimeout(() => input.select(), 0));
    return input;
  }

  function renderSetRow(exercise, set, setIndex) {
    const setName = `${exercise.name} set ${setIndex + 1}`;
    return el(
      "div",
      { class: "history-set-row" },
      el("span", { class: "set-number" }, String(setIndex + 1)),
      numberBox(set, "weight", `${setName} weight in ${Units.current()}`),
      numberBox(set, "reps", `${setName} reps`),
      el(
        "button",
        {
          type: "button",
          class: "set-remove",
          "aria-label": `Remove ${setName}`,
          disabled: exercise.sets.length === 1,
          onclick: () => {
            exercise.sets.splice(setIndex, 1);
            render();
          },
        },
        "×",
      ),
    );
  }

  function renderExercise(exercise, index) {
    return el(
      "div",
      { class: "exercise-card" },
      el(
        "div",
        { class: "exercise-card-header" },
        el(
          "div",
          {},
          el("span", { class: "row-title" }, exercise.name),
          el("span", { class: "row-meta" }, `${exercise.group} · ${UI.plural(exercise.sets.length, "set")}`),
        ),
        el(
          "button",
          {
            type: "button",
            class: "link-button",
            "aria-label": `Remove ${exercise.name} from this workout`,
            onclick: () => {
              editing.exercises.splice(index, 1);
              render();
            },
          },
          "Remove",
        ),
      ),
      el(
        "div",
        { class: "history-set-row set-labels", "aria-hidden": "true" },
        el("span", {}, "Set"),
        el("span", {}, Units.current()),
        el("span", {}, "Reps"),
        el("span", {}),
      ),
      ...exercise.sets.map((set, setIndex) => renderSetRow(exercise, set, setIndex)),
      el(
        "button",
        {
          type: "button",
          class: "add-set",
          disabled: exercise.sets.length >= MAX_SETS,
          onclick: () => {
            // A new set starts with the same weight and reps as the last one.
            const last = exercise.sets[exercise.sets.length - 1];
            exercise.sets.push({ weight: last.weight, reps: last.reps, done: true });
            render();
          },
        },
        "+ Add set",
      ),
    );
  }

  function updateSummary() {
    const exercises = editing.exercises;
    const setCount = exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    const load = WorkoutLogic.workoutLoad(exercises);
    summary.textContent =
      exercises.length === 0
        ? "No exercises left. Delete the workout instead, or Cancel to keep it as it was."
        : `${UI.plural(exercises.length, "exercise")} · ${UI.plural(setCount, "set")} · ` +
          `${Units.format(load, { whole: true })} load`;
    saveButton.disabled = exercises.length === 0;
  }

  function render() {
    exerciseList.replaceChildren(...editing.exercises.map(renderExercise));
    errorText.textContent = "";
    updateSummary();
  }

  // ----- Saving, closing and deleting -----

  // The first box with a number out of range: its exercise, set number and field, or null.
  function findInvalidSet() {
    for (const exercise of editing.exercises) {
      for (const [index, set] of exercise.sets.entries()) {
        if (!(set.reps >= 1 && set.reps <= MAX_REPS)) {
          return { exercise, index, field: "reps" };
        }
        if (!(set.weight >= 0 && set.weight <= MAX_WEIGHT_LB)) {
          return { exercise, index, field: "weight" };
        }
      }
    }
    return null;
  }

  function save() {
    const invalid = findInvalidSet();
    if (invalid) {
      const name = `${invalid.exercise.name} set ${invalid.index + 1}`;
      errorText.textContent =
        `Check ${name}: reps must be 1–${MAX_REPS} and weight 0–${Units.format(MAX_WEIGHT_LB)}.`;
      const label = invalid.field === "reps" ? `${name} reps` : `${name} weight in ${Units.current()}`;
      const box = dialog.querySelector(`[aria-label="${label}"]`);
      box?.setAttribute("aria-invalid", "true");
      box?.focus();
      return;
    }
    if (!hasChanges()) {
      dialog.close();
      return;
    }
    const updated = { ...editing, load: WorkoutLogic.workoutLoad(editing.exercises) };
    if (callbacks.onSave(updated)) {
      editing = null;
      dialog.close();
    }
  }

  async function requestClose() {
    const question = "Discard your changes to this workout?";
    if (hasChanges() && !(await UI.ask(question, { confirmLabel: "Discard", danger: true }))) {
      return;
    }
    editing = null;
    dialog.close();
  }

  async function deleteWorkout() {
    const question = `Delete "${editing.name}" from your history? This can't be undone.`;
    if (!(await UI.ask(question, { confirmLabel: "Delete", danger: true }))) {
      return;
    }
    if (callbacks.onDelete(editing.id)) {
      editing = null;
      dialog.close();
    }
  }

  saveButton.addEventListener("click", save);
  cancelButton.addEventListener("click", requestClose);
  deleteButton.addEventListener("click", deleteWorkout);
  // The Escape key and the dimmed area outside the sheet also ask before discarding changes.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      requestClose();
    }
  });

  // Opens a saved workout. onSave(updatedWorkout) and onDelete(id) return
  // true when they succeed, so the sheet only closes once the change is saved.
  function open(workout, { onSave, onDelete }) {
    callbacks = { onSave, onDelete };
    editing = editableCopy(workout);
    openedAs = JSON.stringify(editing);
    title.textContent = workout.name;
    meta.textContent = [
      UI.formatDate(workout.date),
      workout.minutes ? `${workout.minutes} min` : null,
      workout.calories ? `~${UI.formatNumber(workout.calories)} cal burned` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    render();
    dialog.showModal();
  }

  return { open };
})();
