// Personal records on Home: a card with the 3 newest records and a See all
// button that opens a wall of tiles, one per lift. Weighted lifts show their
// best estimated one-rep max; bodyweight lifts show their most reps. Tapping
// a lift opens its history.
(() => {
  const { el } = UI;
  const HOME_COUNT = 3;
  const NEW_FOR_DAYS = 7;

  const card = document.getElementById("records");
  const records = WorkoutLogic.personalRecords(Store.read(Store.KEYS.workouts, []));
  const unit = Units.current();
  const newSince = WorkoutLogic.addDays(UI.todayKey(), -(NEW_FOR_DAYS - 1));

  const shortDate = (dateKey) => UI.formatDate(dateKey).replace(/^\w+, /, "");
  const weightText = (pounds) => UI.formatNumber(Math.round(Units.fromPounds(pounds) * 10) / 10);

  // The big number and its small label: "222" + "lb 1RM", or "18" + "reps".
  function headline(record) {
    return record.kind === "weight"
      ? { value: UI.formatNumber(Math.round(Units.fromPounds(record.best))), label: `${unit} 1RM` }
      : { value: String(record.best), label: "reps" };
  }

  // "185×6 · Nov 12", or "18 reps · Nov 10" for bodyweight lifts.
  function detail(record) {
    const set = record.kind === "weight" ? `${weightText(record.set.weight)}×${record.set.reps}` : `${record.best} reps`;
    return `${set} · ${shortDate(record.date)}`;
  }

  function spokenLabel(record) {
    const { value, label } = headline(record);
    const best = record.kind === "weight" ? `estimated one-rep max ${value} ${unit}` : `most reps ${value}`;
    return `${record.name}: ${best}, ${detail(record)}. Open history`;
  }

  // A small line of each session's best, scaled between its lowest and highest
  // points so small gains still show. Nothing for a single session.
  function trendLine(values) {
    if (values.length < 2) {
      return el("span", { class: "record-trend" });
    }
    const width = 120;
    const height = 28;
    const pad = 3;
    const low = Math.min(...values);
    const range = Math.max(...values) - low;
    const points = values.map((value, index) => {
      const x = pad + (index * (width - pad * 2)) / (values.length - 1);
      const y = range === 0 ? height / 2 : height - pad - ((value - low) / range) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(namespace, "polyline");
    line.setAttribute("points", points.join(" "));
    svg.append(line);
    return el("span", { class: "record-trend" }, svg);
  }

  function newBadge(record) {
    return record.date >= newSince ? el("span", { class: "record-new" }, "NEW") : null;
  }

  function tile(record) {
    const { value, label } = headline(record);
    return el(
      "button",
      {
        type: "button",
        class: "record-tile",
        "aria-label": spokenLabel(record),
        onclick: () => ExerciseHistory.open(record.name),
      },
      el("span", { class: "record-name" }, record.name, newBadge(record)),
      el("span", { class: "record-best" }, value, el("small", {}, ` ${label}`)),
      trendLine(record.trend),
      el("span", { class: "record-detail" }, detail(record)),
    );
  }

  // ----- The wall: every lift, in a sheet -----

  const wall = el("div", { class: "record-wall" });
  const sheet = el(
    "dialog",
    { class: "sheet records-sheet", "aria-labelledby": "records-sheet-title" },
    el(
      "div",
      { class: "sheet-header" },
      el("h2", { id: "records-sheet-title" }, "Personal records"),
      el("button", { type: "button", class: "sheet-close", "aria-label": "Close", onclick: () => sheet.close() }, "×"),
    ),
    el(
      "p",
      { class: "muted records-sheet-sub" },
      `${UI.plural(records.length, "lift")} · newest record first · tap one for its history`,
    ),
    wall,
    el(
      "p",
      { class: "note" },
      "1RM is estimated from your best set with the Epley formula: weight × (1 + reps ÷ 30). Lifts done only at 0 lb show your most reps.",
    ),
  );
  document.body.append(sheet);
  sheet.addEventListener("click", (event) => {
    if (event.target === sheet) {
      sheet.close();
    }
  });

  function openWall() {
    wall.replaceChildren(...records.map(tile));
    sheet.showModal();
    sheet.scrollTop = 0;
  }

  // ----- The Home card -----

  const heading = el("h2", { id: "records-heading" }, "Personal records");
  if (records.length === 0) {
    card.replaceChildren(
      el("div", { class: "card-header" }, heading),
      el("p", { class: "muted" }, "No records yet. Save a workout and your best lifts show up here."),
    );
    return;
  }
  card.replaceChildren(
    el(
      "div",
      { class: "card-header" },
      heading,
      el("span", { class: "muted records-count" }, UI.plural(records.length, "lift")),
    ),
    el("div", { class: "record-wall" }, records.slice(0, HOME_COUNT).map(tile)),
    el(
      "button",
      { type: "button", class: "button-secondary records-see-all", onclick: openWall },
      `See all ${UI.plural(records.length, "record")}`,
    ),
  );
})();
