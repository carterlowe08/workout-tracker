// Color wipe between pages: tapping a tab grows a circle in that page's color
// from the tab until it fills the screen, then the new page opens already
// covered in that color, which fades away. The header and tab bar stay on top
// the whole time. Skipped when the phone has Reduce Motion turned on.
//
// Loaded in each page's <head>, so the color is in place before the new page
// is drawn and it never flashes.
const PageWipe = (() => {
  const STORAGE_KEY = "workoutTracker.pageWipe";
  // A wipe saved longer ago than this belongs to some other visit; ignore it.
  const MAX_AGE_MS = 5000;
  const GROW_MS = 320;
  // The fade's length is set in styles.css (page-wipe-clear); keep them equal.
  const CLEAR_MS = 260;
  const CLEAR_DELAY_MS = 30;
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
      return saved && Date.now() - saved.at < MAX_AGE_MS ? saved.page : null;
    } catch {
      return null;
    }
  }

  function saveWipe(page) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ page, at: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  // ----- Arriving: start covered, then fade the color away -----

  function clearArrivingWipe() {
    delete root.dataset.wipe;
    delete root.dataset.wipeClearing;
  }

  const arrivingPage = readSavedWipe();
  if (arrivingPage && !reduceMotion()) {
    root.dataset.wipe = arrivingPage;
    document.addEventListener("DOMContentLoaded", () => {
      // A moment for the page to be drawn under the color before it fades.
      setTimeout(() => {
        root.dataset.wipeClearing = "";
      }, CLEAR_DELAY_MS);
      // Never leave the page covered, even if the fade doesn't run.
      setTimeout(clearArrivingWipe, CLEAR_DELAY_MS + CLEAR_MS + 400);
    });
    document.addEventListener("animationend", (event) => {
      if (event.target === document.body && event.animationName === "page-wipe-clear") {
        clearArrivingWipe();
      }
    });
  }

  // ----- Leaving: grow a circle from the tapped tab, then go -----

  function startWipe(event) {
    const link = event.target.closest(".tab-bar a[href]");
    const isPlainClick =
      event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
    if (!link || !isPlainClick || link.getAttribute("aria-current") === "page" || reduceMotion()) {
      return;
    }
    const page = pageFor(link.href);
    if (!page || !saveWipe(page)) {
      return;
    }
    event.preventDefault();
    const tab = link.getBoundingClientRect();
    const circle = document.createElement("div");
    circle.className = "page-wipe";
    circle.dataset.page = page;
    circle.style.setProperty("--wipe-x", `${tab.left + tab.width / 2}px`);
    circle.style.setProperty("--wipe-y", `${tab.top + tab.height / 2}px`);
    circle.style.setProperty("--wipe-ms", `${GROW_MS}ms`);
    document.body.append(circle);
    setTimeout(() => {
      location.href = link.href;
    }, GROW_MS);
  }

  document.addEventListener("click", startWipe);

  // Coming back with the browser's Back button can show this page exactly as
  // it was left, circle and all; clear it.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      readSavedWipe();
      document.querySelectorAll(".page-wipe").forEach((circle) => circle.remove());
      clearArrivingWipe();
    }
  });

  return { pageFor, GROW_MS };
})();
