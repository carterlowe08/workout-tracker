// Food diary on the Calories page: add foods to meals from a USDA search or
// by hand, and see today's calories and macros.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  const MEALS = [
    { id: "breakfast", name: "Breakfast", icon: "☕" },
    { id: "lunch", name: "Lunch", icon: "🥪" },
    { id: "dinner", name: "Dinner", icon: "🍽️" },
    { id: "snacks", name: "Snacks", icon: "🍎" },
  ];
  const MACROS = [
    { field: "carbs", label: "Carbs", letter: "C" },
    { field: "fat", label: "Fat", letter: "F" },
    { field: "protein", label: "Protein", letter: "P" },
  ];
  const MAX_RECENT_FOODS = 15;
  const MAX_GRAMS = 5000;
  const GRAMS_UNIT = "grams";

  let foodLog = Store.read(KEYS.foodLog, []);
  let recentFoods = Store.read(KEYS.recentFoods, []);
  // Daily calorie and macro goals come from the macro plan; null until one is set.
  const goals = Store.read(KEYS.nutritionGoals, null);
  const expandedMeals = new Set();
  let activeMeal = MEALS[0];
  let selectedFood = null;

  const foodDate = document.getElementById("food-date");
  const weekDays = document.getElementById("week-days");
  const eatenCalories = document.getElementById("eaten-calories");
  const calorieGoal = document.getElementById("calorie-goal");
  const caloriesLeft = document.getElementById("calories-left");
  const calorieBar = document.getElementById("calorie-bar");
  const macroGrid = document.getElementById("macro-grid");
  const goalNote = document.getElementById("goal-note");
  const planLink = document.getElementById("plan-link");
  const mealList = document.getElementById("meal-list");

  const dialog = document.getElementById("food-dialog");
  const dialogTitle = document.getElementById("food-dialog-title");
  const searchTab = document.getElementById("tab-search");
  const manualTab = document.getElementById("tab-manual");
  const searchPanel = document.getElementById("panel-search");
  const manualPanel = document.getElementById("panel-manual");
  const searchForm = document.getElementById("food-search-form");
  const queryInput = document.getElementById("food-query");
  const searchButton = document.getElementById("food-search-button");
  const searchStatus = document.getElementById("food-search-status");
  const resultsList = document.getElementById("food-results");
  const detail = document.getElementById("food-detail");
  const detailName = document.getElementById("food-detail-name");
  const detailBrand = document.getElementById("food-detail-brand");
  const quantityInput = document.getElementById("food-quantity");
  const portionSelect = document.getElementById("food-portion");
  const amountError = document.getElementById("food-amount-error");
  const preview = document.getElementById("food-preview");
  const addButton = document.getElementById("food-add-button");
  const manualName = document.getElementById("manual-name");
  const manualNameError = document.getElementById("manual-name-error");
  const manualError = document.getElementById("manual-error");
  const manualAddButton = document.getElementById("manual-add-button");
  const manualFields = {
    calories: { input: document.getElementById("manual-calories"), max: 5000, label: "Calories" },
    protein: { input: document.getElementById("manual-protein"), max: 500, label: "Protein" },
    carbs: { input: document.getElementById("manual-carbs"), max: 1000, label: "Carbs" },
    fat: { input: document.getElementById("manual-fat"), max: 500, label: "Fat" },
  };

  function todaysEntries() {
    const today = UI.todayKey();
    return foodLog.filter((entry) => entry.date === today);
  }

  function saveFoodLog(updated) {
    if (!Store.write(KEYS.foodLog, updated)) {
      UI.showSaveError();
      return false;
    }
    foodLog = updated;
    return true;
  }

  function percentWidth(value, goal) {
    return `${goal > 0 ? Math.min(value / goal, 1) * 100 : 0}%`;
  }

  // Sunday-to-Saturday, with a check on each day that has food logged.
  function renderWeek() {
    const today = UI.todayKey();
    const [year, month, day] = today.split("-").map(Number);
    const sunday = WorkoutLogic.addDays(today, -new Date(year, month - 1, day).getDay());
    const loggedDays = new Set(foodLog.map((entry) => entry.date));
    const days = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = WorkoutLogic.addDays(sunday, offset);
      const [y, m, d] = date.split("-").map(Number);
      const weekday = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
      const logged = loggedDays.has(date);
      days.push(
        el(
          "li",
          {
            class: date === today ? "week-day today" : "week-day",
            "aria-label": `${weekday}: ${logged ? "food logged" : "nothing logged"}`,
          },
          el("span", { class: "week-letter", "aria-hidden": "true" }, weekday[0]),
          el(
            "span",
            { class: logged ? "week-check logged" : "week-check", "aria-hidden": "true" },
            logged ? "✓" : "",
          ),
        ),
      );
    }
    weekDays.replaceChildren(...days);
  }

  function renderTotals() {
    const totals = WorkoutLogic.sumNutrition(todaysEntries());
    eatenCalories.textContent = UI.formatNumber(totals.calories);
    if (goals) {
      const left = goals.calories - totals.calories;
      calorieGoal.textContent = `/ ${UI.formatNumber(goals.calories)}`;
      caloriesLeft.textContent = left >= 0 ? `${UI.formatNumber(left)} left` : `${UI.formatNumber(-left)} over`;
    } else {
      calorieGoal.textContent = "";
      caloriesLeft.textContent = "No daily goal yet";
    }
    calorieBar.style.width = percentWidth(totals.calories, goals ? goals.calories : 0);

    macroGrid.replaceChildren(
      ...MACROS.map(({ field, label }) =>
        el(
          "div",
          { class: "macro" },
          el("span", { class: "macro-label" }, label),
          el(
            "p",
            { class: "macro-amount" },
            `${UI.formatNumber(totals[field])} g`,
            goals ? el("span", { class: "goal-target" }, ` / ${UI.formatNumber(goals[field])}`) : null,
          ),
          el(
            "div",
            { class: "progress", "aria-hidden": "true" },
            el("div", {
              class: `progress-fill ${field}-fill`,
              style: `width: ${percentWidth(totals[field], goals ? goals[field] : 0)}`,
            }),
          ),
        ),
      ),
    );
    goalNote.hidden = Boolean(goals);
    goalNote.replaceChildren(
      "No daily goals yet. ",
      el("a", { class: "text-link", href: "plan.html" }, "Answer a few questions to get a plan →"),
    );
    planLink.textContent = goals ? "Edit plan" : "Set goals";
  }

  function macroLine(nutrition) {
    return MACROS.map(({ field, letter }) => `${letter} ${UI.formatNumber(nutrition[field])} g`).join(" · ");
  }

  function mealSummary(entries) {
    if (entries.length === 0) {
      return "Nothing logged yet";
    }
    return entries.length === 1 ? entries[0].name : `${entries[0].name} and ${entries.length - 1} more`;
  }

  function mealStats(entries) {
    const totals = WorkoutLogic.sumNutrition(entries);
    if (entries.length === 0) {
      return "0 cal";
    }
    const percents = WorkoutLogic.macroPercents(totals);
    const shares = MACROS.map(({ field, letter }) => `${letter} ${percents[field]}%`).join("  ");
    return `${UI.formatNumber(totals.calories)} cal · ${shares}`;
  }

  function renderFoodRow(entry) {
    return el(
      "li",
      { class: "food-row" },
      el(
        "div",
        {},
        el("span", { class: "row-title" }, entry.name),
        el("span", { class: "row-meta" }, `${entry.amount} · ${UI.formatNumber(entry.calories)} cal`),
        el("span", { class: "row-meta" }, macroLine(entry)),
      ),
      el(
        "button",
        {
          type: "button",
          class: "set-remove",
          "aria-label": `Delete ${entry.name}`,
          onclick: () => deleteEntry(entry),
        },
        "×",
      ),
    );
  }

  function renderMealCard(meal) {
    const entries = todaysEntries().filter((entry) => entry.meal === meal.id);
    const isExpanded = expandedMeals.has(meal.id);
    const detailsId = `meal-details-${meal.id}`;
    const totals = WorkoutLogic.sumNutrition(entries);
    return el(
      "li",
      { class: "card meal-card" },
      el(
        "div",
        { class: "meal-top" },
        el(
          "button",
          {
            type: "button",
            class: "meal-toggle",
            "aria-expanded": String(isExpanded),
            "aria-controls": detailsId,
            onclick: () => {
              if (isExpanded) {
                expandedMeals.delete(meal.id);
              } else {
                expandedMeals.add(meal.id);
              }
              renderMeals();
            },
          },
          el("span", { class: "meal-icon", "aria-hidden": "true" }, meal.icon),
          el(
            "span",
            { class: "meal-text" },
            el(
              "span",
              { class: "meal-name" },
              meal.name,
              el("span", { class: "meal-chevron", "aria-hidden": "true" }, "›"),
            ),
            el("span", { class: "meal-foods" }, mealSummary(entries)),
            el("span", { class: "meal-stats" }, mealStats(entries)),
          ),
        ),
        el(
          "button",
          {
            type: "button",
            class: "log-button",
            "aria-label": `Log food to ${meal.name}`,
            onclick: () => openDialog(meal),
          },
          "Log",
        ),
      ),
      el(
        "div",
        { class: "meal-details", id: detailsId, hidden: !isExpanded },
        entries.length === 0
          ? el("p", { class: "empty" }, `Nothing logged for ${meal.name.toLowerCase()} yet. Tap Log to add food.`)
          : el("ul", { class: "list" }, ...entries.map(renderFoodRow)),
        entries.length > 0
          ? el(
              "p",
              { class: "meal-total" },
              `Total: ${UI.formatNumber(totals.calories)} cal · ${macroLine(totals)}`,
            )
          : null,
      ),
    );
  }

  function renderMeals() {
    mealList.replaceChildren(...MEALS.map(renderMealCard));
  }

  function renderAll() {
    renderWeek();
    renderTotals();
    renderMeals();
  }

  function addEntry(entry) {
    if (!saveFoodLog([...foodLog, entry])) {
      return false;
    }
    expandedMeals.add(entry.meal);
    renderAll();
    dialog.close();
    UI.showToast(`Added ${entry.name} to ${activeMeal.name}`);
    return true;
  }

  async function deleteEntry(entry) {
    if (!(await UI.ask(`Remove ${entry.name} from your diary?`, { confirmLabel: "Remove", danger: true }))) {
      return;
    }
    if (saveFoodLog(foodLog.filter((item) => item.id !== entry.id))) {
      renderAll();
      UI.showToast(`Removed ${entry.name}`);
    }
  }

  // ----- Add-food sheet -----

  function showTab(tabName) {
    const isSearch = tabName === "search";
    searchTab.setAttribute("aria-selected", String(isSearch));
    manualTab.setAttribute("aria-selected", String(!isSearch));
    searchPanel.hidden = !isSearch;
    manualPanel.hidden = isSearch;
  }

  function setStatus(message, isError = false) {
    searchStatus.textContent = message;
    searchStatus.classList.toggle("error", isError);
  }

  function renderResults(foods) {
    detail.hidden = true;
    resultsList.hidden = false;
    resultsList.replaceChildren(
      ...foods.map((food) =>
        el(
          "li",
          {},
          el(
            "button",
            { type: "button", class: "food-result", onclick: () => selectFood(food) },
            el("span", { class: "row-title" }, food.name),
            el(
              "span",
              { class: "row-meta" },
              [food.brand, `${UI.formatNumber(Math.round(food.per100g.calories))} cal per 100 g`]
                .filter(Boolean)
                .join(" · "),
            ),
          ),
        ),
      ),
    );
  }

  function showRecentFoods() {
    if (recentFoods.length === 0) {
      setStatus("Search for a food, like “banana” or “greek yogurt”.");
      resultsList.replaceChildren();
      return;
    }
    setStatus("Recent foods (no search needed)");
    renderResults(recentFoods);
  }

  async function runSearch(event) {
    event.preventDefault();
    const query = queryInput.value.trim();
    if (!query) {
      setStatus("Type a food to search for.", true);
      return;
    }
    setStatus("Searching…");
    searchButton.disabled = true;
    resultsList.replaceChildren();
    detail.hidden = true;
    try {
      const foods = await FoodSearch.search(query);
      if (foods.length === 0) {
        setStatus(`No foods found for “${query}”. Try simpler words, or use Manual entry.`, true);
      } else {
        setStatus(`${UI.plural(foods.length, "result")} for “${query}”`);
        renderResults(foods);
      }
    } catch (error) {
      if (!(error instanceof FoodSearch.FoodSearchError)) {
        throw error;
      }
      setStatus(error.message, true);
    } finally {
      searchButton.disabled = false;
    }
  }

  // Prefer a portion named after the food itself ("1 banana", "1 breast")
  // over cups or slices; otherwise use USDA's first portion.
  function defaultPortionIndex(food) {
    const nameWords = food.name
      .split(",")[0]
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.replace(/s$/, ""));
    const index = food.portions.findIndex((portion) =>
      nameWords.some((word) => word.length > 2 && portion.label.toLowerCase().startsWith(`1 ${word}`)),
    );
    return Math.max(index, 0);
  }

  function selectFood(food) {
    selectedFood = food;
    detailName.textContent = food.name;
    detailBrand.textContent = food.brand;
    portionSelect.replaceChildren(
      ...food.portions.map((portion, index) =>
        el("option", { value: String(index) }, `${portion.label} (${UI.formatNumber(portion.grams)} g)`),
      ),
      el("option", { value: GRAMS_UNIT }, "grams"),
    );
    // Start with one portion, or 100 g if USDA lists no portions.
    portionSelect.value = food.portions.length > 0 ? String(defaultPortionIndex(food)) : GRAMS_UNIT;
    quantityInput.value = food.portions.length > 0 ? "1" : "100";
    resultsList.hidden = true;
    detail.hidden = false;
    setStatus("");
    updatePreview();
    quantityInput.focus();
  }

  function selectedGrams() {
    const quantity = Number(quantityInput.value);
    if (quantityInput.value === "" || !(quantity > 0)) {
      return null;
    }
    const gramsPerUnit =
      portionSelect.value === GRAMS_UNIT ? 1 : selectedFood.portions[Number(portionSelect.value)].grams;
    const grams = quantity * gramsPerUnit;
    return grams <= MAX_GRAMS ? grams : null;
  }

  function updatePreview() {
    const grams = selectedGrams();
    amountError.textContent = grams === null ? `Enter an amount above 0 (up to ${MAX_GRAMS} g).` : "";
    addButton.disabled = grams === null;
    const nutrition = WorkoutLogic.nutritionForGrams(selectedFood.per100g, grams || 0);
    preview.replaceChildren(
      el("div", {}, el("strong", {}, UI.formatNumber(nutrition.calories)), el("span", {}, "cal")),
      ...MACROS.map(({ field, label }) =>
        el("div", {}, el("strong", {}, `${UI.formatNumber(nutrition[field])} g`), el("span", {}, label)),
      ),
    );
  }

  function rememberFood(food) {
    recentFoods = [food, ...recentFoods.filter((item) => item.id !== food.id)].slice(0, MAX_RECENT_FOODS);
    Store.write(KEYS.recentFoods, recentFoods);
  }

  function addSelectedFood() {
    const grams = selectedGrams();
    if (grams === null) {
      updatePreview();
      return;
    }
    const quantity = Number(quantityInput.value);
    let amount = `${UI.formatNumber(grams)} g`;
    if (portionSelect.value !== GRAMS_UNIT) {
      const portionLabel = selectedFood.portions[Number(portionSelect.value)].label;
      amount = quantity === 1 ? portionLabel : `${UI.formatNumber(quantity)} × ${portionLabel}`;
    }
    const added = addEntry({
      id: Date.now(),
      date: UI.todayKey(),
      meal: activeMeal.id,
      name: selectedFood.name,
      amount,
      ...WorkoutLogic.nutritionForGrams(selectedFood.per100g, grams),
    });
    if (added) {
      rememberFood(selectedFood);
    }
  }

  function readManualNumber({ input, max, label }, required) {
    if (input.value === "") {
      return required ? { error: `Enter ${label.toLowerCase()}.` } : { value: 0 };
    }
    const value = Number(input.value);
    if (!(value >= 0 && value <= max)) {
      return { error: `${label} must be between 0 and ${UI.formatNumber(max)}.` };
    }
    return { value };
  }

  function addManualFood(event) {
    event.preventDefault();
    const name = manualName.value.trim();
    manualNameError.textContent = name ? "" : "Enter a food name.";
    const values = {};
    let firstError = "";
    for (const [field, config] of Object.entries(manualFields)) {
      const result = readManualNumber(config, field === "calories");
      config.input.setAttribute("aria-invalid", result.error ? "true" : "false");
      if (result.error && !firstError) {
        firstError = result.error;
      }
      values[field] = result.value;
    }
    manualError.textContent = firstError;
    if (!name || firstError) {
      return;
    }
    const added = addEntry({
      id: Date.now(),
      date: UI.todayKey(),
      meal: activeMeal.id,
      name,
      amount: "Manual entry",
      calories: Math.round(values.calories),
      protein: values.protein,
      carbs: values.carbs,
      fat: values.fat,
    });
    if (added) {
      manualPanel.reset();
    }
  }

  function openDialog(meal) {
    activeMeal = meal;
    dialogTitle.textContent = `Add to ${meal.name}`;
    addButton.textContent = `Add to ${meal.name}`;
    manualAddButton.textContent = `Add to ${meal.name}`;
    manualNameError.textContent = "";
    manualError.textContent = "";
    queryInput.value = "";
    showTab("search");
    showRecentFoods();
    dialog.showModal();
    queryInput.focus();
  }

  searchTab.addEventListener("click", () => showTab("search"));
  manualTab.addEventListener("click", () => {
    showTab("manual");
    manualName.focus();
  });
  searchForm.addEventListener("submit", runSearch);
  document.getElementById("food-detail-back").addEventListener("click", () => {
    detail.hidden = true;
    resultsList.hidden = false;
  });
  quantityInput.addEventListener("input", updatePreview);
  portionSelect.addEventListener("change", updatePreview);
  addButton.addEventListener("click", addSelectedFood);
  manualPanel.addEventListener("submit", addManualFood);
  document.getElementById("food-dialog-close").addEventListener("click", () => dialog.close());
  // Clicking the dimmed area outside the sheet closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  foodDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  renderAll();
  // plan.js sends people here with #plan-saved after saving a plan.
  if (location.hash === "#plan-saved") {
    UI.showToast("Plan saved. Your goals are set.");
    history.replaceState(null, "", location.pathname);
  }
})();
