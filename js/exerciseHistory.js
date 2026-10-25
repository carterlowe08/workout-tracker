// Exercise history: a sheet showing every saved session of one exercise, the
// heaviest set, the best estimated one-rep max, and a chart of that estimate
// over time. Opened by tapping an exercise's name.
const ExerciseHistory = (() => {
  const { el } = UI;
  const MAX_CHART_SESSIONS = 20;

  const title = el("h2", { id: "history-title" });
  const subtitle = el("p", { class: "muted editor-meta" });
  const stats = el("div", { class: "stat-grid history-stats" });
  const chartHeading = el("h3", { class: "history-heading" }, "Estimated one-rep max");
  const chart = el("div", { class: "history-chart" });
  const sessionsHeading = el("h3", { class: "history-heading" }, "Every session");
  const sessionList = el("ul", { class: "list" });
  const formulaNote = el(
    "p",
    { class: "note" },
    "Estimated one-rep max uses the Epley formula: weight × (1 + reps ÷ 30). It's a guide, not a test.",
  );

  const dialog = el(
    "dialog",
    { class: "sheet", "aria-labelledby": "history-title" },
    el(
      "div",
      { class: "sheet-header" },
      title,
      el(
        "button",
        { type: "button", class: "sheet-close", "aria-label": "Close", onclick: () => dialog.close() },
        "×",
      ),
    ),
    subtitle,
    stats,
    chartHeading,
    chart,
    sessionsHeading,
    sessionList,
    formulaNote,
  );
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  // Weights are saved in pounds and shown in the chosen unit, as whole numbers for estimates.
  const weightText = (pounds) => UI.formatNumber(Units.fromPounds(pounds));
  const setText = (set) => `${weightText(set.weight)}×${set.reps}`;
  const shortDate = (dateKey) => UI.formatDate(dateKey).replace(/^\w+, /, "");

  function stat(value, label) {
    return el(
      "div",
      { class: "stat" },
      el("span", { class: "stat-value" }, value),
      el("span", { class: "stat-label" }, label),
    );
  }

  // Bodyweight moves (weight 0) have no one-rep max, so show the most reps instead.
  function renderStats(sessions) {
    const { heaviest, bestEstimate } = WorkoutLogic.bestSets(sessions);
    const unit = Units.current();
    const usesWeight = heaviest.weight > 0;
    const mostReps = Math.max(...sessions.flatMap((session) => session.sets.map((set) => set.reps)));
    const bestOneRepMax = UI.formatNumber(Math.round(Units.fromPounds(bestEstimate)));
    stats.replaceChildren(
      usesWeight
        ? stat(setText(heaviest), `Heaviest set (${unit} × reps)`)
        : stat(String(mostReps), "Most reps in a set"),
      usesWeight
        ? stat(bestOneRepMax, `Best est. 1-rep max (${unit})`)
        : stat(String(sessions.length), "Sessions"),
    );
    return usesWeight;
  }

  // One point per session, oldest first, with the session's best estimate.
  function renderChart(sessions) {
    const recent = sessions.slice(0, MAX_CHART_SESSIONS).reverse();
    const sessionBest = (session) =>
      Math.max(...session.sets.map((set) => WorkoutLogic.estimatedOneRepMax(set.weight, set.reps)));
    const points = recent.map((session) => ({
      label: shortDate(session.date),
      longLabel: `${UI.formatDate(session.date)} · ${session.workoutName}`,
      value: Math.round(Units.fromPounds(sessionBest(session))),
    }));
    if (points.length < 2) {
      chart.replaceChildren(el("p", { class: "muted" }, "Log this exercise in another workout to see a trend."));
      return;
    }
    LineChart.draw(chart, points, (value, { short = false } = {}) =>
      short ? UI.formatNumber(value) : `${UI.formatNumber(value)} ${Units.current()}`,
    );
  }

  function renderSessions(sessions) {
    sessionList.replaceChildren(
      ...sessions.map((session) =>
        el(
          "li",
          { class: "history-session" },
          el("span", { class: "row-title" }, `${UI.formatDate(session.date)} · ${session.workoutName}`),
          el("span", { class: "row-meta" }, session.sets.map(setText).join(", ")),
        ),
      ),
    );
  }

  function open(exerciseName) {
    const workouts = Store.read(Store.KEYS.workouts, []);
    const sessions = WorkoutLogic.exerciseSessions(workouts, exerciseName);
    title.textContent = exerciseName;
    const hasHistory = sessions.length > 0;
    for (const part of [stats, chartHeading, chart, sessionsHeading, sessionList, formulaNote]) {
      part.hidden = !hasHistory;
    }
    if (!hasHistory) {
      subtitle.textContent =
        `You haven't saved a workout with ${exerciseName} yet. Its history shows up here once you do.`;
      dialog.showModal();
      return;
    }
    subtitle.textContent = `${UI.plural(sessions.length, "session")} · weights in ${Units.current()}`;
    const usesWeight = renderStats(sessions);
    chartHeading.hidden = !usesWeight;
    chart.hidden = !usesWeight;
    formulaNote.hidden = !usesWeight;
    renderSessions(sessions);
    dialog.showModal();
    // The chart sizes itself to the sheet, so draw it once the sheet is showing.
    if (usesWeight) {
      renderChart(sessions);
    }
  }

  return { open };
})();
