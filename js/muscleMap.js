// Muscle map: anatomical front and back figures with the exercise's main
// muscles in red and the muscles that also work in pink. Muscle names match
// the exercise database (chest, lats, middle back, quadriceps, ...).
const MuscleMap = (() => {
  const { el } = UI;
  const SVG_NS = "http://www.w3.org/2000/svg";
  const WIDTH = 200;

  // Shapes for the viewer's left half of a 200 × 400 figure; each is drawn
  // again mirrored for the right half. The dark body shows through the gaps
  // between muscles, so it outlines them.
  const FRONT = {
    neck: ["M93 50 L99 50 L99 70 L96 70 Z"],
    traps: ["M91 56 C86 62 78 66 70 69 L84 72 C88 66 91 62 91 56 Z"],
    shoulders: ["M65 70 C53 71 44 80 42 94 C41 102 43 110 47 114 C52 100 58 88 68 80 C69 76 68 72 65 70 Z"],
    chest: ["M74 76 C82 72 92 72 99 75 L99 106 C90 112 77 112 67 104 C61 98 62 86 74 76 Z"],
    biceps: ["M47 116 C42 126 40 140 42 152 C45 158 51 158 54 152 C57 140 58 126 55 112 C52 112 49 113 47 116 Z"],
    forearms: [
      "M39 160 C33 174 29 190 28 206 L35 208 C40 194 45 178 49 162 C46 159 42 158 39 160 Z",
      "M51 162 C49 178 44 194 38 210 L43 211 C49 196 54 180 55 164 Z",
    ],
    abdominals: [
      "M87 110 L99 110 L99 126 L86 126 Q85 117 87 110 Z",
      "M86 129 L99 129 L99 145 L86 145 Z",
      "M86 148 L99 148 L99 164 L87 164 Z",
      "M87 167 L99 167 L99 196 C94 192 90 184 87 174 Z",
      "M66 108 C72 114 78 116 83 114 L84 168 C78 164 72 152 68 138 C66 128 65 116 66 108 Z",
    ],
    abductors: ["M66 172 C61 182 59 194 60 208 L65 204 C67 192 70 182 74 174 Z"],
    quadriceps: [
      "M68 186 C62 210 60 240 63 268 C66 278 72 282 77 280 C76 250 76 220 78 196 C75 190 72 187 68 186 Z",
      "M80 196 C80 222 80 252 80 280 C86 282 90 278 90 270 C93 248 93 222 90 204 C87 200 84 197 80 196 Z",
    ],
    adductors: ["M93 192 C97 196 99 202 99 210 C98 226 95 240 92 250 C93 232 94 212 93 192 Z"],
    calves: [
      "M66 296 C61 312 61 334 65 354 L72 356 C74 336 75 314 73 296 C71 294 68 294 66 296 Z",
      "M76 296 C82 310 85 330 82 352 L76 356 C78 334 78 314 76 296 Z",
    ],
  };
  const BACK = {
    traps: ["M93 48 L99 48 L99 100 C90 98 82 96 76 94 C72 86 66 78 58 72 C72 68 86 62 93 48 Z"],
    shoulders: ["M63 70 C52 71 44 80 42 94 C41 102 43 110 47 114 C52 100 59 88 69 82 C68 77 66 73 63 70 Z"],
    triceps: ["M46 116 C41 128 40 142 43 154 L53 154 C56 140 57 126 55 114 C52 113 49 113 46 116 Z"],
    forearms: [
      "M39 160 C33 174 29 190 28 206 L35 208 C40 194 45 178 49 162 C46 159 42 158 39 160 Z",
      "M51 162 C49 178 44 194 38 210 L43 211 C49 196 54 180 55 164 Z",
    ],
    "middle back": ["M99 103 L99 140 C92 134 85 122 79 106 C84 103 92 102 99 103 Z"],
    lats: ["M73 98 C67 104 64 118 66 134 C69 148 78 160 90 168 L90 150 C84 138 79 124 76 106 Z"],
    "lower back": ["M93 146 L99 146 L99 194 L91 192 C89 176 89 160 93 146 Z"],
    abductors: ["M64 176 C59 184 58 196 62 206 C64 196 67 188 72 180 Z"],
    glutes: ["M67 192 C62 206 64 222 75 230 C85 235 95 233 99 227 L99 198 C90 192 78 190 67 192 Z"],
    hamstrings: [
      "M67 238 C62 256 63 278 69 292 L79 292 C79 272 79 254 78 238 C74 236 70 236 67 238 Z",
      "M81 238 C83 254 86 274 86 292 L95 290 C97 270 97 252 95 238 C90 236 85 236 81 238 Z",
    ],
    calves: [
      "M68 300 C62 316 63 336 71 348 L79 346 C81 330 81 314 79 300 C75 298 71 298 68 300 Z",
      "M82 300 C86 314 88 332 84 346 L90 344 C94 330 94 312 89 300 C87 298 84 298 82 300 Z",
    ],
  };
  // Head, neck, hands, knees and feet: part of the dark body, never highlighted.
  const BODY_PARTS = [
    ["ellipse", { cx: 100, cy: 28, rx: 16, ry: 20 }],
    ["path", { d: "M90 44 L110 44 L112 66 L88 66 Z" }],
    ["path", { d: "M29 208 C25 216 24 226 27 234 C29 238 33 238 35 234 C38 226 40 218 39 210 Z" }],
    ["path", { d: "M66 280 L88 280 L84 294 L69 294 Z" }],
    ["path", { d: "M66 354 C64 362 64 370 70 374 C76 376 82 374 82 368 L80 354 Z" }],
  ];

  function svgEl(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attributes)) {
      node.setAttribute(name, value);
    }
    return node;
  }

  // Draws the shape on the left, and a mirrored copy on the right.
  function bothSides(tag, attributes) {
    const left = svgEl(tag, attributes);
    const right = svgEl(tag, { ...attributes, transform: `matrix(-1 0 0 1 ${WIDTH} 0)` });
    return [left, right];
  }

  function figure(shapes, main, also) {
    const svg = svgEl("svg", { viewBox: `0 0 ${WIDTH} 400`, "aria-hidden": "true" });
    // The body: every shape drawn dark with a thick outline fills the gaps between muscles.
    const body = svgEl("g", { class: "muscle-body" });
    for (const [tag, attributes] of BODY_PARTS) {
      body.append(...bothSides(tag, attributes));
    }
    for (const paths of Object.values(shapes)) {
      for (const d of paths) {
        body.append(...bothSides("path", { d }));
      }
    }
    svg.append(body);
    for (const [muscle, paths] of Object.entries(shapes)) {
      let state = "idle";
      if (main.includes(muscle)) {
        state = "main";
      } else if (also.includes(muscle)) {
        state = "also";
      }
      for (const d of paths) {
        svg.append(...bothSides("path", { d, class: `muscle muscle-${state}`, "data-muscle": muscle }));
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
