// The color of the tab bar at the bottom of every page. Loaded in the page's
// <head> after headerColor.js, so the saved color applies before anything is
// drawn. A palette button at the end of the tab bar lets you pick it, from the
// header's swatches.
//
// On a light bar the icons turn dark and the current page's pill turns black,
// so both stay easy to see; on a dark bar they stay light, as by default.
const TabBarColor = (() => {
  // Black is the default: a see-through black bar, set in styles.css.
  const DEFAULT_COLOR = "#000000";
  const PROPERTIES = ["--tab-bar-bg-custom", "--tab-bar-icon-custom", "--tab-bar-pill-custom", "--tab-bar-pill-text-custom"];

  function isColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
  }

  function current() {
    const color = Store.read(Store.KEYS.tabBarColor, DEFAULT_COLOR);
    return isColor(color) ? color.toLowerCase() : DEFAULT_COLOR;
  }

  // The icon and pill colors that go with a bar color.
  function shadesFor(color) {
    const lightBar = HeaderColor.textColorFor(color) === "#000000";
    return lightBar
      ? { icon: "#2e2e33", pill: "#111114", pillText: "#ffffff" }
      : { icon: "#d4d4d8", pill: "#ffffff", pillText: "#000000" };
  }

  function apply(color) {
    const { style } = document.documentElement;
    if (color === DEFAULT_COLOR) {
      PROPERTIES.forEach((property) => style.removeProperty(property));
      return;
    }
    const shades = shadesFor(color);
    style.setProperty("--tab-bar-bg-custom", color);
    style.setProperty("--tab-bar-icon-custom", shades.icon);
    style.setProperty("--tab-bar-pill-custom", shades.pill);
    style.setProperty("--tab-bar-pill-text-custom", shades.pillText);
  }

  // Changes the page right away, even if the browser refuses to save the choice.
  function set(color) {
    if (!isColor(color)) {
      return false;
    }
    const picked = color.toLowerCase();
    apply(picked);
    return Store.write(Store.KEYS.tabBarColor, picked);
  }

  apply(current());

  // The palette button goes at the end of the bar. Its menu is placed on the
  // page itself, not in the bar, so it follows the Dark / Light switch.
  function addPicker() {
    const tabBar = document.querySelector(".tab-bar");
    if (!tabBar) {
      return;
    }
    const { toggle, menu } = ColorMenu.create({
      toggleClass: "tab-bar-color-toggle",
      toggleLabel: "Change tab bar color",
      menuClass: "tab-bar-color-menu",
      menuLabel: "Tab bar color",
      targets: [
        {
          label: "Tab bar",
          title: "Tab bar color",
          swatches: HeaderColor.SWATCHES,
          defaultColor: DEFAULT_COLOR,
          current,
          set,
        },
      ],
      resetLabel: "Reset tab bar color",
      reset: () => set(DEFAULT_COLOR),
    });
    tabBar.append(toggle);
    document.body.append(menu);
  }

  // The tab bar and UI don't exist yet while the <head> is loading.
  document.addEventListener("DOMContentLoaded", addPicker);

  return { DEFAULT_COLOR, current, set, shadesFor };
})();
