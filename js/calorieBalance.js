// Calories in vs. out on the Calories page: what the food and exercise logs
// say should have happened to body weight over 2 weeks, 4 weeks or 3 months,
// next to what the scale says. A bar per day shows net calories (eaten minus
// exercise) against maintenance before exercise, with the weight line under it.
(() => {
  const { el } = UI;
  const { KEYS } = Store;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const CHART_WIDTH = 320;
  const PLOT_LEFT = 40;
  const PLOT_RIGHT = 4;
  const PLOT_WIDTH = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const BARS_HEIGHT = 176;
  const BARS_TOP = 10;
  const BARS_BOTTOM = 150;
  const WEIGHT_HEIGHT = 78;

  const card = document.getElementById("balance");
  const unit = Units.current();
  let rangeKey = "2W";

  function svgElement(tag, attributes = {}, text = null) {
    const node = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }
    if (text !== null) {
      node.textContent = text;
    }
    return node;
  }

  const shortDate = (dateKey) => UI.formatDate(dateKey).replace(/^\w+, /, "");

  // "−1.2", "+0.4" or "0.0", with a real minus sign.
  function signed(value) {
    const rounded = Math.round(value * 10) / 10;
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
    return `${sign}${Math.abs(rounded).toFixed(1)}`;
  }

  const weightText = (pounds) => Units.fromPounds(pounds).toFixed(1);

  // Rounds up to the next 100, so axis labels are round numbers.
  const roundUp = (calories) => Math.ceil(calories / 100) * 100;

  // The center of day `index`'s slot along the shared x axis.
  function dayX(index, dayCount) {
    return PLOT_LEFT + ((index + 0.5) * PLOT_WIDTH) / dayCount;
  }

  function summaryBox(title, value, caption, isCalories) {
    return el(
      "div",
      { class: isCalories ? "balance-box tile tile-calories" : "balance-box" },
      el("span", { class: "balance-box-title" }, title),
      el("span", { class: "balance-box-value" }, value),
      el("span", { class: "balance-box-caption" }, caption),
    );
  }

  function caloriesBox(balance) {
    if (balance.loggedDays === 0) {
      return summaryBox("Calories say", "–", "Log food to compare", true);
    }
    const total = balance.totalDifference;
    const side = total > 0 ? "over" : "under";
    const amount = total === 0 ? "Right at maintenance" : `${UI.formatNumber(Math.abs(total))} kcal ${side}`;
    const pounds = total / WorkoutLogic.CALORIES_PER_POUND;
    return summaryBox(
      "Calories say",
      `${signed(Units.fromPounds(pounds))} ${unit}`,
      `${amount} · ${balance.loggedDays} of ${balance.days.length} days logged`,
      true,
    );
  }

  function scaleBox(balance) {
    if (!balance.scale) {
      return summaryBox("Scale says", "–", "Log 2 weigh-ins to compare", false);
    }
    const { from, to } = balance.scale;
    // The change between the two weights as shown, so they always add up.
    const change = Number(weightText(to)) - Number(weightText(from));
    return summaryBox(
      "Scale says",
      `${signed(change)} ${unit}`,
      `${weightText(from)} → ${weightText(to)}`,
      false,
    );
  }

  function spokenSummary(balance) {
    const missing = balance.days.length - balance.loggedDays;
    const parts = [`${UI.plural(balance.underDays, "day")} under`, `${UI.plural(balance.overDays, "day")} over`];
    if (missing > 0) {
      parts.push(`${UI.plural(missing, "day")} with no food logged`);
    }
    return `Daily net calories against maintenance for the last ${balance.days.length} days: ${parts.join(", ")}`;
  }

  // One bar per day: down for under maintenance, up for over. A small dot on
  // the zero line marks a day with no food logged.
  function barChart(balance) {
    const differences = balance.days.map((day) => day.difference).filter((value) => value !== null);
    let top = roundUp(Math.max(0, ...differences));
    let bottom = roundUp(Math.max(0, ...differences.map((value) => -value)));
    if (top === 0 && bottom === 0) {
      top = 100;
      bottom = 100;
    }
    const plotHeight = BARS_BOTTOM - BARS_TOP;
    const zeroY = BARS_TOP + (top / (top + bottom)) * plotHeight;
    const scale = plotHeight / (top + bottom);
    const dayCount = balance.days.length;
    const slot = PLOT_WIDTH / dayCount;
    const barWidth = Math.max(1.5, slot * 0.62);
    const radius = Math.min(3, barWidth / 2);

    const svg = svgElement("svg", {
      class: "balance-svg",
      viewBox: `0 0 ${CHART_WIDTH} ${BARS_HEIGHT}`,
      role: "img",
      "aria-label": spokenSummary(balance),
    });
    const axisLabel = (y, text) =>
      svg.append(svgElement("text", { x: 0, y: y + 3.5, class: "balance-axis" }, text));
    if (top > 0 && zeroY - BARS_TOP >= 12) {
      axisLabel(BARS_TOP, `+${UI.formatNumber(top)}`);
    }
    axisLabel(zeroY, "0");
    if (bottom > 0 && BARS_BOTTOM - zeroY >= 12) {
      axisLabel(BARS_BOTTOM, `−${UI.formatNumber(bottom)}`);
    }
    svg.append(
      svgElement("line", { x1: PLOT_LEFT, y1: zeroY, x2: CHART_WIDTH - PLOT_RIGHT, y2: zeroY, class: "balance-zero" }),
    );

    balance.days.forEach((day, index) => {
      const center = dayX(index, dayCount);
      if (day.difference === null) {
        svg.append(svgElement("circle", { cx: center, cy: zeroY, r: Math.min(2, slot / 3), class: "balance-missing" }));
        return;
      }
      // At least 2 high so a small or even day still shows; an even day sits on the line.
      const height = Math.max(2, Math.abs(day.difference) * scale);
      const isOver = day.difference > 0;
      const y = day.difference === 0 ? zeroY - 1 : isOver ? zeroY - height : zeroY;
      svg.append(
        svgElement("rect", {
          x: center - barWidth / 2,
          y,
          width: barWidth,
          height,
          rx: radius,
          class: day.difference === 0 ? "balance-even" : isOver ? "balance-over" : "balance-under",
        }),
      );
    });

    const middle = Math.floor((dayCount - 1) / 2);
    const dateLabel = (index, text, anchor) =>
      svg.append(
        svgElement(
          "text",
          { x: dayX(index, dayCount), y: BARS_HEIGHT - 4, class: "balance-axis", "text-anchor": anchor },
          text,
        ),
      );
    dateLabel(0, shortDate(balance.start), "start");
    dateLabel(middle, shortDate(balance.days[middle].date), "middle");
    dateLabel(dayCount - 1, "Today", "end");
    return svg;
  }

  // The weigh-ins in the same days, on the same x axis as the bars.
  function weightChart(balance) {
    if (balance.weights.length < 2) {
      return el("p", { class: "balance-empty" }, "Log 2 weigh-ins in this range to see your weight line.");
    }
    const values = balance.weights.map((entry) => entry.pounds);
    const high = Math.max(...values);
    const low = Math.min(...values);
    const pad = 10;
    const yFor = (pounds) =>
      high === low ? WEIGHT_HEIGHT / 2 : pad + ((high - pounds) / (high - low)) * (WEIGHT_HEIGHT - pad * 2);
    const indexOf = (dateKey) => balance.days.findIndex((day) => day.date === dateKey);
    const points = balance.weights.map((entry) => [dayX(indexOf(entry.date), balance.days.length), yFor(entry.pounds)]);

    const first = balance.weights[0];
    const last = balance.weights[balance.weights.length - 1];
    const svg = svgElement("svg", {
      class: "balance-svg",
      viewBox: `0 0 ${CHART_WIDTH} ${WEIGHT_HEIGHT}`,
      role: "img",
      "aria-label": `Weight from ${weightText(first.pounds)} to ${weightText(last.pounds)} ${unit} over the same days`,
    });
    for (const [pounds, y] of high === low ? [[high, WEIGHT_HEIGHT / 2]] : [[high, pad], [low, WEIGHT_HEIGHT - pad]]) {
      svg.append(
        svgElement("line", { x1: PLOT_LEFT, y1: y, x2: CHART_WIDTH - PLOT_RIGHT, y2: y, class: "balance-grid" }),
        svgElement("text", { x: 0, y: y + 3.5, class: "balance-axis" }, weightText(pounds)),
      );
    }
    svg.append(
      svgElement("polyline", {
        points: points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
        class: "balance-weight-line",
      }),
    );
    const [endX, endY] = points[points.length - 1];
    svg.append(svgElement("circle", { cx: endX, cy: endY, r: 4, class: "balance-weight-end" }));
    return svg;
  }

  function rangeChips() {
    return el(
      "div",
      { class: "balance-ranges", role: "group", "aria-label": "Range" },
      Object.keys(WorkoutLogic.BALANCE_RANGES).map((key) =>
        el(
          "button",
          {
            type: "button",
            class: "balance-range",
            "aria-pressed": String(key === rangeKey),
            onclick: () => {
              rangeKey = key;
              render();
            },
          },
          key,
        ),
      ),
    );
  }

  function legend() {
    return el(
      "ul",
      { class: "balance-legend", "aria-hidden": "true" },
      el("li", {}, el("span", { class: "balance-key balance-key-under" }), "Under"),
      el("li", {}, el("span", { class: "balance-key balance-key-over" }), "Over"),
      el("li", {}, el("span", { class: "balance-key balance-key-missing" }), "Not logged"),
      el("li", {}, el("span", { class: "balance-key balance-key-weight" }), "Weight"),
    );
  }

  function render() {
    const heading = el("h2", { id: "balance-heading" }, "Calories in vs. out");
    const maintenance = WorkoutLogic.maintenanceBeforeExercise(Store.read(KEYS.planAnswers, null));
    if (maintenance === null) {
      card.replaceChildren(
        el("div", { class: "balance-top" }, heading),
        el("p", { class: "muted" }, "Take the plan questionnaire to see how your calories line up with the scale."),
        el("a", { class: "button-secondary balance-plan-link", href: "plan.html" }, "Open the Plan"),
      );
      return;
    }
    const balance = WorkoutLogic.calorieBalance(
      {
        foodLog: Store.read(KEYS.foodLog, []),
        calorieEntries: Store.read(KEYS.calories, []),
        weightLog: Store.read(KEYS.weightLog, []),
      },
      maintenance,
      UI.todayKey(),
      WorkoutLogic.BALANCE_RANGES[rangeKey],
    );
    const chartArea =
      balance.loggedDays === 0
        ? el("p", { class: "balance-empty" }, "No food logged in this range yet. Add food in the Diary below.")
        : barChart(balance);
    card.replaceChildren(
      el("div", { class: "balance-top" }, heading, rangeChips()),
      el("div", { class: "balance-boxes" }, caloriesBox(balance), scaleBox(balance)),
      el(
        "div",
        { class: "balance-section" },
        el(
          "span",
          { class: "balance-label" },
          `Daily net vs. maintenance before exercise (${UI.formatNumber(maintenance)})`,
        ),
        chartArea,
      ),
      el("div", { class: "balance-section" }, el("span", { class: "balance-label" }, "Weight, same days"), weightChart(balance)),
      balance.loggedDays > 0 || balance.weights.length >= 2 ? legend() : null,
      el(
        "p",
        { class: "note" },
        "Net is food eaten minus the exercise you log. Maintenance before exercise is your Plan's burn at the Sedentary level, so workouts aren't counted twice. About 3,500 kcal is 1 lb.",
      ),
    );
  }

  render();
  for (const eventName of ["food-log-changed", "burned-calories-changed", "bodyweight-changed"]) {
    document.addEventListener(eventName, render);
  }
})();
