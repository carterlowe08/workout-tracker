// Ready-made programs shown on the Workouts page's "Premade" tab. Each day
// becomes a workout when started. Exercise names match the exercise list.
const PREMADE_PROGRAMS = [
  {
    name: "5×5 Strength",
    description:
      "A beginner barbell program. Alternate Workout A and B three days a week (for example Mon/Wed/Fri). " +
      "When you finish every set, add 5 lb next time (10 lb on deadlifts).",
    days: [
      {
        name: "5×5 Workout A",
        exercises: [
          { name: "Back Squat", sets: 5, reps: 5 },
          { name: "Bench Press", sets: 5, reps: 5 },
          { name: "Barbell Row", sets: 5, reps: 5 },
        ],
      },
      {
        name: "5×5 Workout B",
        exercises: [
          { name: "Back Squat", sets: 5, reps: 5 },
          { name: "Overhead Press", sets: 5, reps: 5 },
          { name: "Deadlift", sets: 1, reps: 5 },
        ],
      },
    ],
  },
  {
    name: "Push / Pull / Legs",
    description:
      "A muscle-building split: chest, shoulders and triceps; back and biceps; then legs. " +
      "Run it once a week (3 days) or twice (6 days).",
    days: [
      {
        name: "Push Day",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 8 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Pull Day",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Pull-Up", sets: 3, reps: 8 },
          { name: "Barbell Row", sets: 3, reps: 8 },
          { name: "Face Pull", sets: 3, reps: 15 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Leg Day",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 8 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Leg Press", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
  {
    name: "Upper / Lower",
    description:
      "Four days a week: upper body, lower body, rest, then upper and lower again (for example Mon/Tue/Thu/Fri). " +
      "A and B use different lifts, so each muscle gets two kinds of work a week.",
    days: [
      {
        name: "Upper A",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 6 },
          { name: "Barbell Row", sets: 4, reps: 6 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Lat Pulldown", sets: 3, reps: 10 },
          { name: "Barbell Curl", sets: 2, reps: 12 },
          { name: "Tricep Pushdown", sets: 2, reps: 12 },
        ],
      },
      {
        name: "Lower A",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 6 },
          { name: "Romanian Deadlift", sets: 3, reps: 8 },
          { name: "Leg Press", sets: 3, reps: 10 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 12 },
        ],
      },
      {
        name: "Upper B",
        exercises: [
          { name: "Incline Dumbbell Press", sets: 4, reps: 8 },
          { name: "Pull-Up", sets: 4, reps: 8 },
          { name: "Dumbbell Shoulder Press", sets: 3, reps: 10 },
          { name: "Seated Cable Row", sets: 3, reps: 10 },
          { name: "Hammer Curl", sets: 2, reps: 12 },
          { name: "Skull Crusher", sets: 2, reps: 12 },
        ],
      },
      {
        name: "Lower B",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Front Squat", sets: 3, reps: 8 },
          { name: "Bulgarian Split Squat", sets: 3, reps: 10 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Seated Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
  {
    name: "Full Body",
    description:
      "Three days a week with a rest day between (for example Mon/Wed/Fri), working every muscle each time. " +
      "Good when you can't get to the gym more often.",
    days: [
      {
        name: "Full Body A",
        exercises: [
          { name: "Back Squat", sets: 3, reps: 8 },
          { name: "Bench Press", sets: 3, reps: 8 },
          { name: "Barbell Row", sets: 3, reps: 8 },
          { name: "Lateral Raise", sets: 2, reps: 15 },
          { name: "Hanging Leg Raise", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Full Body B",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Pull-Up", sets: 3, reps: 8 },
          { name: "Walking Lunge", sets: 3, reps: 10 },
          { name: "Cable Crunch", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Full Body C",
        exercises: [
          { name: "Front Squat", sets: 3, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Seated Cable Row", sets: 3, reps: 10 },
          { name: "Hip Thrust", sets: 3, reps: 10 },
          { name: "Hammer Curl", sets: 2, reps: 12 },
        ],
      },
    ],
  },
  {
    name: "Arnold Split",
    description:
      "Six days a week: chest and back, shoulders and arms, then legs, twice through with Sunday off. " +
      "A lot of volume, so it suits lifters who already train regularly.",
    days: [
      {
        name: "Arnold Chest & Back",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 8 },
          { name: "Pull-Up", sets: 4, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Barbell Row", sets: 3, reps: 10 },
          { name: "Chest Fly", sets: 3, reps: 12 },
          { name: "Lat Pulldown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Arnold Shoulders & Arms",
        exercises: [
          { name: "Overhead Press", sets: 4, reps: 8 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
          { name: "Skull Crusher", sets: 3, reps: 10 },
          { name: "Hammer Curl", sets: 3, reps: 12 },
          { name: "Dip", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Arnold Legs",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 8 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Leg Press", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
          { name: "Hanging Leg Raise", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    name: "5/3/1",
    description:
      "Four days a week, one main lift a day. Set a training max at 90% of your 1-rep max. The main lift's 3 sets " +
      "change each week: week 1 is 5 reps at 65/75/85%, week 2 is 3 reps at 70/80/90%, week 3 is 5, 3 and as many as " +
      "you can at 75/85/95%, and week 4 is light. Then add 5 lb to the training max for bench and press, 10 lb for " +
      "squat and deadlift. The 5 × 10 lifts after it use a lighter weight.",
    days: [
      {
        name: "5/3/1 Squat",
        exercises: [
          { name: "Back Squat", sets: 3, reps: 5 },
          { name: "Leg Press", sets: 5, reps: 10 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Hanging Leg Raise", sets: 3, reps: 10 },
        ],
      },
      {
        name: "5/3/1 Bench",
        exercises: [
          { name: "Bench Press", sets: 3, reps: 5 },
          { name: "Incline Dumbbell Press", sets: 5, reps: 10 },
          { name: "Barbell Row", sets: 5, reps: 10 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "5/3/1 Deadlift",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Romanian Deadlift", sets: 5, reps: 10 },
          { name: "Walking Lunge", sets: 3, reps: 10 },
          { name: "Cable Crunch", sets: 3, reps: 12 },
        ],
      },
      {
        name: "5/3/1 Press",
        exercises: [
          { name: "Overhead Press", sets: 3, reps: 5 },
          { name: "Dumbbell Shoulder Press", sets: 5, reps: 10 },
          { name: "Pull-Up", sets: 5, reps: 8 },
          { name: "Barbell Curl", sets: 3, reps: 12 },
        ],
      },
    ],
  },
  {
    name: "Bro Split",
    description:
      "Five days a week, one muscle group a day, so each one gets a long session and a full week to recover.",
    days: [
      {
        name: "Chest Day",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 4, reps: 10 },
          { name: "Chest Fly", sets: 3, reps: 12 },
          { name: "Dip", sets: 3, reps: 10 },
          { name: "Push-Up", sets: 2, reps: 15 },
        ],
      },
      {
        name: "Back Day",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Pull-Up", sets: 4, reps: 8 },
          { name: "Barbell Row", sets: 4, reps: 8 },
          { name: "Lat Pulldown", sets: 3, reps: 12 },
          { name: "Seated Cable Row", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Shoulder Day",
        exercises: [
          { name: "Overhead Press", sets: 4, reps: 8 },
          { name: "Dumbbell Shoulder Press", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 4, reps: 12 },
          { name: "Face Pull", sets: 3, reps: 15 },
        ],
      },
      {
        name: "Arm Day",
        exercises: [
          { name: "Barbell Curl", sets: 4, reps: 10 },
          { name: "Skull Crusher", sets: 4, reps: 10 },
          { name: "Hammer Curl", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Bro Leg Day",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 8 },
          { name: "Leg Press", sets: 4, reps: 10 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Leg Extension", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
];
