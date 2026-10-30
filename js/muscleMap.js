// Muscle map: front and back body figures with the exercise's main muscles
// lit bright and the muscles that also work lit dimmer. Muscle names match
// the exercise database (chest, lats, middle back, quadriceps, ...).
const MuscleMap = (() => {
  const { el } = UI;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // Each muscle's shapes on a 100 × 178 figure: [x, y, width, height], drawn
  // as rounded capsules. Left and right sides are separate shapes.
  const FRONT = {
    neck: [[45, 22, 10, 7]],
    shoulders: [
      [24, 30, 14, 14],
      [62, 30, 14, 14],
    ],
    chest: [
      [38.5, 31, 11, 17],
      [50.5, 31, 11, 17],
    ],
    biceps: [
      [24, 46, 10, 18],
      [66, 46, 10, 18],
    ],
    forearms: [
      [22, 66, 9, 22],
      [69, 66, 9, 22],
    ],
    abdominals: [
      [41, 50, 8.5, 11],
      [50.5, 50, 8.5, 11],
      [41, 62, 8.5, 11],
      [50.5, 62, 8.5, 11],
      [41, 74, 8.5, 12],
      [50.5, 74, 8.5, 12],
    ],
    abductors: [
      [31.5, 88, 5, 16],
      [63.5, 88, 5, 16],
    ],
    quadriceps: [
      [37, 90, 9, 42],
      [54, 90, 9, 42],
    ],
    adductors: [
      [46.5, 92, 3, 22],
      [50.5, 92, 3, 22],
    ],
    calves: [
      [38, 136, 8, 28],
      [54, 136, 8, 28],
    ],
  };
  const BACK = {
    traps: [[40, 22, 20, 20]],
    shoulders: [
      [24, 30, 14, 14],
      [62, 30, 14, 14],
    ],
    triceps: [
      [24, 46, 10, 18],
      [66, 46, 10, 18],
    ],
    forearms: [
      [22, 66, 9, 22],
      [69, 66, 9, 22],
    ],
    lats: [
      [34.5, 44, 7, 30],
      [58.5, 44, 7, 30],
    ],
    "middle back": [[42.5, 43.5, 15, 17]],
    "lower back": [[43, 62, 14, 22]],
    abductors: [
      [31.5, 86, 5, 14],
      [63.5, 86, 5, 14],
    ],
    glutes: [
      [38, 86, 11.5, 14],
      [50.5, 86, 11.5, 14],
    ],
    hamstrings: [
      [38, 102, 11, 32],
      [51, 102, 11, 32],
    ],
    calves: [
      [38, 136, 9, 28],
      [53, 136, 9, 28],
    ],
  };
  // Head, hands and feet, never highlighted.
  const BODY_PARTS = [
    ["circle", { cx: 50, cy: 12, r: 9 }],
    ["circle", { cx: 26.5, cy: 93, r: 4 }],
    ["circle", { cx: 73.5, cy: 93, r: 4 }],
    ["rect", { x: 37, y: 166, width: 10, height: 6, rx: 3 }],
    ["rect", { x: 53, y: 166, width: 10, height: 6, rx: 3 }],
  ];

  function svgEl(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    return node;
  }

  function figure(shapes, main, also) {
    const svg = svgEl("svg", { viewBox: "0 0 100 178", "aria-hidden": "true" });
    for (const [tag, attributes] of BODY_PARTS) {
      svg.append(svgEl(tag, { ...attributes, class: "muscle-idle" }));
    }
    for (const [muscle, boxes] of Object.entries(shapes)) {
      let state = "idle";
      if (main.includes(muscle)) {
        state = "main";
      } else if (also.includes(muscle)) {
        state = "also";
      }
      for (const [x, y, width, height] of boxes) {
        const rx = Math.min(width, height) / 2;
        svg.append(svgEl("rect", { x, y, width, height, rx, class: `muscle-${state}`, "data-muscle": muscle }));
      }
    }
    return svg;
  }

  const capitalize = (muscle) => muscle.charAt(0).toUpperCase() + muscle.slice(1);

  function namesLine(kind, label, muscles) {
    return el(
      "p",
      {},
      el("span", { class: `muscle-swatch muscle-${kind}`, "aria-hidden": "true" }),
      `${label}: ${muscles.map(capitalize).join(", ")}`,
    );
  }

  // draw(["chest"], ["shoulders", "triceps"]) -> a card with both figures and the muscle names.
  function draw(main, also) {
    const side = (shapes, label) =>
      el("div", { class: "muscle-figure" }, figure(shapes, main, also), el("p", { class: "muscle-figure-label" }, label));
    return el(
      "div",
      { class: "muscle-card" },
      el("div", { class: "muscle-figures" }, side(FRONT, "Front"), side(BACK, "Back")),
      el(
        "div",
        { class: "muscle-names" },
        main.length > 0 ? namesLine("main", "Main", main) : null,
        also.length > 0 ? namesLine("also", "Also works", also) : null,
      ),
    );
  }

  return { draw, MUSCLES: [...new Set([...Object.keys(FRONT), ...Object.keys(BACK)])] };
})();
