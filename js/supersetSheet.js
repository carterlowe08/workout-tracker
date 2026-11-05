// The checklist behind an exercise's link button: pick which other exercises
// to do with it as a superset.
const SupersetSheet = (() => {
  const { el } = UI;

  // options: [{ name, checked, inOtherSuperset }]. Resolves to the checked
  // positions in options, or null if cancelled.
  function open(sourceName, options) {
    return new Promise((resolve) => {
      const boxes = options.map((option) => el("input", { type: "checkbox", checked: option.checked }));
      const saveButton = el("button", { type: "button", class: "button" }, "Save");
      const cancelButton = el("button", { type: "button", class: "button-secondary" }, "Cancel");
      const sheet = el(
        "dialog",
        { class: "sheet superset-sheet", "aria-labelledby": "superset-sheet-title" },
        el("h2", { id: "superset-sheet-title" }, `Superset with ${sourceName}`),
        el("p", { class: "muted" }, "Do one set of each with no rest. Rest starts after the last one."),
        el(
          "div",
          { class: "superset-options" },
          options.map((option, index) =>
            el(
              "label",
              { class: "superset-option" },
              boxes[index],
              el(
                "span",
                {},
                option.name,
                option.inOtherSuperset ? el("small", {}, "Moves out of its current superset") : null,
              ),
            ),
          ),
        ),
        el("div", { class: "button-row" }, saveButton, cancelButton),
      );
      function finish(answer) {
        sheet.close();
        sheet.remove();
        resolve(answer);
      }
      saveButton.addEventListener("click", () => {
        finish(options.flatMap((_, index) => (boxes[index].checked ? [index] : [])));
      });
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
      document.body.append(sheet);
      sheet.showModal();
    });
  }

  return { open };
})();
