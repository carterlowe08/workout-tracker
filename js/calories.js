// Calories page: estimate calories from activity, minutes and bodyweight,
// and keep a history of entries.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  let entries = Store.read(KEYS.calories, []);

  const form = document.getElementById("calorie-form");
  const activitySelect = document.getElementById("activity");
  const minutesInput = document.getElementById("minutes");
  const bodyweightInput = document.getElementById("bodyweight");
  const minutesError = document.getElementById("minutes-error");
  const bodyweightError = document.getElementById("bodyweight-error");
  const estimatePreview = document.getElementById("estimate-preview");
  const todayTotal = document.getElementById("calories-today");
  const weekTotal = document.getElementById("calories-week");
  const list = document.getElementById("calorie-list");

  function readMinutes() {
    const minutes = Number(minutesInput.value);
    return Number.isInteger(minutes) && minutes >= 1 && minutes <= 600 ? minutes : null;
  }

  function readBodyweight() {
    const bodyweight = Number(bodyweightInput.value);
    return bodyweightInput.value !== "" && bodyweight >= 50 && bodyweight <= 700 ? bodyweight : null;
  }

  function setError(input, errorElement, message) {
    errorElement.textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function updatePreview() {
    const minutes = readMinutes();
    const bodyweight = readBodyweight();
    if (minutes === null || bodyweight === null) {
      estimatePreview.textContent = "Enter minutes and bodyweight to see an estimate.";
      return;
    }
    const calories = WorkoutLogic.estimateCalories(activitySelect.value, bodyweight, minutes);
    estimatePreview.textContent = `Estimated: about ${UI.formatNumber(calories)} kcal`;
  }

  function renderTotals() {
    const today = UI.todayKey();
    const weekStart = WorkoutLogic.addDays(today, -6);
    const sum = (filtered) => filtered.reduce((total, entry) => total + entry.calories, 0);
    todayTotal.textContent = UI.formatNumber(sum(entries.filter((entry) => entry.date === today)));
    weekTotal.textContent = UI.formatNumber(sum(entries.filter((entry) => entry.date >= weekStart)));
  }

  function renderList() {
    if (entries.length === 0) {
      list.replaceChildren(el("li", { class: "empty" }, "Nothing logged yet. Log your first activity above."));
      return;
    }
    list.replaceChildren(
      ...entries.map((entry) =>
        el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el("span", { class: "row-title" }, `${entry.activity} · ${UI.formatNumber(entry.calories)} kcal`),
            el(
              "span",
              { class: "row-meta" },
              [UI.formatDate(entry.date), `${entry.minutes} min`, entry.workoutName ? `from ${entry.workoutName}` : null]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
          el(
            "button",
            {
              type: "button",
              class: "link-button",
              "aria-label": `Delete ${entry.activity} entry`,
              onclick: () => deleteEntry(entry.id),
            },
            "Delete",
          ),
        ),
      ),
    );
  }

  async function deleteEntry(id) {
    if (!(await UI.ask("Delete this exercise entry?", { confirmLabel: "Delete", danger: true }))) {
      return;
    }
    const remaining = entries.filter((entry) => entry.id !== id);
    if (!Store.write(KEYS.calories, remaining)) {
      UI.showSaveError();
      return;
    }
    entries = remaining;
    renderTotals();
    renderList();
    UI.showToast("Entry deleted");
  }

  function logEntry(event) {
    event.preventDefault();
    const minutes = readMinutes();
    const bodyweight = readBodyweight();
    setError(minutesInput, minutesError, minutes === null ? "Enter whole minutes from 1 to 600." : "");
    setError(bodyweightInput, bodyweightError, bodyweight === null ? "Enter a weight from 50 to 700 lb." : "");
    if (minutes === null || bodyweight === null) {
      return;
    }
    const entry = {
      id: Date.now(),
      date: UI.todayKey(),
      activity: activitySelect.value,
      minutes,
      calories: WorkoutLogic.estimateCalories(activitySelect.value, bodyweight, minutes),
    };
    if (!Store.write(KEYS.calories, [entry, ...entries])) {
      UI.showSaveError();
      return;
    }
    entries = [entry, ...entries];
    Store.write(KEYS.bodyweight, bodyweight);
    minutesInput.value = "";
    updatePreview();
    renderTotals();
    renderList();
    UI.showToast(`Logged ${UI.formatNumber(entry.calories)} kcal`);
  }

  activitySelect.replaceChildren(
    ...Object.keys(WorkoutLogic.MET_VALUES).map((activity) => el("option", { value: activity }, activity)),
  );
  const savedBodyweight = Store.read(KEYS.bodyweight, null);
  if (savedBodyweight !== null) {
    bodyweightInput.value = savedBodyweight;
  }

  [activitySelect, minutesInput, bodyweightInput].forEach((input) =>
    input.addEventListener("input", updatePreview),
  );
  // Clear a field's error as soon as its value becomes valid.
  minutesInput.addEventListener("input", () => {
    if (readMinutes() !== null) setError(minutesInput, minutesError, "");
  });
  bodyweightInput.addEventListener("input", () => {
    if (readBodyweight() !== null) setError(bodyweightInput, bodyweightError, "");
  });
  form.addEventListener("submit", logEntry);

  updatePreview();
  renderTotals();
  renderList();
})();
