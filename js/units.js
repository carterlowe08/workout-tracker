// Pounds or kilograms for lifting weights. Weights are always stored in
// pounds; this converts them for display and converts typed values back, so
// switching units never changes a saved number. Also adds the lb / kg switch
// to the top of every page.
const Units = (() => {
  const KG_PER_LB = 0.45359237;
  const UNITS = ["lb", "kg"];

  function current() {
    const unit = Store.read(Store.KEYS.weightUnit, "lb");
    return UNITS.includes(unit) ? unit : "lb";
  }

  // Pounds -> the chosen unit, to one decimal place (135 lb -> 61.2 kg). Pounds
  // are rounded too, so a weight typed as 100 kg shows as 220.5 lb, not 220.4622…
  function fromPounds(pounds, unit = current()) {
    const value = unit === "kg" ? pounds * KG_PER_LB : pounds;
    return Math.round(value * 10) / 10;
  }

  // A number typed in the chosen unit -> pounds, for saving.
  function toPounds(value, unit = current()) {
    return unit === "kg" ? value / KG_PER_LB : value;
  }

  // "61.2 kg" or "135 lb". Totals like load pass `{ whole: true }` for "3,198 kg".
  function format(pounds, { whole = false } = {}) {
    const value = fromPounds(pounds);
    return `${UI.formatNumber(whole ? Math.round(value) : value)} ${current()}`;
  }

  function addSwitch() {
    const header = document.querySelector(".site-header");
    if (!header) {
      return;
    }
    const unitSwitch = UI.el(
      "div",
      { class: "unit-switch", role: "radiogroup", "aria-label": "Weight units" },
      ...UNITS.map((unit) =>
        UI.el(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": String(unit === current()),
            onclick: () => {
              if (unit !== current() && Store.write(Store.KEYS.weightUnit, unit)) {
                // Redraw the page so every weight shows in the new unit.
                location.reload();
              }
            },
          },
          unit,
        ),
      ),
    );
    header.append(unitSwitch);
  }

  addSwitch();

  return { current, fromPounds, toPounds, format };
})();
