// Rest timer: a bar above the tab bar that counts down between sets.
// The end time is saved, so the countdown survives a page reload.
const RestTimer = (() => {
  const { KEYS } = Store;
  const { el } = UI;
  const DEFAULT_SECONDS = 90;
  const MIN_SECONDS = 15;
  const MAX_SECONDS = 600;
  const STEP_SECONDS = 15;

  let tickTimer = null;
  let audioContext = null;

  const timeText = el("span", { class: "rest-time", "aria-live": "off" });
  const labelText = el("span", { class: "rest-label" }, "Rest");
  const progressFill = el("div", { class: "rest-progress-fill" });
  const bar = el(
    "div",
    { class: "rest-timer", role: "timer", "aria-label": "Rest timer", hidden: true },
    el("div", { class: "rest-progress", "aria-hidden": "true" }, progressFill),
    el("div", { class: "rest-readout" }, labelText, timeText),
    el(
      "div",
      { class: "rest-controls" },
      el(
        "button",
        { type: "button", "aria-label": "15 seconds less rest", onclick: () => adjust(-STEP_SECONDS) },
        "−15s",
      ),
      el(
        "button",
        { type: "button", "aria-label": "15 seconds more rest", onclick: () => adjust(STEP_SECONDS) },
        "+15s",
      ),
      el("button", { type: "button", class: "rest-skip", onclick: () => stop() }, "Skip"),
    ),
  );
  document.body.append(bar);

  function defaultSeconds() {
    return Store.read(KEYS.restSeconds, DEFAULT_SECONDS);
  }

  function formatClock(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  // A short beep. The audio context is created on a tap (pressing End set),
  // because browsers block sound that starts without one.
  function beep() {
    if (!audioContext) {
      return;
    }
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    oscillator.frequency.value = 880;
    volume.gain.setValueAtTime(0.25, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.7);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.7);
  }

  function finish() {
    stop();
    beep();
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    UI.showToast("Rest's over. Time for your next set!");
  }

  function tick() {
    const timer = Store.read(KEYS.restTimer, null);
    if (!timer) {
      stop();
      return;
    }
    const secondsLeft = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    if (secondsLeft === 0) {
      finish();
      return;
    }
    timeText.textContent = formatClock(secondsLeft);
    progressFill.style.width = `${(secondsLeft / timer.duration) * 100}%`;
  }

  function run() {
    bar.hidden = false;
    document.body.classList.add("rest-timer-open");
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 250);
    tick();
  }

  function start() {
    try {
      audioContext ||= new AudioContext();
    } catch {
      audioContext = null; // No sound on this browser; vibration and the message still work.
    }
    const duration = defaultSeconds();
    Store.write(KEYS.restTimer, { endsAt: Date.now() + duration * 1000, duration });
    run();
  }

  // Changes this rest and remembers the new length for next time.
  function adjust(deltaSeconds) {
    const timer = Store.read(KEYS.restTimer, null);
    if (!timer) {
      return;
    }
    const secondsLeft = Math.ceil((timer.endsAt - Date.now()) / 1000);
    const newLeft = Math.min(Math.max(secondsLeft + deltaSeconds, 1), MAX_SECONDS);
    const duration = Math.min(Math.max(timer.duration + deltaSeconds, MIN_SECONDS), MAX_SECONDS);
    Store.write(KEYS.restTimer, { endsAt: Date.now() + newLeft * 1000, duration: Math.max(duration, newLeft) });
    Store.write(KEYS.restSeconds, duration);
    tick();
  }

  function stop() {
    clearInterval(tickTimer);
    tickTimer = null;
    Store.remove(KEYS.restTimer);
    bar.hidden = true;
    document.body.classList.remove("rest-timer-open");
  }

  // Pick up a countdown that was running before a reload.
  const running = Store.read(KEYS.restTimer, null);
  if (running && running.endsAt > Date.now()) {
    run();
  } else if (running) {
    stop();
  }

  return { start, stop };
})();
