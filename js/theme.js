// Dark or light mode. Loaded in the page's <head>, so the saved choice applies
// before anything is drawn and a light-mode page never flashes black. Also adds
// the Dark / Light switch to the top of every page. css/styles.css holds the
// colors for each mode, and which parts of the app look the same in both.
const Theme = (() => {
  const THEMES = ["dark", "light"];

  function current() {
    const theme = Store.read(Store.KEYS.theme, "dark");
    return THEMES.includes(theme) ? theme : "dark";
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
  }

  // Changes the page right away, even if the browser refuses to save the choice.
  function set(theme) {
    Store.write(Store.KEYS.theme, theme);
    apply(theme);
  }

  apply(current());

  // The header and UI don't exist yet while the <head> is loading.
  document.addEventListener("DOMContentLoaded", () => {
    UI.addHeaderSwitch({
      label: "Color mode",
      options: [
        { value: "dark", text: "Dark" },
        { value: "light", text: "Light" },
      ],
      current: current(),
      onPick: set,
    });
  });

  return { current, set };
})();
