// Weekly recap: full-screen slides about last week (Sunday to Saturday),
// compared with the week before. It opens by itself the first time Home is
// opened in a new week, if last week had a workout, and the Weekly recap
// button on Home opens it any time.
(() => {
  const { el } = UI;

  const today = UI.todayKey();
  const weekStart = WorkoutLogic.recapWeekStart(today);
  const data = {
    workouts: Store.read(Store.KEYS.workouts, []),
    calorieEntries: Store.read(Store.KEYS.calories, []),
    checkIns: Store.read(Store.KEYS.checkIns, {}),
  };
  const week = WorkoutLogic.weekSummary(data, weekStart);
  const before = WorkoutLogic.weekSummary(data, WorkoutLogic.addDays(weekStart, -7));
  const unit = Units.current();

  // "Nov 1 – 7", or "Oct 25 – 31" / "Nov 29 – Dec 5" across months.
  function weekRange(start, end) {
    const short = (dateKey) => UI.formatDate(dateKey).replace(/^\w+, /, "");
    const sameMonth = start.slice(0, 7) === end.slice(0, 7);
    return `${short(start)} – ${sameMonth ? Number(end.slice(8)) : short(end)}`;
  }
  const rangeText = weekRange(week.start, week.end);

  // The pill under the big number. words: [more, less] for this slide.
  function changeText(current, previous, { percent = false, words, format = String }) {
    const change = WorkoutLogic.weekChange(current, previous, { percent });
    const amount = percent ? `${change.amount}%` : format(change.amount);
    switch (change.direction) {
      case "up":
        return `▲ ${amount} ${words[0]} than the week before`;
      case "down":
        return `▼ ${amount} ${words[1]} than the week before`;
      case "same":
        return "Same as the week before";
      case "new":
        return "Nothing logged the week before";
      default:
        return null;
    }
  }

  const SLIDES = [
    {
      tile: "tile-streak",
      title: "Workouts",
      value: String(week.workouts),
      unitText: week.workouts === 1 ? "workout" : "workouts",
      change: changeText(week.workouts, before.workouts, { words: ["more", "fewer"] }),
      bars: [week.workouts, before.workouts],
      barText: String,
    },
    {
      tile: "tile-load",
      title: "Total load",
      value: UI.formatNumber(Math.round(Units.fromPounds(week.load))),
      unitText: `${unit} lifted`,
      change: changeText(week.load, before.load, { percent: true, words: ["more", "less"] }),
      bars: [week.load, before.load],
      barText: (pounds) => `${UI.formatNumber(Math.round(Units.fromPounds(pounds)))} ${unit}`,
    },
    {
      tile: "tile-rpe",
      title: "Average RPE",
      value: week.averageRpe === null ? "–" : String(week.averageRpe),
      unitText: week.averageRpe === null ? "No RPE logged this week" : "out of 10",
      change: changeText(week.averageRpe, before.averageRpe, { words: ["higher", "lower"] }),
      bars: [week.averageRpe ?? 0, before.averageRpe ?? 0],
      barMax: 10,
      barText: (rpe) => (rpe ? String(rpe) : "–"),
    },
    {
      tile: "tile-calories",
      title: "Calories burned",
      value: UI.formatNumber(week.calories),
      unitText: "kcal burned",
      change: changeText(week.calories, before.calories, { percent: true, words: ["more", "less"] }),
      bars: [week.calories, before.calories],
      barText: (calories) => `${UI.formatNumber(calories)} kcal`,
    },
    {
      tile: "tile-load",
      title: "New records",
      value: String(week.records.length),
      unitText: week.records.length === 1 ? "new record" : "new records",
      change: week.records.length === 0 ? "No new records this week. Keep at it." : null,
      records: week.records,
    },
  ];

  // This week's and last week's bars, scaled to the bigger one (or barMax).
  function bars(slide) {
    const [current, previous] = slide.bars;
    const largest = slide.barMax || Math.max(current, previous);
    if (!(largest > 0)) {
      return null;
    }
    const row = (label, value, isThisWeek) =>
      el(
        "div",
        { class: "recap-bar-row" },
        el("span", { class: "recap-bar-label" }, label),
        el(
          "span",
          { class: "recap-bar-track" },
          el("span", {
            class: `recap-bar-fill${isThisWeek ? "" : " previous"}`,
            style: `width: ${Math.round((value / largest) * 100)}%`,
          }),
        ),
        el("span", { class: "recap-bar-value" }, slide.barText(value)),
      );
    return el("div", { class: "recap-bars" }, row("Last week", current, true), row("Week before", previous, false));
  }

  function recordList(records) {
    if (records.length === 0) {
      return null;
    }
    const shown = records.slice(0, 5).map((record) => {
      const set =
        record.kind === "weight"
          ? `${UI.formatNumber(Math.round(Units.fromPounds(record.set.weight) * 10) / 10)}×${record.set.reps}`
          : `${record.best} reps`;
      return el("li", {}, el("span", {}, record.name), el("strong", {}, set));
    });
    const more = records.length > 5 ? el("li", { class: "recap-more" }, `+${records.length - 5} more`) : null;
    return el("ul", { class: "recap-records" }, shown, more);
  }

  // ----- The sheet -----

  let index = 0;
  const slideHolder = el("div", { class: "recap-holder" });
  const sheet = el("dialog", { class: "recap-sheet", "aria-label": `Weekly recap, ${rangeText}` }, slideHolder);
  document.body.append(sheet);
  sheet.addEventListener("close", () => {
    index = 0;
  });

  function render() {
    const slide = SLIDES[index];
    const isLast = index === SLIDES.length - 1;
    const progress = el(
      "div",
      { class: "recap-progress", "aria-hidden": "true" },
      SLIDES.map((_, position) => el("span", { class: position <= index ? "seen" : "" })),
    );
    slideHolder.replaceChildren(
      el(
        "div",
        { class: `recap-slide tile ${slide.tile}` },
        progress,
        el(
          "div",
          { class: "recap-top" },
          el("span", { class: "recap-week" }, `Weekly recap · ${rangeText}`),
          el(
            "button",
            { type: "button", class: "recap-close", "aria-label": "Close recap", onclick: () => sheet.close() },
            "×",
          ),
        ),
        el(
          "div",
          { class: "recap-body", "aria-live": "polite" },
          el("span", { class: "recap-kicker" }, `${index + 1} of ${SLIDES.length} · ${slide.title}`),
          el("span", { class: "recap-number" }, slide.value),
          el("span", { class: "recap-unit" }, slide.unitText),
          slide.change ? el("span", { class: "recap-change" }, slide.change) : null,
          slide.bars ? bars(slide) : null,
          slide.records ? recordList(slide.records) : null,
        ),
        el(
          "div",
          { class: "recap-nav" },
          el(
            "button",
            {
              type: "button",
              class: "recap-back",
              disabled: index === 0,
              onclick: () => {
                index -= 1;
                render();
              },
            },
            "Back",
          ),
          el(
            "button",
            {
              type: "button",
              class: "recap-next",
              onclick: () => {
                if (isLast) {
                  sheet.close();
                  return;
                }
                index += 1;
                render();
              },
            },
            isLast ? "Done" : `Next: ${SLIDES[index + 1].title}`,
          ),
        ),
      ),
    );
    slideHolder.querySelector(".recap-next").focus();
  }

  function open() {
    index = 0;
    render();
    sheet.showModal();
  }

  // ----- The Home button, and opening once a week by itself -----

  const button = document.getElementById("recap-open");
  button.append(
    el("span", { class: "recap-open-title" }, "Weekly recap"),
    el(
      "span",
      { class: "recap-open-meta" },
      week.workouts > 0 ? `${rangeText} · ${UI.plural(week.workouts, "workout")}` : `${rangeText} · No workouts last week`,
    ),
  );
  button.addEventListener("click", open);

  if (week.workouts > 0 && Store.read(Store.KEYS.recapShownWeek, null) !== weekStart) {
    if (Store.write(Store.KEYS.recapShownWeek, weekStart)) {
      open();
    }
  }
})();
