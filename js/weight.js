// Weight tracker on the Calories page: a summary row that expands into a
// chart of daily weigh-ins with a 7-day average and the plan's goal weight.
// Logging a weight also updates the bodyweight used for calorie estimates.
// Weights are saved in pounds and shown in the unit chosen at the top (lb or kg).
(() => {
  const { KEYS } = Store;

  const unit = Units.current();
  const MIN_POUNDS = 50;
  const MAX_POUNDS = 700;
  const MIN_SHOWN = Units.fromPounds(MIN_POUNDS);
  const MAX_SHOWN = Units.fromPounds(MAX_POUNDS);
  const STEP = unit === "kg" ? 0.1 : 0.2;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const CHART_HEIGHT = 170;
  const MARGIN = { top: 12, right: 10, bottom: 30, left: 36 };
  // The goal line is drawn only when it is within 10 lb of the plotted weights,
  // so a far-off goal doesn't flatten the trend.
  const GOAL_LINE_REACH = Units.fromPounds(10);

  let log = Store.read(KEYS.weightLog, []);
  let rangeDays = "30";

  const toggle = document.getElementById("weight-toggle");
  const details = document.getElementById("weight-details");
  const nowText = document.getElementById("weight-now");
  const changeText = document.getElementById("weight-change");
  const chart = document.getElementById("weight-chart");
  const legend = document.querySelector(".weight-legend");
  const goalLegend = document.getElementById("weight-legend-goal");
  const startText = document.getElementById("weight-start");
  const rangeChangeText = document.getElementById("weight-range-change");
  const toGoalText = document.getElementById("weight-to-goal");
  const form = document.getElementById("weight-form");
  const input = document.getElementById("weight-input");
  const error = document.getElementById("weight-error");
  const rangeButtons = document.querySelectorAll(".weight-ranges .chip");

  function goalWeight() {
    const answers = Store.read(KEYS.planAnswers, null);
    return (answers && answers.goalWeightLb) || null;
  }

  function oneDecimal(value) {
    return Math.round(value * 10) / 10;
  }

  // A weight in pounds as text in the chosen unit, like "180.4" or "81.8".
  function shown(pounds) {
    return Units.fromPounds(pounds).toFixed(1);
  }

  // "−1.2" or "+0.4", with a real minus sign.
  function signed(value) {
    const rounded = oneDecimal(value);
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
    return `${sign}${Math.abs(rounded).toFixed(1)}`;
  }

  function shortDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function dayNumber(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / 86400000;
  }

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }
    return node;
  }

  function svgText(x, y, anchor, text) {
    const node = svgElement("text", { x, y, class: "chart-axis", "text-anchor": anchor });
    node.textContent = text;
    return node;
  }

  function renderSummary() {
    const latest = log[log.length - 1];
    if (!latest) {
      nowText.textContent = "";
      changeText.textContent = details.hidden ? "Tap to log your weight" : "No weigh-ins yet";
      return;
    }
    nowText.replaceChildren(shown(latest.pounds), " ", UI.el("span", { class: "tile-unit" }, unit));
    const change = WorkoutLogic.weeklyWeightChange(log);
    if (change) {
      const amount = Units.fromPounds(change.pounds);
      const arrow = amount < 0 ? "▼" : amount > 0 ? "▲" : "";
      changeText.textContent = `${arrow} ${Math.abs(amount).toFixed(1)} ${unit} since ${shortDate(change.since)}`.trim();
    } else {
      changeText.textContent = latest.date === UI.todayKey() ? "Logged today" : `Last logged ${shortDate(latest.date)}`;
    }
  }

  function rangeStart() {
    const today = UI.todayKey();
    if (rangeDays === "all") {
      // At least a week, so a single weigh-in doesn't sit alone on an empty axis.
      const weekAgo = WorkoutLogic.addDays(today, -6);
      return log.length > 0 && log[0].date < weekAgo ? log[0].date : weekAgo;
    }
    return WorkoutLogic.addDays(today, -(Number(rangeDays) - 1));
  }

  // Round grid lines (every 1, 2, 5 or 10 lb or kg) around the plotted weights.
  function yTicks(values) {
    const low = Math.min(...values);
    const high = Math.max(...values);
    const step = [1, 2, 5, 10, 25].find((option) => (high - low) / option <= 4) || 50;
    const start = Math.floor((low - 0.5) / step) * step;
    const end = Math.ceil((high + 0.5) / step) * step;
    const ticks = [];
    for (let tick = start; tick <= end; tick += step) {
      ticks.push(tick);
    }
    return ticks;
  }

  function drawChart(entries, start, goal) {
    legend.hidden = entries.length === 0;
    if (entries.length === 0) {
      chart.removeAttribute("role");
      chart.removeAttribute("aria-label");
      chart.replaceChildren(
        UI.el(
          "p",
          { class: "weight-chart-empty" },
          log.length === 0 ? "Log your first weight below to start the chart." : "No weigh-ins in this range.",
        ),
      );
      return;
    }

    const today = UI.todayKey();
    const width = Math.max(chart.clientWidth, 260);
    const plotWidth = width - MARGIN.left - MARGIN.right;
    const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    const firstDay = dayNumber(start);
    const daySpan = Math.max(dayNumber(today) - firstDay, 1);
    // Everything on the chart is in the chosen unit.
    const weights = entries.map((entry) => Units.fromPounds(entry.pounds));
    const averages = entries.map((entry) => Units.fromPounds(WorkoutLogic.weightAverage(log, entry.date)));
    const plotted = [...weights, ...averages];
    const showGoal =
      goal !== null &&
      goal >= Math.min(...plotted) - GOAL_LINE_REACH &&
      goal <= Math.max(...plotted) + GOAL_LINE_REACH;
    const ticks = yTicks(showGoal ? [...plotted, goal] : plotted);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const xFor = (dateKey) => MARGIN.left + ((dayNumber(dateKey) - firstDay) / daySpan) * plotWidth;
    const yFor = (value) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * plotHeight;

    const svg = svgElement("svg", { viewBox: `0 0 ${width} ${CHART_HEIGHT}`, class: "weight-svg", "aria-hidden": "true" });
    for (const tick of ticks) {
      const y = yFor(tick);
      svg.append(
        svgElement("line", { x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y, class: "chart-grid" }),
        svgText(MARGIN.left - 8, y + 4, "end", tick),
      );
    }
    if (showGoal) {
      const y = yFor(goal);
      svg.append(svgElement("line", { x1: MARGIN.left, x2: width - MARGIN.right, y1: y, y2: y, class: "weight-goal-line" }));
    }
    const middle = WorkoutLogic.addDays(start, Math.round(daySpan / 2));
    svg.append(
      svgText(MARGIN.left, CHART_HEIGHT - 6, "start", shortDate(start)),
      svgText(xFor(middle), CHART_HEIGHT - 6, "middle", shortDate(middle)),
      svgText(width - MARGIN.right, CHART_HEIGHT - 6, "end", "Today"),
    );

    entries.forEach((entry, index) => {
      svg.append(svgElement("circle", { cx: xFor(entry.date), cy: yFor(weights[index]), r: 3, class: "weight-dot" }));
    });
    if (entries.length > 1) {
      const path = entries
        .map((entry, index) => `${index === 0 ? "M" : "L"}${xFor(entry.date)},${yFor(averages[index])}`)
        .join(" ");
      svg.append(svgElement("path", { d: path, class: "weight-average-line" }));
    }
    const last = entries[entries.length - 1];
    svg.append(
      svgElement("circle", { cx: xFor(last.date), cy: yFor(averages[averages.length - 1]), r: 5, class: "weight-average-end" }),
    );

    goalLegend.hidden = !showGoal;
    chart.setAttribute("role", "img");
    chart.setAttribute(
      "aria-label",
      `Weight from ${shortDate(entries[0].date)} to ${shortDate(last.date)}: ` +
        `${shown(entries[0].pounds)} to ${shown(last.pounds)} ${unit}.`,
    );
    chart.replaceChildren(svg);
  }

  function renderStats(entries, goal) {
    const latest = log[log.length - 1];
    if (entries.length === 0) {
      startText.textContent = "–";
      rangeChangeText.textContent = "–";
      rangeChangeText.className = "";
    } else {
      const first = Units.fromPounds(entries[0].pounds);
      const change = oneDecimal(Units.fromPounds(entries[entries.length - 1].pounds) - first);
      startText.textContent = first.toFixed(1);
      rangeChangeText.textContent = signed(change);
      // Green when the change heads toward the goal weight.
      const towardGoal = goal !== null && change !== 0 && Math.sign(change) === Math.sign(goal - first);
      rangeChangeText.className = towardGoal ? "weight-toward-goal" : "";
    }
    if (goal === null) {
      toGoalText.replaceChildren(UI.el("a", { href: "plan.html" }, "Set goal"));
    } else if (!latest) {
      toGoalText.textContent = "–";
    } else {
      toGoalText.textContent = Math.abs(oneDecimal(Units.fromPounds(latest.pounds) - goal)).toFixed(1);
    }
  }

  function renderDetails() {
    if (details.hidden) {
      return;
    }
    const start = rangeStart();
    const entries = log.filter((entry) => entry.date >= start);
    const goalPounds = goalWeight();
    const goal = goalPounds === null ? null : Units.fromPounds(goalPounds);
    drawChart(entries, start, goal);
    renderStats(entries, goal);
  }

  function render() {
    renderSummary();
    renderDetails();
  }

  // The stepper starts from the latest weigh-in, or the bodyweight saved elsewhere in the app.
  function startingWeight() {
    const latest = log[log.length - 1];
    if (latest) {
      return latest.pounds;
    }
    const answers = Store.read(KEYS.planAnswers, null);
    return Store.read(KEYS.bodyweight, null) || (answers && answers.weightLb) || null;
  }

  // The typed weight in the chosen unit, rounded to 0.1, or null if it's out of range.
  function readInput() {
    const value = Number(input.value);
    return input.value !== "" && value >= MIN_SHOWN && value <= MAX_SHOWN ? oneDecimal(value) : null;
  }

  function setError(message) {
    error.textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function step(direction) {
    const startingPounds = startingWeight();
    const current = readInput() ?? (startingPounds === null ? null : Units.fromPounds(startingPounds));
    if (current === null) {
      input.focus();
      return;
    }
    const next = Math.min(MAX_SHOWN, Math.max(MIN_SHOWN, oneDecimal(current + direction * STEP)));
    input.value = next.toFixed(1);
    setError("");
  }

  function logWeight(event) {
    event.preventDefault();
    const value = readInput();
    if (value === null) {
      setError(`Enter a weight from ${MIN_SHOWN} to ${MAX_SHOWN} ${unit}.`);
      input.focus();
      return;
    }
    // Kilograms convert to pounds with two decimals, so they show back exactly as typed.
    const pounds = Math.round(Units.toPounds(value) * 100) / 100;
    const today = UI.todayKey();
    const replacing = log.some((entry) => entry.date === today);
    const updated = WorkoutLogic.recordWeight(log, today, pounds);
    if (!Store.write(KEYS.weightLog, updated)) {
      UI.showSaveError();
      return;
    }
    log = updated;
    // The newest weigh-in becomes the bodyweight for calorie estimates.
    Store.write(KEYS.bodyweight, pounds);
    document.dispatchEvent(new CustomEvent("bodyweight-changed", { detail: pounds }));
    setError("");
    input.value = value.toFixed(1);
    render();
    const weightText = `${value.toFixed(1)} ${unit}`;
    UI.showToast(replacing ? `Updated today's weight to ${weightText}` : `Logged ${weightText}`);
  }

  function setExpanded(expanded) {
    toggle.setAttribute("aria-expanded", String(expanded));
    details.hidden = !expanded;
    render();
  }

  function setRange(days) {
    rangeDays = days;
    rangeButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.days === days)));
    renderDetails();
  }

  toggle.addEventListener("click", () => setExpanded(details.hidden));
  rangeButtons.forEach((button) => button.addEventListener("click", () => setRange(button.dataset.days)));
  document.getElementById("weight-minus").addEventListener("click", () => step(-1));
  document.getElementById("weight-plus").addEventListener("click", () => step(1));
  input.addEventListener("input", () => {
    if (readInput() !== null) setError("");
  });
  input.addEventListener("focus", () => input.select());
  form.addEventListener("submit", logWeight);
  // The chart is drawn at the card's real width, so redraw when that changes.
  window.addEventListener("resize", renderDetails);

  document.querySelector(".weight-input-unit").textContent = unit;
  document.querySelector(".weight-input-wrap .visually-hidden").textContent = `Today's weight in ${unit}`;
  document.getElementById("weight-minus").setAttribute("aria-label", `Down ${STEP} ${unit}`);
  document.getElementById("weight-plus").setAttribute("aria-label", `Up ${STEP} ${unit}`);
  input.min = MIN_SHOWN;
  input.max = MAX_SHOWN;
  const initialWeight = startingWeight();
  if (initialWeight !== null) {
    input.value = shown(initialWeight);
  }
  render();
})();
