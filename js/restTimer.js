// Rest timer: counts down on the exercise card, right under the set just
// finished. Each exercise remembers its own rest time. The end time is saved,
// so the countdown survives a page reload.
const RestTimer = (() => {
  const { KEYS } = Store;
  const { el } = UI;
  const DEFAULT_SECONDS = 90;
  const STEP_SECONDS = 15;
  const PRESET_SECONDS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

  let tickTimer = null;
  let audioContext = null;
  // Set by the workout page: what takes the countdown's place when it ends,
  // and what to redraw when an exercise's rest time changes.
  let replacementFor = () => null;
  let onSecondsChanged = () => {};

  const timeText = el("span", { class: "rest-countdown-time" });
  const progressFill = el("div", { class: "rest-countdown-fill" });
  const countdown = el(
    "div",
    { class: "rest-countdown", role: "timer", "aria-label": "Rest timer" },
    progressFill,
    timeText,
    el(
      "div",
      { class: "rest-countdown-controls" },
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
      el("button", { type: "button", onclick: () => stop() }, "Skip"),
    ),
  );

  function readRests() {
    return Store.read(KEYS.exerciseRest, {});
  }

  // This exercise's rest time. Exercises not changed yet use the older
  // app-wide setting if there is one, otherwise 90 seconds.
  function secondsFor(exerciseName) {
    return WorkoutLogic.restSecondsFor(readRests(), exerciseName, Store.read(KEYS.restSeconds, DEFAULT_SECONDS));
  }

  function saveSeconds(exerciseName, seconds) {
    if (!Store.write(KEYS.exerciseRest, WorkoutLogic.withRestSeconds(readRests(), exerciseName, seconds))) {
      UI.showSaveError();
      return;
    }
    onSecondsChanged(exerciseName);
  }

  function runningTimer() {
    return Store.read(KEYS.restTimer, null);
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
    const timer = runningTimer();
    if (!timer) {
      stop();
      return;
    }
    const secondsLeft = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
    if (secondsLeft === 0) {
      finish();
      return;
    }
    timeText.textContent = WorkoutLogic.formatClock(secondsLeft);
    progressFill.style.width = `${(secondsLeft / timer.duration) * 100}%`;
  }

  function run() {
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 250);
    tick();
  }

  // Starts the rest after this set of this exercise.
  function start(exerciseName, exerciseIndex, setIndex) {
    try {
      audioContext ||= new AudioContext();
    } catch {
      audioContext = null; // No sound on this browser; vibration and the message still work.
    }
    const duration = secondsFor(exerciseName);
    Store.write(KEYS.restTimer, {
      endsAt: Date.now() + duration * 1000,
      duration,
      exerciseName,
      exerciseIndex,
      setIndex,
    });
    run();
  }

  // A swap during a rest: the same rest carries on for the new exercise.
  function renameExercise(oldName, newName) {
    const timer = runningTimer();
    if (timer && timer.exerciseName === oldName) {
      Store.write(KEYS.restTimer, { ...timer, exerciseName: newName });
    }
  }

  // Changes this rest and remembers the new length for this exercise.
  function adjust(deltaSeconds) {
    const timer = runningTimer();
    if (!timer) {
      return;
    }
    const secondsLeft = Math.ceil((timer.endsAt - Date.now()) / 1000);
    const newLeft = Math.min(Math.max(secondsLeft + deltaSeconds, 1), WorkoutLogic.MAX_REST_SECONDS);
    const remembered = WorkoutLogic.clampRestSeconds(secondsFor(timer.exerciseName) + deltaSeconds);
    Store.write(KEYS.restTimer, {
      ...timer,
      endsAt: Date.now() + newLeft * 1000,
      duration: Math.max(remembered, newLeft),
    });
    saveSeconds(timer.exerciseName, remembered);
    tick();
  }

  // Ends the countdown. The set rows around it stay as they are, so a number
  // being typed keeps its cursor.
  function stop() {
    clearInterval(tickTimer);
    tickTimer = null;
    const timer = runningTimer();
    Store.remove(KEYS.restTimer);
    if (countdown.isConnected) {
      const replacement = timer ? replacementFor(timer) : null;
      countdown.replaceWith(...(replacement ? [replacement] : []));
    }
  }

  // Which exercise in this workout the running rest belongs to, or -1. Uses the
  // saved position, then the name, since an earlier exercise may have been removed.
  function exerciseIndexIn(exercises) {
    const timer = runningTimer();
    if (!timer) {
      return -1;
    }
    const saved = exercises[timer.exerciseIndex];
    return saved && saved.name === timer.exerciseName
      ? timer.exerciseIndex
      : exercises.findIndex((exercise) => exercise.name === timer.exerciseName);
  }

  // The countdown, if the running rest comes right after this set.
  function countdownAfter(exercises, exerciseIndex, setIndex) {
    const timer = runningTimer();
    return timer && timer.setIndex === setIndex && exerciseIndexIn(exercises) === exerciseIndex ? countdown : null;
  }

  // A rest whose set was removed has nowhere to show, so it ends.
  function stopIfNotShown() {
    if (runningTimer() && !countdown.isConnected) {
      stop();
    }
  }

  // ----- Picking an exercise's rest time -----
  let pickerExerciseName = "";
  const pickerTitle = el("h2", { id: "rest-picker-title" });
  const pickerCurrent = el("p", { class: "muted" });
  const presetButtons = PRESET_SECONDS.map((seconds) =>
    el(
      "button",
      {
        type: "button",
        "data-seconds": String(seconds),
        "aria-pressed": "false",
        onclick: () => pickSeconds(seconds),
      },
      WorkoutLogic.formatClock(seconds),
    ),
  );
  const picker = el(
    "dialog",
    { class: "sheet rest-picker", "aria-labelledby": "rest-picker-title" },
    pickerTitle,
    pickerCurrent,
    el("div", { class: "rest-presets" }, presetButtons),
    el(
      "div",
      { class: "button-row" },
      el("button", { type: "button", class: "button-secondary", onclick: () => picker.close() }, "Cancel"),
    ),
  );
  picker.addEventListener("click", (event) => {
    if (event.target === picker) {
      picker.close();
    }
  });
  document.body.append(picker);

  function pickSeconds(seconds) {
    picker.close();
    saveSeconds(pickerExerciseName, seconds);
    UI.showToast(`${pickerExerciseName}: ${WorkoutLogic.formatClock(seconds)} rest`);
  }

  function openPicker(exerciseName) {
    pickerExerciseName = exerciseName;
    const current = secondsFor(exerciseName);
    pickerTitle.textContent = `Rest for ${exerciseName}`;
    pickerCurrent.textContent =
      `Now ${WorkoutLogic.formatClock(current)}. Used for every set of this exercise, now and next time.`;
    for (const button of presetButtons) {
      button.setAttribute("aria-pressed", String(Number(button.dataset.seconds) === current));
    }
    picker.showModal();
  }

  function connect(handlers) {
    replacementFor = handlers.replacementFor;
    onSecondsChanged = handlers.onSecondsChanged;
  }

  // Pick up a countdown that was running before a reload.
  const running = runningTimer();
  if (running && running.endsAt > Date.now()) {
    run();
  } else if (running) {
    stop();
  }

  return { start, stop, renameExercise, secondsFor, countdownAfter, stopIfNotShown, openPicker, connect };
})();
