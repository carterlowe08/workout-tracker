// Goals card on Home and Streak: lift and cardio goals with a straight path
// from where you started to your target, what to aim for this week, progress
// updates, and, when a goal is behind, reasons drawn from the past week.
// "+ New goal" opens a step-by-step sheet (prototype B of eight).
(() => {
  const container = document.getElementById("goals");
  if (!container) {
    return;
  }
  const { KEYS } = Store;
  const { el } = UI;
  const today = UI.todayKey();
  const unit = Units.current();
  const WEEK_CHOICES = [4, 8, 12, 16];
  const EXAMPLES = {
    weight: unit === "kg" ? ["e.g. 60", "e.g. 80"] : ["e.g. 135", "e.g. 185"],
    reps: ["e.g. 5", "e.g. 10"],
    distance: ["e.g. 1.5", "e.g. 3"],
    time: ["e.g. 10:30", "e.g. 9:00"],
  };
  const NOW_HINTS = {
    weight: "Your heaviest weight for one set right now.",
    reps: "The most reps you can do in one set right now.",
    distance: "The farthest you go in one session right now.",
    time: "How long it takes or lasts now. Type minutes (25) or minutes:seconds (9:30).",
  };
  const STATE_LABELS = {
    "on-track": "On track",
    ahead: "Ahead",
    behind: "Behind",
    reached: "Reached",
    missed: "Date passed",
  };

  const storedGoals = Store.read(KEYS.goals, []);
  let goals = Array.isArray(storedGoals) ? storedGoals.filter(GoalLogic.isUsableGoal) : [];
  let openGoalId = null;
  // Charts are drawn once their card is on the page, so they know their width.
  let chartsToDraw = [];

  function unitOf(goal) {
    return { weight: unit, reps: "reps", distance: goal.distanceUnit, time: "min" }[goal.measure];
  }

  function format(goal, value) {
    if (goal.measure === "weight") return Units.format(value);
    if (goal.measure === "time") return `${GoalLogic.formatMinutes(value)} min`;
    return `${UI.formatNumber(value)} ${unitOf(goal)}`;
  }

  // A stored value in the unit on screen (pounds become kilograms when the switch says kg).
  function shown(goal, value) {
    return goal.measure === "weight" ? Units.fromPounds(value) : value;
  }

  function stored(measure, typedValue) {
    return measure === "weight" ? Units.toPounds(typedValue) : typedValue;
  }

  function save(updated) {
    if (!Store.write(KEYS.goals, updated)) {
      UI.showSaveError();
      return false;
    }
    goals = updated;
    render();
    return true;
  }

  // Everything the off-track reasons look at, read fresh so a check-in or
  // workout logged on this page counts straight away.
  function reasonData() {
    return {
      workouts: Store.read(KEYS.workouts, []),
      checkIns: Store.read(KEYS.checkIns, {}),
      cardioEntries: Store.read(KEYS.calories, []),
      foodLog: Store.read(KEYS.foodLog, []),
      nutritionGoals: Store.read(KEYS.nutritionGoals, null),
      weekGoal: WorkoutLogic.clampWeekGoal(Store.read(KEYS.weekGoal, WorkoutLogic.DEFAULT_WEEK_GOAL)),
    };
  }

  // ----- The path chart: a dashed line from start to goal, your updates as dots -----

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  function svgElement(tag, attributes = {}, text = null) {
    const node = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }
    if (text !== null) node.textContent = text;
    return node;
  }

  function pathChart(goal, holder) {
    const width = Math.max(holder.clientWidth || 300, 260);
    const height = 170;
    const margin = { top: 16, right: 16, bottom: 26, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const totalDays = Math.max(GoalLogic.daysBetween(goal.startDate, goal.endDate), 1);
    const points = [{ date: goal.startDate, value: goal.start }, ...(goal.updates || [])];
    const values = [goal.start, goal.target, ...points.map((point) => point.value)].map((value) => shown(goal, value));
    let low = Math.min(...values);
    let high = Math.max(...values);
    const pad = (high - low) * 0.1 || 1;
    low -= pad;
    high += pad;
    const xFor = (date) =>
      margin.left + (Math.min(Math.max(GoalLogic.daysBetween(goal.startDate, date), 0), totalDays) / totalDays) * plotWidth;
    const yFor = (value) => margin.top + (1 - (shown(goal, value) - low) / (high - low)) * plotHeight;
    const short = (value) => (goal.measure === "time" ? GoalLogic.formatMinutes(value) : UI.formatNumber(shown(goal, value)));
    const shortDate = (date) => {
      const [year, month, day] = date.split("-").map(Number);
      return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };

    const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, class: "goal-chart", "aria-hidden": "true" });
    for (const value of [goal.start, goal.target]) {
      const y = yFor(value);
      svg.append(
        svgElement("line", { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: "chart-grid" }),
        svgElement("text", { x: margin.left - 8, y: y + 4, "text-anchor": "end", class: "chart-axis" }, short(value)),
      );
    }
    svg.append(
      svgElement("text", { x: margin.left, y: height - 6, "text-anchor": "start", class: "chart-axis" }, shortDate(goal.startDate)),
      svgElement("text", { x: width - margin.right, y: height - 6, "text-anchor": "end", class: "chart-axis" }, shortDate(goal.endDate)),
      svgElement("line", {
        x1: xFor(goal.startDate),
        y1: yFor(goal.start),
        x2: xFor(goal.endDate),
        y2: yFor(goal.target),
        class: "goal-path",
      }),
    );
    if (today > goal.startDate && today < goal.endDate) {
      const x = xFor(today);
      svg.append(
        svgElement("line", { x1: x, x2: x, y1: margin.top, y2: margin.top + plotHeight, class: "goal-today" }),
        svgElement("text", { x, y: margin.top - 4, "text-anchor": "middle", class: "chart-axis" }, "Today"),
        // Where the path says you should be today, to compare with your last dot.
        svgElement("circle", { cx: x, cy: yFor(GoalLogic.expectedValue(goal, today)), r: 5, class: "goal-should-be" }),
      );
    }
    if (points.length > 1) {
      const line = points.map((point, index) => `${index ? "L" : "M"}${xFor(point.date)},${yFor(point.value)}`).join(" ");
      svg.append(svgElement("path", { d: line, class: "goal-actual" }));
    }
    for (const point of points) {
      svg.append(svgElement("circle", { cx: xFor(point.date), cy: yFor(point.value), r: 4.5, class: "goal-dot" }));
    }
    holder.replaceChildren(svg);
  }

  // ----- The list of goals -----

  function goalSummary(goal, status) {
    // "Now 150 lb · goal 185 lb" reads right whether the goal goes up or down (a faster mile).
    const numbers = `Now ${format(goal, status.latest.value)} · goal ${format(goal, goal.target)}`;
    if (status.state === "reached") return numbers;
    if (status.state === "missed") return `${numbers} · ended ${UI.formatDate(goal.endDate)}`;
    return `${numbers} · week ${status.weekNumber} of ${status.totalWeeks}`;
  }

  function aimLine(goal, status) {
    if (status.state === "reached") return "You reached your goal. Nice work.";
    if (status.state === "missed") return `The goal date passed. You got ${Math.round(status.progress * 100)}% of the way there.`;
    return `This week, aim for ${format(goal, status.aimThisWeek)}.`;
  }

  function pathLine(goal, status) {
    const sign = goal.target > goal.start ? "+" : "−";
    return `Your path: ${sign}${format(goal, Math.abs(status.perWeek))} a week, from ${format(goal, goal.start)} to ${format(goal, goal.target)} by ${UI.formatDate(goal.endDate)}.`;
  }

  function updateForm(goal) {
    const input = el("input", {
      type: "text",
      inputmode: "decimal",
      id: `goal-update-${goal.id}`,
      placeholder: EXAMPLES[goal.measure][0],
      autocomplete: "off",
    });
    const error = el("p", { class: "field-error", "aria-live": "polite" });
    const form = el(
      "form",
      { class: "goal-update", novalidate: true },
      el("label", { class: "field", for: input.id }, "Where are you now?"),
      el("div", { class: "unit-input" }, input, el("span", {}, unitOf(goal))),
      error,
      el("button", { type: "submit", class: "button" }, "Save progress"),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const typed = GoalLogic.parseNumber(input.value);
      const problem = GoalLogic.numberProblem(goal.measure, typed, "where you are now");
      if (problem) {
        error.textContent = problem;
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      const value = stored(goal.measure, typed);
      const updated = { ...goal, updates: GoalLogic.recordUpdate(goal.updates || [], today, value) };
      const wasReached = GoalLogic.goalStatus(goal, today, unit).state === "reached";
      if (save(goals.map((item) => (item.id === goal.id ? updated : item)))) {
        const reached = GoalLogic.goalStatus(updated, today, unit).state === "reached";
        UI.showToast(reached && !wasReached ? `Goal reached: ${goal.name}!` : `Progress saved: ${format(goal, value)}`);
      }
    });
    input.addEventListener("input", () => {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
    });
    return form;
  }

  async function deleteGoal(goal) {
    if (!(await UI.ask(`Delete your ${goal.name} goal? Its progress is deleted too.`, { confirmLabel: "Delete", danger: true }))) {
      return;
    }
    if (save(goals.filter((item) => item.id !== goal.id))) {
      UI.showToast(`Deleted ${goal.name} goal`);
    }
  }

  function goalDetails(goal, status) {
    const chart = el("div", { class: "goal-chart-holder" });
    const details = el(
      "div",
      { class: "goal-details", id: `goal-details-${goal.id}` },
      el("p", { class: "goal-aim" }, aimLine(goal, status)),
      el("p", { class: "goal-path-text" }, pathLine(goal, status)),
      chart,
      el(
        "p",
        { class: "goal-legend" },
        el("span", { class: "goal-legend-path" }, "Your path"),
        el("span", { class: "goal-legend-actual" }, "Your updates"),
        el("span", { class: "goal-legend-now" }, "Where you should be today"),
      ),
    );
    if (status.state === "behind" || status.state === "missed") {
      const reasons = GoalLogic.offTrackReasons(goal, reasonData(), today, (value) => format(goal, value));
      details.append(
        el(
          "div",
          { class: "goal-reasons" },
          el("h3", {}, status.state === "behind" ? "Why you might be behind" : "What may have held you back"),
          el("p", { class: "muted" }, "From the past 7 days:"),
          el("ul", {}, ...reasons.map((reason) => el("li", {}, reason))),
        ),
      );
    }
    // Still there once a goal is reached or past its date, so a typo can be fixed.
    details.append(updateForm(goal));
    details.append(el("button", { type: "button", class: "link-button goal-delete", onclick: () => deleteGoal(goal) }, "Delete goal"));
    chartsToDraw.push(() => pathChart(goal, chart));
    return details;
  }

  function goalItem(goal) {
    const status = GoalLogic.goalStatus(goal, today, unit);
    const isOpen = openGoalId === goal.id;
    const toggle = el(
      "button",
      {
        type: "button",
        class: "goal-toggle",
        "aria-expanded": String(isOpen),
        "aria-controls": `goal-details-${goal.id}`,
        onclick: () => {
          openGoalId = isOpen ? null : goal.id;
          render();
        },
      },
      el(
        "span",
        { class: "goal-top" },
        el("span", { class: "goal-name" }, goal.name),
        el("span", { class: `goal-badge goal-${status.state}` }, STATE_LABELS[status.state]),
      ),
      el("span", { class: "goal-summary" }, goalSummary(goal, status)),
      el("span", { class: "goal-bar", "aria-hidden": "true" }, el("span", { style: `width: ${Math.round(status.progress * 100)}%` })),
      el("span", { class: "goal-more" }, isOpen ? "Hide details" : "Details, update progress"),
    );
    return el("li", { class: `goal-item${isOpen ? " open" : ""}` }, toggle, isOpen ? goalDetails(goal, status) : null);
  }

  function render() {
    chartsToDraw = [];
    const list = goals.length
      ? el("ul", { class: "goal-list" }, ...goals.map(goalItem))
      : el(
          "p",
          { class: "empty goal-empty" },
          "No goals yet. Set one for a lift or cardio, and the app shows what to aim for each week to get there.",
        );
    container.replaceChildren(
      el(
        "div",
        { class: "card-header" },
        el("h2", { id: "goals-heading" }, "Goals"),
        el("button", { type: "button", class: "pill-button", onclick: openNewGoal }, "+ New goal"),
      ),
      list,
    );
    chartsToDraw.forEach((draw) => draw());
    chartsToDraw = [];
  }

  // ----- New goal: one question at a time -----

  const STEP_COUNT = 5;
  let draft;
  let step = 0;
  const sheetTitle = el("h2", { id: "goal-sheet-title" });
  const stepLabel = el("p", { class: "goal-step-label" });
  const dots = el("div", { class: "goal-step-dots", "aria-hidden": "true" });
  const body = el("div", { class: "goal-step-body" });
  const backButton = el("button", { type: "button", class: "button-secondary" }, "Back");
  const nextButton = el("button", { type: "button", class: "button" }, "Next");
  const closeButton = el("button", { type: "button", class: "sheet-close", "aria-label": "Close" }, "×");
  const sheet = el(
    "dialog",
    { class: "sheet goal-sheet", "aria-labelledby": "goal-sheet-title" },
    el("div", { class: "sheet-header" }, el("span", {}, "New goal"), closeButton),
    dots,
    stepLabel,
    sheetTitle,
    body,
    el("div", { class: "sheet-footer button-row goal-sheet-buttons" }, backButton, nextButton),
  );
  document.body.append(sheet);

  function freshDraft() {
    return { kind: "lift", name: "", measure: "weight", distanceUnit: "mi", start: "", target: "", weeks: 8, endDate: "" };
  }

  function draftGoal() {
    return {
      name: draft.name.trim(),
      kind: draft.kind,
      measure: draft.measure,
      distanceUnit: draft.distanceUnit,
      start: stored(draft.measure, GoalLogic.parseNumber(draft.start)),
      target: stored(draft.measure, GoalLogic.parseNumber(draft.target)),
      startDate: today,
      endDate: draft.endDate || GoalLogic.endDateForWeeks(today, draft.weeks),
      updates: [],
    };
  }

  function errorSlot() {
    return el("p", { class: "field-error", id: "goal-step-error", "aria-live": "polite" });
  }

  function showError(message) {
    const slot = body.querySelector("#goal-step-error");
    slot.textContent = message;
    body.querySelector("input")?.setAttribute("aria-invalid", "true");
  }

  function liftChoices() {
    const custom = Store.read(KEYS.customExercises, []);
    const names = new Set();
    return [...(Array.isArray(custom) ? custom : []), ...EXERCISE_LIBRARY]
      .filter((exercise) => exercise.group !== "Cardio")
      .filter((exercise) => !names.has(exercise.name.toLowerCase()) && names.add(exercise.name.toLowerCase()));
  }

  function pick(name) {
    draft.name = name;
    step += 1;
    showStep();
  }

  function kindTabs() {
    const tab = (kind, label) =>
      el(
        "button",
        {
          type: "button",
          role: "radio",
          class: "tab",
          "aria-checked": String(draft.kind === kind),
          onclick: () => {
            if (draft.kind === kind) return;
            Object.assign(draft, { kind, name: "", measure: kind === "lift" ? "weight" : "distance" });
            showStep();
          },
        },
        label,
      );
    return el("div", { class: "tabs", role: "radiogroup", "aria-label": "Goal type" }, tab("lift", "Lift"), tab("cardio", "Cardio"));
  }

  function chooseStep() {
    const parts = [kindTabs()];
    if (draft.name) {
      parts.push(
        el(
          "div",
          { class: "goal-picked" },
          el("span", {}, draft.name),
          el("button", { type: "button", class: "pill-button", onclick: () => { draft.name = ""; showStep(); } }, "Change"),
        ),
      );
    } else if (draft.kind === "cardio") {
      parts.push(
        el(
          "div",
          { class: "goal-pick-list", role: "group", "aria-label": "Cardio" },
          ...GoalLogic.CARDIO_OPTIONS.map((option) =>
            el("button", { type: "button", class: "goal-pick", onclick: () => pick(option.name) }, option.name),
          ),
        ),
      );
    } else {
      const lifts = liftChoices();
      const search = el("input", { type: "search", id: "goal-search", placeholder: "Search, e.g. bench", autocomplete: "off" });
      const results = el("div", { class: "goal-pick-list" });
      const fill = () => {
        const typed = search.value.trim();
        const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = lifts.filter((exercise) => words.every((word) => exercise.name.toLowerCase().includes(word))).slice(0, 8);
        const items = matches.map((exercise) =>
          el("button", { type: "button", class: "goal-pick", onclick: () => pick(exercise.name) }, exercise.name, el("small", {}, exercise.group)),
        );
        if (typed && !matches.some((exercise) => exercise.name.toLowerCase() === typed.toLowerCase())) {
          items.push(el("button", { type: "button", class: "goal-pick goal-pick-own", onclick: () => pick(typed) }, `Use “${typed}”`));
        }
        results.replaceChildren(...items);
      };
      search.addEventListener("input", fill);
      search.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          results.querySelector("button")?.click();
        }
      });
      fill();
      parts.push(el("label", { class: "field", for: "goal-search" }, "Exercise"), search, results);
    }
    parts.push(errorSlot());
    return parts;
  }

  function measureStep() {
    const options =
      draft.kind === "lift"
        ? [["weight", `Weight (${unit})`, "Lift heavier"], ["reps", "Reps", "Do more in one set"]]
        : [["distance", "Distance", "Go farther"], ["time", "Time", "Go longer, or faster"]];
    const parts = [
      el(
        "div",
        { class: "goal-pick-list", role: "radiogroup", "aria-label": "What to track" },
        ...options.map(([measure, label, hint]) =>
          el(
            "button",
            {
              type: "button",
              role: "radio",
              class: "goal-pick",
              "aria-checked": String(draft.measure === measure),
              onclick: () => {
                if (draft.measure !== measure) Object.assign(draft, { measure, start: "", target: "" });
                showStep();
              },
            },
            label,
            el("small", {}, hint),
          ),
        ),
      ),
    ];
    if (draft.measure === "distance") {
      parts.push(
        el(
          "div",
          { class: "chips", role: "radiogroup", "aria-label": "Distance unit" },
          ...["mi", "km"].map((distanceUnit) =>
            el(
              "button",
              {
                type: "button",
                role: "radio",
                class: "chip",
                "aria-checked": String(draft.distanceUnit === distanceUnit),
                "aria-pressed": String(draft.distanceUnit === distanceUnit),
                onclick: () => { draft.distanceUnit = distanceUnit; showStep(); },
              },
              distanceUnit === "mi" ? "Miles" : "Kilometers",
            ),
          ),
        ),
      );
    }
    return parts;
  }

  function numberStep(key) {
    const input = el("input", {
      type: "text",
      inputmode: "decimal",
      id: "goal-number",
      value: draft[key],
      placeholder: EXAMPLES[draft.measure][key === "start" ? 0 : 1],
      autocomplete: "off",
    });
    input.addEventListener("input", () => {
      draft[key] = input.value;
      input.removeAttribute("aria-invalid");
      body.querySelector("#goal-step-error").textContent = "";
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        next();
      }
    });
    const hint =
      key === "start"
        ? NOW_HINTS[draft.measure]
        : `You're at ${draft.start} ${unitOf(draft)} now.${draft.measure === "time" ? " A lower number is fine, like a faster mile." : ""}`;
    return [
      el("label", { class: "visually-hidden", for: "goal-number" }, key === "start" ? "Where you are now" : "Your goal"),
      el("div", { class: "unit-input" }, input, el("span", {}, unitOf(draft))),
      el("p", { class: "field-hint" }, hint),
      errorSlot(),
    ];
  }

  function preview() {
    const goal = draftGoal();
    if (GoalLogic.validateGoal(goal, today).length) {
      return el("p", { class: "muted" }, "Pick a date after today to see your plan.");
    }
    const status = GoalLogic.goalStatus(goal, today, unit);
    const perWeek = Math.abs(status.perWeek);
    const sign = goal.target > goal.start ? "+" : "−";
    const children = [
      el("p", { class: "goal-aim" }, `Week 1: aim for ${format(goal, status.aimThisWeek)}`),
      el(
        "p",
        {},
        `That's ${sign}${format(goal, perWeek)} a week for ${UI.plural(status.totalWeeks, "week")}, reaching ${format(goal, goal.target)} by ${UI.formatDate(goal.endDate)}.`,
      ),
    ];
    if (goal.measure === "weight" && perWeek > 10) {
      children.push(el("p", { class: "goal-warning" }, "That's a big jump every week. Most people add 2.5 to 5 lb a week, so a later date may be easier to hit."));
    }
    return el("div", { class: "goal-preview", "aria-live": "polite" }, ...children);
  }

  function dateStep() {
    const dateInput = el("input", { type: "date", id: "goal-date", value: draft.endDate, min: WorkoutLogic.addDays(today, 1) });
    dateInput.addEventListener("change", () => {
      draft.endDate = dateInput.value;
      showStep();
    });
    return [
      el(
        "div",
        { class: "chips", role: "radiogroup", "aria-label": "How long" },
        ...WEEK_CHOICES.map((weeks) =>
          el(
            "button",
            {
              type: "button",
              role: "radio",
              class: "chip",
              "aria-checked": String(!draft.endDate && draft.weeks === weeks),
              "aria-pressed": String(!draft.endDate && draft.weeks === weeks),
              onclick: () => { Object.assign(draft, { weeks, endDate: "" }); showStep(); },
            },
            `${weeks} weeks`,
          ),
        ),
      ),
      el("label", { class: "field", for: "goal-date" }, "Or pick a date"),
      dateInput,
      errorSlot(),
      preview(),
    ];
  }

  const STEPS = [
    { title: () => "What's the goal for?", build: chooseStep },
    { title: () => "What do you want to improve?", build: measureStep },
    { title: () => `Where are you now on ${draft.name}?`, build: () => numberStep("start") },
    { title: () => "What's your goal?", build: () => numberStep("target") },
    { title: () => "By when?", build: dateStep },
  ];

  function showStep() {
    sheetTitle.textContent = STEPS[step].title();
    stepLabel.textContent = `Step ${step + 1} of ${STEP_COUNT}`;
    dots.replaceChildren(...STEPS.map((_, index) => el("span", { class: index <= step ? "on" : "" })));
    body.replaceChildren(...STEPS[step].build());
    backButton.hidden = step === 0;
    nextButton.textContent = step === STEP_COUNT - 1 ? "Save goal" : "Next";
    body.querySelector("#goal-number, #goal-search")?.focus();
  }

  // Checks this step's answer; returns a message, or "" to move on.
  function stepProblem() {
    if (step === 0) return draft.name ? "" : draft.kind === "lift" ? "Tap an exercise in the list. Search to find it." : "Tap a kind of cardio.";
    if (step === 2) return GoalLogic.numberProblem(draft.measure, GoalLogic.parseNumber(draft.start), "where you are now");
    if (step === 3) {
      const target = GoalLogic.parseNumber(draft.target);
      const problem = GoalLogic.numberProblem(draft.measure, target, "your goal");
      if (problem) return problem;
      if (target === GoalLogic.parseNumber(draft.start)) return "Your goal should be different from where you are now.";
      if (target === 0) return "Your goal should be more than 0.";
    }
    return "";
  }

  function next() {
    // A quick double tap on Save goal shouldn't save it twice.
    if (!sheet.open) return;
    const problem = stepProblem();
    if (problem) {
      showError(problem);
      return;
    }
    if (step < STEP_COUNT - 1) {
      step += 1;
      showStep();
      return;
    }
    const goal = draftGoal();
    const errors = GoalLogic.validateGoal(goal, today);
    if (errors.length) {
      showError(errors[0].message);
      return;
    }
    const id = `goal-${Date.now()}`;
    if (save([...goals, { id, ...goal }])) {
      sheet.close();
      openGoalId = id;
      render();
      UI.showToast(`Goal saved: ${goal.name}`);
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function openNewGoal() {
    draft = freshDraft();
    step = 0;
    showStep();
    sheet.showModal();
    body.querySelector("#goal-search")?.focus();
  }

  backButton.addEventListener("click", () => {
    step -= 1;
    showStep();
  });
  nextButton.addEventListener("click", next);
  // Only the × and Escape close it: a stray tap outside shouldn't lose the answers.
  closeButton.addEventListener("click", () => sheet.close());

  render();
})();
