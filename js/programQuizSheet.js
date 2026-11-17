// The "Find my program" sheet on the Workouts page's Premade tab: four
// questions, one per screen, then the program ProgramQuiz recommends, with
// buttons to start its first day or save every day as a routine.
const ProgramQuizSheet = (() => {
  const { el } = UI;

  const QUESTIONS = [
    {
      key: "goal",
      title: "What's your main goal?",
      options: [
        { value: "strength", label: "Get stronger", hint: "Lift heavier weights" },
        { value: "muscle", label: "Build muscle", hint: "Get bigger and more defined" },
        { value: "fatLoss", label: "Lose fat", hint: "Burn more while keeping muscle" },
        { value: "general", label: "Stay fit", hint: "Feel good and stay healthy" },
      ],
    },
    {
      key: "days",
      title: "How many days a week can you lift?",
      options: ProgramQuiz.DAY_CHOICES.map((days) => ({ value: days, label: `${days} days` })),
    },
    {
      key: "experience",
      title: "How long have you been lifting?",
      options: [
        { value: "new", label: "Just starting", hint: "New to the gym" },
        { value: "some", label: "Under a year", hint: "Know the main lifts" },
        { value: "experienced", label: "A year or more", hint: "Train regularly" },
      ],
    },
    {
      key: "minutes",
      title: "How long is a workout?",
      options: ProgramQuiz.MINUTES.map((minutes) => ({ value: minutes, label: `${minutes} min` })),
    },
  ];

  // onStart(plan) starts the plan's first day; onSave(plan) saves its days as
  // routines and resolves to true if they were saved.
  function open({ onStart, onSave }) {
    const answers = {};
    let step = 0;
    const body = el("div", { class: "quiz-body", "aria-live": "polite" });
    const closeButton = el("button", { type: "button", class: "sheet-close", "aria-label": "Close" }, "×");
    const sheet = el(
      "dialog",
      { class: "sheet quiz-sheet", "aria-labelledby": "quiz-sheet-title" },
      el("div", { class: "sheet-header" }, el("h2", { id: "quiz-sheet-title" }, "Find my program"), closeButton),
      body,
    );

    function close() {
      sheet.close();
      sheet.remove();
    }

    function show(...children) {
      body.replaceChildren(...children.flat().filter((child) => child != null));
    }

    function drawQuestion() {
      const question = QUESTIONS[step];
      const isShortList = !question.options[0].hint;
      show(
        el(
          "div",
          { class: "quiz-progress", "aria-hidden": "true" },
          QUESTIONS.map((_, index) => el("i", { class: index <= step ? "on" : "" })),
        ),
        el("p", { class: "quiz-step" }, `Question ${step + 1} of ${QUESTIONS.length}`),
        el("h3", { class: "quiz-title" }, question.title),
        el(
          "div",
          { class: isShortList ? "quiz-answers two-columns" : "quiz-answers" },
          question.options.map((option) =>
            el(
              "button",
              {
                type: "button",
                class: "quiz-answer",
                "aria-pressed": String(answers[question.key] === option.value),
                onclick: () => {
                  answers[question.key] = option.value;
                  step += 1;
                  draw();
                },
              },
              el("b", {}, option.label),
              option.hint ? el("span", {}, option.hint) : null,
            ),
          ),
        ),
        step > 0
          ? el(
              "button",
              {
                type: "button",
                class: "back-button",
                onclick: () => {
                  step -= 1;
                  draw();
                },
              },
              "← Back",
            )
          : null,
      );
      body.querySelector(".quiz-answer").focus();
    }

    function drawResult() {
      const plan = ProgramQuiz.recommend(answers);
      show(
        el(
          "div",
          { class: "quiz-result" },
          el("small", {}, "Your program"),
          el("strong", {}, plan.program),
          el("p", {}, plan.reason),
        ),
        el("p", { class: "muted quiz-runner-up" }, "Also good: ", el("b", {}, plan.runnerUp)),
        plan.notes.length > 0 ? el("ul", { class: "quiz-notes" }, plan.notes.map((note) => el("li", {}, note))) : null,
        plan.days.map((day, index) =>
          el(
            "details",
            { class: "premade-day quiz-day", open: index === 0 },
            el("summary", {}, day.name, el("span", {}, UI.plural(day.exercises.length, "exercise"))),
            el(
              "ul",
              { class: "premade-exercises" },
              day.exercises.map((exercise) =>
                el(
                  "li",
                  {},
                  el("span", {}, exercise.name),
                  el("span", { class: "premade-sets" }, `${exercise.sets} × ${exercise.reps}`),
                ),
              ),
            ),
          ),
        ),
        el(
          "div",
          { class: "button-row quiz-actions" },
          el(
            "button",
            {
              type: "button",
              class: "button",
              onclick: () => {
                close();
                onStart(plan);
              },
            },
            `Start ${plan.days[0].name}`,
          ),
          el(
            "button",
            {
              type: "button",
              class: "button-secondary",
              onclick: async () => {
                if (await onSave(plan)) {
                  close();
                }
              },
            },
            "Save to routines",
          ),
        ),
        el(
          "button",
          {
            type: "button",
            class: "back-button",
            onclick: () => {
              step = 0;
              draw();
            },
          },
          "Change my answers",
        ),
      );
    }

    function draw() {
      if (step < QUESTIONS.length) {
        drawQuestion();
      } else {
        drawResult();
      }
    }

    closeButton.addEventListener("click", close);
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
    sheet.showModal();
    draw();
  }

  return { open };
})();
