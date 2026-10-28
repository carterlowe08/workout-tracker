// End-of-workout check-in: a sheet that asks "How hard was it today?" with
// RPE 1–10 described top to bottom, and saves the answer as today's check-in
// (the same one the Streak page shows and counts toward the streak).
const RpeCheckIn = (() => {
  const { KEYS } = Store;
  const { el } = UI;
  const RPES = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  // Purple from dim to bright as RPE rises, like the Streak calendar.
  function shadeStyle(rpe) {
    const lightness = 22 + rpe * 5;
    const text = rpe >= 9 ? "#150f26" : "#ffffff";
    return `--shade: hsl(256 60% ${lightness}%); --shade-text: ${text}`;
  }

  let selected = null;
  let answerPending = null;

  const subtitle = el("p", { class: "rpe-sheet-sub", id: "rpe-sheet-sub" });
  const rows = RPES.map((rpe) =>
    el(
      "button",
      {
        type: "button",
        class: "rpe-option",
        "aria-pressed": "false",
        "data-rpe": String(rpe),
        style: shadeStyle(rpe),
        onclick: () => select(rpe),
      },
      el("span", { class: "rpe-option-number" }, String(rpe)),
      el(
        "span",
        { class: "rpe-option-words" },
        WorkoutLogic.rpeLabel(rpe),
        el("small", {}, WorkoutLogic.rpeHint(rpe)),
      ),
    ),
  );
  const saveButton = el("button", { type: "button", class: "button", disabled: true }, "Save RPE");
  const skipButton = el("button", { type: "button", class: "button-secondary" }, "Skip");
  const sheet = el(
    "dialog",
    { class: "sheet rpe-sheet", "aria-labelledby": "rpe-sheet-title", "aria-describedby": "rpe-sheet-sub" },
    el("h2", { id: "rpe-sheet-title" }, "How hard was it today?"),
    subtitle,
    el("div", { class: "rpe-options", role: "group", "aria-label": "RPE, 10 is hardest" }, rows),
    el("div", { class: "sheet-footer button-row" }, saveButton, skipButton),
  );
  document.body.append(sheet);

  function select(rpe) {
    selected = rpe;
    for (const row of rows) {
      row.setAttribute("aria-pressed", String(Number(row.dataset.rpe) === rpe));
    }
    saveButton.disabled = false;
    saveButton.textContent = `Save RPE ${rpe}`;
  }

  function answer(rpe) {
    sheet.close();
    const resolve = answerPending;
    answerPending = null;
    resolve?.(rpe);
  }

  saveButton.addEventListener("click", () => answer(selected));
  skipButton.addEventListener("click", () => answer(null));
  // Escape and the dimmed area outside the sheet count as Skip.
  sheet.addEventListener("cancel", (event) => {
    event.preventDefault();
    answer(null);
  });
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) {
      answer(null);
    }
  });

  // Opens the sheet; resolves to the chosen RPE, or null if skipped.
  // A check-in already made today starts selected, so a second workout can keep it.
  function ask(summary) {
    const todayCheckIn = Store.read(KEYS.checkIns, {})[UI.todayKey()];
    subtitle.textContent = todayCheckIn
      ? `${summary} · Today's RPE so far is ${todayCheckIn.rpe}`
      : summary;
    selected = null;
    saveButton.disabled = true;
    saveButton.textContent = "Save RPE";
    for (const row of rows) {
      row.setAttribute("aria-pressed", "false");
    }
    if (todayCheckIn) {
      select(todayCheckIn.rpe);
    }
    sheet.showModal();
    sheet.scrollTop = 0;
    (todayCheckIn ? rows[RPES.indexOf(todayCheckIn.rpe)] : rows[0]).focus();
    return new Promise((resolve) => {
      answerPending = resolve;
    });
  }

  // Saves today's check-in, keeping a note written on the Streak page. Returns true on success.
  function saveToday(rpe) {
    const checkIns = Store.read(KEYS.checkIns, {});
    const today = UI.todayKey();
    const note = checkIns[today] ? checkIns[today].note : "";
    return Store.write(KEYS.checkIns, { ...checkIns, [today]: { rpe, note } });
  }

  return { ask, saveToday };
})();
