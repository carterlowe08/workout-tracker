// The color behind the Sisu name. Loaded in the page's <head>, so the saved
// color applies before anything is drawn. Also adds the color button next to
// the name, which opens a row of swatches and a Custom color choice.
const HeaderColor = (() => {
  const DEFAULT_COLOR = "#d4d4d8";
  const DARK_TEXT = "#000000";
  const LIGHT_TEXT = "#ffffff";
  const SWATCHES = [
    { name: "Light gray", color: DEFAULT_COLOR },
    { name: "White", color: "#ffffff" },
    { name: "Dark gray", color: "#2e2e33" },
    { name: "Black", color: "#000000" },
    { name: "Navy", color: "#1e3358" },
    { name: "Purple", color: "#35285a" },
    { name: "Forest", color: "#18402a" },
    { name: "Rust", color: "#8a3a14" },
  ];

  function isColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function current() {
    const color = Store.read(Store.KEYS.headerColor, DEFAULT_COLOR);
    return isColor(color) ? color.toLowerCase() : DEFAULT_COLOR;
  }

  // How bright a color looks, from 0 (black) to 1 (white), by the WCAG formula.
  function luminance(color) {
    const [red, green, blue] = [1, 3, 5].map((start) => {
      const channel = parseInt(color.slice(start, start + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function contrast(first, second) {
    const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Dark or white text, whichever is easier to read on this background.
  function textColorFor(background) {
    return contrast(background, DARK_TEXT) >= contrast(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
  }

  function apply(color) {
    const { style } = document.documentElement;
    style.setProperty("--header-bg", color);
    style.setProperty("--header-text", textColorFor(color));
  }

  // Changes the page right away, even if the browser refuses to save the choice.
  function set(color) {
    apply(color);
    return Store.write(Store.KEYS.headerColor, color);
  }

  apply(current());

  function addPicker() {
    const header = document.querySelector(".site-header");
    if (!header || !header.firstElementChild) {
      return;
    }

    const toggle = UI.el("button", {
      type: "button",
      class: "header-color-toggle",
      "aria-label": "Change header color",
      "aria-expanded": "false",
    });
    toggle.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.6-1-2.7 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" /><circle cx="7.5" cy="11.5" r="1" /><circle cx="10.5" cy="7.5" r="1" /><circle cx="15.5" cy="8" r="1" /></svg>';

    const swatchButtons = SWATCHES.map(({ name, color }) => {
      const button = UI.el("button", {
        type: "button",
        class: "header-color-swatch",
        "aria-label": name,
        onclick: () => {
          pick(color);
          close();
        },
      });
      button.style.background = color;
      return button;
    });
    const customInput = UI.el("input", { type: "color", class: "header-color-input" });
    customInput.addEventListener("input", () => pick(customInput.value));
    const menu = UI.el(
      "div",
      { class: "header-color-menu", role: "group", "aria-label": "Header color", hidden: "" },
      UI.el("p", { class: "header-color-title" }, "Header color"),
      UI.el("div", { class: "header-color-swatches" }, ...swatchButtons),
      UI.el("label", { class: "header-color-custom" }, "Custom", customInput),
    );

    function showSelected() {
      const color = current();
      swatchButtons.forEach((button, index) => {
        button.setAttribute("aria-pressed", String(SWATCHES[index].color === color));
      });
      customInput.value = color;
    }

    function pick(color) {
      if (!set(color)) {
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
    header.firstElementChild.after(toggle);
    header.append(menu);
  }

  // The header and UI don't exist yet while the <head> is loading.
  document.addEventListener("DOMContentLoaded", addPicker);

  return { DEFAULT_COLOR, SWATCHES, current, set, textColorFor, contrast };
})();
