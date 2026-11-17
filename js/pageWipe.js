// Color wipe between pages: tapping a tab opens that page right away, covered
// in the page's color, and the color shrinks into a circle on the tab you
// tapped to show the page. Nothing waits before the new page starts loading.
// The header and tab bar stay on top the whole time. Skipped when the phone
// has Reduce Motion turned on.
//
// Loaded in each page's <head>, so the color is in place before the new page
// is drawn and the page never flashes before it.
const PageWipe = (() => {
  const STORAGE_KEY = "workoutTracker.pageWipe";
  // A wipe saved longer ago than this belongs to some other visit; ignore it.
  const MAX_AGE_MS = 5000;
  // The shrink's length is set in styles.css (page-wipe-shrink); keep them equal.
  const SHRINK_MS = 340;
  const START_DELAY_MS = 30;
  // Each tab's page, matching the Home tile colors in styles.css.
  const PAGES = {
    "index.html": "home",
    "workouts.html": "workouts",
    "calories.html": "calories",
    "streak.html": "streak",
  };
  const root = document.documentElement;

  // "https://…/workout-tracker/workouts.html?x" → "workouts"; "…/workout-tracker/" → "home".
  function pageFor(href) {
    const path = new URL(href, location.href).pathname;
    const file = path.endsWith("/") ? "index.html" : path.slice(path.lastIndexOf("/") + 1);
    return PAGES[file] || null;
  }

  function reduceMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function readSavedWipe() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      sessionStorage.removeItem(STORAGE_KEY);
      return saved && Date.now() - saved.at < MAX_AGE_MS ? saved : null;
    } catch {
      return null;
    }
  }

  function clearWipe() {
    delete root.dataset.wipe;
    delete root.dataset.wipeShrinking;
  }

  // ----- Arriving: start covered, then shrink the color onto the tapped tab -----

  const arriving = readSavedWipe();
  if (arriving && !reduceMotion()) {
    root.dataset.wipe = arriving.page;
    root.style.setProperty("--wipe-x", `${arriving.x}px`);
    root.style.setProperty("--wipe-y", `${arriving.y}px`);
    document.addEventListener("DOMContentLoaded", () => {
      // A moment for the page to be drawn under the color before it shrinks.
      setTimeout(() => {
        root.dataset.wipeShrinking = "";
      }, START_DELAY_MS);
      // Never leave the page covered, even if the animation doesn't run.
      setTimeout(clearWipe, START_DELAY_MS + SHRINK_MS + 400);
    });
    document.addEventListener("animationend", (event) => {
      if (event.target === document.body && event.animationName === "page-wipe-shrink") {
        clearWipe();
      }
    });
  }

  // ----- Leaving: note which tab was tapped, and let the page load as usual -----

  document.addEventListener("click", (event) => {
    const link = event.target.closest(".tab-bar a[href]");
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!link || !isPlainClick || link.getAttribute("aria-current") === "page" || reduceMotion()) {
      return;
    }
    const page = pageFor(link.href);
    if (!page) {
      return;
    }
    const tab = link.getBoundingClientRect();
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          page,
          x: Math.round(tab.left + tab.width / 2),
          y: Math.round(tab.top + tab.height / 2),
          at: Date.now(),
        }),
      );
    } catch {
      // Without storage the page just opens without the wipe.
    }
  });

  // Coming back with the browser's Back button can show a page exactly as it
  // was left; make sure no color is left on it.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      readSavedWipe();
      clearWipe();
    }
  });

  return { pageFor };
})();
