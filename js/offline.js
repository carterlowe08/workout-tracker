// Lets Sisu open with no signal: sw.js saves a copy of the app on the phone
// the first time a page opens with signal. Home says when that copy is ready.
(() => {
  const status = document.getElementById("offline-status");

  function show(message) {
    if (status) {
      status.textContent = message;
    }
  }

  if (!("serviceWorker" in navigator)) {
    show("This browser can't open Sisu without signal.");
    return;
  }
  show("Getting ready to open without signal…");
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => show("Ready to open without signal."))
    .catch(() => show("Not ready to open without signal yet. Open Sisu again with a connection."));
  // Asks the browser not to clear saved workouts when the phone runs low on space.
  navigator.storage?.persist?.().catch(() => {});
})();
