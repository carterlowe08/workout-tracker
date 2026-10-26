// Home page: today's load, calories, RPE and streak as colored tiles, plus a progress chart.
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
  const rpeToday = checkIns[today] ? checkIns[today].rpe : null;
  const loadThisWeek = workouts
    .filter((workout) => workout.date >= weekStart)
    .reduce((total, workout) => total + workout.load, 0);

  // Pounds -> the chosen unit, rounded to whole numbers or, for single sets, one decimal (61.2 kg).
  const inChosenUnit = (pounds, decimals = 0) => {
    const scale = 10 ** decimals;
    return Math.round(Units.fromPounds(pounds) * scale) / scale;
  };

  const unit = Units.current();
  const WEEKS_SHOWN = 12;

  document.getElementById("today-date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // ----- Load tile: today's load, a bar against the best day, and a 12-week sparkline -----
  const loadShareOfBest = bestLoadDay > 0 ? Math.min(loadToday / bestLoadDay, 1) : 0;
  document.getElementById("load-today").textContent = UI.formatNumber(inChosenUnit(loadToday));
  document.getElementById("load-unit").textContent = unit;
  document.getElementById("load-bar").style.width = `${Math.round(loadShareOfBest * 100)}%`;
  const weekText = `${UI.formatNumber(inChosenUnit(loadThisWeek))} ${unit} this week`;
  document.getElementById("load-caption").textContent =
    bestLoadDay > 0 ? `${Math.round(loadShareOfBest * 100)}% of your best day · ${weekText}` : "No workouts saved yet";

  // A tiny line of total load per week; hidden until there is something to draw.
  function drawSparkline(container, values) {
    if (values.every((value) => value === 0)) {
      container.replaceChildren();
      return;
    }
    const width = 96;
    const height = 48;
    const pad = 4;
    const highest = Math.max(...values);
    const points = values.map((value, index) => [
      pad + (index * (width - pad * 2)) / (values.length - 1),
      height - pad - (value / highest) * (height - pad * 2),
    ]);
    const svgNamespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNamespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `Total load per week for the last ${values.length} weeks`);
    const line = document.createElementNS(svgNamespace, "polyline");
    line.setAttribute("points", points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "));
    const [lastX, lastY] = points[points.length - 1];
    const dot = document.createElementNS(svgNamespace, "circle");
    dot.setAttribute("cx", lastX.toFixed(1));
    dot.setAttribute("cy", lastY.toFixed(1));
    dot.setAttribute("r", "3.5");
    svg.append(line, dot);
    container.replaceChildren(svg);
  }

  const weeklyLoad = WorkoutLogic.weeklyValues(
    workouts,
    today,
    WEEKS_SHOWN,
    (workout) => workout.load,
    (a, b) => a + b,
  ).map(({ value }) => value || 0);
  drawSparkline(document.getElementById("load-sparkline"), weeklyLoad);

  // ----- Calories and RPE tiles -----
  document.getElementById("calories-today").textContent = UI.formatNumber(caloriesToday);
  document.getElementById("rpe-today").textContent = rpeToday === null ? "–" : String(rpeToday);
  document.getElementById("rpe-label").textContent =
    rpeToday === null ? "Not checked in yet" : WorkoutLogic.rpeLabel(rpeToday);
  // Ten bars that get taller from left to right; today's RPE fills that many.
  document.getElementById("rpe-bars").replaceChildren(
    ...Array.from({ length: 10 }, (_, index) =>
      UI.el("span", {
        class: rpeToday !== null && index < rpeToday ? "filled" : "",
        style: `height: ${10 + index * 3}px`,
      }),
    ),
  );

  // ----- Streak tile: the streak, the best one, and a check for each of the last 7 days -----
  const checkInDays = Object.keys(checkIns);
  const streak = WorkoutLogic.currentStreak(checkInDays, today);
  const best = WorkoutLogic.bestStreak(checkInDays);
  document.getElementById("streak-count").textContent = streak;
  document.getElementById("streak-best").textContent = best > 0 ? `Best ${best}` : "";
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => WorkoutLogic.addDays(today, index - 6));
  document.getElementById("week-dots").replaceChildren(
    ...lastSevenDays.map((day) => {
      const [year, month, date] = day.split("-").map(Number);
      const letters = new Date(year, month - 1, date).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
      const classes = ["week-dot"];
      if (checkIns[day]) classes.push("checked");
      if (day === today) classes.push("today");
      return UI.el("span", { class: "week-dot-day" }, UI.el("span", { class: classes.join(" ") }), letters);
    }),
  );
  const checkedThisWeek = lastSevenDays.filter((day) => checkIns[day]).length;
  document.getElementById("week-summary").textContent =
    `Checked in ${checkedThisWeek} of the last 7 days.${best > 0 ? ` Best streak ${best} days.` : ""}`;

  document.getElementById("progress-heading").textContent = `Progress, last 12 weeks (${unit})`;

  // ----- Progress chart: heaviest set per week for one exercise, or total weekly load -----
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

  // Chart values are already in the chosen unit (lb or kg).
  function formatWeight(value, { short = false } = {}) {
    if (short) {
      return value >= 10000 ? `${UI.formatNumber(value / 1000)}k` : UI.formatNumber(value);
    }
    return `${UI.formatNumber(value)} ${Units.current()}`;
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
      return `${what}: ${formatWeight(logged[0].value)}. Log another week to see a trend.`;
    }
    const first = logged[0];
    const last = logged[logged.length - 1];
    const change = last.value - first.value;
    if (change === 0) {
      return `${what}: no change since the week of ${first.label}.`;
    }
    const direction = change > 0 ? "up" : "down";
    return `${what} is ${direction} ${formatWeight(Math.abs(change))} since the week of ${first.label}.`;
  }

  function renderTable(points, metric) {
    const unit = Units.current();
    const heading = metric === TOTAL_LOAD ? `Total load (${unit})` : `Heaviest ${metric} set (${unit})`;
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
      value: value === null ? null : inChosenUnit(value, metric === TOTAL_LOAD ? 0 : 1),
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
    LineChart.draw(chartContainer, points, formatWeight);
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
