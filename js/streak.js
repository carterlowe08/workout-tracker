// Streak & RPE page: one check-in per day with an RPE rating, a running
// streak, and a calendar of the last four weeks.
(() => {
  const { KEYS } = Store;
  const { el } = UI;
  const CALENDAR_DAYS = 28;

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
  const list = document.getElementById("checkin-list");

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

  function renderForm() {
    const todayCheckIn = checkIns[UI.todayKey()];
    if (todayCheckIn) {
      rpeInput.value = todayCheckIn.rpe;
      noteInput.value = todayCheckIn.note;
      checkInButton.textContent = "Update today's check-in";
    } else {
      checkInButton.textContent = "Check in for today";
    }
    updateRpeOutput();
  }

  function renderCalendar() {
    const today = UI.todayKey();
    const cells = [];
    for (let offset = CALENDAR_DAYS - 1; offset >= 0; offset -= 1) {
      const day = WorkoutLogic.addDays(today, -offset);
      const checkIn = checkIns[day];
      const classes = ["calendar-day"];
      if (checkIn) classes.push(rpeClass(checkIn.rpe));
      if (day === today) classes.push("today");
      const description = checkIn
        ? `${UI.formatDate(day)}: RPE ${checkIn.rpe}`
        : `${UI.formatDate(day)}: no check-in`;
      cells.push(
        el("div", { class: classes.join(" "), title: description, "aria-label": description, role: "img" },
          checkIn ? String(checkIn.rpe) : ""),
      );
    }
    calendar.replaceChildren(...cells);
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
    }
    renderAll();
    UI.showToast("Check-in deleted");
  }

  rpeInput.addEventListener("input", updateRpeOutput);
  form.addEventListener("submit", checkIn);

  renderAll();
})();
