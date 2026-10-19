// Searches USDA FoodData Central for foods and their nutrition.
// API guide: https://fdc.nal.usda.gov/api-guide
const FoodSearch = (() => {
  // USDA's public demo key. It is shared by everyone and meant to be public,
  // so it is not a secret, but it only allows about 10 searches an hour per
  // network. Results are cached so repeating a search doesn't use one up.
  const API_KEY = "DEMO_KEY";
  const SEARCH_URL = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${API_KEY}`;
  // "Survey (FNDDS)" has everyday foods with real portion sizes; "Branded" has packaged products.
  const DATA_TYPES = ["Survey (FNDDS)", "SR Legacy", "Branded"];
  const NUTRIENT_IDS = { calories: 1008, protein: 1003, carbs: 1005, fat: 1004 };
  const CACHE_PREFIX = "workoutTracker.foodSearch.";
  const MAX_PORTIONS = 6;

  class FoodSearchError extends Error {
    constructor(message) {
      super(message);
      this.name = "FoodSearchError";
    }
  }

  // Brand-name entries arrive in ALL CAPS ("CHICKEN BREAST"); make them readable.
  function readableName(text) {
    if (text !== text.toUpperCase()) {
      return text;
    }
    return text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  }

  function nutrientPer100g(food, nutrientId) {
    const nutrient = (food.foodNutrients || []).find((item) => item.nutrientId === nutrientId);
    return nutrient && Number.isFinite(nutrient.value) ? nutrient.value : 0;
  }

  function portionsFor(food) {
    const portions = (food.foodMeasures || [])
      .filter((measure) => measure.gramWeight > 0 && measure.disseminationText)
      .filter((measure) => measure.disseminationText !== "Quantity not specified")
      .map((measure) => ({ label: measure.disseminationText, grams: measure.gramWeight }));
    const servingInGrams = /^(g|grm)$/i.test(food.servingSizeUnit || "");
    if (food.servingSize > 0 && servingInGrams) {
      const label = food.householdServingFullText ? food.householdServingFullText.toLowerCase() : "1 serving";
      portions.unshift({ label, grams: food.servingSize });
    }
    return portions.slice(0, MAX_PORTIONS);
  }

  // Turns one USDA search result into the shape the app uses.
  function toFood(food) {
    return {
      id: food.fdcId,
      name: readableName(food.description || "Unnamed food"),
      brand: food.brandName || food.brandOwner || "",
      branded: food.dataType === "Branded",
      per100g: Object.fromEntries(
        Object.entries(NUTRIENT_IDS).map(([field, nutrientId]) => [field, nutrientPer100g(food, nutrientId)]),
      ),
      portions: portionsFor(food),
    };
  }

  function readCache(query) {
    try {
      const cached = sessionStorage.getItem(CACHE_PREFIX + query);
      return cached === null ? null : JSON.parse(cached);
    } catch {
      return null;
    }
  }

  function writeCache(query, foods) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + query, JSON.stringify(foods));
    } catch {
      // The cache only saves searches; the app works without it.
    }
  }

  async function search(rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    const cached = readCache(query);
    if (cached) {
      return cached;
    }

    let response;
    try {
      response = await fetch(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, pageSize: 25, dataType: DATA_TYPES }),
      });
    } catch {
      throw new FoodSearchError(
        "Couldn't reach the food database. Check your internet connection, or use Manual entry.",
      );
    }
    if (response.status === 429) {
      throw new FoodSearchError(
        "Search limit reached. The free key allows about 10 searches an hour. Pick a recent food or use Manual entry.",
      );
    }
    if (!response.ok) {
      throw new FoodSearchError(
        `The food database had a problem (error ${response.status}). Try again, or use Manual entry.`,
      );
    }

    const data = await response.json();
    const foods = (data.foods || []).map(toFood);
    // Everyday foods first, then brand-name products. The sort keeps USDA's order within each group.
    foods.sort((a, b) => Number(a.branded) - Number(b.branded));
    writeCache(query, foods);
    return foods;
  }

  return { search, FoodSearchError };
})();
