// How-to for an exercise: start and finish photos, a muscle map, and the
// steps, all from the open free-exercise-db (public domain). Shown at the top
// of the exercise sheet that opens when you tap an exercise's name.
const ExerciseGuide = (() => {
  const { el } = UI;
  const PHOTO_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
  const STEPS_URL = "js/exerciseSteps.json";

  // Popular lifts point at a database exercise by id; database exercises are their own entry.
  const databaseById = new Map(EXERCISE_DATABASE.map((exercise) => [exercise.id, exercise]));
  const listedByName = new Map(EXERCISE_LIBRARY.map((exercise) => [exercise.name.toLowerCase(), exercise]));

  // The database entry with photos, muscles and steps for a name, or null
  // (custom exercises and names no longer in the list).
  function find(exerciseName) {
    const listed = listedByName.get(exerciseName.trim().toLowerCase());
    return (listed && databaseById.get(listed.id)) || null;
  }

  // The steps file is large, so it's fetched the first time a how-to opens
  // and kept for the rest of the visit. A failed fetch is tried again next time.
  let stepsRequest = null;
  function loadSteps() {
    if (!stepsRequest) {
      stepsRequest = fetch(STEPS_URL).then((response) => {
        if (!response.ok) {
          throw new Error(`Steps request failed: ${response.status}`);
        }
        return response.json();
      });
      stepsRequest.catch(() => {
        stepsRequest = null;
      });
    }
    return stepsRequest;
  }

  function photo(exercise, index, caption) {
    const image = el("img", {
      src: `${PHOTO_BASE}${exercise.id}/${index}.jpg`,
      alt: `${exercise.name}, ${caption.toLowerCase()} position`,
      width: "320",
      height: "240",
    });
    const figure = el("figure", { class: "guide-photo" }, image, el("figcaption", {}, caption));
    image.addEventListener("error", () => {
      image.replaceWith(el("div", { class: "guide-photo-missing" }, "Photo didn't load"));
    });
    return figure;
  }

  function stepsList(exercise) {
    const message = (text) => el("li", { class: "muted guide-steps-message" }, text);
    const list = el("ol", { class: "guide-steps", "aria-live": "polite" }, message("Loading steps…"));
    const showMessage = (text) => list.replaceChildren(message(text));
    loadSteps()
      .then((stepsById) => {
        const steps = stepsById[exercise.id];
        if (!steps || steps.length === 0) {
          showMessage("No written steps for this one. The photos show the start and finish.");
          return;
        }
        list.replaceChildren(...steps.map((step) => el("li", {}, step)));
      })
      .catch(() => showMessage("Couldn't load the steps. Check your connection and open this again."));
    return list;
  }

  // The how-to section for an exercise name.
  function render(exerciseName) {
    const exercise = find(exerciseName);
    if (!exercise) {
      return el(
        "section",
        { class: "guide" },
        el(
          "p",
          { class: "muted guide-none" },
          "No photos or steps for this exercise. They come from the exercise list, so custom exercises don't have them.",
        ),
      );
    }
    return el(
      "section",
      { class: "guide", "aria-label": `How to do ${exerciseName}` },
      exercise.noPhotos
        ? null
        : el("div", { class: "guide-photos" }, photo(exercise, 0, "Start"), photo(exercise, 1, "Finish")),
      MuscleMap.draw(exercise.main, exercise.also),
      el("h3", { class: "history-heading" }, "How to do it"),
      stepsList(exercise),
      el("p", { class: "note guide-credit" }, "Photos and steps: free-exercise-db (public domain)."),
    );
  }

  return { find, render, loadSteps };
})();
