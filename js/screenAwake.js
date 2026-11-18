// Keeps the phone's screen on while a workout is going, using the browser's
// Screen Wake Lock. The browser drops the lock whenever the page is hidden, so
// it is asked for again when the page comes back or the user taps anything.
const ScreenAwake = (() => {
  const supported = "wakeLock" in navigator;
  let wanted = false;
  let lock = null;
  let requesting = false;
  let onChange = () => {};

  function isOn() {
    return lock !== null;
  }

  async function acquire() {
    if (!supported || !wanted || lock || requesting || document.visibilityState !== "visible") {
      return;
    }
    requesting = true;
    try {
      const newLock = await navigator.wakeLock.request("screen");
      if (!wanted) {
        // The workout ended while the browser was answering.
        newLock.release();
        return;
      }
      lock = newLock;
      lock.addEventListener("release", () => {
        lock = null;
        onChange();
      });
      onChange();
    } catch {
      // Refused (low battery mode, or no tap yet on some browsers); the next tap tries again.
    } finally {
      requesting = false;
    }
  }

  // Turns keeping the screen on for this page on or off.
  function keepOn(on) {
    wanted = on;
    if (on) {
      acquire();
    } else if (lock) {
      lock.release();
    }
  }

  document.addEventListener("visibilitychange", acquire);
  document.addEventListener("pointerdown", acquire);

  return {
    supported,
    isOn,
    keepOn,
    // Called whenever the screen starts or stops being kept on.
    set onChange(callback) {
      onChange = callback;
    },
  };
})();
