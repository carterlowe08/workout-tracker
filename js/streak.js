// Streak & RPE page: one check-in per day with an RPE rating, a running
// streak, and a month calendar shaded by RPE.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  // Check-ins are stored by date: { "2026-10-13": { rpe: 8, note: "..." } }.
  let checkIns = Store.read(KEYS.checkIns, {});

  const form = document.getElementById("checkin-form");
  const rpeInput = document.getElementById("rpe");
  const rpeOutput = document.getElementById("rpe-output");
  const noteInput = document.getElementById("checkin-note");
  const checkInButton = document.getElementById("checkin-button");
  const currentStreak = document.getElementById("current-streak");
  const bestStreak = document.getElementById("best-streak");
  const calendar = document.getElementById("calendar");
  const monthHeading = document.getElementById("month-heading");
  const nextMonthButton = document.getElementById("month-next");
  const list = document.getElementById("checkin-list");
  const donePanel = document.getElementById("checkin-done");
  const cancelButton = document.getElementById("checkin-cancel");

  // The calendar shows one month at a time, starting with this one.
  const [thisYear, thisMonth] = UI.todayKey().split("-").map(Number);
  let shownYear = thisYear;
  let shownMonth = thisMonth;
  // True while changing a check-in already made today.
  let editing = false;

  function rpeClass(rpe) {
    if (rpe <= 4) return "rpe-low";
    if (rpe <= 7) return "rpe-mid";
    return "rpe-high";
  }

  function updateRpeOutput() {
    const rpe = Number(rpeInput.value);
    rpeOutput.textContent = `${rpe} · ${WorkoutLogic.rpeLabel(rpe)}`;
  }

  function renderStreak() {
    const days = Object.keys(checkIns);
    const streak = WorkoutLogic.currentStreak(days, UI.todayKey());
    currentStreak.textContent = streak;
    bestStreak.textContent = WorkoutLogic.bestStreak(days);
  }

  // Before today's check-in the purple row is the form; after it, a summary with Edit.
  function renderForm() {
    const todayCheckIn = checkIns[UI.todayKey()];
    const showSummary = Boolean(todayCheckIn) && !editing;
    donePanel.hidden = !showSummary;
    form.hidden = showSummary;
    cancelButton.hidden = !todayCheckIn;
    if (todayCheckIn) {
      document.getElementById("done-rpe").textContent = todayCheckIn.rpe;
      document.getElementById("done-title").textContent =
        `Checked in today · ${WorkoutLogic.rpeLabel(todayCheckIn.rpe)}`;
      document.getElementById("done-note").textContent = todayCheckIn.note ? `\u201c${todayCheckIn.note}\u201d` : "";
      rpeInput.value = todayCheckIn.rpe;
      noteInput.value = todayCheckIn.note;
      checkInButton.textContent = "Update check-in";
    } else {
      checkInButton.textContent = "Check in for today";
    }
    updateRpeOutput();
  }

  function renderCalendar() {
    const today = UI.todayKey();
    const first = new Date(shownYear, shownMonth - 1, 1);
    const daysInMonth = new Date(shownYear, shownMonth, 0).getDate();
    monthHeading.textContent = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    nextMonthButton.disabled = shownYear === thisYear && shownMonth === thisMonth;
    // Monday-first grid: blank cells before the 1st.
    const blanks = (first.getDay() + 6) % 7;
    const cells = Array.from({ length: blanks }, () => el("div", { class: "calendar-day blank", "aria-hidden": "true" }));
    for (let date = 1; date <= daysInMonth; date += 1) {
      const day = `${shownYear}-${String(shownMonth).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
      const checkIn = checkIns[day];
      const classes = ["calendar-day"];
      if (checkIn) classes.push(rpeClass(checkIn.rpe));
      if (day === today) classes.push("today");
      if (day > today) classes.push("future");
      const description = checkIn
        ? `${UI.formatDate(day)}: RPE ${checkIn.rpe}`
        : `${UI.formatDate(day)}: no check-in`;
      cells.push(
        el("div", { class: classes.join(" "), title: description, "aria-label": description, role: "img" }, String(date)),
      );
    }
    calendar.replaceChildren(...cells);
  }

  function showMonth(step) {
    shownMonth += step;
    if (shownMonth === 0) {
      shownMonth = 12;
      shownYear -= 1;
    } else if (shownMonth === 13) {
      shownMonth = 1;
      shownYear += 1;
    }
    renderCalendar();
  }

  function renderList() {
    const days = Object.keys(checkIns).sort().reverse();
    if (days.length === 0) {
      list.replaceChildren(el("li", { class: "empty" }, "No check-ins yet. Check in after your next workout."));
      return;
    }
    list.replaceChildren(
      ...days.map((day) => {
        const { rpe, note } = checkIns[day];
        return el(
          "li",
          { class: "row" },
          el(
            "div",
            {},
            el("span", { class: "row-title" }, `${UI.formatDate(day)} · RPE ${rpe} (${WorkoutLogic.rpeLabel(rpe)})`),
            note ? el("span", { class: "row-meta" }, note) : null,
          ),
          el(
            "button",
            {
              type: "button",
              class: "link-button",
              "aria-label": `Delete check-in for ${UI.formatDate(day)}`,
              onclick: () => deleteCheckIn(day),
            },
            "Delete",
          ),
        );
      }),
    );
  }

  function renderAll() {
    renderStreak();
    renderForm();
    renderCalendar();
    renderList();
  }

  function saveCheckIns(updated) {
    if (!Store.write(KEYS.checkIns, updated)) {
      UI.showSaveError();
      return false;
    }
    checkIns = updated;
    return true;
  }

  function checkIn(event) {
    event.preventDefault();
    const today = UI.todayKey();
    const wasCheckedIn = Boolean(checkIns[today]);
    const rpe = Number(rpeInput.value);
    if (!(Number.isInteger(rpe) && rpe >= 1 && rpe <= 10)) {
      UI.showToast("RPE must be a whole number from 1 to 10.", true);
      return;
    }
    if (!saveCheckIns({ ...checkIns, [today]: { rpe, note: noteInput.value.trim() } })) {
      return;
    }
    editing = false;
    renderAll();
    UI.showToast(wasCheckedIn ? "Check-in updated" : "Checked in! Streak updated");
  }

  async function deleteCheckIn(day) {
    const question = `Delete the check-in for ${UI.formatDate(day)}? This can break your streak.`;
    if (!(await UI.ask(question, { confirmLabel: "Delete", danger: true }))) {
      return;
    }
    const remaining = Object.fromEntries(Object.entries(checkIns).filter(([key]) => key !== day));
    if (!saveCheckIns(remaining)) {
      return;
    }
    if (day === UI.todayKey()) {
      noteInput.value = "";
      editing = false;
    }
    renderAll();
    UI.showToast("Check-in deleted");
  }

  rpeInput.addEventListener("input", updateRpeOutput);
  form.addEventListener("submit", checkIn);
  document.getElementById("checkin-edit").addEventListener("click", () => {
    editing = true;
    renderForm();
    rpeInput.focus();
  });
  cancelButton.addEventListener("click", () => {
    editing = false;
    renderForm();
  });
  document.getElementById("month-prev").addEventListener("click", () => showMonth(-1));
  nextMonthButton.addEventListener("click", () => showMonth(1));
  document.getElementById("streak-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  renderAll();
})();
