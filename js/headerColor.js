// The color behind the Sisu name. Loaded in the page's <head>, so the saved
// color applies before anything is drawn. Also adds the color button next to
// the name, which opens a menu (js/colorMenu.js) for the header and the four
// tile colors (js/tileColors.js): pick one at the top, then a swatch or a
// Custom color. Its Reset also puts the tab bar back (js/tabBarColor.js).
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
    const { toggle, menu } = ColorMenu.create({
      toggleClass: "header-color-toggle",
      toggleLabel: "Change colors",
      menuClass: "header-color-menu",
      menuLabel: "Colors",
      // The header, then each tile. The tab bar has its own palette button.
      targets: [
        { label: "Header", title: "Header color", swatches: SWATCHES, defaultColor: DEFAULT_COLOR, current, set },
        ...TileColors.TILES.map(({ name, label }) => ({
          label,
          title: `${label} tile color`,
          swatches: TileColors.SWATCHES,
          defaultColor: TileColors.DEFAULTS[name],
          current: () => TileColors.current(name),
          set: (color) => TileColors.set(name, color),
        })),
      ],
      resetLabel: "Reset to default colors",
      // The header, all four tiles and the tab bar go back to how Sisu first looked.
      reset: () =>
        [set(DEFAULT_COLOR), TileColors.reset(), TabBarColor.set(TabBarColor.DEFAULT_COLOR)].every(Boolean),
    });
    header.firstElementChild.after(toggle);
    header.append(menu);
  }

  // The header and UI don't exist yet while the <head> is loading.
  document.addEventListener("DOMContentLoaded", addPicker);

  return { DEFAULT_COLOR, SWATCHES, current, set, textColorFor, contrast };
})();
