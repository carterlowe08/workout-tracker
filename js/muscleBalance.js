// Muscle balance on Home: the body map shaded by this week's sets, a ring per
// muscle that closes at the weekly target, and a line on the muscle picked by
// tapping either one.
(() => {
  const { el } = UI;
  const { GROUPS } = MuscleBalance;
  const RING_RADIUS = 22;
  const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
  // The full name doesn't fit under a ring on a phone; the detail line has it.
  const SHORT_NAMES = { Hamstrings: "Hams" };
  const OTHER_NAMES = { abductors: "Outer thighs", adductors: "Inner thighs" };

  const week = MuscleBalance.weekSets(Store.read(Store.KEYS.workouts, []), UI.todayKey());
  let target = MuscleBalance.clampTarget(Store.read(Store.KEYS.muscleTarget, MuscleBalance.DEFAULT_TARGET));

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const setsText = (sets) => `${UI.formatNumber(sets)} ${sets === 1 ? "set" : "sets"}`;
  const groupOf = (muscle) => GROUPS.find((group) => group.muscles.includes(muscle));
  // What tapping a muscle picks: its ring, or the muscle itself without one.
  const keyFor = (muscle) => groupOf(muscle)?.name || muscle;

  // Starts on the muscle with the fewest sets, the one worth noticing.
  let selected = GROUPS.reduce((lowest, group) =>
    week.groups[group.name] < week.groups[lowest.name] ? group : lowest,
  ).name;

  // ----- Body map -----

  const figures = el("div", {
    onclick: (event) => {
      const muscle = event.target.closest?.("[data-muscle]")?.dataset.muscle;
      if (muscle) pick(keyFor(muscle));
    },
  });

  function renderFigures() {
    figures.replaceChildren(
      MuscleMap.drawFigures(
        (muscle) => {
          const trained = week.muscles[muscle] > 0 ? "balance-trained" : "balance-untrained";
          return keyFor(muscle) === selected ? `${trained} selected` : trained;
        },
        (muscle) => `--shade: ${MuscleBalance.shade(week.muscles[muscle], target)}%`,
      ),
    );
  }

  // ----- Rings -----

  function svgEl(tag, attributes, text = "") {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    node.textContent = text;
    return node;
  }

  function ringDrawing(sets) {
    const circle = { cx: 28, cy: 28, r: RING_RADIUS };
    const svg = svgEl("svg", { viewBox: "0 0 56 56", "aria-hidden": "true" });
    svg.append(svgEl("circle", circle));
    if (sets > 0) {
      const filled = Math.min(sets / target, 1) * RING_LENGTH;
      svg.append(
        svgEl("circle", {
          ...circle,
          class: "filled",
          "stroke-dasharray": `${filled} ${RING_LENGTH}`,
          transform: "rotate(-90 28 28)",
        }),
      );
    }
    svg.append(svgEl("text", { x: 28, y: 33 }, sets >= target ? "✓" : UI.formatNumber(sets)));
    return svg;
  }

  const ringButtons = new Map(
    GROUPS.map(({ name }) => [name, el("button", { type: "button", class: "balance-ring", onclick: () => pick(name) })]),
  );

  function renderRings() {
    for (const [name, button] of ringButtons) {
      const sets = week.groups[name];
      button.setAttribute("aria-pressed", String(name === selected));
      button.setAttribute("aria-label", `${name}: ${UI.formatNumber(sets)} of ${target} sets`);
      button.replaceChildren(ringDrawing(sets), SHORT_NAMES[name] || name);
    }
  }

  // ----- The picked muscle -----

  const detail = el("div", { class: "balance-detail", "aria-live": "polite" });

  function renderDetail() {
    const hasRing = selected in week.groups;
    const group = GROUPS.find((item) => item.name === selected);
    const sets = hasRing ? week.groups[selected] : week.muscles[selected];
    const name = hasRing ? selected : OTHER_NAMES[selected] || capitalize(selected);
    const lifts = week.lifts[selected].map(([lift, count]) => `${lift} ${UI.formatNumber(count)}`).join(" · ");
    const left = target - sets;
    let next = null;
    if (hasRing) {
      next = left > 0 ? `${setsText(left)} left. Try ${MuscleBalance.suggestedLift(selected)}.` : "Target reached.";
    }
    // Back is several muscles on the body map, so say how they split.
    const split =
      hasRing && group.muscles.length > 1 && sets > 0
        ? group.muscles.map((muscle) => `${capitalize(muscle)} ${UI.formatNumber(week.muscles[muscle])}`).join(" · ")
        : null;
    detail.replaceChildren(
      ...[
        el(
          "p",
          { class: "balance-detail-title" },
          hasRing ? `${name} · ${UI.formatNumber(sets)} of ${target} sets` : `${name} · ${setsText(sets)}`,
        ),
        el("p", {}, lifts || "Not trained this week."),
        split ? el("p", { class: "muted" }, split) : null,
        next ? el("p", { class: "muted" }, next) : null,
      ].filter(Boolean),
    );
  }

  function pick(key) {
    selected = key;
    render();
  }

  // ----- Target -----

  const targetText = el("strong", {});
  const fewer = el("button", { type: "button", class: "icon-square", "aria-label": "Lower the weekly target" }, "−");
  const more = el("button", { type: "button", class: "icon-square", "aria-label": "Raise the weekly target" }, "+");

  function changeTarget(step) {
    const changed = MuscleBalance.clampTarget(target + step);
    if (!Store.write(Store.KEYS.muscleTarget, changed)) {
      UI.showSaveError();
      return;
    }
    target = changed;
    render();
  }
  fewer.addEventListener("click", () => changeTarget(-1));
  more.addEventListener("click", () => changeTarget(1));

  // ----- The card -----

  const legendEnd = el("span", {});
  const reached = el("p", { class: "muted balance-summary" });

  function render() {
    targetText.textContent = target;
    legendEnd.textContent = `${target}+`;
    fewer.disabled = target === MuscleBalance.MIN_TARGET;
    more.disabled = target === MuscleBalance.MAX_TARGET;
    const closed = GROUPS.filter(({ name }) => week.groups[name] >= target).length;
    const empty = GROUPS.every(({ name }) => week.groups[name] === 0);
    reached.textContent = empty
      ? "No sets yet this week (Sunday to Saturday). Save a workout and the muscles it works light up."
      : `Sunday to Saturday · ${closed} of ${GROUPS.length} at target`;
    renderFigures();
    renderRings();
    renderDetail();
  }

  render();
  document.getElementById("muscle-balance").replaceChildren(
    ...[
      el(
        "div",
        { class: "card-header" },
        el("h2", { id: "balance-heading" }, "Muscle balance"),
        el(
          "div",
          { class: "balance-legend" },
          el("span", {}, "0"),
          el("i", { class: "balance-untrained" }),
          el("i", { class: "balance-legend-range" }),
          legendEnd,
        ),
      ),
      reached,
      figures,
      el("div", { class: "balance-rings" }, [...ringButtons.values()]),
      detail,
      el(
        "div",
        { class: "balance-target" },
        "Weekly target",
        el(
          "div",
          { class: "goal-stepper", role: "group", "aria-label": "Weekly target" },
          fewer,
          el("span", { class: "goal-stepper-value", "aria-live": "polite" }, targetText, " sets"),
          more,
        ),
      ),
      el("p", { class: "note" }, "A muscle that helps on a lift counts as half a set. Cardio isn't counted."),
      week.uncounted > 0
        ? el(
            "p",
            { class: "note" },
            `${setsText(week.uncounted)} of custom exercises left out: Legs, Arms and Other don't say which muscle.`,
          )
        : null,
    ].filter(Boolean),
  );
})();
