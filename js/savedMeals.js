// The sheets behind a meal card's dots menu: pick a saved meal to log (or
// delete one), and save a meal under a name.
const SavedMeals = (() => {
  const { KEYS } = Store;
  const { el } = UI;

  let meals = MealLogic.usable(Store.read(KEYS.savedMeals, []));

  function saveMeals(updated) {
    if (!Store.write(KEYS.savedMeals, updated)) {
      UI.showSaveError();
      return false;
    }
    meals = updated;
    return true;
  }

  const caloriesOf = (foods) => `${UI.formatNumber(WorkoutLogic.sumNutrition(foods).calories)} cal`;
  const foodNames = (foods) => foods.map((food) => food.name).join(", ");

  // A sheet with a title and a close button; closing it always runs close().
  function buildSheet(titleId, close, ...children) {
    const title = el("h2", { id: titleId });
    const sheet = el(
      "dialog",
      { class: "sheet", "aria-labelledby": titleId },
      el(
        "div",
        { class: "sheet-header" },
        title,
        el("button", { type: "button", class: "sheet-close", "aria-label": "Close", onclick: close }, "×"),
      ),
      ...children,
    );
    sheet.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    sheet.addEventListener("click", (event) => {
      if (event.target === sheet) {
        close();
      }
    });
    document.body.append(sheet);
    return { sheet, title };
  }

  // ----- Picking a saved meal -----

  let pickFor = null; // { mealName, onPick } while the list is open

  const pickNote = el("p", { class: "muted saved-meal-note" });
  const mealList = el("ul", { class: "list saved-meal-list" });
  const undoPlace = el("div", {});
  const listSheet = buildSheet("saved-meals-title", closeList, pickNote, undoPlace, mealList);
  listSheet.title.textContent = "Saved meals";

  function closeList() {
    Undo.moveToPage(); // A meal just deleted can still be put back.
    listSheet.sheet.close();
    pickFor = null;
  }

  function renderList() {
    if (meals.length === 0) {
      mealList.replaceChildren(
        el("li", { class: "empty" }, "No saved meals yet. Log a meal, then tap ⋯ on its card and Save as meal."),
      );
      return;
    }
    mealList.replaceChildren(
      ...meals.map((meal) =>
        el(
          "li",
          { class: "saved-meal" },
          el(
            "button",
            {
              type: "button",
              class: "saved-meal-pick",
              "aria-label": `Add ${meal.name} to ${pickFor.mealName}, ${caloriesOf(meal.foods)}`,
              onclick: () => {
                const { onPick } = pickFor;
                Undo.dismiss();
                closeList();
                onPick(meal);
              },
            },
            el("span", { class: "row-title" }, meal.name),
            el("span", { class: "row-meta" }, caloriesOf(meal.foods)),
            el("span", { class: "row-meta" }, foodNames(meal.foods)),
          ),
          el(
            "button",
            {
              type: "button",
              class: "set-remove",
              "aria-label": `Delete saved meal ${meal.name}`,
              onclick: () => deleteMeal(meal),
            },
            "×",
          ),
        ),
      ),
    );
  }

  function deleteMeal(meal) {
    const { remaining, spot } = Undo.takeOut(meals, meal);
    if (!saveMeals(remaining)) {
      return;
    }
    renderList();
    Undo.show(
      `${meal.name} deleted`,
      () => {
        if (MealLogic.nameProblem(meal.name, meals)) {
          UI.showToast(`You already have a meal called ${meal.name}.`, true);
        } else if (saveMeals(Undo.putBack(meals, meal, spot))) {
          UI.showToast(`${meal.name} is back`);
          if (pickFor) {
            renderList();
          }
        }
      },
      { host: undoPlace },
    );
  }

  // onPick(meal) logs the meal that was tapped.
  function openList(mealName, onPick) {
    Undo.dismiss();
    pickFor = { mealName, onPick };
    pickNote.textContent = `Tap a meal to add its foods to ${mealName}.`;
    renderList();
    listSheet.sheet.showModal();
  }

  // ----- Saving a meal -----

  let entriesToSave = [];

  const savePreview = el("p", { class: "muted saved-meal-note" });
  const nameInput = el("input", { type: "text", maxlength: String(MealLogic.MAX_NAME_LENGTH), autocomplete: "off" });
  const nameError = el("span", { class: "field-error", "aria-live": "polite" });
  const saveForm = el(
    "form",
    { class: "form", novalidate: true },
    el("label", { class: "field" }, "Name", nameInput, nameError),
    el("button", { type: "submit", class: "button" }, "Save meal"),
  );
  const saveSheet = buildSheet("save-meal-title", closeSave, savePreview, saveForm);

  function closeSave() {
    saveSheet.sheet.close();
  }

  function showNameError(message) {
    nameError.textContent = message;
    nameInput.setAttribute("aria-invalid", String(message !== ""));
  }

  nameInput.addEventListener("input", () => showNameError(""));
  saveForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const problem = MealLogic.nameProblem(nameInput.value, meals);
    showNameError(problem);
    if (problem) {
      nameInput.focus();
      return;
    }
    const meal = MealLogic.mealFrom(nameInput.value, entriesToSave, Date.now());
    if (!saveMeals([meal, ...meals])) {
      return;
    }
    closeSave();
    UI.showToast(`Saved "${meal.name}"`);
  });

  function openSave(mealName, entries) {
    entriesToSave = entries;
    saveSheet.title.textContent = `Save ${mealName.toLowerCase()}`;
    savePreview.textContent = `${foodNames(entries)} · ${caloriesOf(entries)}`;
    nameInput.value = `Usual ${mealName.toLowerCase()}`;
    showNameError("");
    saveSheet.sheet.showModal();
    nameInput.focus();
    nameInput.select();
  }

  return { openList, openSave };
})();
