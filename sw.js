// Opens Sisu with no signal. When a page first opens with signal, this saves a
// copy of every app file on the phone. Later, pages come from the network when
// it answers (so updates show up) and from the copy when it doesn't. Saved
// workouts and foods aren't touched here; they're in the browser's storage.
//
// scripts/deploy.sh replaces VERSION with the project commit. Each version
// keeps its own copy, so files from two versions are never mixed.
const VERSION = "8213cec";
const APP_CACHE = `sisu-app-${VERSION}`;
const FONT_CACHE = "sisu-fonts";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const FONT_STYLES =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
// Weak gym signal can leave a request hanging; after this, use the saved copy.
const NETWORK_WAIT_MS = 3000;
// tests/test_offline.py checks that this lists everything the pages load.
const FILES = [
  "index.html",
  "calories.html",
  "plan.html",
  "streak.html",
  "workouts.html",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "css/styles.css",
  "js/backup.js",
  "js/barcode.js",
  "js/calorieBalance.js",
  "js/calories.js",
  "js/colorMenu.js",
  "js/diningHallMenus.js",
  "js/exerciseDatabase.js",
  "js/exerciseGuide.js",
  "js/exerciseHistory.js",
  "js/exerciseNotes.js",
  "js/exerciseSteps.json",
  "js/exercises.js",
  "js/food.js",
  "js/foodSearch.js",
  "js/goalLogic.js",
  "js/goals.js",
  "js/headerColor.js",
  "js/home.js",
  "js/lineChart.js",
  "js/logic.js",
  "js/mealLogic.js",
  "js/muscleBalance.js",
  "js/muscleBalanceLogic.js",
  "js/muscleMap.js",
  "js/offline.js",
  "js/pageWipe.js",
  "js/plan.js",
  "js/plateCalculator.js",
  "js/premadeRoutines.js",
  "js/programQuiz.js",
  "js/programQuizSheet.js",
  "js/records.js",
  "js/restTimer.js",
  "js/restaurantMenus.js",
  "js/restaurants.js",
  "js/rpeCheckIn.js",
  "js/savedMeals.js",
  "js/screenAwake.js",
  "js/selectMenu.js",
  "js/setRpe.js",
  "js/storage.js",
  "js/streak.js",
  "js/supersetSheet.js",
  "js/swapSheet.js",
  "js/tabBarColor.js",
  "js/theme.js",
  "js/tileColors.js",
  "js/ui.js",
  "js/undo.js",
  "js/units.js",
  "js/water.js",
  "js/weeklyRecap.js",
  "js/weight.js",
  "js/workoutEditor.js",
  "js/workouts.js",
];

const isStamped = VERSION !== "dev";
const isPage = (file) => file.endsWith(".html");
const addressOf = (file) => (isStamped && /\.(js|css)$/.test(file) ? `${file}?v=${VERSION}` : file);

async function saveFile(cache, file) {
  // "reload" skips the browser's own cache, which may hold an older version.
  const response = await fetch(new Request(addressOf(file), { cache: "reload" }));
  if (!response.ok) {
    throw new Error(`${file}: ${response.status}`);
  }
  // Right after a deploy a server can still send the last version's pages.
  // Stopping here keeps the old copy, and the browser tries again later.
  if (isStamped && isPage(file) && !(await response.clone().text()).includes(`?v=${VERSION}`)) {
    throw new Error(`${file} isn't version ${VERSION} yet`);
  }
  await cache.put(addressOf(file), response);
}

// The font is only for looks, so failing to save it doesn't stop anything.
async function saveFont() {
  try {
    const cache = await caches.open(FONT_CACHE);
    const styles = await fetch(FONT_STYLES);
    const text = await styles.clone().text();
    await cache.put(FONT_STYLES, styles);
    const fontUrls = [...text.matchAll(/url\((https:[^)]+)\)/g)].map((match) => match[1]);
    await Promise.all(fontUrls.map(async (url) => cache.put(url, await fetch(url))));
  } catch {
    // The phone's own font is used instead.
  }
}

async function install() {
  const cache = await caches.open(APP_CACHE);
  await Promise.all([...FILES.map((file) => saveFile(cache, file)), saveFont()]);
  await self.skipWaiting();
}

async function activate() {
  const names = await caches.keys();
  const outdated = names.filter((name) => name.startsWith("sisu-app-") && name !== APP_CACHE);
  await Promise.all(outdated.map((name) => caches.delete(name)));
  await self.clients.claim();
}

async function fetchInTime(request) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), NETWORK_WAIT_MS);
  try {
    return await fetch(request, { signal: stop.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function networkThenSaved(request, savedKey) {
  const cache = await caches.open(APP_CACHE);
  try {
    return await fetchInTime(request);
  } catch (error) {
    const saved = await cache.match(savedKey, { ignoreSearch: true });
    if (saved) {
      return saved;
    }
    throw error;
  }
}

// A file stamped with this version can't change, so the copy is as good as new.
async function savedThenNetwork(request) {
  const cache = await caches.open(APP_CACHE);
  return (await cache.match(request)) || networkThenSaved(request, request);
}

async function font(request) {
  const cache = await caches.open(FONT_CACHE);
  const saved = await cache.match(request.url, { ignoreVary: true });
  if (saved) {
    return saved;
  }
  const response = await fetch(request);
  await cache.put(request.url, response.clone());
  return response;
}

self.addEventListener("install", (event) => event.waitUntil(install()));
self.addEventListener("activate", (event) => event.waitUntil(activate()));
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(font(request));
  } else if (url.origin !== location.origin || !url.href.startsWith(self.registration.scope)) {
    return; // Food search, barcodes and photos go straight to the network.
  } else if (request.mode === "navigate") {
    // The app's plain address is Home.
    event.respondWith(networkThenSaved(request, url.pathname.endsWith("/") ? "index.html" : request));
  } else if (isStamped && url.searchParams.get("v") === VERSION) {
    event.respondWith(savedThenNetwork(request));
  } else {
    event.respondWith(networkThenSaved(request, request));
  }
});
