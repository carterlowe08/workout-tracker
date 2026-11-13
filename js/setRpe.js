// RPE for one set: a small sheet with 6–10 in a row, each with how many reps
// were left under it ("2 left"). One tap picks; Clear removes a set's RPE.
const SetRpe = (() => {
  const { el } = UI;

  let answerPending = null;

  const title = el("h2", { id: "set-rpe-title" });
  const subtitle = el("p", { class: "rpe-sheet-sub" });
  const choices = WorkoutLogic.SET_RPES.map((rpe) =>
    el(
      "button",
      {
        type: "button",
        class: "set-rpe-choice",
        "aria-pressed": "false",
        "data-rpe": String(rpe),
        "aria-label": `RPE ${rpe}, ${WorkoutLogic.repsLeftLabel(rpe)}`,
        onclick: () => answer({ rpe }),
      },
      el("span", { class: "set-rpe-number" }, String(rpe)),
      el("small", {}, WorkoutLogic.repsLeftLabel(rpe)),
    ),
  );
  const clearButton = el(
    "button",
    { type: "button", class: "button-secondary", onclick: () => answer({ rpe: null }) },
    "Clear",
  );
  const cancelButton = el(
    "button",
    { type: "button", class: "button-secondary", onclick: () => answer(null) },
    "Cancel",
  );
  const sheet = el(
    "dialog",
    { class: "sheet rpe-sheet set-rpe-sheet", "aria-labelledby": "set-rpe-title" },
    title,
    subtitle,
    el("div", { class: "set-rpe-choices", role: "group", "aria-label": "RPE, 10 is hardest" }, choices),
    el("div", { class: "sheet-footer button-row" }, clearButton, cancelButton),
  );
  document.body.append(sheet);

  function answer(result) {
    sheet.close();
    const resolve = answerPending;
    answerPending = null;
    resolve?.(result);
  }

  // Escape and the dimmed area outside the sheet count as Cancel.
  sheet.addEventListener("cancel", (event) => {
    event.preventDefault();
    answer(null);
  });
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) {
      answer(null);
    }
  });

  // Opens the sheet for one set. Resolves to { rpe } (a number, or null after
  // Clear), or to null if cancelled so nothing changes.
  function ask(exerciseName, setNumber, currentRpe) {
    title.textContent = `How hard was set ${setNumber}?`;
    subtitle.textContent = `${exerciseName} · reps left in the tank`;
    const current = WorkoutLogic.setRpe(currentRpe);
    for (const choice of choices) {
      choice.setAttribute("aria-pressed", String(Number(choice.dataset.rpe) === current));
    }
    clearButton.hidden = current === null;
    sheet.showModal();
    (current ? choices[WorkoutLogic.SET_RPES.indexOf(current)] : choices[2]).focus();
    return new Promise((resolve) => {
      answerPending = resolve;
    });
  }

  // The RPE box on a set row: shows the set's RPE (or "–") and opens the sheet.
  // onChange runs after a new RPE is kept on the set.
  function box(set, exerciseName, setNumber, onChange) {
    const setName = `${exerciseName} set ${setNumber}`;
    const button = el("button", { type: "button", class: "set-rpe" });
    function show() {
      const rpe = WorkoutLogic.setRpe(set.rpe);
      button.textContent = rpe ? String(rpe) : "–";
      button.classList.toggle("empty", rpe === null);
      button.setAttribute("aria-label", rpe ? `${setName} RPE ${rpe}, change` : `Add RPE for ${setName}`);
    }
    button.addEventListener("click", async () => {
      const result = await ask(exerciseName, setNumber, set.rpe);
      if (!result) {
        return;
      }
      if (result.rpe === null) {
        delete set.rpe;
      } else {
        set.rpe = result.rpe;
      }
      show();
      onChange();
    });
    show();
    return button;
  }

  return { ask, box };
})();
