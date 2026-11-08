// A palette button and the color menu it opens, shared by the header
// (js/headerColor.js) and the tab bar (js/tabBarColor.js). The menu lists one
// or more targets (chips at the top when there are several), eight swatches
// and a Custom color for the chosen target, and a Reset button. The target's
// original color is labeled "Default", so it can be put back on its own.
const ColorMenu = (() => {
  const PALETTE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15.5" cy="8" r="1" /></svg>';

  // Each target is { label, title, swatches, defaultColor, current(), set(color) };
  // reset() puts this menu's colors back and returns false if saving failed.
  // Returns the button and the menu; the caller places both on the page.
  function create({ toggleClass, toggleLabel, menuClass, menuLabel, targets, resetLabel, reset }) {
    const toggle = UI.el("button", {
      type: "button",
      class: toggleClass,
      "aria-label": toggleLabel,
      "aria-expanded": "false",
    });
    toggle.innerHTML = PALETTE_ICON;

    let target = targets[0];
    const targetButtons = targets.map((choice) =>
      UI.el(
        "button",
        {
          type: "button",
          class: "color-menu-target",
          onclick: () => {
            target = choice;
            showSelected();
          },
        },
        UI.el("span", { class: "color-menu-dot", "aria-hidden": "true" }),
        choice.label,
      ),
    );
    const title = UI.el("p", { class: "color-menu-title" });
    const swatchButtons = target.swatches.map(() =>
      UI.el("button", {
        type: "button",
        class: "color-menu-swatch",
        onclick: (event) => {
          pick(target.swatches[swatchButtons.indexOf(event.currentTarget)].color);
          close();
        },
      }),
    );
    // Shown under whichever swatch is the chosen target's original color.
    const defaultLabels = swatchButtons.map(() =>
      UI.el("span", { class: "color-menu-default", "aria-hidden": "true", hidden: "" }, "Default"),
    );
    const swatchCells = swatchButtons.map((button, index) =>
      UI.el("div", { class: "color-menu-swatch-cell" }, button, defaultLabels[index]),
    );
    const customInput = UI.el("input", { type: "color", class: "color-menu-input" });
    customInput.addEventListener("input", () => pick(customInput.value));
    const resetButton = UI.el(
      "button",
      {
        type: "button",
        class: "button-secondary color-menu-reset",
        onclick: () => {
          if (!reset()) {
            UI.showSaveError();
          }
          showSelected();
          close();
        },
      },
      resetLabel,
    );
    const chips =
      targets.length > 1
        ? [UI.el("div", { class: "color-menu-targets", role: "group", "aria-label": "What to color" }, ...targetButtons)]
        : [];
    const menu = UI.el(
      "div",
      { class: `color-menu ${menuClass}`, role: "group", "aria-label": menuLabel, hidden: "" },
      ...chips,
      title,
      UI.el("div", { class: "color-menu-swatches" }, ...swatchCells),
      UI.el("label", { class: "color-menu-custom" }, "Custom", customInput),
      resetButton,
    );

    function showSelected() {
      targetButtons.forEach((button, index) => {
        button.setAttribute("aria-pressed", String(targets[index] === target));
        button.firstElementChild.style.background = targets[index].current();
      });
      title.textContent = target.title;
      const color = target.current();
      swatchButtons.forEach((button, index) => {
        const swatch = target.swatches[index];
        const isDefault = swatch.color === target.defaultColor;
        button.style.background = swatch.color;
        button.setAttribute("aria-label", isDefault ? `${swatch.name} (default)` : swatch.name);
        button.setAttribute("aria-pressed", String(swatch.color === color));
        defaultLabels[index].hidden = !isDefault;
      });
      customInput.value = color;
    }

    function pick(color) {
      if (!target.set(color)) {
        UI.showSaveError();
      }
      showSelected();
    }

    function close() {
      menu.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }

    toggle.addEventListener("click", () => {
      const opening = menu.hidden;
      if (opening) {
        showSelected();
      }
      menu.hidden = !opening;
      toggle.setAttribute("aria-expanded", String(opening));
    });
    document.addEventListener("click", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !toggle.contains(event.target)) {
        close();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        close();
        toggle.focus();
      }
    });

    showSelected();
    return { toggle, menu };
  }

  return { create };
})();
