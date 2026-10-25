// Plate calculator: shows which plates go on each side of the bar for a
// weight, with a drawing of the loaded bar. Opened from a set's plates button.
// Works with pound plates or kilogram plates, switchable inside the sheet.
const PlateCalculator = (() => {
  const { KEYS } = Store;
  const { el } = UI;
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  const BARS = {
    olympic: { label: "Olympic", defaultWeight: { lb: 45, kg: 20 } },
    ez: { label: "EZ bar", defaultWeight: { lb: 25, kg: 10 } },
    trap: { label: "Trap bar", defaultWeight: { lb: 55, kg: 25 } },
  };
  const PLATE_SIZES = { lb: WorkoutLogic.PLATE_SIZES, kg: WorkoutLogic.PLATE_SIZES_KG };
  // Drawn size of each plate: thickness and height in drawing units.
  const PLATE_SHAPES = {
    lb: {
      45: { thickness: 18, height: 108 },
      35: { thickness: 16, height: 94 },
      25: { thickness: 14, height: 78 },
      10: { thickness: 10, height: 58 },
      5: { thickness: 8, height: 44 },
      2.5: { thickness: 6, height: 34 },
    },
    kg: {
      25: { thickness: 18, height: 108 },
      20: { thickness: 16, height: 108 },
      15: { thickness: 14, height: 96 },
      10: { thickness: 12, height: 80 },
      5: { thickness: 9, height: 56 },
      2.5: { thickness: 7, height: 42 },
      1.25: { thickness: 6, height: 34 },
    },
  };
  const MAX_TARGET = { lb: 1500, kg: 700 };
  // Warm-up weights are rounded to a weight you can load: one smallest plate per side.
  const WARMUP_STEP = { lb: 5, kg: 2.5 };
  const MAX_BAR = { lb: 200, kg: 90 };

  // Plate weights need two decimals so the 1.25 kg plate doesn't show as 1.3.
  const formatPlate = (weight) => weight.toLocaleString(undefined, { maximumFractionDigits: 2 });

  let barType = "olympic";
  let plateUnit = "lb";
  // Which warm-up steps are done for the exercise this sheet was opened from,
  // and who to tell when one is tapped: { done: { "40": time, ... }, onToggle },
  // where onToggle(stepKey, isDone) saves the change and returns the new `done`.
  let warmupContext = null;

  // ----- Sheet layout -----

  const title = el("h2", { id: "plate-title" }, "Plates");
  const unitChoices = el("div", { class: "tabs", role: "radiogroup", "aria-label": "Plate units" });
  const barChoices = el("div", { class: "tabs bar-tabs", role: "radiogroup", "aria-label": "Bar type" });
  const numberInput = (id) => el("input", { type: "number", inputmode: "decimal", min: "0", step: "any", id });
  const targetInput = numberInput("plate-target");
  const barWeightInput = numberInput("bar-weight");
  const targetLabel = el("span", {});
  const barLabel = el("span", {});
  const plateClass = (plate) => `plate-${plateUnit}-${String(plate).replace(".", "-")}`;
  const drawing = el("div", { class: "plate-drawing" });
  const plateKey = el("ul", { class: "plate-key", "aria-hidden": "true" });
  const summary = el("p", { class: "plate-summary", "aria-live": "polite" });
  const legend = el("p", { class: "note plate-legend" });
  const warmupList = el("ul", { class: "warmup-list" });
  const warmupSection = el(
    "section",
    { class: "warmup", "aria-labelledby": "warmup-title" },
    el("h3", { id: "warmup-title" }, "Warm-up"),
    el(
      "p",
      { class: "muted warmup-intro" },
      "Tap Done as you finish each one. Warm-ups count toward time and calories, not load.",
    ),
    warmupList,
  );

  const dialog = el(
    "dialog",
    { class: "sheet", "aria-labelledby": "plate-title" },
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
    unitChoices,
    barChoices,
    el(
      "div",
      { class: "field-row" },
      el("label", { class: "field" }, targetLabel, targetInput),
      el("label", { class: "field" }, barLabel, barWeightInput),
    ),
    drawing,
    plateKey,
    summary,
    warmupSection,
    legend,
  );
  document.body.append(dialog);
  // Clicking the dimmed area outside the sheet closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  // Saved bar weights, per unit: { lb: { olympic: 45, ... }, kg: { ... } }.
  // Older saves held only pound weights ({ olympic: 45, ... }).
  function savedBarWeights() {
    const saved = Store.read(KEYS.barWeights, {});
    return saved.lb || saved.kg ? saved : { lb: saved, kg: {} };
  }

  function barWeight(type, unit) {
    return savedBarWeights()[unit]?.[type] ?? BARS[type].defaultWeight[unit];
  }

  function saveBarWeight(weight) {
    const saved = savedBarWeights();
    Store.write(KEYS.barWeights, { ...saved, [plateUnit]: { ...saved[plateUnit], [barType]: weight } });
  }

  function radioButtons(options, selected, onSelect) {
    return options.map(([value, label]) =>
      el(
        "button",
        {
          type: "button",
          class: "tab",
          role: "radio",
          "aria-checked": String(value === selected),
          onclick: () => onSelect(value),
        },
        label,
      ),
    );
  }

  function renderChoices() {
    unitChoices.replaceChildren(
      ...radioButtons(
        [
          ["lb", "lb plates"],
          ["kg", "kg plates"],
        ],
        plateUnit,
        switchUnit,
      ),
    );
    barChoices.replaceChildren(
      ...radioButtons(
        Object.entries(BARS).map(([type, bar]) => [type, bar.label]),
        barType,
        (type) => {
          barType = type;
          barWeightInput.value = barWeight(type, plateUnit);
          renderChoices();
          update();
        },
      ),
    );
    targetLabel.textContent = `Target (${plateUnit})`;
    barLabel.textContent = `Bar (${plateUnit})`;
    legend.textContent =
      `Plates: ${PLATE_SIZES[plateUnit].map(formatPlate).join(", ")} ${plateUnit}. ` +
      "Bar weights are remembered for next time.";
  }

  // Converts the target to the other unit, so 135 lb becomes 61.2 kg.
  function switchUnit(unit) {
    if (unit === plateUnit) {
      return;
    }
    const target = Number(targetInput.value);
    if (targetInput.value !== "" && target >= 0) {
      targetInput.value = Units.fromPounds(Units.toPounds(target, plateUnit), unit);
    }
    plateUnit = unit;
    barWeightInput.value = barWeight(barType, plateUnit);
    renderChoices();
    update();
  }

  // ----- Drawing -----

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, String(value));
    }
    return node;
  }

  // The middle of the bar, where your hands go, drawn differently for each bar.
  function drawGrip(svg, type, centerY) {
    if (type === "trap") {
      const hexagon = "130,30 230,30 260,70 230,110 130,110 100,70";
      svg.append(svgElement("polygon", { points: hexagon, class: "bar-frame" }));
      svg.append(svgElement("line", { x1: 150, y1: 50, x2: 150, y2: 90, class: "bar-handle" }));
      svg.append(svgElement("line", { x1: 210, y1: 50, x2: 210, y2: 90, class: "bar-handle" }));
    } else if (type === "ez") {
      const zigzag = "100,70 125,70 140,62 160,78 180,62 200,78 220,62 235,70 260,70";
      svg.append(svgElement("polyline", { points: zigzag, class: "bar-shaft" }));
    } else {
      svg.append(svgElement("line", { x1: 100, y1: centerY, x2: 260, y2: centerY, class: "bar-shaft" }));
    }
  }

  // Plates stack outward from each collar, heaviest closest to the middle.
  function drawPlates(svg, plates, centerY) {
    const shapes = PLATE_SHAPES[plateUnit];
    const sleeveLength = 92;
    const naturalWidth = plates.reduce((sum, plate) => sum + shapes[plate].thickness + 2, 0);
    // Squeeze the plates if there are too many to fit on the sleeve.
    const squeeze = naturalWidth > sleeveLength ? sleeveLength / naturalWidth : 1;
    for (const side of [-1, 1]) {
      let x = side === -1 ? 92 : 268;
      for (const plate of plates) {
        const { thickness, height } = shapes[plate];
        const width = thickness * squeeze;
        const plateX = side === -1 ? x - width : x;
        svg.append(
          svgElement("rect", {
            x: plateX,
            y: centerY - height / 2,
            width,
            height,
            rx: 2,
            class: `plate ${plateClass(plate)}`,
          }),
        );
        x += side * (width + 2 * squeeze);
      }
    }
  }

  function draw(plates) {
    const centerY = 70;
    const svg = svgElement("svg", { viewBox: "0 0 360 140", class: "plate-svg", "aria-hidden": "true" });
    // Sleeves, then collars, then the grip, then the plates on top.
    svg.append(svgElement("line", { x1: 0, y1: centerY, x2: 100, y2: centerY, class: "bar-sleeve" }));
    svg.append(svgElement("line", { x1: 260, y1: centerY, x2: 360, y2: centerY, class: "bar-sleeve" }));
    svg.append(svgElement("rect", { x: 92, y: centerY - 9, width: 8, height: 18, rx: 2, class: "bar-collar" }));
    svg.append(svgElement("rect", { x: 260, y: centerY - 9, width: 8, height: 18, rx: 2, class: "bar-collar" }));
    drawGrip(svg, barType, centerY);
    drawPlates(svg, plates, centerY);
    drawing.replaceChildren(svg);
    // A key matching each plate color to its weight, for the plates in use.
    const used = PLATE_SIZES[plateUnit].filter((plate) => plates.includes(plate));
    plateKey.replaceChildren(
      ...used.map((plate) =>
        el(
          "li",
          {},
          el("span", { class: `plate-swatch ${plateClass(plate)}` }),
          `${formatPlate(plate)} ${plateUnit}`,
        ),
      ),
    );
  }

  // ----- Calculation and text -----

  function readWeight(input, max) {
    const value = Number(input.value);
    return input.value !== "" && value >= 0 && value <= max ? value : null;
  }

  // The warm-up ladder for the target weight, with plates per side and a Done button for each step.
  function renderWarmups(target, bar) {
    const unit = plateUnit;
    const steps = WorkoutLogic.warmupSteps(target, bar, WARMUP_STEP[unit]);
    if (steps.length === 0) {
      warmupList.replaceChildren(el("li", { class: "empty" }, "No warm-up needed at this weight."));
      return;
    }
    warmupList.replaceChildren(
      ...steps.map((step) => {
        const { plates } = WorkoutLogic.platesPerSide(step.weight, bar, PLATE_SIZES[unit]);
        const loading = plates.length > 0 ? `${plates.map(formatPlate).join(" + ")} per side` : "just the bar";
        const isDone = Boolean(warmupContext?.done[step.key]);
        const weightText = `${formatPlate(step.weight)} ${unit} × ${step.reps}`;
        return el(
          "li",
          { class: isDone ? "warmup-step done" : "warmup-step" },
          el(
            "div",
            {},
            el("span", { class: "row-title" }, step.key === "bar" ? `Bar (${weightText})` : weightText),
            el("span", { class: "row-meta" }, loading),
          ),
          warmupContext
            ? el(
                "button",
                {
                  type: "button",
                  class: `set-step ${isDone ? "done" : "ready"}`,
                  "aria-pressed": String(isDone),
                  "aria-label": `${isDone ? "Undo" : "Mark done"}: warm-up ${weightText}`,
                  onclick: () => {
                    // onToggle saves the change and returns the updated list of done steps.
                    warmupContext.done = warmupContext.onToggle(step.key, !isDone);
                    update();
                  },
                },
                isDone ? "✓" : "Done",
              )
            : null,
        );
      }),
    );
  }

  function update() {
    const unit = plateUnit;
    const target = readWeight(targetInput, MAX_TARGET[unit]);
    const bar = readWeight(barWeightInput, MAX_BAR[unit]);
    if (bar !== null) {
      saveBarWeight(bar);
    }
    title.textContent = target === null ? "Plates" : `Plates for ${UI.formatNumber(target)} ${unit}`;
    warmupSection.hidden = true;
    if (target === null || bar === null) {
      summary.textContent = "Enter a target weight and the bar's weight.";
      draw([]);
      return;
    }
    if (target < bar) {
      summary.textContent = `That's less than the ${BARS[barType].label.toLowerCase()} itself (${bar} ${unit}).`;
      draw([]);
      return;
    }
    warmupSection.hidden = false;
    renderWarmups(target, bar);
    const { plates, total } = WorkoutLogic.platesPerSide(target, bar, PLATE_SIZES[unit]);
    draw(plates);
    const perSide = plates.length > 0 ? plates.map(formatPlate).join(" + ") : "nothing, just the bar";
    const closest =
      total < target
        ? ` That makes ${formatPlate(total)} ${unit}, the closest you can get with these plates.`
        : "";
    summary.textContent = `Each side: ${perSide}.${closest}`;
  }

  targetInput.addEventListener("input", update);
  barWeightInput.addEventListener("input", update);
  for (const input of [targetInput, barWeightInput]) {
    input.addEventListener("focus", () => setTimeout(() => input.select(), 0));
  }

  // Opens the sheet for a weight saved in pounds, shown in the app's chosen
  // unit. `defaultBar` is "olympic", "ez" or "trap". `warmups` (optional) is
  // { done, onToggle(stepKey, isDone) } for the exercise's warm-up checkmarks.
  function open(weightInPounds, defaultBar = "olympic", warmups = null) {
    warmupContext = warmups;
    barType = defaultBar;
    plateUnit = Units.current();
    targetInput.value = weightInPounds ? Units.fromPounds(weightInPounds, plateUnit) : "";
    barWeightInput.value = barWeight(barType, plateUnit);
    renderChoices();
    update();
    dialog.showModal();
  }

  return { open };
})();
