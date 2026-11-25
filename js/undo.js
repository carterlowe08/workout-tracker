// Undo after deleting: a bar that counts down 5 seconds, and the logic that
// puts a deleted item back exactly where it was. The delete is saved right
// away, so leaving the page or letting the time run out keeps it deleted.
// Only the newest delete can be undone.
const Undo = (() => {
  const { el } = UI;
  const SECONDS = 5;
  const TICK_MS = 100;

  // ----- Taking items out of a list and putting them back -----

  // The same item, also when one copy was read fresh from storage.
  function isSame(a, b) {
    return a === b || (a?.id !== undefined && a?.id === b?.id);
  }

  // Where something sat: its neighbors, so it can return between them even if
  // other items were added or deleted since.
  function spotAt(remaining, index) {
    return { index, previous: remaining[index - 1] ?? null, next: remaining[index] ?? null };
  }

  function takeOut(list, item) {
    const index = list.findIndex((other) => isSame(other, item));
    const remaining = list.filter((_, position) => position !== index);
    return { remaining, spot: spotAt(remaining, index) };
  }

  function putBack(list, item, spot) {
    if (list.some((other) => isSame(other, item))) {
      return list;
    }
    const nextIndex = spot.next ? list.findIndex((other) => isSame(other, spot.next)) : -1;
    const previousIndex = spot.previous ? list.findIndex((other) => isSame(other, spot.previous)) : -1;
    let index = Math.min(spot.index, list.length);
    if (nextIndex !== -1) {
      index = nextIndex;
    } else if (previousIndex !== -1) {
      index = previousIndex + 1;
    }
    return [...list.slice(0, index), item, ...list.slice(index)];
  }

  // An exercise in the workout being built. Taking one out of a superset of
  // two unlinks its partner, so the partner is remembered too.
  function takeExercise(exercises, exercise) {
    const { remaining: linked, spot } = takeOut(exercises, exercise);
    const remaining = WorkoutLogic.withoutLoneSupersets(linked);
    const partner = remaining.find((other, index) => other !== linked[index]) ?? null;
    return { exercise, remaining, partner, spot: spotAt(remaining, spot.index) };
  }

  function putExerciseBack(exercises, { exercise, partner, spot }) {
    const restored = putBack(exercises, exercise, spot).map((other) =>
      other === partner ? { ...other, supersetId: exercise.supersetId } : other,
    );
    return WorkoutLogic.withoutLoneSupersets(restored);
  }

  // ----- The bar -----

  let bar = null;
  let timer = null;
  let shownAt = 0;

  function secondsLeft(elapsedMs) {
    return Math.ceil((SECONDS * 1000 - elapsedMs) / 1000);
  }

  function dismiss() {
    clearInterval(timer);
    bar?.remove();
    bar = null;
  }

  // show("Banana deleted", putItBack). `host` places the bar inside an open
  // sheet, which would otherwise cover it.
  function show(message, onUndo, { host = document.body } = {}) {
    dismiss();
    shownAt = Date.now();
    const countdown = el("span", { class: "undo-countdown", "aria-hidden": "true" }, `${secondsLeft(0)} s to undo`);
    const shown = el(
      "div",
      { class: host === document.body ? "undo-bar" : "undo-bar in-sheet" },
      el("span", { class: "undo-text" }, el("span", { class: "undo-message", role: "status" }, message), countdown),
      el(
        "button",
        {
          type: "button",
          class: "undo-button",
          onclick: () => {
            if (bar !== shown) {
              return; // Timed out or replaced while being tapped.
            }
            dismiss();
            onUndo();
          },
        },
        "Undo",
      ),
      el("span", { class: "undo-drain", style: `animation-duration: ${SECONDS}s`, "aria-hidden": "true" }),
    );
    bar = shown;
    host.prepend(shown);
    timer = setInterval(() => {
      const left = secondsLeft(Date.now() - shownAt);
      if (left <= 0) {
        dismiss();
      } else {
        countdown.textContent = `${left} s to undo`;
      }
    }, TICK_MS);
  }

  // Keeps a bar that was inside a sheet going when the sheet closes.
  function moveToPage() {
    if (!bar || bar.parentElement === document.body) {
      return;
    }
    // Moving restarts the draining line, so start it partway along.
    bar.querySelector(".undo-drain").style.animationDelay = `${shownAt - Date.now()}ms`;
    bar.classList.remove("in-sheet");
    document.body.prepend(bar);
  }

  return { takeOut, putBack, takeExercise, putExerciseBack, secondsLeft, show, dismiss, moveToPage };
})();
