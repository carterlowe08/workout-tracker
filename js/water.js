// Water tracker on the Calories page: quick-add a glass or bottle (or any
// amount), see today's ounces against a daily goal, and undo the last entry.
(() => {
  const { KEYS } = Store;

  const DEFAULT_GOAL_OUNCES = 100;
  const LIMITS = {
    add: { min: 1, max: 128, label: "Ounces to add", button: "Add", title: "Add water" },
    goal: { min: 8, max: 300, label: "Daily goal (oz)", button: "Save goal", title: "Daily water goal" },
  };

  let entries = Store.read(KEYS.water, []);
  let goalOunces = Store.read(KEYS.waterGoal, DEFAULT_GOAL_OUNCES);
  let dialogMode = "add";

  const todayTotal = document.getElementById("water-today");
  const goalText = document.getElementById("water-goal");
  const progress = document.getElementById("water-progress");
  const bar = document.getElementById("water-bar");
  const undoButton = document.getElementById("water-undo");
  const dialog = document.getElementById("water-dialog");
  const dialogTitle = document.getElementById("water-dialog-title");
  const form = document.getElementById("water-form");
  const amountLabel = document.getElementById("water-amount-label");
  const amountInput = document.getElementById("water-amount");
  const amountError = document.getElementById("water-amount-error");
  const submitButton = document.getElementById("water-submit");

  function todaysEntries() {
    const today = UI.todayKey();
    return entries.filter((entry) => entry.date === today);
  }

  function render() {
    const total = WorkoutLogic.waterForDay(entries, UI.todayKey());
    todayTotal.textContent = UI.formatNumber(total);
    goalText.textContent = UI.formatNumber(goalOunces);
    bar.style.width = `${Math.min(100, (total / goalOunces) * 100)}%`;
    progress.setAttribute("aria-valuemax", goalOunces);
    progress.setAttribute("aria-valuenow", total);
    progress.setAttribute("aria-valuetext", `${total} of ${goalOunces} ounces`);
    undoButton.disabled = todaysEntries().length === 0;
  }

  function addWater(ounces) {
    const entry = { id: Date.now(), date: UI.todayKey(), ounces };
    if (!Store.write(KEYS.water, [entry, ...entries])) {
      UI.showSaveError();
      return;
    }
    entries = [entry, ...entries];
    render();
    const total = WorkoutLogic.waterForDay(entries, entry.date);
    UI.showToast(total >= goalOunces ? `Added ${ounces} oz. Goal reached!` : `Added ${ounces} oz`);
  }

  function undoLast() {
    // Entries are kept newest first, so today's first entry is the latest one.
    const last = todaysEntries()[0];
    if (!last) {
      return;
    }
    const remaining = entries.filter((entry) => entry.id !== last.id);
    if (!Store.write(KEYS.water, remaining)) {
      UI.showSaveError();
      return;
    }
    entries = remaining;
    render();
    UI.showToast(`Removed ${last.ounces} oz`);
  }

  function openDialog(mode) {
    dialogMode = mode;
    const limits = LIMITS[mode];
    dialogTitle.textContent = limits.title;
    amountLabel.textContent = limits.label;
    submitButton.textContent = limits.button;
    amountInput.min = limits.min;
    amountInput.max = limits.max;
    amountInput.value = mode === "goal" ? goalOunces : "";
    amountInput.placeholder = mode === "goal" ? "" : "e.g. 12";
    amountError.textContent = "";
    amountInput.setAttribute("aria-invalid", "false");
    dialog.showModal();
    amountInput.focus();
    amountInput.select();
  }

  function submitDialog(event) {
    event.preventDefault();
    const { min, max } = LIMITS[dialogMode];
    const ounces = Number(amountInput.value);
    if (amountInput.value === "" || !Number.isInteger(ounces) || ounces < min || ounces > max) {
      amountError.textContent = `Enter whole ounces from ${min} to ${max}.`;
      amountInput.setAttribute("aria-invalid", "true");
      return;
    }
    if (dialogMode === "goal") {
      if (!Store.write(KEYS.waterGoal, ounces)) {
        UI.showSaveError();
        return;
      }
      goalOunces = ounces;
      render();
      UI.showToast(`Water goal set to ${ounces} oz`);
    } else {
      addWater(ounces);
    }
    dialog.close();
  }

  document.querySelectorAll(".water-add[data-ounces]").forEach((button) =>
    button.addEventListener("click", () => addWater(Number(button.dataset.ounces))),
  );
  document.getElementById("water-custom").addEventListener("click", () => openDialog("add"));
  document.getElementById("water-goal-button").addEventListener("click", () => openDialog("goal"));
  undoButton.addEventListener("click", undoLast);
  form.addEventListener("submit", submitDialog);
  document.getElementById("water-dialog-close").addEventListener("click", () => dialog.close());
  // Clicking the dimmed area outside the sheet closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  render();
})();
