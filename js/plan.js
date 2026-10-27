// Nutrition plan page: a questionnaire suggests daily calories and macros,
// the user can change any of them, and saving sets the Calories tab's goals.
// Weights are saved in pounds and typed in the unit chosen at the top.
(() => {
  const { KEYS } = Store;
  const { el } = UI;

  const unit = Units.current();

  const planForm = document.getElementById("plan-form");
  const goalsForm = document.getElementById("goals-form");
  const activitySelect = document.getElementById("activity");
  const explanation = document.getElementById("plan-explanation");
  const macroCheck = document.getElementById("macro-check");
  const goalsError = document.getElementById("goals-error");

  // Each answer: its input, the allowed range, and the message when it's out of range.
  // Weights are typed in the chosen unit, so their range is converted from 50–700 lb.
  const minWeight = Units.fromPounds(50);
  const maxWeight = Units.fromPounds(700);
  const answerFields = {
    age: { input: "age", min: 13, max: 100, message: "Enter an age from 13 to 100." },
    heightFeet: { input: "height-feet", min: 3, max: 8, message: "Enter your height in feet and inches." },
    heightInches: { input: "height-inches", min: 0, max: 11, message: "Inches must be 0 to 11." },
    weightLb: {
      input: "weight",
      min: minWeight,
      max: maxWeight,
      isWeight: true,
      message: `Enter a weight from ${minWeight} to ${maxWeight} ${unit}.`,
    },
    goalWeightLb: {
      input: "goal-weight",
      min: minWeight,
      max: maxWeight,
      isWeight: true,
      message: `Enter a goal weight from ${minWeight} to ${maxWeight} ${unit}.`,
    },
  };
  const errorElements = {
    age: "age-error",
    heightFeet: "height-error",
    heightInches: "height-error",
    weightLb: "weight-error",
    goalWeightLb: "goal-weight-error",
  };
  const goalFields = {
    calories: { input: "goal-calories", min: 800, max: 10000, label: "Calories" },
    protein: { input: "goal-protein", min: 0, max: 600, label: "Protein" },
    carbs: { input: "goal-carbs", min: 0, max: 1500, label: "Carbs" },
    fat: { input: "goal-fat", min: 0, max: 600, label: "Fat" },
  };

  const byId = (id) => document.getElementById(id);

  function readNumber(id, min, max) {
    const input = byId(id);
    const value = Number(input.value);
    const valid = input.value !== "" && value >= min && value <= max;
    input.setAttribute("aria-invalid", valid ? "false" : "true");
    return valid ? value : null;
  }

  // A typed weight in pounds. An unchanged weight keeps its saved pounds, so
  // resubmitting in kg doesn't nudge 184 lb to 184.09 lb.
  function weightInPounds(name, value) {
    const saved = Store.read(KEYS.planAnswers, null);
    if (saved && Units.fromPounds(saved[name]) === value) {
      return saved[name];
    }
    // Kilograms convert to pounds with two decimals, so they show back as typed.
    return Math.round(Units.toPounds(value) * 100) / 100;
  }

  function readAnswers() {
    const answers = {};
    let valid = true;
    Object.values(errorElements).forEach((id) => {
      byId(id).textContent = "";
    });
    for (const [name, field] of Object.entries(answerFields)) {
      const value = readNumber(field.input, field.min, field.max);
      answers[name] = value !== null && field.isWeight ? weightInPounds(name, value) : value;
      if (answers[name] === null) {
        valid = false;
        const errorElement = byId(errorElements[name]);
        errorElement.textContent ||= field.message;
      }
    }
    const sexChoice = planForm.querySelector('input[name="sex"]:checked');
    byId("sex-error").textContent = sexChoice ? "" : "Choose one.";
    if (!sexChoice) {
      valid = false;
    }
    answers.sex = sexChoice ? sexChoice.value : null;
    answers.activity = activitySelect.value;
    return valid ? answers : null;
  }

  function explain(plan, answers) {
    const activity = WorkoutLogic.ACTIVITY_LEVELS[answers.activity];
    const inKg = unit === "kg";
    const goalSentence = {
      lose: `To lose about ${inKg ? "½ kg" : "1 lb"} a week, the plan is 500 calories less than that.`,
      gain: `To gain about ${inKg ? "¼ kg" : "½ lb"} a week, the plan is 250 calories more than that.`,
      maintain: `You're within ${inKg ? "1 kg" : "2 lb"} of your goal, so the plan keeps you where you are.`,
    }[plan.direction];
    const proteinRule = inKg ? "1.8 g per kilogram" : "0.8 g per pound";
    const lines = [
      `At rest your body burns about ${UI.formatNumber(plan.bmr)} calories a day. ` +
        `Being ${activity.label.toLowerCase()} brings that to about ${UI.formatNumber(plan.tdee)}.`,
      goalSentence,
      `Protein is ${proteinRule} of your goal weight, fat is 25% of calories, and carbs fill the rest.`,
    ];
    if (plan.raisedToMinimum) {
      lines.push(
        `The plan was raised to a safe minimum, so weight loss may be slower than ${inKg ? "½ kg" : "1 lb"} a week.`,
      );
    }
    explanation.replaceChildren(
      el("p", { class: "plan-headline" }, "Suggested for you"),
      ...lines.map((line) => el("p", {}, line)),
    );
  }

  function fillGoals(goals) {
    for (const [name, field] of Object.entries(goalFields)) {
      byId(field.input).value = goals[name];
      byId(field.input).setAttribute("aria-invalid", "false");
    }
    goalsError.textContent = "";
    updateMacroCheck();
  }

  // Edited macros may no longer add up to the calorie goal; say so.
  function updateMacroCheck() {
    const grams = {};
    for (const name of ["protein", "carbs", "fat"]) {
      const value = Number(byId(goalFields[name].input).value);
      grams[name] = Number.isFinite(value) ? value : 0;
    }
    const fromMacros = Math.round(WorkoutLogic.macroCalories(grams));
    const calories = Number(byId(goalFields.calories.input).value);
    if (!fromMacros || !calories) {
      macroCheck.textContent = "";
      return;
    }
    const difference = fromMacros - calories;
    const matches = Math.abs(difference) <= 50;
    macroCheck.classList.toggle("warning", !matches);
    macroCheck.textContent = matches
      ? `Your macros add up to ${UI.formatNumber(fromMacros)} calories, matching your goal.`
      : `Your macros add up to ${UI.formatNumber(fromMacros)} calories, ` +
        `${UI.formatNumber(Math.abs(difference))} ${difference > 0 ? "over" : "under"} your calorie goal.`;
  }

  function suggestPlan(event) {
    event.preventDefault();
    const answers = readAnswers();
    if (!answers) {
      const firstInvalid = planForm.querySelector('[aria-invalid="true"]');
      (firstInvalid || planForm.querySelector('input[name="sex"]')).focus();
      return;
    }
    Store.write(KEYS.planAnswers, answers);
    const plan = WorkoutLogic.suggestNutritionPlan({
      ...answers,
      heightInches: answers.heightFeet * 12 + answers.heightInches,
    });
    explain(plan, answers);
    fillGoals(plan);
    byId("goals-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function savePlan(event) {
    event.preventDefault();
    const goals = {};
    let firstError = "";
    for (const [name, field] of Object.entries(goalFields)) {
      goals[name] = readNumber(field.input, field.min, field.max);
      if (goals[name] === null && !firstError) {
        firstError = `${field.label} must be between ${UI.formatNumber(field.min)} and ${UI.formatNumber(field.max)}.`;
      }
    }
    goalsError.textContent = firstError;
    if (firstError) {
      return;
    }
    if (!Store.write(KEYS.nutritionGoals, goals)) {
      UI.showSaveError();
      return;
    }
    // The Calories tab shows a confirmation when it sees this marker.
    location.href = "calories.html#plan-saved";
  }

  function restoreAnswers() {
    const answers = Store.read(KEYS.planAnswers, null);
    if (!answers) {
      return;
    }
    for (const [name, field] of Object.entries(answerFields)) {
      byId(field.input).value = field.isWeight ? Units.fromPounds(answers[name]) : answers[name];
    }
    const sexInput = planForm.querySelector(`input[name="sex"][value="${answers.sex}"]`);
    if (sexInput) {
      sexInput.checked = true;
    }
    activitySelect.value = answers.activity;
  }

  document.querySelectorAll(".weight-unit-label").forEach((label) => {
    label.textContent = unit;
  });
  for (const field of Object.values(answerFields).filter((answerField) => answerField.isWeight)) {
    byId(field.input).min = field.min;
    byId(field.input).max = field.max;
  }
  byId("weight").placeholder = `e.g. ${Units.fromPounds(175)}`;
  byId("goal-weight").placeholder = `e.g. ${Units.fromPounds(165)}`;
  activitySelect.replaceChildren(
    ...Object.entries(WorkoutLogic.ACTIVITY_LEVELS).map(([value, level]) =>
      el("option", { value }, `${level.label}: ${level.description}`),
    ),
  );
  activitySelect.value = "moderate";
  restoreAnswers();
  const savedGoals = Store.read(KEYS.nutritionGoals, null);
  if (savedGoals) {
    fillGoals(savedGoals);
    explanation.replaceChildren(
      el("p", { class: "muted" }, "Your current plan. Change any number, or retake the questions above."),
    );
  }

  planForm.addEventListener("submit", suggestPlan);
  goalsForm.addEventListener("submit", savePlan);
  goalsForm.addEventListener("input", updateMacroCheck);
})();
