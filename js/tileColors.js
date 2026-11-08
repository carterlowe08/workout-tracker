// The colors of the four metric tiles (load, calories, RPE, streak). Loaded in
// the page's <head> after headerColor.js, so saved colors apply before anything
// is drawn. The header's color button lets you pick them.
//
// A picked color is the tile's bright shade: its labels, the header stripe and
// other accents. The tile's background is a deep shade of it, so the white text
// on tiles always stays readable.
const TileColors = (() => {
  const TILES = [
    { name: "load", label: "Load" },
    { name: "calories", label: "Calories" },
    { name: "rpe", label: "RPE" },
    { name: "streak", label: "Streak" },
  ];
  const DEFAULTS = { load: "#7fa8ff", calories: "#ffa066", rpe: "#a98bff", streak: "#4cb873" };
  const SWATCHES = [
    { name: "Blue", color: DEFAULTS.load },
    { name: "Orange", color: DEFAULTS.calories },
    { name: "Purple", color: DEFAULTS.rpe },
    { name: "Green", color: DEFAULTS.streak },
    { name: "Red", color: "#ff6b6b" },
    { name: "Pink", color: "#ff8fab" },
    { name: "Teal", color: "#4fd1e0" },
    { name: "Yellow", color: "#f7c948" },
  ];
  const BLACK = "#000000";
  const WHITE = "#ffffff";
  // The darkest card color the bright shade sits on in dark mode.
  const DARK_SURFACE = "#161618";
  const READABLE = 4.5;

  function isTile(name) {
    return Object.hasOwn(DEFAULTS, name);
  }

  function isColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function saved() {
    const colors = Store.read(Store.KEYS.tileColors, {});
    return colors && typeof colors === "object" && !Array.isArray(colors) ? colors : {};
  }

  function current(name) {
    const color = saved()[name];
    return isColor(color) ? color.toLowerCase() : DEFAULTS[name];
  }

  // Blends two "#rrggbb" colors: amount 0 gives the first, 1 the second.
  function mix(color, other, amount) {
    const channels = [1, 3, 5].map((start) => {
      const from = parseInt(color.slice(start, start + 2), 16);
      const to = parseInt(other.slice(start, start + 2), 16);
      return Math.round(from + (to - from) * amount)
        .toString(16)
        .padStart(2, "0");
    });
    return `#${channels.join("")}`;
  }

  // Moves a color toward `toward` in small steps until it reads on every background.
  function readableOn(color, backgrounds, toward) {
    for (let amount = 0; amount < 1; amount += 0.05) {
      const candidate = mix(color, toward, amount);
      if (backgrounds.every((background) => HeaderColor.contrast(candidate, background) >= READABLE)) {
        return candidate;
      }
    }
    return toward;
  }

  // Every shade the app needs from one picked color.
  function shadesFor(color) {
    const tile = mix(color, BLACK, 0.75);
    return {
      tile,
      // Labels on the tile and accents on dark pages.
      accent: readableOn(color, [tile, DARK_SURFACE], WHITE),
      // Accents used as text on light pages.
      accentLight: readableOn(color, [WHITE], BLACK),
      // The middle RPE shade on the Streak calendar.
      middle: mix(color, BLACK, 0.45),
    };
  }

  // Default colors use the hand-picked shades in styles.css, so nothing is set.
  function apply(name, color = current(name)) {
    const { style } = document.documentElement;
    const properties = [`--${name}-custom`, `--${name}-custom-light`, `--${name}-tile-custom`];
    if (name === "rpe") {
      properties.push("--rpe-mid-custom", "--rpe-high-text");
    }
    if (color === DEFAULTS[name]) {
      properties.forEach((property) => style.removeProperty(property));
      return;
    }
    const shades = shadesFor(color);
    style.setProperty(`--${name}-custom`, shades.accent);
    style.setProperty(`--${name}-custom-light`, shades.accentLight);
    style.setProperty(`--${name}-tile-custom`, shades.tile);
    if (name === "rpe") {
      style.setProperty("--rpe-mid-custom", shades.middle);
      style.setProperty("--rpe-high-text", HeaderColor.textColorFor(shades.accent));
    }
  }

  // Changes the page right away, even if the browser refuses to save the choice.
  function set(name, color) {
    if (!isTile(name) || !isColor(color)) {
      return false;
    }
    const picked = color.toLowerCase();
    apply(name, picked);
    const colors = { ...saved() };
    if (picked === DEFAULTS[name]) {
      delete colors[name];
    } else {
      colors[name] = picked;
    }
    return Store.write(Store.KEYS.tileColors, colors);
  }

  // Puts every tile back to its original color. False if the browser refused to save.
  function reset() {
    return TILES.map(({ name }) => set(name, DEFAULTS[name])).every(Boolean);
  }

  TILES.forEach(({ name }) => apply(name));

  return { TILES, DEFAULTS, SWATCHES, current, set, reset, mix, shadesFor };
})();
