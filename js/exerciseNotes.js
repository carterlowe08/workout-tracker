// Notes per exercise ("seat on 4", "left shoulder felt off"). The end of a
// workout offers to add them, one exercise at a time, and the workout page
// shows them the next time the exercise comes up.
const ExerciseNotes = (() => {
  const { KEYS } = Store;
  const { el } = UI;

  function readNotes() {
    return Store.read(KEYS.exerciseNotes, {});
  }

  function textFor(exerciseName) {
    return WorkoutLogic.exerciseNote(readNotes(), exerciseName);
  }

  // Blank text removes the note. Returns true on success.
  function save(exerciseName, text) {
    const saved = Store.write(KEYS.exerciseNotes, WorkoutLogic.withExerciseNote(readNotes(), exerciseName, text));
    if (!saved) {
      UI.showSaveError();
    }
    return saved;
  }

  // One exercise's step. Resolves to true if a note was saved.
  // An existing note starts in the box, so it can be kept, changed or cleared.
  function askForExercise(exerciseName, stepNumber, stepCount) {
    return new Promise((resolve) => {
      const previousText = textFor(exerciseName);
      const box = el("textarea", {
        maxlength: String(WorkoutLogic.MAX_NOTE_LENGTH),
        placeholder: "e.g. seat on 4, left shoulder felt off",
        "aria-label": `Note for ${exerciseName}`,
      });
      box.value = previousText;
      let savedNote = false;
      const nextButton = el("button", { type: "button", class: "button" }, stepNumber === stepCount ? "Done" : "Next");
      const skipButton = el("button", { type: "button", class: "button-secondary" }, "Skip");
      const sheet = el(
        "dialog",
        { class: "sheet note-sheet", "aria-labelledby": "note-sheet-title" },
        el("p", { class: "note-sheet-step" }, `${stepNumber} of ${stepCount}`),
        el("h2", { id: "note-sheet-title" }, exerciseName),
        box,
        el("div", { class: "sheet-footer button-row" }, nextButton, skipButton),
      );
      // Every way out ends here, so the workout can never get stuck on this sheet.
      // It runs directly from the buttons; browsers may delay or skip the close event.
      function finish() {
        if (sheet.open) {
          sheet.close();
        }
        sheet.remove();
        resolve(savedNote);
      }
      nextButton.addEventListener("click", () => {
        const text = box.value.trim();
        savedNote = Boolean(text) && text !== previousText && save(exerciseName, text);
        if (!text && previousText) {
          save(exerciseName, "");
        }
        finish();
      });
      skipButton.addEventListener("click", finish);
      // Escape skips, unless it would throw away something typed.
      sheet.addEventListener("cancel", (event) => {
        event.preventDefault();
        if (box.value === previousText) {
          finish();
        }
      });
      sheet.addEventListener("close", finish);
      document.body.append(sheet);
      sheet.showModal();
      box.focus();
    });
  }

  // Offers to add notes for these exercises. Resolves to how many were saved.
  async function askForWorkout(exerciseNames) {
    if (exerciseNames.length === 0) {
      return 0;
    }
    const wantsNote = await UI.ask("Add note? Save a reminder for next time.", {
      confirmLabel: "Add note",
      cancelLabel: "No thanks",
    });
    if (!wantsNote) {
      return 0;
    }
    let savedCount = 0;
    for (const [index, exerciseName] of exerciseNames.entries()) {
      if (await askForExercise(exerciseName, index + 1, exerciseNames.length)) {
        savedCount += 1;
      }
    }
    return savedCount;
  }

  return { textFor, save, askForWorkout };
})();
