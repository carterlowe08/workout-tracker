// Home page: today's load, calories and RPE as rings, plus the week's numbers.
(() => {
  const today = UI.todayKey();
  const weekStart = WorkoutLogic.addDays(today, -6);

  const checkIns = Store.read(Store.KEYS.checkIns, {});
  const calorieEntries = Store.read(Store.KEYS.calories, []);
  const workouts = Store.read(Store.KEYS.workouts, []);

  const sumForToday = (items, valueOf) =>
    items.filter((item) => item.date === today).reduce((total, item) => total + valueOf(item), 0);

  const loadToday = sumForToday(workouts, (workout) => workout.load);
  const caloriesToday = sumForToday(calorieEntries, (entry) => entry.calories);
  const bestLoadDay = WorkoutLogic.bestDayTotal(workouts, (workout) => workout.load);
  const bestCalorieDay = WorkoutLogic.bestDayTotal(calorieEntries, (entry) => entry.calories);
  const rpeToday = checkIns[today] ? checkIns[today].rpe : null;
  const loadThisWeek = workouts
    .filter((workout) => workout.date >= weekStart)
    .reduce((total, workout) => total + workout.load, 0);

  // Today's total as a share of the best day, so the ring is full on a record day.
  const shareOfBest = (value, best) => (best > 0 ? value / best : 0);

  document.getElementById("today-rings").replaceChildren(
    UI.ring({
      fraction: shareOfBest(loadToday, bestLoadDay),
      value: UI.formatNumber(loadToday),
      unit: "lb",
      label: "Load",
      caption: bestLoadDay > 0 ? `Best: ${UI.formatNumber(bestLoadDay)}` : "No workouts yet",
      color: "var(--load)",
      size: "small",
    }),
    UI.ring({
      fraction: shareOfBest(caloriesToday, bestCalorieDay),
      value: UI.formatNumber(caloriesToday),
      unit: "kcal",
      label: "Calories",
      caption: bestCalorieDay > 0 ? `Best: ${UI.formatNumber(bestCalorieDay)}` : "None logged yet",
      color: "var(--calories)",
      size: "small",
    }),
    UI.ring({
      fraction: rpeToday === null ? 0 : rpeToday / 10,
      value: rpeToday === null ? "–" : String(rpeToday),
      unit: "/ 10",
      label: "RPE",
      caption: rpeToday === null ? "Not checked in" : WorkoutLogic.rpeLabel(rpeToday),
      color: "var(--rpe)",
      size: "small",
    }),
  );

  document.getElementById("today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  document.getElementById("stat-streak").textContent = WorkoutLogic.currentStreak(
    Object.keys(checkIns),
    today,
  );
  document.getElementById("stat-load").textContent = UI.formatNumber(loadThisWeek);

  // ----- Progress chart: heaviest set per week for one exercise, or total weekly load -----
  const WEEKS_SHOWN = 12;
  const TOTAL_LOAD = "total-load";
  const metricSelect = document.getElementById("progress-metric");
  const chartContainer = document.getElementById("progress-chart");
  const summary = document.getElementById("progress-summary");
  const table = document.getElementById("progress-table");

  // Exercises logged set by set, most-logged first.
  const timesLogged = new Map();
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (Array.isArray(exercise.sets)) {
        timesLogged.set(exercise.name, (timesLogged.get(exercise.name) || 0) + 1);
      }
    }
  }
  const exerciseNames = [...timesLogged.keys()].sort((a, b) => timesLogged.get(b) - timesLogged.get(a));

  const shortDate = (dateKey) => UI.formatDate(dateKey).replace(/^\w+, /, "");

  function formatPounds(value, { short = false } = {}) {
    if (short) {
      return value >= 10000 ? `${UI.formatNumber(value / 1000)}k` : UI.formatNumber(value);
    }
    return `${UI.formatNumber(value)} lb`;
  }

  function weeklySeries(metric) {
    if (metric === TOTAL_LOAD) {
      return WorkoutLogic.weeklyValues(workouts, today, WEEKS_SHOWN, (workout) => workout.load, (a, b) => a + b);
    }
    return WorkoutLogic.weeklyValues(
      workouts,
      today,
      WEEKS_SHOWN,
      (workout) => WorkoutLogic.heaviestSet(workout, metric),
      Math.max,
    );
  }

  function describeChange(points, metric) {
    const logged = points.filter((point) => point.value !== null);
    const what = metric === TOTAL_LOAD ? "Weekly load" : `Heaviest ${metric} set`;
    if (logged.length < 2) {
      return `${what}: ${formatPounds(logged[0].value)}. Log another week to see a trend.`;
    }
    const first = logged[0];
    const last = logged[logged.length - 1];
    const change = last.value - first.value;
    if (change === 0) {
      return `${what}: no change since the week of ${first.label}.`;
    }
    const direction = change > 0 ? "up" : "down";
    return `${what} is ${direction} ${formatPounds(Math.abs(change))} since the week of ${first.label}.`;
  }

  function renderTable(points, metric) {
    const heading = metric === TOTAL_LOAD ? "Total load (lb)" : `Heaviest ${metric} set (lb)`;
    table.replaceChildren(
      UI.el("caption", {}, `${heading}, by week`),
      UI.el("tr", {}, UI.el("th", {}, "Week"), UI.el("th", {}, heading)),
      ...points.map((point) =>
        UI.el(
          "tr",
          {},
          UI.el("td", {}, point.longLabel),
          UI.el("td", {}, point.value === null ? "Nothing logged" : String(point.value)),
        ),
      ),
    );
  }

  function renderProgress() {
    const metric = metricSelect.value;
    const points = weeklySeries(metric).map(({ week, value }) => ({
      label: shortDate(week),
      longLabel: `Week of ${shortDate(week)}`,
      value,
    }));
    if (points.every((point) => point.value === null)) {
      summary.textContent = "";
      chartContainer.replaceChildren(
        UI.el("p", { class: "empty" }, "Save a workout to start your progress chart."),
      );
      table.replaceChildren();
      return;
    }
    summary.textContent = describeChange(points, metric);
    LineChart.draw(chartContainer, points, formatPounds);
    renderTable(points, metric);
  }

  metricSelect.replaceChildren(
    ...exerciseNames.map((name) => UI.el("option", { value: name }, `${name}: heaviest set`)),
    UI.el("option", { value: TOTAL_LOAD }, "Total weekly load"),
  );
  metricSelect.value = exerciseNames[0] || TOTAL_LOAD;
  metricSelect.addEventListener("change", renderProgress);
  // Redraw at the new width when the screen rotates or the window is resized.
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderProgress, 150);
  });
  renderProgress();
})();
