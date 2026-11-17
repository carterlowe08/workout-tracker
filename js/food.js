// Food diary on the Calories page: add foods to meals from a USDA search or
// by hand, and see today's calories and macros.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  const MEALS = [
    { id: "breakfast", name: "Breakfast" },
    { id: "lunch", name: "Lunch" },
    { id: "dinner", name: "Dinner" },
    { id: "snacks", name: "Snacks" },
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
  const weekBars = document.getElementById("week-bars");
  const eatenCalories = document.getElementById("eaten-calories");
  const calorieGoal = document.getElementById("calorie-goal");
  const caloriesLeft = document.getElementById("calories-left");
  const netCalories = document.getElementById("net-calories");
  const macroSplit = document.getElementById("macro-split");
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
  const tabs = {
    search: { tab: searchTab, panel: searchPanel },
    restaurants: {
      tab: document.getElementById("tab-restaurants"),
      panel: document.getElementById("panel-restaurants"),
    },
    scan: { tab: document.getElementById("tab-scan"), panel: document.getElementById("panel-scan") },
    manual: { tab: manualTab, panel: manualPanel },
  };
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
    // Calories in vs. out redraws from the food log.
    document.dispatchEvent(new Event("food-log-changed"));
    return true;
  }

  // One bar per day for the last 7 days, as tall as that day's calories; today is highlighted.
  function renderWeek() {
    const today = UI.todayKey();
    const days = Array.from({ length: 7 }, (_, index) => WorkoutLogic.addDays(today, index - 6));
    const caloriesByDay = days.map(
      (date) => WorkoutLogic.sumNutrition(foodLog.filter((entry) => entry.date === date)).calories,
    );
    const tallest = Math.max(goals ? goals.calories : 0, ...caloriesByDay, 1);
    weekBars.replaceChildren(
      ...days.map((date, index) => {
        const [year, month, day] = date.split("-").map(Number);
        const weekday = new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "long" });
        const calories = caloriesByDay[index];
        return el(
          "li",
          {
            class: date === today ? "week-bar today" : "week-bar",
            "aria-label": `${weekday}: ${calories > 0 ? `${UI.formatNumber(calories)} kcal` : "nothing logged"}`,
          },
          el("span", {
            class: "week-bar-fill",
            "aria-hidden": "true",
            style: `height: ${calories > 0 ? Math.max((calories / tallest) * 100, 6) : 4}%`,
          }),
          el("span", { class: "week-bar-day", "aria-hidden": "true" }, weekday.slice(0, 2)),
        );
      }),
    );
  }

  function burnedToday() {
    const today = UI.todayKey();
    return Store.read(KEYS.calories, [])
      .filter((entry) => entry.date === today)
      .reduce((total, entry) => total + entry.calories, 0);
  }

  // Net = eaten minus burned. Redrawn when the exercise log changes too.
  function renderNet() {
    const eaten = WorkoutLogic.sumNutrition(todaysEntries()).calories;
    netCalories.textContent = UI.formatNumber(eaten - burnedToday());
  }

  function renderTotals() {
    const totals = WorkoutLogic.sumNutrition(todaysEntries());
    eatenCalories.textContent = UI.formatNumber(totals.calories);
    if (goals) {
      const left = goals.calories - totals.calories;
      calorieGoal.textContent = `of ${UI.formatNumber(goals.calories)} kcal`;
      caloriesLeft.textContent =
        left >= 0 ? `${UI.formatNumber(left)} kcal left to eat today` : `${UI.formatNumber(-left)} kcal over today's goal`;
    } else {
      calorieGoal.textContent = "No daily goal yet";
      caloriesLeft.textContent = "";
    }
    renderNet();

    // The bar splits today's calories by where they came from (carbs, fat, protein).
    const percents = WorkoutLogic.macroPercents(totals);
    macroSplit.replaceChildren(
      ...MACROS.filter(({ field }) => percents[field] > 0).map(({ field }) =>
        el("span", { class: `macro-split-part ${field}-fill`, style: `flex-grow: ${percents[field]}` }),
      ),
    );
    macroGrid.replaceChildren(
      ...MACROS.map(({ field, label }) =>
        el(
          "li",
          { class: `macro-key macro-${field}` },
          el("span", { class: "macro-label" }, label),
          `${UI.formatNumber(totals[field])}${goals ? ` / ${UI.formatNumber(goals[field])}` : ""} g`,
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

  // Each macro's share of the meal's calories, e.g. "C 45%  F 30%  P 25%".
  function mealStats(entries) {
    const percents = WorkoutLogic.macroPercents(WorkoutLogic.sumNutrition(entries));
    return MACROS.map(({ field, letter }) => `${letter} ${percents[field]}%`).join("  ");
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
      { class: "meal-card" },
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
          el(
            "span",
            { class: "meal-text" },
            el(
              "span",
              { class: "meal-name" },
              meal.name,
              el("span", { class: "meal-calories" }, ` · ${UI.formatNumber(totals.calories)}`),
              el("span", { class: "meal-chevron", "aria-hidden": "true" }, "›"),
            ),
            el("span", { class: "meal-foods" }, mealSummary(entries)),
            entries.length > 0 ? el("span", { class: "meal-stats" }, mealStats(entries)) : null,
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

  // Saves a diary entry. Usually closes the sheet with a toast; quick add keeps
  // the sheet open so several items can be logged in a row.
  function addEntry(entry, { keepOpen = false } = {}) {
    if (!saveFoodLog([...foodLog, entry])) {
      return false;
    }
    expandedMeals.add(entry.meal);
    renderAll();
    if (!keepOpen) {
      dialog.close();
      UI.showToast(`Added ${entry.name} to ${activeMeal.name}`);
    }
    return true;
  }

  // A unique id for a new entry, even when two are added in the same millisecond.
  let lastEntryId = 0;
  function newEntryId() {
    lastEntryId = Math.max(Date.now(), lastEntryId + 1);
    return lastEntryId;
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
    for (const [name, { tab, panel }] of Object.entries(tabs)) {
      tab.setAttribute("aria-selected", String(name === tabName));
      panel.hidden = name !== tabName;
    }
    if (tabName === "scan") {
      startScan();
    } else {
      stopScan();
    }
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
        setStatus(`No foods found for “${query}”. Try simpler words, or use the Manual tab.`, true);
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

  // ----- Restaurants tab: pick a chain, then an item from its menu -----
  // Dining halls come first in the list and open on their stations.

  const restaurants = Restaurants.load([...DINING_HALL_MENUS, ...RESTAURANT_MENUS]);
  const MAX_SERVINGS = 20;
  const restaurantPick = document.getElementById("restaurant-pick");
  const restaurantQuery = document.getElementById("restaurant-query");
  const restaurantStatus = document.getElementById("restaurant-status");
  const restaurantList = document.getElementById("restaurant-list");
  const restaurantMenu = document.getElementById("restaurant-menu");
  const restaurantBadge = document.getElementById("restaurant-badge");
  const restaurantName = document.getElementById("restaurant-name");
  const restaurantNote = document.getElementById("restaurant-note");
  const menuQuery = document.getElementById("menu-query");
  const mealTimeSwitch = document.getElementById("meal-time-switch");
  const menuCategories = document.getElementById("menu-categories");
  const menuStatus = document.getElementById("menu-status");
  const menuItems = document.getElementById("menu-items");
  const menuStationHeading = document.getElementById("menu-station-heading");
  const menuStations = document.getElementById("menu-stations");
  const quickAddedBar = document.getElementById("quick-added");
  const quickAddedText = document.getElementById("quick-added-text");
  const restaurantBack = document.getElementById("restaurant-back");
  const restaurantItem = document.getElementById("restaurant-item");
  const restaurantItemBack = document.getElementById("restaurant-item-back");
  const restaurantItemName = document.getElementById("restaurant-item-name");
  const restaurantItemPlace = document.getElementById("restaurant-item-place");
  const servingsInput = document.getElementById("restaurant-servings");
  const servingsError = document.getElementById("restaurant-servings-error");
  const restaurantPreview = document.getElementById("restaurant-preview");
  const restaurantAddButton = document.getElementById("restaurant-add-button");
  let openRestaurant = null;
  let menuMealTime = "all";
  let menuCategory = Restaurants.ALL_CATEGORIES;
  let selectedMenuItem = null;
  // Dining halls: the open station (null shows the station grid), how many of
  // each item were quick-added since the sheet opened, and the last quick add,
  // which Undo removes.
  let menuStation = null;
  let quickAddCounts = new Map();
  let lastQuickAdd = null;

  function badgeFor(restaurant, element = el("span", { class: "restaurant-badge", "aria-hidden": "true" })) {
    element.textContent = restaurant.initials;
    element.style.background = restaurant.color;
    element.style.color = restaurant.textColor;
    return element;
  }

  function showRestaurantView(view) {
    restaurantPick.hidden = view !== "pick";
    restaurantMenu.hidden = view !== "menu";
    restaurantItem.hidden = view !== "item";
  }

  function renderRestaurantList() {
    const query = restaurantQuery.value.trim();
    const found = Restaurants.find(restaurants, query, activeMeal.id);
    restaurantStatus.textContent =
      found.length === 0
        ? `No restaurant called “${query}” yet. Try the Search or Manual tab.`
        : query
          ? ""
          : "Pick a restaurant to see its menu.";
    restaurantList.replaceChildren(
      ...found.map((restaurant) =>
        el(
          "li",
          {},
          el(
            "button",
            { type: "button", class: "food-result restaurant-row", onclick: () => openMenu(restaurant) },
            badgeFor(restaurant),
            el(
              "span",
              { class: "row-text" },
              el("span", { class: "row-title" }, restaurant.name),
              el(
                "span",
                { class: "row-meta" },
                Restaurants.usesStations(restaurant)
                  ? `${restaurant.kind} · ${UI.plural(restaurant.items.length, "item")} · ${UI.plural(Restaurants.categories(restaurant).length, "station")}`
                  : `${UI.plural(restaurant.items.length, "item")} · ${Restaurants.categories(restaurant).join(", ")}`,
              ),
            ),
            el("span", { class: "row-meta", "aria-hidden": "true" }, "›"),
          ),
        ),
      ),
    );
  }

  function showRestaurantPicker() {
    openRestaurant = null;
    showRestaurantView("pick");
    renderRestaurantList();
    restaurantQuery.focus();
  }

  function renderMenuItems() {
    const query = menuQuery.value.trim();
    if (Restaurants.usesStations(openRestaurant)) {
      renderStationMenu(query);
      return;
    }
    const items = Restaurants.menuItems(openRestaurant, { mealTime: menuMealTime, category: menuCategory, query });
    const otherMealTime = menuMealTime === "all" ? "" : " Try All for the whole menu.";
    menuStatus.textContent = items.length === 0 ? `Nothing on this menu matches “${query}”.${otherMealTime}` : "";
    menuItems.replaceChildren(
      ...items.map((item) =>
        el(
          "li",
          {},
          el(
            "button",
            { type: "button", class: "food-result restaurant-row", onclick: () => selectMenuItem(item) },
            el(
              "span",
              { class: "row-text" },
              el("span", { class: "row-title" }, item.name),
              el("span", { class: "row-meta" }, macroLine(item)),
            ),
            el("span", { class: "restaurant-calories" }, `${UI.formatNumber(item.calories)} cal`),
          ),
        ),
      ),
    );
  }

  // Dining hall menu: the station grid, or one station's items (or search
  // results across every station) with a + to log one serving right away.
  function renderStationMenu(query) {
    const showGrid = menuStation === null && query === "";
    menuStations.hidden = !showGrid;
    menuItems.hidden = showGrid;
    menuStationHeading.hidden = menuStation === null;
    menuStationHeading.textContent = menuStation || "";
    restaurantBack.textContent = menuStation === null ? "← All restaurants" : `← ${openRestaurant.shortName} stations`;
    if (showGrid) {
      menuStatus.textContent = "";
      menuStations.replaceChildren(
        ...Restaurants.stations(openRestaurant, menuMealTime).map((station) =>
          el(
            "button",
            {
              type: "button",
              class: "station-card",
              onclick: () => {
                menuStation = station.name;
                renderMenuItems();
              },
            },
            el("strong", {}, station.name),
            el("span", { class: "row-meta" }, station.blurb),
            el("span", { class: "station-count" }, UI.plural(station.count, "item")),
          ),
        ),
      );
      return;
    }
    const items = Restaurants.menuItems(openRestaurant, {
      mealTime: menuMealTime,
      category: menuStation || Restaurants.ALL_CATEGORIES,
      query,
    });
    const otherMealTime = menuMealTime === "all" ? "" : " Try All for the whole menu.";
    menuStatus.textContent =
      items.length === 0
        ? `Nothing ${menuStation ? `at ${menuStation}` : "on this menu"} matches “${query}”.${otherMealTime}`
        : "";
    menuItems.replaceChildren(...items.map(quickAddRow));
  }

  function quickAddRow(item) {
    const added = quickAddCounts.get(item.id) || 0;
    return el(
      "li",
      { class: "quick-add-row" },
      el(
        "button",
        { type: "button", class: "food-result quick-add-name", onclick: () => selectMenuItem(item) },
        el("span", { class: "row-title" }, item.name),
        el(
          "span",
          { class: "row-meta" },
          [menuStation ? null : item.category, item.serving, `${UI.formatNumber(item.calories)} cal`].filter(Boolean).join(" · "),
        ),
      ),
      added ? el("span", { class: "quick-add-count", "aria-label": `${added} added` }, `×${added}`) : null,
      el(
        "button",
        {
          type: "button",
          class: "quick-add-button",
          "aria-label": `Add 1 serving of ${item.name} to ${activeMeal.name}`,
          onclick: () => quickAdd(item),
        },
        "+",
      ),
    );
  }

  function quickAdd(item) {
    const entry = menuEntry(item, 1);
    if (!addEntry(entry, { keepOpen: true })) {
      return;
    }
    quickAddCounts.set(item.id, (quickAddCounts.get(item.id) || 0) + 1);
    lastQuickAdd = { entry, itemId: item.id };
    quickAddedText.textContent = `Added ${item.name} to ${activeMeal.name}`;
    quickAddedBar.hidden = false;
    renderMenuItems();
  }

  function undoQuickAdd() {
    if (!lastQuickAdd) {
      return;
    }
    const { entry, itemId } = lastQuickAdd;
    if (!saveFoodLog(foodLog.filter((item) => item.id !== entry.id))) {
      return;
    }
    renderAll();
    quickAddCounts.set(itemId, quickAddCounts.get(itemId) - 1);
    lastQuickAdd = null;
    quickAddedBar.hidden = true;
    renderMenuItems();
    UI.showToast(`Removed ${entry.name}`);
  }

  function hideQuickAdded() {
    lastQuickAdd = null;
    quickAddedBar.hidden = true;
  }

  function renderMenuCategories() {
    menuCategories.replaceChildren(
      ...[Restaurants.ALL_CATEGORIES, ...Restaurants.categories(openRestaurant, menuMealTime)].map((category) =>
        el(
          "button",
          {
            type: "button",
            class: "chip",
            "aria-pressed": String(category === menuCategory),
            onclick: () => {
              menuCategory = category;
              renderMenuCategories();
              renderMenuItems();
            },
          },
          category,
        ),
      ),
    );
  }

  // Breakfast / Lunch & Dinner / All, shown only for chains with a breakfast menu.
  function renderMealTimeSwitch() {
    mealTimeSwitch.hidden = !Restaurants.servesBreakfast(openRestaurant);
    mealTimeSwitch.replaceChildren(
      ...Restaurants.MEAL_TIMES.map(({ id, label }) =>
        el(
          "button",
          {
            type: "button",
            class: "tab",
            role: "radio",
            "aria-checked": String(id === menuMealTime),
            onclick: () => {
              menuMealTime = id;
              menuCategory = Restaurants.ALL_CATEGORIES;
              if (menuStation && !Restaurants.categories(openRestaurant, id).includes(menuStation)) {
                menuStation = null;
              }
              renderMealTimeSwitch();
              renderMenuCategories();
              renderMenuItems();
            },
          },
          label,
        ),
      ),
    );
  }

  function openMenu(restaurant) {
    openRestaurant = restaurant;
    menuMealTime = Restaurants.mealTimeFor(activeMeal.id, restaurant);
    menuCategory = Restaurants.ALL_CATEGORIES;
    renderMealTimeSwitch();
    badgeFor(restaurant, restaurantBadge);
    restaurantName.textContent = restaurant.name;
    restaurantNote.textContent = restaurant.note || "";
    restaurantNote.hidden = !restaurant.note;
    menuQuery.value = "";
    menuQuery.placeholder = `Search ${restaurant.name}`;
    restaurantItemBack.textContent = `← ${restaurant.shortName || restaurant.name} menu`;
    const stationLayout = Restaurants.usesStations(restaurant);
    menuStation = null;
    hideQuickAdded();
    menuCategories.hidden = stationLayout;
    menuStations.hidden = !stationLayout;
    menuStationHeading.hidden = true;
    menuItems.hidden = false;
    restaurantBack.textContent = "← All restaurants";
    renderMenuCategories();
    renderMenuItems();
    showRestaurantView("menu");
    menuItems.scrollTop = 0;
  }

  function selectedServings() {
    const servings = Number(servingsInput.value);
    return servingsInput.value !== "" && servings > 0 && servings <= MAX_SERVINGS ? servings : null;
  }

  function updateRestaurantPreview() {
    const servings = selectedServings();
    servingsError.textContent = servings === null ? `Enter servings above 0 (up to ${MAX_SERVINGS}).` : "";
    servingsInput.setAttribute("aria-invalid", servings === null ? "true" : "false");
    restaurantAddButton.disabled = servings === null;
    const nutrition = Restaurants.nutritionFor(selectedMenuItem, servings || 0);
    restaurantPreview.replaceChildren(
      el("div", {}, el("strong", {}, UI.formatNumber(nutrition.calories)), el("span", {}, "cal")),
      ...MACROS.map(({ field, label }) =>
        el("div", {}, el("strong", {}, `${UI.formatNumber(nutrition[field])} g`), el("span", {}, label)),
      ),
    );
  }

  function selectMenuItem(item) {
    selectedMenuItem = item;
    restaurantItemName.textContent = item.name;
    restaurantItemPlace.textContent = [openRestaurant.name, item.category, item.serving && `1 serving = ${item.serving}`]
      .filter(Boolean)
      .join(" · ");
    servingsInput.value = "1";
    showRestaurantView("item");
    updateRestaurantPreview();
  }

  function addMenuItem() {
    const servings = selectedServings();
    if (servings === null) {
      updateRestaurantPreview();
      return;
    }
    addEntry(menuEntry(selectedMenuItem, servings));
  }

  function menuEntry(item, servings) {
    return {
      id: newEntryId(),
      date: UI.todayKey(),
      meal: activeMeal.id,
      name: `${openRestaurant.shortName || openRestaurant.name} ${item.name}`,
      amount: Restaurants.servingsLabel(servings),
      ...Restaurants.nutritionFor(item, servings),
    };
  }

  // Back from a station goes to the station grid; otherwise to the restaurant list.
  function goBackFromMenu() {
    if (Restaurants.usesStations(openRestaurant) && menuStation !== null) {
      menuStation = null;
      menuQuery.value = "";
      renderMenuItems();
      return;
    }
    hideQuickAdded();
    showRestaurantPicker();
  }

  restaurantQuery.addEventListener("input", renderRestaurantList);
  menuQuery.addEventListener("input", renderMenuItems);
  restaurantBack.addEventListener("click", goBackFromMenu);
  document.getElementById("quick-added-undo").addEventListener("click", undoQuickAdd);
  restaurantItemBack.addEventListener("click", () => showRestaurantView("menu"));
  servingsInput.addEventListener("input", updateRestaurantPreview);
  restaurantAddButton.addEventListener("click", addMenuItem);

  // ----- Scan tab -----

  const scanVideo = document.getElementById("scan-video");
  const scanView = document.getElementById("scan-view");
  const scanStatus = document.getElementById("scan-status");
  const scanAgainButton = document.getElementById("scan-again");
  const scanForm = document.getElementById("scan-form");
  const scanCodeInput = document.getElementById("scan-code");
  const scanLookupButton = document.getElementById("scan-lookup");
  let stopCamera = null;
  // Counts lookups so an answer for an older barcode is ignored.
  let lookupNumber = 0;

  function setScanStatus(message, isError = false) {
    scanStatus.textContent = message;
    scanStatus.classList.toggle("error", isError);
  }

  function stopScan() {
    if (stopCamera) {
      stopCamera();
      stopCamera = null;
    }
    lookupNumber += 1;
  }

  function startScan() {
    stopScan();
    scanView.hidden = false;
    scanAgainButton.hidden = true;
    setScanStatus("Point your camera at the barcode on the package.");
    stopCamera = Barcode.startScanning(scanVideo, lookUpBarcode, (message) => {
      stopCamera = null;
      scanView.hidden = true;
      setScanStatus(message, true);
    });
  }

  async function lookUpBarcode(code) {
    stopCamera = null;
    const thisLookup = ++lookupNumber;
    scanView.hidden = true;
    scanAgainButton.hidden = true;
    scanLookupButton.disabled = true;
    setScanStatus(`Looking up ${code}…`);
    try {
      const food = await Barcode.lookUp(code);
      if (thisLookup !== lookupNumber) {
        return;
      }
      if (food) {
        scanCodeInput.value = "";
        showTab("search");
        selectFood(food);
        return;
      }
      setScanStatus(`No product found for ${code}. Try scanning again, search by name, or use the Manual tab.`, true);
    } catch (error) {
      if (!(error instanceof Barcode.BarcodeError)) {
        throw error;
      }
      if (thisLookup === lookupNumber) {
        setScanStatus(error.message, true);
      }
    } finally {
      scanLookupButton.disabled = false;
      if (thisLookup === lookupNumber) {
        scanAgainButton.hidden = false;
      }
    }
  }

  function lookUpTypedBarcode(event) {
    event.preventDefault();
    const code = Barcode.cleanCode(scanCodeInput.value);
    if (!code) {
      setScanStatus("A barcode number is 8, 12 or 13 digits, like 028400090896.", true);
      return;
    }
    stopScan();
    lookUpBarcode(code);
  }

  scanAgainButton.addEventListener("click", startScan);
  scanForm.addEventListener("submit", lookUpTypedBarcode);

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
    restaurantAddButton.textContent = `Add to ${meal.name}`;
    restaurantQuery.value = "";
    quickAddCounts = new Map();
    hideQuickAdded();
    showRestaurantView("pick");
    renderRestaurantList();
    manualNameError.textContent = "";
    manualError.textContent = "";
    queryInput.value = "";
    showTab("search");
    showRecentFoods();
    dialog.showModal();
    queryInput.focus();
  }

  searchTab.addEventListener("click", () => showTab("search"));
  tabs.restaurants.tab.addEventListener("click", () => {
    showTab("restaurants");
    if (!restaurantPick.hidden) {
      restaurantQuery.focus();
    }
  });
  tabs.scan.tab.addEventListener("click", () => showTab("scan"));
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
  // Turn the camera off whenever the sheet closes, however it was closed.
  dialog.addEventListener("close", stopScan);
  // Clicking the dimmed area outside the sheet closes it.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  document.addEventListener("burned-calories-changed", renderNet);

  foodDate.textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  renderAll();
  // plan.js sends people here with #plan-saved after saving a plan.
  if (location.hash === "#plan-saved") {
    UI.showToast("Plan saved. Your goals are set.");
    history.replaceState(null, "", location.pathname);
  }
})();
