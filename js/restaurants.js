// Searching the restaurant menus in js/restaurantMenus.js. No screens here:
// the Restaurants tab in js/food.js draws what these functions return.
const Restaurants = (() => {
  const ALL_CATEGORIES = "All";

  // The menu switch's choices. Lunch and dinner share one menu at fast-food
  // chains, so they are one choice.
  const MEAL_TIMES = [
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch-dinner", label: "Lunch & Dinner" },
    { id: "all", label: "All" },
  ];
  const ANYTIME = "anytime";

  // Letters and digits only, lowercase, so "McDonalds", "mcdonald's" and
  // "Mc Donalds" all compare the same.
  function normalize(text) {
    return String(text)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[^a-z0-9]/g, "");
  }

  // Turns the compact item arrays into objects the screens can use. Each item
  // gets its meal time from its category: "breakfast", "anytime" or
  // "lunch-dinner" (the default).
  function load(menus) {
    return menus.map((restaurant) => ({
      ...restaurant,
      items: restaurant.items.map(([name, category, calories, protein, carbs, fat], index) => ({
        id: `${restaurant.id}-${index}`,
        name,
        category,
        mealTime: (restaurant.mealTimes || {})[category] || "lunch-dinner",
        calories,
        protein,
        carbs,
        fat,
      })),
    }));
  }

  function servesBreakfast(restaurant) {
    return restaurant.items.some((item) => item.mealTime === "breakfast");
  }

  // Which part of the menu to open on for the diary meal whose Log was tapped:
  // breakfast items for Breakfast, the rest for Lunch and Dinner, and the
  // whole menu for Snacks or a chain with no breakfast menu.
  function mealTimeFor(mealId, restaurant) {
    if (restaurant && !servesBreakfast(restaurant)) {
      return "all";
    }
    if (mealId === "breakfast") {
      return "breakfast";
    }
    return mealId === "lunch" || mealId === "dinner" ? "lunch-dinner" : "all";
  }

  function fitsMealTime(item, mealTime) {
    return mealTime === "all" || item.mealTime === ANYTIME || item.mealTime === mealTime;
  }

  // Restaurants whose name or an alias contains the query, best match first:
  // names that start with the query come before ones that only contain it.
  // When logging breakfast, chains that serve breakfast come first among equals.
  function find(restaurants, query, mealId) {
    const wanted = normalize(query);
    const breakfastFirst = mealId === "breakfast";
    const scored = restaurants
      .map((restaurant) => {
        const names = [restaurant.name, ...(restaurant.aliases || [])].map(normalize);
        let score = null;
        if (!wanted || names.some((name) => name.startsWith(wanted))) {
          score = 0;
        } else if (names.some((name) => name.includes(wanted))) {
          score = 2;
        }
        if (score !== null && breakfastFirst && !servesBreakfast(restaurant)) {
          score += 1;
        }
        return { restaurant, score };
      })
      .filter(({ score }) => score !== null);
    return scored.sort((a, b) => a.score - b.score).map(({ restaurant }) => restaurant);
  }

  // The categories with something to show at this meal time, in menu order.
  function categories(restaurant, mealTime = "all") {
    const shown = restaurant.items.filter((item) => fitsMealTime(item, mealTime));
    return [...new Set(shown.map((item) => item.category))];
  }

  // Menu items at a meal time, in a category ("All" for every one), whose
  // name contains the query.
  function menuItems(restaurant, { mealTime = "all", category = ALL_CATEGORIES, query = "" } = {}) {
    const wanted = normalize(query);
    return restaurant.items.filter(
      (item) =>
        fitsMealTime(item, mealTime) &&
        (category === ALL_CATEGORIES || item.category === category) &&
        normalize(item.name).includes(wanted),
    );
  }

  // Calories and macros for a number of servings, rounded like the rest of the diary.
  function nutritionFor(item, servings) {
    const roundTenth = (value) => Math.round(value * servings * 10) / 10;
    return {
      calories: Math.round(item.calories * servings),
      protein: roundTenth(item.protein),
      carbs: roundTenth(item.carbs),
      fat: roundTenth(item.fat),
    };
  }

  function servingsLabel(servings) {
    return servings === 1 ? "1 serving" : `${servings} servings`;
  }

  return {
    ALL_CATEGORIES,
    MEAL_TIMES,
    normalize,
    load,
    servesBreakfast,
    mealTimeFor,
    find,
    categories,
    menuItems,
    nutritionFor,
    servingsLabel,
  };
})();
