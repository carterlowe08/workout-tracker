// The popup behind an exercise's Swap button: same-muscle suggestions first,
// and a search over the whole exercise list.
const SwapSheet = (() => {
  const { el } = UI;

  // Resolves to the chosen exercise, or null if cancelled.
  function open(source, allExercises, takenNames) {
    return new Promise((resolve) => {
      const search = el("input", {
        type: "search",
        placeholder: "Search exercises",
        "aria-label": "Search exercises",
        autocomplete: "off",
      });
      const heading = el("p", { class: "swap-heading", "aria-live": "polite" });
      const options = el("div", { class: "swap-options" });
      const cancelButton = el("button", { type: "button", class: "button-secondary" }, "Cancel");
      const sheet = el(
        "dialog",
        { class: "sheet swap-sheet", "aria-labelledby": "swap-sheet-title" },
        el("h2", { id: "swap-sheet-title" }, `Swap ${source.name}`),
        search,
        heading,
        options,
        el("div", { class: "sheet-footer button-row" }, cancelButton),
      );

      function finish(choice) {
        sheet.close();
        sheet.remove();
        resolve(choice);
      }

      function drawOptions() {
        const typed = search.value.trim();
        const choices = WorkoutLogic.swapChoices(allExercises, takenNames, source.group, typed);
        heading.textContent = typed ? UI.plural(choices.length, "result") : `Same muscle: ${source.group}`;
        options.replaceChildren(
          ...(choices.length > 0
            ? choices.map((choice) =>
                el(
                  "button",
                  { type: "button", class: "swap-option", onclick: () => finish(choice) },
                  choice.name,
                  el("small", {}, [choice.group, choice.equipment].filter(Boolean).join(" · ")),
                ),
              )
            : [el("p", { class: "muted" }, "No exercises match your search.")]),
        );
      }

      search.addEventListener("input", drawOptions);
      cancelButton.addEventListener("click", () => finish(null));
      // Escape and the dimmed area outside the sheet count as Cancel.
      sheet.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      });
      sheet.addEventListener("click", (event) => {
        if (event.target === sheet) {
          finish(null);
        }
      });
      drawOptions();
      document.body.append(sheet);
      sheet.showModal();
    });
  }

  return { open };
})();
