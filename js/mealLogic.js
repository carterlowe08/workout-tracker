// Saved meals and copy yesterday: which foods to copy, and turning foods into
// today's diary entries and back. Nothing here touches the page.
const MealLogic = (() => {
  const MAX_NAME_LENGTH = 30;

  function yesterdaysFoods(foodLog, mealId, todayKey) {
    const yesterday = WorkoutLogic.addDays(todayKey, -1);
    return foodLog.filter((entry) => entry.date === yesterday && entry.meal === mealId);
  }

  // A food without the parts that tie it to one day's diary.
  function plainFood({ id: _id, date: _date, meal: _meal, ...food }) {
    return food;
  }

  // New diary entries for a list of foods (or entries from another day).
  function asEntries(foods, { date, meal, newId }) {
    return foods.map((food) => ({ ...plainFood(food), id: newId(), date, meal }));
  }

  const cleanName = (name) => name.trim().replace(/\s+/g, " ");

  function mealFrom(name, entries, id) {
    return { id, name: cleanName(name), foods: entries.map(plainFood) };
  }

  // What's wrong with a new meal's name, or "" when it's fine.
  function nameProblem(name, savedMeals) {
    const cleaned = cleanName(name);
    if (cleaned === "") {
      return "Enter a name for the meal.";
    }
    const isTaken = savedMeals.some((meal) => meal.name.toLowerCase() === cleaned.toLowerCase());
    return isTaken ? `You already have a meal called "${cleaned}".` : "";
  }

  // Saved meals that can be shown and logged, in case a backup was damaged.
  function usable(savedMeals) {
    if (!Array.isArray(savedMeals)) {
      return [];
    }
    return savedMeals.filter(
      (meal) =>
        typeof meal?.name === "string" &&
        Array.isArray(meal.foods) &&
        meal.foods.length > 0 &&
        meal.foods.every((food) => typeof food?.name === "string" && Number.isFinite(food.calories)),
    );
  }

  return { MAX_NAME_LENGTH, yesterdaysFoods, asEntries, mealFrom, nameProblem, usable };
})();
